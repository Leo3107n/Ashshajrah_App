/**
 * Read-only Student integration verification.
 *
 * The script discovers an active development Student account whose legacy
 * password is reversible, authenticates through the same NextAuth flow used by
 * the mobile app, checks every Student data surface, verifies an Admin boundary,
 * and signs out. It never logs credentials or mutates application records.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = String(process.env.VERIFY_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const cookies = new Map();
const results = [];

function captureCookies(response) {
  const values = response.headers.getSetCookie?.() || [];
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    if (cookieValue) cookies.set(name, cookieValue);
    else cookies.delete(name);
  }
}

function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (cookies.size) headers.set("Cookie", cookieHeader());
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers,
  });
  captureCookies(response);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

function check(name, condition, detail) {
  results.push({ name, passed: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}: ${detail}`);
}

async function authenticate(identifier, password) {
  const csrfResult = await request("/api/auth/csrf");
  check("CSRF token", csrfResult.response.ok && csrfResult.data?.csrfToken, `HTTP ${csrfResult.response.status}`);

  const form = new URLSearchParams({
    csrfToken: csrfResult.data.csrfToken,
    identifier,
    password,
    callbackUrl: `${baseUrl}/`,
    redirect: "false",
    json: "true",
  });
  const callback = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: form,
  });
  check("Student authentication", callback.response.status < 400, `HTTP ${callback.response.status}`);

  const session = await request("/api/auth/session");
  check("Authenticated session", session.response.ok && session.data?.user?.role === "student", `HTTP ${session.response.status}`);
}

const surfaces = [
  ["Dashboard", "/api/student/dashboard", (data) => data && typeof data === "object"],
  ["Classes", "/api/student/classes", (data) => Array.isArray(data?.items)],
  ["Calendar", "/api/student/calendar", (data) => data && typeof data === "object"],
  ["Calendar lectures", "/api/student/calendar-lectures?range=all", (data) => Array.isArray(data?.items)],
  ["Lectures", "/api/student/lectures?range=all", (data) => Array.isArray(data?.items)],
  ["Homework", "/api/student/homework", (data) => Array.isArray(data?.items)],
  ["Attendance", "/api/student/attendance", (data) => data && typeof data === "object"],
  ["Progress reports", "/api/student/progress-reports", (data) => data && typeof data === "object"],
  ["Timeline and teacher notes", "/api/student/timeline?range=all", (data) => Array.isArray(data?.notes)],
  ["Conversations", "/api/notes/threads", (data) => Array.isArray(data?.items)],
  ["Notifications", "/api/notifications?limit=100", (data) => Array.isArray(data?.items)],
  ["Announcements", "/api/headlines/active", (data) => Array.isArray(data?.headlines)],
  ["Fees", "/api/student/fees", (data) => Array.isArray(data?.items)],
  ["Profile", "/api/student/profile", (data) => Boolean(data?.profile?.student_id)],
  ["Payment access state", "/api/payment-access-status", (data) => typeof data?.blocked === "boolean"],
];

async function main() {
  const [account] = await prisma.$queryRaw`
    SELECT
      COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(u.username), ''), NULLIF(TRIM(u.phone), '')) AS identifier,
      u.password_hash
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    INNER JOIN student_profiles sp ON sp.user_id = u.id
    WHERE LOWER(r.name) = 'student'
      AND LOWER(u.status::text) = 'active'
      AND COALESCE(u.password_hash, '') <> ''
      AND u.password_hash NOT LIKE '$2%'
    ORDER BY u.created_at ASC NULLS LAST
    LIMIT 1
  `;

  check("Development Student account", account?.identifier && account?.password_hash, "No active reversible-password Student account is available.");

  const anonymous = await request("/api/student/profile");
  check("Anonymous route protection", anonymous.response.status === 401, `Expected 401, received ${anonymous.response.status}`);

  await authenticate(account.identifier, account.password_hash);

  for (const [name, path, shape] of surfaces) {
    const result = await request(path);
    check(name, result.response.ok && shape(result.data), `HTTP ${result.response.status} or unexpected response shape`);
  }

  const forbidden = await request("/api/admin/users");
  check("Student/Admin permission boundary", forbidden.response.status === 403, `Expected 403, received ${forbidden.response.status}`);

  const csrf = await request("/api/auth/csrf");
  const signout = await request("/api/auth/signout", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.data?.csrfToken || "",
      callbackUrl: `${baseUrl}/login`,
      redirect: "false",
      json: "true",
    }),
  });
  check("Logout request", signout.response.status < 400, `HTTP ${signout.response.status}`);

  const expired = await request("/api/auth/session");
  check("Session invalidated", !expired.data?.user, "Session remained authenticated after logout.");

  const passed = results.filter((item) => item.passed).length;
  console.log(`Student integration verification passed: ${passed}/${results.length} checks.`);
  for (const result of results) console.log(`PASS  ${result.name}`);
}

main()
  .catch((error) => {
    console.error(`Student integration verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
