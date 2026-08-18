"use client";

import { useState } from "react";

export default function ChildSwitcher({ childrenList = [], value = "", onChange }) {
  const [open, setOpen] = useState(false);

  if (!childrenList.length) {
    return (
      <div className="rounded-2xl border border-[#E4C766]/70 bg-[#FFF5D6] px-4 py-3 text-sm text-[#8A6B00]">
        No linked children are available for this account.
      </div>
    );
  }

  return (
    <label className="block rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_16px_50px_-34px_rgba(13,59,46,0.16)] backdrop-blur-xl">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">
        Viewing child
      </span>
      <div className="relative">
        <select
          value={value || ""}
          onChange={(event) => {
            onChange?.(event.target.value);
            setOpen(false);
          }}
          onMouseDown={() => setOpen((current) => !current)}
          onBlur={() => setOpen(false)}
          className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#C9A227] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
        >
          <option value="" disabled>
            Select a child
          </option>
          {childrenList.map((child) => (
            <option key={child.id} value={child.id}>
              {child.full_name} {child.grade_level ? `- ${child.grade_level}` : ""}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
        >
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  );
}
