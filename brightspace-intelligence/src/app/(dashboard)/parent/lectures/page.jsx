"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import LMSCalendar from "@/components/calendar/LMSCalendar";

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export default function ParentClassesPage() {
  const [state, setState] = useState({
    children: [],
    selectedChildId: "",
    error: "",
    filters: {
      date: todayDate(),
      range: "all",
      classLevel: "",
      subjectId: "",
      status: "",
    },
  });

  useEffect(() => {
    fetch("/api/parent/children", { cache: "no-store" })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data?.message || "Unable to load children.");
        setState((current) => ({
          ...current,
          children: data.children || [],
          selectedChildId: "",
          error: "",
        }));
      })
      .catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 overflow-hidden rounded-[2rem] px-4 py-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
        <div className="relative max-w-6xl">
          <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
            Parent lectures
          </p>
          <h1 className="mb-3 mt-4 text-2xl font-bold text-[#FAF7F0] sm:text-4xl lg:text-4xl font-display">
            Child lecture schedule and history
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[#F1EADC]/90 sm:text-base">
            Follow upcoming lectures, past sessions, and class meeting history for the selected child.
          </p>
        </div>
      </section>
      <ChildSwitcher
        childrenList={state.children}
        value={state.selectedChildId}
        onChange={(id) => setState((current) => ({ ...current, selectedChildId: id }))}
      />
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {!state.selectedChildId ? (
        <div className="rounded-[2rem] border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-8 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]">
          Please select a child first.
        </div>
      ) : (
        <LMSCalendar
          apiUrl="/api/parent/lectures"
          filters={state.filters}
          extraParams={{ childId: state.selectedChildId }}
          onDateSelect={(date) => setState((current) => ({ ...current, filters: { ...current.filters, date, range: "selected_date" } }))}
          popupMode="page"
        />
      )}
      </div>
    </div>
  );
}
