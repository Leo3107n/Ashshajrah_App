"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "New admissions", value: "new_lead" },
  { label: "Voucher created", value: "voucher_created" },
  { label: "Fee submitted", value: "fee_submitted" },
  { label: "Access granted", value: "access_granted" },
  { label: "Rejected", value: "rejected" },
  { label: "Pending clarification", value: "pending_clarification" },
];

export default function RegistrationLeadFilters({
  initialSearch,
  initialStatus,
  canSync,
  onFilterChange,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [statusOpen, setStatusOpen] = useState(false);
  const searchTimerRef = useRef(null);
  const [syncState, setSyncState] = useState({
    pending: false,
    message: "",
    tone: "neutral",
  });

  useEffect(() => {
    setSearch(initialSearch);
    setStatus(initialStatus);
  }, [initialSearch, initialStatus]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  function replaceWithHash(nextParams) {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    router.replace(
      nextParams.toString() ? `${pathname}?${nextParams.toString()}${hash}` : `${pathname}${hash}`,
      { scroll: false }
    );
  }

  function applyFilters(nextSearch, nextStatus) {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedStatus = String(nextStatus || "").trim();
    const hasPage = params.has("page");

    if (nextSearch) {
      params.set("search", nextSearch);
    } else {
      params.delete("search");
    }

    if (normalizedStatus) {
      params.set("status", normalizedStatus);
    } else {
      params.set("status", "all");
    }

    if (hasPage) {
      params.delete("page");
    }

    startTransition(() => {
      replaceWithHash(params);
      onFilterChange?.({ search: nextSearch, status: normalizedStatus || "all" });
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

  async function handleSync() {
    setSyncState({
      pending: true,
      message: "",
      tone: "neutral",
    });

    try {
      const response = await fetch("/api/coordinator/registration-leads/sync", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Sync failed.");
      }

      setSyncState({
        pending: false,
        message: `${data.stats?.synced || 0} records synced, ${data.stats?.failed || 0} failed.`,
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setSyncState({
        pending: false,
        message: error instanceof Error ? error.message : "Sync failed.",
        tone: "error",
      });
    }
  }

  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.6fr)]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">
              Search Admissions
            </span>
            <input
              type="text"
              value={search}
              onChange={(event) => {
                const nextSearch = event.target.value;
                setSearch(nextSearch);

                if (searchTimerRef.current) {
                  window.clearTimeout(searchTimerRef.current);
                }

                searchTimerRef.current = window.setTimeout(() => {
                  applyFilters(nextSearch.trim(), status);
                }, 220);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  if (searchTimerRef.current) {
                    window.clearTimeout(searchTimerRef.current);
                  }
                  applyFilters(search.trim(), status);
                }
              }}
              placeholder="Student, class, parent, email, or phone"
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
                if (searchTimerRef.current) {
                  window.clearTimeout(searchTimerRef.current);
                }
                applyFilters(search.trim(), nextStatus);
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
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => applyFilters(search.trim(), status)}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Applying..." : "Apply filters"}
          </button>

          {canSync ? (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncState.pending}
              className="inline-flex items-center justify-center rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {syncState.pending ? "Syncing..." : "Sync Google Sheet Records"}
            </button>
          ) : null}
        </div>
      </div>

      {syncState.message ? (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
          syncState.tone === "success"
              ? "bg-[#EAF6EF] text-[#0D5C48]"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {syncState.message}
        </p>
      ) : null}
    </section>
  );
}
