/**
 * Single source of truth for role navigation and route authorization. The
 * shell and protected layout share these maps to prevent permission drift.
 */
export const ROLE_NAVIGATION = {
  student: [
    ["dashboard", "Home", "home-outline", "home"],
    ["classes", "Classes", "school-outline", "school"],
    ["calendar", "Calendar", "calendar-outline", "calendar"],
    ["homework", "Homework", "book-outline", "book"],
    ["profile", "Profile", "person-outline", "person"],
  ],
  coordinator: [
    ["dashboard", "Home", "home-outline", "home"],
    ["admissions", "Admissions", "people-outline", "people"],
    ["payments", "Payments", "wallet-outline", "wallet"],
    ["profile", "Profile", "person-outline", "person"],
  ],
  admin: [
    ["dashboard", "Overview", "grid-outline", "grid"],
    ["users", "Users", "people-outline", "people"],
    ["academics", "Academics", "school-outline", "school"],
    ["admissions", "Admissions", "person-add-outline", "person-add"],
    ["more", "More", "apps-outline", "apps"],
  ],
  superadmin: [
    ["dashboard", "Overview", "grid-outline", "grid"],
    ["users", "Users", "people-outline", "people"],
    ["academics", "Academics", "school-outline", "school"],
    ["finance", "Finance", "wallet-outline", "wallet"],
    ["more", "More", "apps-outline", "apps"],
  ],
  teacher: [
    // Teacher tabs follow the daily workflow: overview, assigned teaching,
    // scheduled delivery, homework work, then account/session controls.
    ["dashboard", "Home", "home-outline", "home"],
    ["classes", "Classes", "school-outline", "school"],
    ["lectures", "Lectures", "calendar-outline", "calendar"],
    ["homework", "Homework", "book-outline", "book"],
    ["profile", "Profile", "person-outline", "person"],
  ],
  parent: [
    ["dashboard", "Home", "home-outline", "home"],
    ["calendar", "Calendar", "calendar-outline", "calendar"],
    ["fees", "Fees", "wallet-outline", "wallet"],
    ["profile", "Profile", "person-outline", "person"],
  ],
};

export const SUPPORTED_ROLES = Object.freeze(Object.keys(ROLE_NAVIGATION));
const EXTRA_ROLE_SECTIONS = Object.freeze({
  admin: ["payments", "admission-review", "communications", "reports", "audit", "profile", "career-applications"],
  superadmin: ["admissions", "admission-review", "communications", "reports", "audit", "profile", "career-applications"],
  // These Student workspaces are reached from dashboard cards and detail
  // links instead of consuming another slot in the five-item bottom bar.
  student: ["lectures", "attendance", "progress", "notes", "notifications", "fees"],
  // Teachers receive only their operational completion-report workspace.
  // Generic administrative reporting remains limited to Admin/Super Admin.
  // Homework approval already lives inside the "homework" tab's "To Review"
  // sub-tab (TeacherHomework.js), so it is intentionally not duplicated here.
  teacher: ["attendance", "completion-reports", "notes", "notifications", "students", "internal-events"],
  // Coordinator's day-to-day workspaces reached from dashboard quick actions.
  coordinator: ["people", "teachers", "lecture-verifications", "vouchers", "admission-review", "reports"],
  // Parent workspaces mirror the Student set, scoped to the parent's children.
  // "classes" (the schedule-by-date view) is already served by the Calendar
  // bottom tab (ParentCalendar.js calls the same api.parent.classes endpoint),
  // so it is intentionally not duplicated here.
  parent: ["attendance", "homework", "lectures", "notes"],
});
const EXTRA_SECTION_TITLES = Object.freeze({
  admissions: "Admissions",
  "admission-review": "Admission Review",
  communications: "Communications",
  reports: "Reports",
  "completion-reports": "Completion Reports",
  audit: "Audit History",
  profile: "Profile",
  payments: "Payments",
  attendance: "Attendance",
  progress: "Progress Reports",
  lectures: "Lectures",
  fees: "Fees",
  notes: "Notes",
  notifications: "Notifications",
  "career-applications": "Careers Applications",
  students: "Students",
  "internal-events": "Internal Events",
  people: "Students & Parents",
  teachers: "Teachers",
  "lecture-verifications": "Lecture Verifications",
  vouchers: "Fee Vouchers",
  classes: "Classes",
  homework: "Homework",
});

export function normalizeRole(value) {
  // Database/API role spellings are collapsed to the route format so values
  // such as "super_admin", "Super Admin", and "super-admin" behave equally.
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function isSupportedRole(role) {
  return SUPPORTED_ROLES.includes(normalizeRole(role));
}

export function navigationForRole(role) {
  return ROLE_NAVIGATION[normalizeRole(role)] || [];
}

export function isSectionAllowed(role, section) {
  const normalizedSection = String(section || "").trim().toLowerCase();
  return (
    navigationForRole(role).some(([key]) => key === normalizedSection) ||
    (EXTRA_ROLE_SECTIONS[normalizeRole(role)] || []).includes(normalizedSection)
  );
}

export function sectionTitle(role, section) {
  return navigationForRole(role).find(([key]) => key === section)?.[1] || EXTRA_SECTION_TITLES[section] || "Portal";
}
