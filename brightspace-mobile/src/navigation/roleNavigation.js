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
    ["dashboard", "Home", "home-outline", "home"],
    ["classes", "Classes", "school-outline", "school"],
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
  admin: ["payments", "admission-review", "communications", "reports", "audit", "profile"],
  superadmin: ["admissions", "admission-review", "communications", "reports", "audit", "profile"],
});
const EXTRA_SECTION_TITLES = Object.freeze({
  admissions: "Admissions",
  "admission-review": "Admission Review",
  communications: "Communications",
  reports: "Reports",
  audit: "Audit History",
  profile: "Profile",
  payments: "Payments",
});

export function normalizeRole(value) {
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
