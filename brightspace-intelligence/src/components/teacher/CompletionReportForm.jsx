"use client";

import { useEffect, useState } from "react";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

export default function CompletionReportForm({ lecture, onSaved }) {
  const [form, setForm] = useState({ topicCovered: "", summary: "", homeworkGiven: "", studentPerformance: "" });
  const [pending, setPending] = useState(false);

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  useEffect(() => {
    let active = true;

    async function loadReport() {
      if (!lecture?.id) {
        setForm({ topicCovered: "", summary: "", homeworkGiven: "", studentPerformance: "" });
        return;
      }

      try {
        const response = await fetch(`/api/teacher/lectures/${lecture.id}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) return;
        if (active && data?.item) {
          setForm({
            topicCovered: data.item.topic_covered || "",
            summary: data.item.summary || "",
            homeworkGiven: data.item.homework_given || "",
            studentPerformance: data.item.student_performance || "",
          });
        }
      } catch {
        if (active) {
          setForm({ topicCovered: "", summary: "", homeworkGiven: "", studentPerformance: "" });
        }
      }
    }

    void loadReport();

    return () => {
      active = false;
    };
  }, [lecture?.id]);

  async function submit(event) {
    event.preventDefault();
    if (!lecture?.id) {
      window.alert("Please select a class first.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/teacher/lectures/${lecture.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.message || "Unable to submit report.");
      onSaved?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to submit report.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-[1.75rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(250,247,240,0.92)_100%)] p-4">
      <input value={form.topicCovered} onChange={(event) => setForm((current) => ({ ...current, topicCovered: event.target.value }))} placeholder="Topic covered" className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
      <textarea value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Class summary" className="min-h-24 rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
      <input value={form.homeworkGiven} onChange={(event) => setForm((current) => ({ ...current, homeworkGiven: event.target.value }))} placeholder="Homework given" className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
      <textarea value={form.studentPerformance} onChange={(event) => setForm((current) => ({ ...current, studentPerformance: event.target.value }))} placeholder="Student performance note" className="min-h-24 rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
      <button disabled={pending} className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0]">
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <LeafSpinnerInline />
            Saving...
          </span>
        ) : (
          "Submit completion report"
        )}
      </button>
    </form>
  );
}
