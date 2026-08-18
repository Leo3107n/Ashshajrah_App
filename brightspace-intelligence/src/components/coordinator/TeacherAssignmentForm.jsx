"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

export default function TeacherAssignmentForm({ options, onSuccess }) {
  const [form, setForm] = useState({
    teacherId: "",
    courseId: "",
    subjectId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [classSubjects, setClassSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);

  function closeSelectState() {
    setTeacherOpen(false);
    setClassOpen(false);
    setSubjectOpen(false);
  }

  useEffect(() => {
    let active = true;

    async function loadClassSubjects() {
      if (!form.courseId) {
        setClassSubjects([]);
        return;
      }

      setSubjectsLoading(true);

      try {
        const response = await fetch(
          `/api/coordinator/teacher-assignments/lookup?course_id=${encodeURIComponent(form.courseId)}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load class subjects.");
        }

        if (active) {
          setClassSubjects(data.items || []);
        }
      } catch {
        if (active) {
          setClassSubjects([]);
        }
      } finally {
        if (active) {
          setSubjectsLoading(false);
        }
      }
    }

    void loadClassSubjects();

    return () => {
      active = false;
    };
  }, [form.courseId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/coordinator/teacher-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to assign teacher.");
      }

      setForm({ teacherId: "", courseId: "", subjectId: "" });
      onSuccess?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to assign teacher.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl lg:grid-cols-3">
      <div className="relative">
        <select
          value={form.teacherId}
          onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}
          onMouseDown={() => setTeacherOpen((current) => !current)}
          onFocus={() => setTeacherOpen(true)}
          onBlur={closeSelectState}
          className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
        >
          <option value="">Select teacher</option>
          {options.teachers?.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${teacherOpen ? "rotate-180" : "rotate-0"}`} />
      </div>
      <div className="relative">
        <select
          value={form.courseId}
          onChange={(event) => { setClassSubjects([]); setForm((current) => ({ ...current, courseId: event.target.value, subjectId: "" })); }}
          onMouseDown={() => setClassOpen((current) => !current)}
          onFocus={() => setClassOpen(true)}
          onBlur={closeSelectState}
          className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
        >
          <option value="">Select class</option>
          {options.courses?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${classOpen ? "rotate-180" : "rotate-0"}`} />
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <select
            value={form.subjectId}
            onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))}
            onMouseDown={() => setSubjectOpen((current) => !current)}
            onFocus={() => setSubjectOpen(true)}
            onBlur={closeSelectState}
            className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
          >
            <option value="" disabled>
              {subjectsLoading
                ? "Loading available subjects..."
                : form.courseId
                  ? "Select available subject"
                  : "Select class first"}
            </option>
            {classSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${subjectOpen ? "rotate-180" : "rotate-0"}`} />
        </div>
        <button type="submit" disabled={submitting} className="rounded-2xl bg-[#0D5C48] px-5 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]">
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <LeafSpinnerInline />
              Saving...
            </span>
          ) : (
            "Assign"
          )}
        </button>
      </div>
    </form>
  );
}
