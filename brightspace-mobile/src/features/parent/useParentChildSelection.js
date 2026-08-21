/**
 * Keeps a manually selected child consistent across every Parent portal screen.
 *
 * Parent screens still receive their own children arrays from their APIs, but
 * the actual selected child id lives in AuthContext. This hook only validates
 * the shared id against the current screen's children; it does not auto-select
 * a child. That keeps the Parent portal blank/default until the parent chooses
 * a child, and it also prevents refreshes from reopening a previously selected
 * child automatically.
 */
import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

export default function useParentChildSelection(children = []) {
  const { parentSelectedChildId, setParentSelectedChildId } = useAuth();
  const safeChildren = Array.isArray(children) ? children : [];

  useEffect(() => {
    const currentIsValid = safeChildren.some(
      (child) => child.id === parentSelectedChildId
    );
    if (parentSelectedChildId && !currentIsValid) {
      setParentSelectedChildId("");
    }
  }, [parentSelectedChildId, safeChildren, setParentSelectedChildId]);

  return [parentSelectedChildId, setParentSelectedChildId];
}
