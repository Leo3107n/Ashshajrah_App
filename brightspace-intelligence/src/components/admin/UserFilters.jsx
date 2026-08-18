"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

const ROLE_OPTIONS = [
  { label: "All roles", value: "" },
  { label: "Admin", value: "admin" },
  { label: "Coordinator", value: "coordinator" },
  { label: "Teacher", value: "teacher" },
  { label: "Parent", value: "parent" },
  { label: "Student", value: "student" },
];

const STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Inactive", value: "inactive" },
];

export default function UserFilters({
  initialSearch,
  initialRole,
  initialStatus,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(initialStatus);
  const [roleOpen, setRoleOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  useEffect(() => {
    setSearch(initialSearch);
    setRole(initialRole);
    setStatus(initialStatus);
  }, [initialRole, initialSearch, initialStatus]);

  function closeSelectState(setter) {
    window.setTimeout(() => setter(false), 0);
  }

  function applyFilters(nextSearch, nextRole, nextStatus) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextSearch) {
      params.set("search", nextSearch);
    } else {
      params.delete("search");
    }

    if (nextRole) {
      params.set("role", nextRole);
    } else {
      params.delete("role");
    }

    if (nextStatus) {
      params.set("status", nextStatus);
    } else {
      params.delete("status");
    }

    startTransition(() => {
      router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#245C4F]">
            Search users
          </span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters(search.trim(), role, status);
              }
            }}
            placeholder="Name, email, or phone"
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#245C4F]">
            Role
          </span>
          <div className="relative">
            <select
              value={role}
              onMouseDown={() => setRoleOpen((current) => !current)}
              onFocus={() => setRoleOpen(true)}
              onBlur={() => closeSelectState(setRoleOpen)}
              onChange={(event) => {
                const nextRole = event.target.value;
                setRole(nextRole);
                applyFilters(search.trim(), nextRole, status);
              }}
              className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${roleOpen ? "rotate-180" : "rotate-0"}`} />
          </div>
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
                applyFilters(search.trim(), role, nextStatus);
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
          onClick={() => applyFilters(search.trim(), role, status)}
          disabled={isPending}
          className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Applying..." : "Apply"}
        </button>
      </div>
    </section>
  );
}
