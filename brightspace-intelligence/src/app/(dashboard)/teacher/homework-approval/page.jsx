"use client";

import { useEffect, useState } from "react";
import HomeworkApprovalTable from "@/components/teacher/HomeworkApprovalTable";

export default function TeacherHomeworkApprovalPage() {
  const [state, setState] = useState({ items: [], error: "" });

  async function load() {
    const response = await fetch("/api/teacher/homework/submissions", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load homework submissions.");
    setState((current) => ({ ...current, items: data.items || [], error: "" }));
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="min-h-screen border-0 space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none border-0 absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative rounded-[2rem] border-0 mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">Approve homework</p>
            <h1 className="mb-3 mt-4 text-3xl font-bold text-[#FAF7F0] sm:text-4xl lg:text-4xl font-display">Review submitted homework</h1>
            <p className="mt-3 max-w-2xl text-sm text-[#F1EADC]">Approve or reject student submissions. Rejected homework moves back to pending so the student can resubmit.</p>
          </div>
        </section>

        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

        <HomeworkApprovalTable
          items={state.items}
          onRefresh={() => load().catch((error) => setState((current) => ({ ...current, error: error.message })))}
        />
      </div>
    </div>
  );
}
