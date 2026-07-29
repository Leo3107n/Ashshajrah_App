/**
 * Central API client for the Ash-Shajrah mobile application.
 *
 * Usage:
 *   import api, { ApiError } from "../src/api";
 *
 *   const dashboard = await api.student.dashboard();
 *   await api.auth.signIn({ identifier, password });
 *
 * Authentication uses the existing NextAuth cookie session. Native fetch cookie
 * persistence varies between Expo Go/platform versions, so native responses are
 * also mirrored into a native cookie jar. Session cookies are encrypted with
 * SecureStore so authenticated sessions can survive an app restart. Passwords
 * are never retained.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = String(configuredBaseUrl || "")
  .trim()
  .replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 30_000;
const unauthorizedListeners = new Set();
const nativeCookies = new Map();
const COOKIE_STORE_KEY = "ash_shajrah_auth_cookies";
let nativeCookiesHydrated = false;

function isNativeRuntime() {
  return Platform.OS !== "web";
}

function splitSetCookieHeader(value) {
  if (!value) return [];

  // A comma inside an Expires attribute is not a cookie separator. Auth.js may
  // return several Set-Cookie values as one combined header in React Native.
  return String(value).split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
}

function rememberResponseCookies(response) {
  if (!isNativeRuntime()) return;

  const getSetCookie = response.headers?.getSetCookie;
  const values =
    typeof getSetCookie === "function"
      ? getSetCookie.call(response.headers)
      : splitSetCookieHeader(response.headers?.get?.("set-cookie"));

  for (const value of values || []) {
    const rawCookie = String(value);
    const pair = rawCookie.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;

    const name = pair.slice(0, separator).trim();
    const cookieValue = pair.slice(separator + 1).trim();
    const maxAgeExpired = /;\s*max-age=0(?:;|$)/i.test(rawCookie);
    const expiresMatch = rawCookie.match(/;\s*expires=([^;]+)/i);
    const expiresAt = expiresMatch ? Date.parse(expiresMatch[1]) : Number.NaN;
    const dateExpired = Number.isFinite(expiresAt) && expiresAt <= Date.now();

    if (!cookieValue || maxAgeExpired || dateExpired) nativeCookies.delete(name);
    else nativeCookies.set(name, cookieValue);
  }

  SecureStore.setItemAsync(
    COOKIE_STORE_KEY,
    JSON.stringify(Object.fromEntries(nativeCookies))
  ).catch(() => {
    // Native cookie persistence is a convenience; the in-memory session remains valid.
  });
}

function nativeCookieHeader() {
  if (!isNativeRuntime() || nativeCookies.size === 0) return "";
  return [...nativeCookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function clearNativeCookies() {
  nativeCookies.clear();
  nativeCookiesHydrated = true;
  if (isNativeRuntime()) {
    SecureStore.deleteItemAsync(COOKIE_STORE_KEY).catch(() => {});
  }
}

async function restoreNativeCookies() {
  if (!isNativeRuntime() || nativeCookiesHydrated) return;
  nativeCookiesHydrated = true;
  try {
    const stored = await SecureStore.getItemAsync(COOKIE_STORE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    Object.entries(parsed || {}).forEach(([name, value]) => {
      if (name && value) nativeCookies.set(name, String(value));
    });
  } catch {
    nativeCookies.clear();
  }
}

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.code = options.code ?? null;
    this.data = options.data ?? null;
    this.url = options.url ?? "";
    this.isNetworkError = Boolean(options.isNetworkError);
  }
}

/**
 * Subscribe to expired/invalid authenticated sessions. The AuthProvider uses
 * this to clear stale user state whenever a protected endpoint returns 401.
 */
export function onUnauthorized(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("onUnauthorized requires a function.");
  }

  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized(error) {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener(error);
    } catch {
      // A UI listener must never prevent the original API error from surfacing.
    }
  });
}

function assertConfigured() {
  if (!API_BASE_URL || API_BASE_URL.includes("your-brightspace-domain.com")) {
    throw new ApiError(
      "EXPO_PUBLIC_API_URL is not configured. Set it to the public URL of the Next.js backend.",
      { code: "API_URL_NOT_CONFIGURED" }
    );
  }
}

function encodePath(value) {
  if (value === undefined || value === null || value === "") {
    throw new ApiError("A required API path parameter is missing.", {
      code: "MISSING_PATH_PARAMETER",
    });
  }

  return encodeURIComponent(String(value));
}

function withQuery(path, query) {
  if (!query || typeof query !== "object") return path;

  const search = Object.entries(query)
    .flatMap(([key, value]) => {
      if (value === undefined || value === null || value === "") return [];
      const values = Array.isArray(value) ? value : [value];
      return values.map(
        (item) => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`
      );
    })
    .join("&");

  return search ? `${path}${path.includes("?") ? "&" : "?"}${search}` : path;
}

function isFormData(value) {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function extractMessage(data, fallback) {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (!data || typeof data !== "object") return fallback;

  return (
    data.message ||
    data.error?.message ||
    (typeof data.error === "string" ? data.error : "") ||
    data.detail ||
    fallback
  );
}

async function parseResponse(response, responseType) {
  if (response.status === 204) return null;
  if (responseType === "response") return response;
  if (responseType === "blob") return response.blob();
  if (responseType === "text") return response.text();

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Low-level request method. Use this for a newly-added backend route until a
 * named endpoint helper is added below.
 */
export async function request(path, options = {}) {
  assertConfigured();

  const {
    method = "GET",
    query,
    body,
    headers: suppliedHeaders,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    responseType = "json",
    signal,
  } = options;

  const url = `${API_BASE_URL}${withQuery(path, query)}`;
  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const headers = {
    Accept: "application/json",
    ...suppliedHeaders,
  };
  const cookie = nativeCookieHeader();
  if (cookie && !headers.Cookie) headers.Cookie = cookie;

  let requestBody;
  if (body !== undefined && body !== null) {
    if (isFormData(body) || typeof body === "string") {
      requestBody = body;
    } else {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      requestBody = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: requestBody,
      credentials: "include",
      signal: controller.signal,
    });
    rememberResponseCookies(response);
    const data = await parseResponse(response, responseType);

    if (!response.ok) {
      const apiError = new ApiError(
        extractMessage(data, `Request failed with status ${response.status}.`),
        {
          status: response.status,
          code: data?.code || data?.error?.code || null,
          data,
          url,
        }
      );

      if (response.status === 401) notifyUnauthorized(apiError);
      throw apiError;
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error?.name === "AbortError") {
      throw new ApiError(
        didTimeout ? "The request timed out. Please try again." : "The request was cancelled.",
        {
          code: didTimeout ? "REQUEST_TIMEOUT" : "REQUEST_CANCELLED",
          url,
          isNetworkError: didTimeout,
        }
      );
    }

    throw new ApiError(
      "Unable to connect to the server. Check your internet connection and API URL.",
      {
        code: "NETWORK_ERROR",
        data: error,
        url,
        isNetworkError: true,
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

const get = (path, query, options) =>
  request(path, { ...options, method: "GET", query });
const post = (path, body, options) =>
  request(path, { ...options, method: "POST", body });
const put = (path, body, options) =>
  request(path, { ...options, method: "PUT", body });
const patch = (path, body, options) =>
  request(path, { ...options, method: "PATCH", body });
const remove = (path, body, options) =>
  request(path, { ...options, method: "DELETE", body });

export const authApi = {
  restoreCookies: restoreNativeCookies,
  session: () => get("/api/auth/session"),
  csrf: () => get("/api/auth/csrf"),
  providers: () => get("/api/auth/providers"),

  async signIn({ identifier, password, callbackUrl = "/" }) {
    const csrf = await authApi.csrf();
    if (!csrf?.csrfToken) {
      throw new ApiError("The server did not provide a CSRF token.", {
        code: "MISSING_CSRF_TOKEN",
      });
    }

    const form = [
      ["csrfToken", csrf.csrfToken],
      ["identifier", identifier],
      ["password", password],
      ["callbackUrl", `${API_BASE_URL}${callbackUrl}`],
      ["redirect", "false"],
      ["json", "true"],
    ]
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");

    const result = await post("/api/auth/callback/credentials", form, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
    });

    if (result?.error) {
      throw new ApiError(result.error, {
        status: 401,
        code: result.code || "AUTHENTICATION_FAILED",
        data: result,
      });
    }

    const session = await authApi.session();
    if (!session?.user) {
      throw new ApiError("Login succeeded but no mobile session was established.", {
        status: 401,
        code: "SESSION_NOT_ESTABLISHED",
        data: result,
      });
    }

    return session;
  },

  async signOut() {
    const csrf = await authApi.csrf();
    const form = [
      ["csrfToken", csrf?.csrfToken || ""],
      ["callbackUrl", `${API_BASE_URL}/login`],
      ["redirect", "false"],
      ["json", "true"],
    ]
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");

    try {
      return await post("/api/auth/signout", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } finally {
      clearNativeCookies();
    }
  },
};

export const publicApi = {
  admissionFormOptions: (query) =>
    get("/api/public/admission-form-options", query),
  locationOptions: (query) => get("/api/public/location-options", query),
  interestedStudent: (token) =>
    get(`/api/public/interested-students/${encodePath(token)}`),
  submitRegistrationLead: (data) =>
    post("/api/public/registration-leads", data, { timeoutMs: 60_000 }),
  uploadAdmissionFile: (formData) =>
    post("/api/public/admission-file-upload", formData, { timeoutMs: 60_000 }),
  submitScholarship: (data) =>
    post("/api/public/admission-next-step/scholarship", data),
  contactUs: (data) => post("/api/public/contact-us", data),
};

export const paymentApi = {
  voucher: (voucherNo) => get(`/api/payment/${encodePath(voucherNo)}`),
  submit: (formData) =>
    post("/api/payment/submit", formData, { timeoutMs: 60_000 }),
  accessStatus: (query) => get("/api/payment-access-status", query),
  monthlyFeeStatus: (query) => get("/api/monthly-fee-status", query),
};

export const sharedApi = {
  activeHeadlines: () => get("/api/headlines/active"),
  filePreview: (query) => get("/api/file-preview", query),

  internalEvents: {
    list: (query) => get("/api/internal-events", query),
    create: (data) => post("/api/internal-events", data),
    syncRecording: (id, data = {}) =>
      post(`/api/internal-events/${encodePath(id)}/recording-sync`, data),
  },

  notes: {
    threads: (query) => get("/api/notes/threads", query),
    createThread: (data) => post("/api/notes/threads", data),
    updateThread: (id, data) =>
      patch(`/api/notes/threads/${encodePath(id)}`, data),
    deleteThread: (id) =>
      remove(`/api/notes/threads/${encodePath(id)}`),
    messages: (threadId, query) =>
      get(`/api/notes/threads/${encodePath(threadId)}/messages`, query),
    sendMessage: (threadId, data) =>
      post(`/api/notes/threads/${encodePath(threadId)}/messages`, data),
  },
};

export const teacherApi = {
  dashboard: (query) => get("/api/teacher/dashboard", query),
  profile: () => get("/api/teacher/profile"),
  students: (query) => get("/api/teacher/students", query),
  classes: (query) => get("/api/teacher/classes", query),
  calendarLectures: (query) => get("/api/teacher/calendar-lectures", query),

  attendance: {
    list: (query) => get("/api/teacher/attendance", query),
    save: (data) => post("/api/teacher/attendance", data),
  },

  lectures: {
    list: (query) => get("/api/teacher/lectures", query),
    detail: (id, query) =>
      get(`/api/teacher/lectures/${encodePath(id)}`, query),
    update: (id, data) =>
      patch(`/api/teacher/lectures/${encodePath(id)}`, data),
    action: (id, data) =>
      post(`/api/teacher/lectures/${encodePath(id)}`, data),
    submitAttendance: (id, data) =>
      post(`/api/teacher/lectures/${encodePath(id)}/attendance`, data),
    submitCompletionReport: (id, data) =>
      post(`/api/teacher/lectures/${encodePath(id)}/completion-report`, data),
  },

  homework: {
    list: (query) => get("/api/teacher/homework", query),
    create: (data) => post("/api/teacher/homework", data),
    update: (data) => patch("/api/teacher/homework", data),
    submissions: (query) =>
      get("/api/teacher/homework/submissions", query),
    reviewSubmission: (id, data) =>
      patch(`/api/teacher/homework/submissions/${encodePath(id)}`, data),
  },

  notes: {
    list: (query) => get("/api/teacher/notes", query),
    create: (data) => post("/api/teacher/notes", data),
    update: (id, data) =>
      patch(`/api/teacher/notes/${encodePath(id)}`, data),
    delete: (id) => remove(`/api/teacher/notes/${encodePath(id)}`),
  },
};

export const studentApi = {
  dashboard: (query) => get("/api/student/dashboard", query),
  classes: (query) => get("/api/student/classes", query),
  attendance: (query) => get("/api/student/attendance", query),
  fees: (query) => get("/api/student/fees", query),
  timeline: (query) => get("/api/student/timeline", query),
  calendar: (query) => get("/api/student/calendar", query),
  calendarLectures: (query) => get("/api/student/calendar-lectures", query),

  profile: {
    get: () => get("/api/student/profile"),
    update: (data) => patch("/api/student/profile", data),
  },

  lectures: {
    list: (query) => get("/api/student/lectures", query),
    detail: (id, query) =>
      get(`/api/student/lectures/${encodePath(id)}`, query),
  },

  homework: {
    list: (query) => get("/api/student/homework", query),
    submit: (id, data) =>
      patch(`/api/student/homework/${encodePath(id)}`, data, {
        timeoutMs: isFormData(data) ? 60_000 : DEFAULT_TIMEOUT_MS,
      }),
  },
};

export const parentApi = {
  dashboard: (query) => get("/api/parent/dashboard", query),
  children: (query) => get("/api/parent/children", query),
  classes: (query) => get("/api/parent/classes", query),
  lectures: (query) => get("/api/parent/lectures", query),
  attendance: (query) => get("/api/parent/attendance", query),
  homework: (query) => get("/api/parent/homework", query),
  fees: (query) => get("/api/parent/fees", query),
  profile: (query) => get("/api/parent/profile", query),
  timeline: (query) => get("/api/parent/timeline", query),
};

export const coordinatorApi = {
  dashboard: () => get("/api/coordinator/dashboard"),
  reports: (query) => get("/api/coordinator/reports", query),
  registrationLeads: (query) =>
    get("/api/coordinator/registration-leads", query),
  scholarships: (query) =>
    get("/api/coordinator/need-based-scholarships", query),
  parentInterviewForms: (query) =>
    get("/api/coordinator/parent-interview-forms", query),

  classes: {
    list: (query) => get("/api/coordinator/classes", query),
    students: (id, query) =>
      get(`/api/coordinator/classes/${encodePath(id)}/students`, query),
    subjects: (id, query) =>
      get(`/api/coordinator/classes/${encodePath(id)}/subjects`, query),
    subjectTeachers: (id, subjectId, query) =>
      get(
        `/api/coordinator/classes/${encodePath(id)}/subjects/${encodePath(
          subjectId
        )}/teachers`,
        query
      ),
    enrollmentSubjects: (id, query) =>
      get(`/api/coordinator/enrollments/${encodePath(id)}/subjects`, query),
  },

  students: {
    list: (query) => get("/api/coordinator/students", query),
    update: (data) => put("/api/coordinator/students", data),
    delete: (data) => remove("/api/coordinator/students", data),
  },

  parents: {
    list: (query) => get("/api/coordinator/parents", query),
    update: (data) => put("/api/coordinator/parents", data),
    delete: (data) => remove("/api/coordinator/parents", data),
  },

  teachers: {
    list: (query) => get("/api/coordinator/teachers", query),
    create: (data) => post("/api/coordinator/teachers", data),
    update: (data) => patch("/api/coordinator/teachers", data),
  },

  teacherAssignments: {
    list: (query) => get("/api/coordinator/teacher-assignments", query),
    lookup: (query) =>
      get("/api/coordinator/teacher-assignments/lookup", query),
    create: (data) => post("/api/coordinator/teacher-assignments", data),
    update: (id, data) =>
      patch(`/api/coordinator/teacher-assignments/${encodePath(id)}`, data),
  },

  interestedStudents: {
    list: (query) => get("/api/coordinator/interested-students", query),
    update: (id, data) =>
      patch(`/api/coordinator/interested-students/${encodePath(id)}`, data),
    delete: (id) =>
      remove(`/api/coordinator/interested-students/${encodePath(id)}`),
    createRegistrationLink: (id, data = {}) =>
      post(
        `/api/coordinator/interested-students/${encodePath(
          id
        )}/registration-link`,
        data
      ),
  },

  feeVouchers: {
    list: (query) => get("/api/coordinator/fee-vouchers", query),
    options: (query) => get("/api/coordinator/fee-vouchers/options", query),
    detail: (id, query) =>
      get(`/api/coordinator/fee-vouchers/${encodePath(id)}`, query),
    create: (data) => post("/api/coordinator/fee-vouchers", data),
  },

  regularFeeVouchers: {
    list: (query) =>
      get("/api/coordinator/regular-fee-vouchers", query),
    create: (data) =>
      post("/api/coordinator/regular-fee-vouchers", data),
  },

  payments: {
    list: (query) => get("/api/coordinator/payments", query),
    verify: (id, data) =>
      post(`/api/coordinator/payments/${encodePath(id)}/verify`, data, {
        timeoutMs: 60_000,
      }),
  },

  lectureSchedules: {
    list: (query) => get("/api/coordinator/lecture-schedules", query),
    create: (data) => post("/api/coordinator/lecture-schedules", data),
    update: (id, data) =>
      patch(`/api/coordinator/lecture-schedules/${encodePath(id)}`, data),
    syncMeetAttendance: (id, data = {}) =>
      post(
        `/api/coordinator/lecture-schedules/${encodePath(
          id
        )}/meet-attendance-sync`,
        data,
        { timeoutMs: 60_000 }
      ),
  },

  lectureVerifications: {
    list: (query) =>
      get("/api/coordinator/lecture-verifications", query),
    detail: (id, query) =>
      get(`/api/coordinator/lecture-verifications/${encodePath(id)}`, query),
    update: (id, data) =>
      patch(`/api/coordinator/lecture-verifications/${encodePath(id)}`, data),
  },
};

export const adminApi = {
  overview: () => get("/api/admin/overview"),
  stats: (query) => get("/api/admin/stats", query),
  lectures: (query) => get("/api/admin/lectures", query),
  payments: (query) => get("/api/admin/payments", query),
  auditLogs: (query) => get("/api/admin/audit-logs", query),
  classLevels: () => get("/api/admin/class-levels"),
  parentInterviewForms: (query) =>
    get("/api/admin/parent-interview-forms", query),

  users: {
    list: (query) => get("/api/admin/users", query),
    create: (data) => post("/api/admin/users", data),
    update: (id, data) =>
      patch(`/api/admin/users/${encodePath(id)}`, data),
    delete: (id) => remove(`/api/admin/users/${encodePath(id)}`),
    setStatus: (id, data) =>
      patch(`/api/admin/users/${encodePath(id)}/status`, data),
    resetPassword: (id, data = {}) =>
      post(`/api/admin/users/${encodePath(id)}/reset-password`, data),
  },

  staff: {
    list: (query) => get("/api/admin/staff", query),
    create: (data) => post("/api/admin/staff", data),
    detail: (id) => get(`/api/admin/staff/${encodePath(id)}`),
    update: (id, data) =>
      patch(`/api/admin/staff/${encodePath(id)}`, data),
  },

  courses: {
    list: (query) => get("/api/admin/courses", query),
    create: (data) => post("/api/admin/courses", data),
    update: (id, data) =>
      patch(`/api/admin/courses/${encodePath(id)}`, data),
    delete: (id) => remove(`/api/admin/courses/${encodePath(id)}`),
  },

  subjects: {
    list: (query) => get("/api/admin/subjects", query),
    create: (data) => post("/api/admin/subjects", data),
    update: (id, data) =>
      patch(`/api/admin/subjects/${encodePath(id)}`, data),
    delete: (id) => remove(`/api/admin/subjects/${encodePath(id)}`),
  },

  headlines: {
    list: (query) => get("/api/admin/headlines", query),
    create: (data) => post("/api/admin/headlines", data),
    update: (id, data) =>
      patch(`/api/admin/headlines/${encodePath(id)}`, data),
    delete: (id) => remove(`/api/admin/headlines/${encodePath(id)}`),
  },

  feeSettings: {
    get: () => get("/api/admin/fee-settings"),
    update: (data) => patch("/api/admin/fee-settings", data),
  },

  regularFees: {
    list: (query) => get("/api/admin/regular-fees", query),
    create: (data) => post("/api/admin/regular-fees", data),
    update: (data) => patch("/api/admin/regular-fees", data),
  },

  otherFees: {
    list: (query) => get("/api/admin/other-fees", query),
    create: (data) => post("/api/admin/other-fees", data),
    update: (data) => patch("/api/admin/other-fees", data),
    delete: (id) =>
      remove(withQuery("/api/admin/other-fees", { id })),
  },

  paymentMethods: {
    list: (query) => get("/api/admin/payment-methods", query),
    create: (data) => post("/api/admin/payment-methods", data),
    update: (data) => patch("/api/admin/payment-methods", data),
    delete: (id) =>
      remove(withQuery("/api/admin/payment-methods", { id })),
  },

  careerApplications: {
    list: (query) => get("/api/admin/career-applications", query),
    delete: (id) =>
      remove(`/api/admin/career-applications/${encodePath(id)}`),
    resume: (id, options) =>
      get(`/api/admin/career-applications/${encodePath(id)}/resume`, null, options),
  },
};

export const jobsApi = {
  admissionFormReminders: (secret) =>
    get("/api/jobs/admission-form-reminders", { secret }),
  monthlyFeeReminders: (secret) =>
    get("/api/jobs/monthly-fee-reminders", { secret }),
};

// Infrastructure endpoints are included for route completeness. Normal mobile
// screens must not call cron jobs or webhook endpoints or bundle their secrets.
export const infrastructureApi = {
  whatsappWebhook: {
    verify: (query) => get("/api/webhooks/whatsapp", query),
    receive: (data) => post("/api/webhooks/whatsapp", data),
  },
};

const api = {
  request,
  auth: authApi,
  public: publicApi,
  payment: paymentApi,
  shared: sharedApi,
  teacher: teacherApi,
  student: studentApi,
  parent: parentApi,
  coordinator: coordinatorApi,
  admin: adminApi,
  jobs: jobsApi,
  infrastructure: infrastructureApi,
};

export default api;
