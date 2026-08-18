"use client";

import { createPortal } from "react-dom";

export default function ClientPortal({ children, targetId }) {
  if (typeof document === "undefined") {
    return children;
  }

  const target = targetId ? document.getElementById(targetId) : null;
  return createPortal(children, target || document.body);
}
