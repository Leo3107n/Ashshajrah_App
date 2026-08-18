"use client";

import { useCallback, useEffect, useState } from "react";
import LectureScheduleForm from "@/components/coordinator/LectureScheduleForm";
import LectureScheduleTable from "@/components/coordinator/LectureScheduleTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

export default function CoordinatorLectureSchedulesPage() {
  const [state, setState] = useState({
    items: [],
    students: [],
    enrollments: [],
    subjects: [],
    teachers: [],
    classes: [],
    error: "",
    loading: true,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    const response = await fetch("/api/coordinator/lecture-schedules", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load lecture schedules.");
    }

    setState({
      items: data.items || [],
      students: data.students || [],
      enrollments: data.enrollments || [],
      subjects: data.subjects || [],
      teachers: data.teachers || [],
      classes: data.classes || data.courses || [],
      error: "",
      loading: false,
    });
  }, []);

  useEffect(() => {
    load().catch((error) =>
      setState((current) => ({ ...current, loading: false, error: error.message }))
    );
  }, [load]);

  return (
    <div className="min-h-screen space-y-6 bg-[#FAF7F0] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))]" />
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
              Coordinator portal
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Plan classes and Meet sessions</h1>
            <p className="mt-3 text-sm leading-7 text-[#FAF7F0] sm:text-base">
              Create lectures, assign teachers, and manage class timing changes.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3 text-sm text-[#FAF7F0]">
            {state.items.length} lectures loaded
          </div>
        </div>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <LectureScheduleForm options={state} onSuccess={load} />
      {state.loading ? <OpenBookLoader title="Loading lecture schedules" subtitle="Fetching schedule data..." /> : null}
      <ShowMoreSection
        items={state.items}
        initialCount={7}
        step={7}
        renderItems={(visibleItems) => <LectureScheduleTable items={visibleItems} onRefresh={load} />}
        emptyMessage="No lecture schedules available."
      />
      </div>
    </div>
  );
}
