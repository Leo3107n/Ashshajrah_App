export function buildInlinePreviewUrl(sourceUrl) {
  const value = String(sourceUrl || "").trim();
  if (!value) return "";

  return `/api/file-preview?url=${encodeURIComponent(value)}`;
}
