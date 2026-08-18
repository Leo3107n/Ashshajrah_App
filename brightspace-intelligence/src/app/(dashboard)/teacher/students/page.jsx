"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import AssignedStudentsTable from "@/components/teacher/AssignedStudentsTable";

export default function TeacherStudentsPage() {
  const [state, setState] = useState({ items: [], subject: "", error: "" });
  const [subjectOpen, setSubjectOpen] = useState(false);

  const subjects = Array.from(
    new Map(
      state.items
        .filter((item) => item.subject_name)
        .map((item) => [String(item.subject_name), { value: item.subject_name, label: item.subject_name }])
    ).values()
  );

  const visibleItems = state.subject
    ? state.items.filter((item) => String(item.subject_name || "") === String(state.subject))
    : state.items;

  useEffect(() => {
    fetch("/api/teacher/students", { cache: "no-store" }).then((response) => response.json().then((data) => {
      if (!response.ok) throw new Error(data?.message || "Unable to load students.");
      setState((current) => ({ ...current, items: data.items || [], error: "" }));
    })).catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);
  return (
    <div className="min-h-screen border-0 space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none border-0 absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative rounded-[2rem] border-0 mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">Students</p>
            <h1 className="mb-2 mt-4 text-3xl font-bold text-[#FAF7F0] sm:text-4xl lg:text-4xl font-display">Assigned learners</h1>
            <p className="mt-2 max-w-5xl text-sm leading-7 text-[#EAF6EF] sm:text-base lg:whitespace-nowrap">
              Track assigned learners, subject placement, and class associations in one place.
            </p>
          </div>
        </section>
        <div className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <label className="block max-w-sm">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">Subject</span>
            <div className="relative">
              <select
                value={state.subject}
                onMouseDown={() => setSubjectOpen((current) => !current)}
                onChange={(event) => {
                  setSubjectOpen(false);
                  setState((current) => ({ ...current, subject: event.target.value }));
                }}
                onFocus={() => setSubjectOpen(true)}
                onBlur={() => setSubjectOpen(false)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm font-medium text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
              >
                <option value="">All subjects</option>
                {subjects.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${subjectOpen ? "rotate-180" : "rotate-0"}`}
              />
            </div>
          </label>
        </div>
        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
        <AssignedStudentsTable items={visibleItems} />
      </div>
    </div>
  );
}
