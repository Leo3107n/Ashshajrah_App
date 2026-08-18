"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Submitted", value: "submitted" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
];

export default function FeeVoucherFilters({ initialSearch, initialStatus = "", onFilterChange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch || "");
  const [status, setStatus] = useState(initialStatus || "");
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    setSearch(initialSearch || "");
    setStatus(initialStatus || "");
  }, [initialSearch, initialStatus]);

  function replaceWithHash(nextParams) {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    router.replace(
      nextParams.toString() ? `${pathname}?${nextParams.toString()}${hash}` : `${pathname}${hash}`,
      { scroll: false }
    );
  }

  function applyFilters(nextSearch, nextStatus) {
    const safeSearch = String(nextSearch || "").trim();
    const safeStatus = String(nextStatus || "").trim();
    const params = new URLSearchParams(searchParams.toString());

    if (safeSearch) {
      params.set("search", safeSearch);
    } else {
      params.delete("search");
    }
    if (safeStatus) {
      params.set("status", safeStatus);
    } else {
      params.set("status", "all");
    }
    startTransition(() => {
      replaceWithHash(params);
      onFilterChange?.({ search: safeSearch, status: safeStatus || "all" });
      if (typeof window !== "undefined") {
        const hash = window.location.hash;
        if (hash) {
          document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  }

  function closeSelectState(setter) {
    window.setTimeout(() => setter(false), 0);
  }

  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">
              Search vouchers
            </span>
            <input
              type="text"
              value={search}
            onChange={(event) => setSearch(event.target.value || "")}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                  applyFilters((search || "").trim(), status);
              }
            }}
            placeholder="Voucher no, payment method, student, parent, phone, or email"
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">
              Status
            </span>
            <div className="relative">
              <select
                value={status}
                onMouseDown={() => setStatusOpen((current) => !current)}
                onFocus={() => setStatusOpen(true)}
                onBlur={() => closeSelectState(setStatusOpen)}
                onChange={(event) => {
                  const nextStatus = event.target.value;
                  setStatus(nextStatus);
                  applyFilters((search || "").trim(), nextStatus);
                }}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${statusOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
          </label>

          <button
            type="button"
            onClick={() => applyFilters((search || "").trim(), status)}
            disabled={isPending}
            className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Searching..." : "Search"}
          </button>
        </div>
      </div>
    </section>
  );
}
