import crypto from "crypto";

export function generatePassword(length = 12) {
  return crypto
    .randomBytes(length * 2)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);
}
