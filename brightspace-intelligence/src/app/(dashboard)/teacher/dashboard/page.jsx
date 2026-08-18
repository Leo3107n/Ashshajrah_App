"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import TeacherStatsCards from "@/components/teacher/TeacherStatsCards";
import ClassActionModal from "@/components/teacher/ClassActionModal";
import LMSCalendar from "@/components/calendar/LMSCalendar";
import ActiveHeadlinesBanner from "@/components/shared/ActiveHeadlinesBanner";

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export default function TeacherDashboardPage() {
  const [state, setState] = useState({
    stats: {},
    headlines: [],
    classes: [],
    selected: null,
    calendarRefreshKey: 0,
    filters: {
      date: todayDate(),
      range: "today",
      classLevel: "",
      subjectId: "",
      status: "",
    },
    error: "",
  });
  const [classOpen, setClassOpen] = useState(false);

  async function load() {
    const response = await fetch("/api/teacher/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load dashboard.");
    setState((current) => ({
      ...current,
      stats: data.stats || {},
      headlines: Array.isArray(data.headlines) ? data.headlines : [],
      error: "",
    }));
  }

  async function loadHeadlines() {
    const response = await fetch("/api/headlines/active", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load headlines.");
    setState((current) => ({
      ...current,
      headlines: Array.isArray(data.headlines) ? data.headlines : [],
    }));
  }

  async function loadLectures(filters = state.filters) {
    const safeFilters = {
      ...filters,
      date: filters.date || todayDate(),
      classLevel: filters.classLevel || "",
      subjectId: filters.subjectId || "",
      status: filters.status || "",
    };
    const response = await fetch(`/api/teacher/calendar-lectures?${new URLSearchParams(safeFilters).toString()}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load lectures.");
    setState((current) => ({
      ...current,
      filters: safeFilters,
      classes: Array.isArray(data.classes) ? data.classes : [],
    }));
  }

  function updateFilters(nextFilters) {
    setState((current) => ({ ...current, filters: nextFilters }));
    loadLectures(nextFilters).catch((error) => setState((current) => ({ ...current, error: error.message })));
  }

  async function markConducted(item) {
    const response = await fetch(`/api/teacher/lectures/${item.id}`, { method: "PATCH" });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data?.message || "Unable to mark conducted.");
      return;
    }
    await load();
    setState((current) => ({ ...current, calendarRefreshKey: current.calendarRefreshKey + 1 }));
  }

  useEffect(() => {
    async function initialize() {
      try {
        await load();
      } catch (error) {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }

      try {
        await loadHeadlines();
      } catch (error) {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }

      try {
        await loadLectures({
          date: todayDate(),
          range: "today",
          classLevel: "",
          subjectId: "",
          status: "",
        });
      } catch (error) {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }
    }

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="border-0 min-h-screen space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none border-0 rounded-[2rem] absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative border-0 rounded-[2rem] mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <ActiveHeadlinesBanner items={state.headlines} />
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">Teacher dashboard</p>
            <h1 className="mb-2 mt-4 text-3xl font-bold text-[#FAF7F0] sm:text-4xl lg:text-4xl font-display">Teaching operations</h1>
            <p className="mt-2 max-w-5xl text-sm leading-7 text-[#EAF6EF] sm:text-base lg:whitespace-nowrap">
              Manage today's lectures, calendar movement, and performance signals from one place.
            </p>
          </div>
        </section>
        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
        <TeacherStatsCards items={[
          { key: "today", label: "Today lectures", value: state.stats.today_lectures || 0 },
          { key: "upcoming", label: "Upcoming lectures", value: state.stats.upcoming_lectures || 0 },
          { key: "students", label: "Assigned students", value: state.stats.assigned_students || 0 },
          { key: "subjects", label: "Assigned subjects", value: state.stats.assigned_subjects || 0 },
        ]} />
        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Class</span>
              <div className="relative">
                <select
                  value={state.filters.classLevel}
                  onMouseDown={() => setClassOpen((current) => !current)}
                  onChange={(event) => {
                    setClassOpen(false);
                    updateFilters({ ...state.filters, classLevel: event.target.value });
                  }}
                  onFocus={() => setClassOpen(true)}
                  onBlur={() => setClassOpen(false)}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm font-medium text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                >
                  <option value="">All classes</option>
                  {state.classes.map((item) => (
                    <option key={item.class_level} value={item.class_level}>
                      {item.class_level}
                      {item.title ? ` - ${item.title}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${classOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </label>
          </div>
          <LMSCalendar
            key={state.calendarRefreshKey}
            apiUrl="/api/teacher/calendar-lectures"
            filters={state.filters}
            onDateSelect={(date) => updateFilters({ ...state.filters, date, range: "selected_date" })}
            onEventClick={(item) => setState((current) => ({ ...current, selected: item }))}
          />
        </section>
        <ClassActionModal lecture={state.selected} open={Boolean(state.selected)} onClose={() => setState((current) => ({ ...current, selected: null }))} onChanged={() => load()} />
      </div>
    </div>
  );
}
