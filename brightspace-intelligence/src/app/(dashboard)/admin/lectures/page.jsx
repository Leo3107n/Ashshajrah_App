"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import LMSCalendar from "@/components/calendar/LMSCalendar";

export default function AdminLecturesPage() {
  const pathname = usePathname() || "";
  const isSuperAdminPortal = pathname.startsWith("/superadmin");
  const portalLabel = isSuperAdminPortal ? "Super admin portal" : "Admin portal";
  const [statusOpen, setStatusOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    search: "",
    date: "",
  });
  const [state, setState] = useState({
    loading: true,
    error: "",
    items: [],
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);

      const response = await fetch(`/api/admin/lectures?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load lecture records.");
      }

      setState({
        loading: false,
        error: "",
        items: Array.isArray(data?.items) ? data.items : [],
      });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load lecture records.",
        items: [],
      });
    }
  }, [filters.search, filters.status]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const items = state.items || [];
    return {
      total: items.length,
      live: items.filter((item) => String(item.display_status || item.status || "").toLowerCase() === "live").length,
      upcoming: items.filter((item) => String(item.display_status || item.status || "").toLowerCase() === "upcoming").length,
      completed: items.filter((item) =>
        ["verified_by_coordinator", "completed_by_teacher"].includes(String(item.display_status || item.status || "").toLowerCase())
      ).length,
    };
  }, [state.items]);

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.14),transparent_28%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-5xl">
              <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
                {portalLabel}
              </p>
              <h1 className="mb-3 mt-4 text-3xl font-bold text-white-deep sm:text-4xl font-display">
                All Lectures Calendar
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
                View all class lectures in calendar format from one read-only portal page.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3 text-sm text-[#FAF7F0]">
              {summary.total} lectures loaded
            </div>
          </div>
        </section>

        <AdminDashboardCards
          cards={[
            { key: "total", label: "Total Lectures", value: summary.total },
            { key: "live", label: "Live Lectures", value: summary.live },
            { key: "upcoming", label: "Upcoming Lectures", value: summary.upcoming },
            { key: "completed", label: "Completed Lectures", value: summary.completed },
          ]}
        />

        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className="grid gap-4 border-b border-[#2D8A6A]/10 px-5 py-5 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="relative">
              <select
                value={filters.status}
                onMouseDown={() => setStatusOpen((current) => !current)}
                onChange={(event) => {
                  setStatusOpen(false);
                  setFilters((current) => ({ ...current, status: event.target.value }));
                }}
                onFocus={() => setStatusOpen(true)}
                onBlur={() => setStatusOpen(false)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm font-medium text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
              >
                <option value="">All statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
                <option value="completed_by_teacher">Completed By Teacher</option>
                <option value="verified_by_coordinator">Verified By Coordinator</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="missed">Missed</option>
                <option value="disputed">Disputed</option>
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${statusOpen ? "rotate-180" : "rotate-0"}`} />
            </div>

            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search lecture, teacher, subject, or class"
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
            />
          </div>
        </section>

        {state.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {state.error}
          </div>
        ) : null}

        <LMSCalendar
          apiUrl="/api/admin/lectures"
          filters={{ date: filters.date, status: filters.status }}
          extraParams={{ search: filters.search }}
          onDateSelect={(date) => setFilters((current) => ({ ...current, date }))}
          popupMode="page"
        />
      </div>
    </div>
  );
}
