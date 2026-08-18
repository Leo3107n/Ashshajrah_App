"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import HomeworkForm from "@/components/teacher/HomeworkForm";
import HomeworkTable from "@/components/teacher/HomeworkTable";

export default function TeacherHomeworkPage() {
  const [state, setState] = useState({ lectures: [], items: [], selected: null, error: "" });
  const [lectureOpen, setLectureOpen] = useState(false);

  async function load() {
    const [classesResponse, homeworkResponse] = await Promise.all([
      fetch("/api/teacher/lectures", { cache: "no-store" }),
      fetch("/api/teacher/homework", { cache: "no-store" }),
    ]);

    const classesData = await classesResponse.json();
    const homeworkData = await homeworkResponse.json();
    if (!classesResponse.ok || !homeworkResponse.ok) {
      throw new Error(classesData?.message || homeworkData?.message || "Unable to load homework.");
    }

    setState((current) => ({
      ...current,
      lectures: classesData.items || [],
      items: homeworkData.items || [],
      error: "",
    }));
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  const editingItem = useMemo(() => state.selected, [state.selected]);
  const usedLectureIds = useMemo(
    () => Array.from(new Set(state.items.map((item) => String(item.lecture_id || "")).filter(Boolean))),
    [state.items]
  );

  return (
    <div className="min-h-screen border-0 space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none border-0 absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl rounded-[2rem] border-0 space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">Homework</p>
            <h1 className="mb-2 mt-4 text-3xl font-bold text-[#FAF7F0] sm:text-4xl lg:text-4xl font-display">Create and review homework</h1>
            <p className="mt-2 max-w-5xl text-sm leading-7 text-[#EAF6EF] sm:text-base lg:whitespace-nowrap">
              Create homework, review submissions, and keep lecture tasks organized.
            </p>
          </div>
        </section>

        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

        <HomeworkForm
          lectures={state.lectures}
          excludeLectureIds={usedLectureIds}
          initialValue={editingItem}
          onSaved={() => {
            setState((current) => ({ ...current, selected: null }));
            load();
          }}
        />

        <HomeworkTable
          items={state.items}
          onEdit={(item) => setState((current) => ({ ...current, selected: item }))}
        />
      </div>
    </div>
  );
}
