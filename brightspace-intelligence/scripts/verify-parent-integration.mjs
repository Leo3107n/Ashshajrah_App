/**
 * Read-only Parent integration verification.
 *
 * Discovers an active local Parent account with a reversible development
 * password, authenticates through the same NextAuth credentials flow used by
 * mobile, checks Parent and shared data surfaces (including child scoping),
 * verifies role boundaries, and signs out. Credentials are never printed and
 * application records are never mutated.
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
    signal: AbortSignal.timeout(20_000),
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

  const callback = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({
      csrfToken: csrfResult.data.csrfToken,
      identifier,
      password,
      callbackUrl: `${baseUrl}/`,
      redirect: "false",
      json: "true",
    }),
  });
  check("Parent authentication", callback.response.status < 400, `HTTP ${callback.response.status}`);

  const session = await request("/api/auth/session");
  check("Authenticated Parent session", session.response.ok && session.data?.user?.role === "parent", `HTTP ${session.response.status}`);
}

const surfaces = [
  ["Dashboard", "/api/parent/dashboard", (data) => Array.isArray(data?.children) && data?.stats && Array.isArray(data?.upcoming)],
  ["Children", "/api/parent/children", (data) => Array.isArray(data?.children)],
  ["Classes and calendar", "/api/parent/classes?range=all", (data) => Array.isArray(data?.items) && Array.isArray(data?.children)],
  ["Lectures", "/api/parent/lectures?range=all", (data) => Array.isArray(data?.items) && Array.isArray(data?.children)],
  ["Attendance", "/api/parent/attendance", (data) => Array.isArray(data?.items) && Array.isArray(data?.children) && typeof data?.summary?.attendance_percentage === "number"],
  ["Homework", "/api/parent/homework", (data) => Array.isArray(data?.items)],
  ["Fees", "/api/parent/fees", (data) => Array.isArray(data?.items)],
  ["Parent notes", "/api/parent/notes", (data) => Array.isArray(data?.notes) && Array.isArray(data?.children)],
  ["Conversations", "/api/notes/threads", (data) => Array.isArray(data?.items)],
  ["Notifications", "/api/notifications?limit=100", (data) => Array.isArray(data?.items) && data?.summary],
  ["Announcements", "/api/headlines/active", (data) => Array.isArray(data?.headlines)],
  ["Profile", "/api/parent/profile", (data) => Boolean(data?.profile?.parent_profile_id)],
  ["Payment access state", "/api/payment-access-status", (data) => typeof data?.blocked === "boolean"],
];

async function main() {
  const [account] = await prisma.$queryRaw`
    SELECT
      COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(u.username), ''), NULLIF(TRIM(u.phone), '')) AS identifier,
      u.password_hash,
      COUNT(DISTINCT sp.student_id)::int AS child_count
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    INNER JOIN parent_profiles pp ON pp.user_id = u.id
    LEFT JOIN student_parents sp ON sp.parent_id = pp.id
    WHERE LOWER(r.name) = 'parent'
      AND LOWER(u.status::text) = 'active'
      AND COALESCE(u.password_hash, '') <> ''
      AND u.password_hash NOT LIKE '$2%'
    GROUP BY u.id, u.email, u.username, u.phone, u.password_hash, u.created_at
    ORDER BY CASE WHEN COUNT(DISTINCT sp.student_id) >= 2 THEN 0 ELSE 1 END,
             COUNT(DISTINCT sp.student_id) DESC,
             CASE WHEN u.email = 'parent@ashshajrah.local' THEN 1 ELSE 0 END,
             u.created_at ASC NULLS LAST
    LIMIT 1
  `;

  check("Parent account available", account?.identifier && account?.password_hash, "No active reversible-password Parent account is available.");
  check("Real multi-child Parent account", Number(account?.child_count || 0) >= 2, `Expected 2+ linked children, found ${account?.child_count ?? 0}.`);

  const anonymous = await request("/api/parent/profile");
  check("Anonymous route protection", anonymous.response.status === 401, `Expected 401, received ${anonymous.response.status}`);

  await authenticate(account.identifier, account.password_hash);

  for (const [name, path, shape] of surfaces) {
    const result = await request(path);
    check(name, result.response.ok && shape(result.data), `HTTP ${result.response.status} or unexpected response shape`);
  }

  const childrenResult = await request("/api/parent/children");
  const children = Array.isArray(childrenResult.data?.children) ? childrenResult.data.children : [];
  const scopedChildren = children.slice(0, Math.min(children.length, 2));
  check("Multi-child listing available", children.length >= 2, `Expected 2+ child records, found ${children.length}.`);

  for (const child of scopedChildren) {
    const childId = child?.id;
    check("Linked child available", Boolean(childId), "A listed child is missing its identifier.");

    const scopedSurfaces = [
      [`Child-scoped dashboard (${childId})`, `/api/parent/dashboard?childId=${encodeURIComponent(childId)}`],
      [`Child-scoped attendance (${childId})`, `/api/parent/attendance?childId=${encodeURIComponent(childId)}`],
      [`Child-scoped homework (${childId})`, `/api/parent/homework?childId=${encodeURIComponent(childId)}`],
      [`Child-scoped fees (${childId})`, `/api/parent/fees?childId=${encodeURIComponent(childId)}`],
      [`Child-scoped parent notes (${childId})`, `/api/parent/notes?childId=${encodeURIComponent(childId)}`],
    ];
    for (const [name, path] of scopedSurfaces) {
      const result = await request(path);
      check(name, result.response.ok && result.data && typeof result.data === "object", `HTTP ${result.response.status}`);
    }
  }

  const adminBoundary = await request("/api/admin/users");
  check("Parent/Admin permission boundary", adminBoundary.response.status === 403, `Expected 403, received ${adminBoundary.response.status}`);

  const studentBoundary = await request("/api/student/profile");
  check("Parent/Student permission boundary", studentBoundary.response.status === 403, `Expected 403, received ${studentBoundary.response.status}`);

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
  console.log(`Parent integration verification passed: ${passed}/${results.length} checks.`);
  for (const result of results) console.log(`PASS  ${result.name}`);
}

main()
  .catch((error) => {
    console.error(`Parent integration verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
