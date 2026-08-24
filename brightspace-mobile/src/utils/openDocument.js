/**
 * Opens public educational resources reliably on mobile. Android devices do
 * not always register a native handler for PDFs or Office files, so those
 * formats are sent through Google's browser viewer while images open directly.
 */
import { Alert, Linking } from "react-native";

const VIEWER_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];

function needsBrowserViewer(url) {
  const path = String(url || "").split("?")[0].toLowerCase();
  return VIEWER_EXTENSIONS.some((extension) => path.endsWith(extension));
}

export async function openEducationalDocument(document) {
  const sourceUrl = String(document?.url || "").trim();
  if (!/^https?:\/\//i.test(sourceUrl)) {
    Alert.alert("Document unavailable", "This document does not have a valid download link.");
    return;
  }

  const openUrl = needsBrowserViewer(sourceUrl)
    ? `https://docs.google.com/gview?embedded=0&url=${encodeURIComponent(sourceUrl)}`
    : sourceUrl;

  try {
    const supported = await Linking.canOpenURL(openUrl);
    if (!supported) throw new Error("No application can open this link.");
    await Linking.openURL(openUrl);
  } catch {
    Alert.alert(
      "Unable to open document",
      "Install or enable a web browser, then try again. You can also open this document from the web portal."
    );
  }
}
