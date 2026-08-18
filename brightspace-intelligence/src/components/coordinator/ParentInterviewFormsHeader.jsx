"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export default function ParentInterviewFormsHeader({
  previewPassword = "",
  previewUrl = "",
  showPreviewControls = true,
  eyebrow = "Coordinator portal",
  title = "Parent interview forms",
  description = "Review submitted parent interview form records with fast search and detailed responses.",
}) {
  const [toastVisible, setToastVisible] = useState(false);

  async function handleCopyPassword() {
    if (!previewPassword) return;
    try {
      await navigator.clipboard.writeText(previewPassword);
    } finally {
      setToastVisible(true);
      window.setTimeout(() => setToastVisible(false), 2200);
    }
  }

  return (
    <>
      {toastVisible ? (
        <div className="fixed right-4 top-4 z-[80] rounded-2xl border border-[#2D8A6A]/15 bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_20px_50px_-24px_rgba(13,59,46,0.35)]">
          Password copied to clipboard
        </div>
      ) : null}
      <div className="relative flex flex-col gap-0">
        <p className="inline-flex w-fit rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">{description}</p>
        {showPreviewControls ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[#E4C766]/25 bg-[#FFF5D6]/10 px-4 py-2 text-sm text-[#FFF5D6]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Preview password</span>
                <span className="font-mono text-sm font-semibold tracking-wide text-[#FAF7F0]">{previewPassword || "-"}</span>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF7F0]/10 text-[#FAF7F0] transition hover:bg-[#FAF7F0]/20"
                  aria-label="Copy preview password"
                  title="Copy preview password"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-[#FAF7F0] px-5 py-3 text-sm font-semibold text-[#245C4F] transition hover:bg-[#DBD8D5]"
              >
                Generate Interview Form
              </a>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
