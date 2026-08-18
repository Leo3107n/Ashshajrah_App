export const ALLOWED_CLASS_LEVELS = new Set([
  "Pre-Nursery",
  "Nursery",
  "KG-1",
  "KG-2",
]);

export const CLASS_SUBJECTS = {
  "Pre-Nursery": [
    "English",
    "Mathematics",
    "Urdu",
    "General Knowledge",
    "Islamiat",
  ],
  Nursery: [
    "English",
    "Mathematics",
    "Urdu",
    "General Knowledge",
    "Islamiat",
  ],
  "KG-1": [
    "English",
    "Mathematics",
    "Urdu",
    "Environmental Studies",
    "Islamiat",
  ],
  "KG-2": [
    "English",
    "Mathematics",
    "Urdu",
    "General Science",
    "Islamiat",
  ],
};

export function normalizeClassLevel(value) {
  const incoming = String(value || "").trim().toLowerCase();
  return [...ALLOWED_CLASS_LEVELS].find((item) => item.toLowerCase() === incoming) || "";
}
