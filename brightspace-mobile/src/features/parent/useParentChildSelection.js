/**
 * Keeps a manually selected child consistent across every Parent portal screen.
 *
 * Parent screens still receive their own children arrays from their APIs, but
 * the actual selected child id lives in AuthContext. This hook only validates
 * the shared id against a loaded, non-empty children list; it does not
 * auto-select a child. Ignoring an empty list is important because every
 * Parent screen renders once before its API request finishes. Clearing the id
 * during that loading render would lose the selection when navigating between
 * screens.
 */
import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

export default function useParentChildSelection(children = []) {
  const { parentSelectedChildId, setParentSelectedChildId } = useAuth();
  const safeChildren = Array.isArray(children) ? children : [];

  useEffect(() => {
    // An empty array normally means this screen is still loading its own copy
    // of the parent's children. Preserve the shared selection until the API
    // has supplied a list that can genuinely validate it.
    if (!parentSelectedChildId || safeChildren.length === 0) return;

    const currentIsValid = safeChildren.some(
      (child) => String(child?.id || "") === String(parentSelectedChildId)
    );
    if (!currentIsValid) {
      setParentSelectedChildId("");
    }
  }, [parentSelectedChildId, safeChildren, setParentSelectedChildId]);

  return [parentSelectedChildId, setParentSelectedChildId];
}
