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
    ["dashboard", "Home", "home-outline", "home"],
    ["users", "Users", "people-outline", "people"],
    ["courses", "Courses", "school-outline", "school"],
    ["profile", "Profile", "person-outline", "person"],
  ],
  superadmin: [
    ["dashboard", "Home", "home-outline", "home"],
    ["users", "Users", "people-outline", "people"],
    ["settings", "Settings", "settings-outline", "settings"],
    ["profile", "Profile", "person-outline", "person"],
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

export function navigationForRole(role) {
  return ROLE_NAVIGATION[role] || ROLE_NAVIGATION.student;
}

export function sectionTitle(role, section) {
  return navigationForRole(role).find(([key]) => key === section)?.[1] || "Portal";
}
