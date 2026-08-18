"use client";

import { useEffect, useState } from "react";

export default function CoordinatorGoTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 300);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Go to top"
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FAF7F0] shadow-lg transition hover:bg-[#063F32]"
    >
      ↑
    </button>
  );
}
