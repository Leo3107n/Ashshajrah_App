"use client";

import { useEffect, useState } from "react";
import StudentClassTable from "@/components/student/StudentClassTable";
import SubjectFilter from "@/components/student/SubjectFilter";
import StatusFilter from "@/components/student/StatusFilter";

const ranges = [
  ["all", "All Lectures"],
  ["today", "Today"],
  ["current_week", "Current week"],
  ["next_week", "Next week"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
];

export default function StudentClassesPage() {
  const [state, setState] = useState({ items: [], subjects: [], loading: true, error: "", range: "all", subjectId: "", status: "" });
  async function load(next = state) {
    const params = new URLSearchParams({ range: next.range || "all", subjectId: next.subjectId || "", status: next.status || "" });
    setState((current) => ({ ...current, loading: true }));
    const response = await fetch(`/api/student/lectures?${params.toString()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load lectures.");
    setState((current) => ({ ...current, items: data.items || [], subjects: data.subjects || [], loading: false, error: "" }));
  }
  useEffect(() => { load().catch((error) => setState((current) => ({ ...current, loading: false, error: error.message }))); }, []);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select value={state.range} onChange={(event) => { const next = { ...state, range: event.target.value }; setState(next); load(next); }} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-medium text-[#063F32] outline-none transition focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]">
          {ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <SubjectFilter value={state.subjectId} subjects={state.subjects} onChange={(subjectId) => { const next = { ...state, subjectId }; setState(next); load(next); }} />
        <StatusFilter value={state.status} onChange={(status) => { const next = { ...state, status }; setState(next); load(next); }} />
      </div>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <StudentClassTable items={state.items} loading={state.loading} />
    </div>
  );
}
