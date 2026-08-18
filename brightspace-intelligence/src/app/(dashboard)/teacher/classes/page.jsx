"use client";

import { useEffect, useState } from "react";
import TeacherClassTable from "@/components/teacher/TeacherClassTable";
import ClassActionModal from "@/components/teacher/ClassActionModal";

const FILTERS = [
  { label: "All lectures", value: "" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Live", value: "live" },
  { label: "Completed", value: "completed_by_teacher" },
  { label: "Verified", value: "verified_by_coordinator" },
  { label: "Missed", value: "missed" },
  { label: "Cancelled", value: "cancelled" },
];

export default function TeacherClassesPage() {
  const [state, setState] = useState({ items: [], selected: null, status: "", error: "" });

  async function load(status = state.status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await fetch(`/api/teacher/lectures${query}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load lectures.");
    setState((current) => ({ ...current, items: data.items || [], status, error: "" }));
  }

  useEffect(() => { load().catch((error) => setState((current) => ({ ...current, error: error.message }))); }, []);

  return (
    <div className="min-h-screen rounded-[2rem] border-0 space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none rounded-[2rem] border-0 absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative rounded-[2rem] border-0 mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
        <div className="relative max-w-6xl">
          <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">Lectures</p>
          <h1 className="mb-2 mt-4 text-3xl font-bold text-[#FAF7F0] sm:text-4xl lg:text-4xl font-display">Assigned lecture history</h1>
          <p className="mt-2 max-w-5xl text-sm leading-7 text-[#EAF6EF] sm:text-base lg:whitespace-nowrap">
            Review class sessions, status changes, and verification progress in one concise list.
          </p>
        </div>
      </section>
      <div className="flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item.value || "all"} onClick={() => load(item.value).catch((error) => setState((current) => ({ ...current, error: error.message })))} className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${state.status === item.value ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow-[0_10px_28px_-18px_rgba(13,59,46,0.45)]" : "border border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] hover:bg-[#F1EADC]"}`}>{item.label}</button>)}</div>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <TeacherClassTable items={state.items} onOpen={(item) => setState((current) => ({ ...current, selected: item }))} />
      <ClassActionModal lecture={state.selected} open={Boolean(state.selected)} onClose={() => setState((current) => ({ ...current, selected: null }))} onChanged={() => load()} />
      </div>
    </div>
  );
}
