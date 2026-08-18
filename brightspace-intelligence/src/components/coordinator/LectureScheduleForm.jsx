"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function LectureScheduleForm({ options, onSuccess }) {
  const [form, setForm] = useState({
    courseId: "",
    studentIds: [],
    teacherId: "",
    subjectId: "",
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    days: [],
    googleMeetLink: "",
  });
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherNotice, setTeacherNotice] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const assignmentLookupRef = useRef(0);
  const [classOpen, setClassOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadClasses() {
      const response = await fetch("/api/coordinator/classes", { cache: "no-store" });
      const data = await response.json();

      if (active && response.ok) {
        setClasses(data.items || []);
      }
    }

    void loadClasses();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadClassData() {
      if (!form.courseId) {
        setStudents([]);
        setSubjects([]);
        setTeachers([]);
        setTeacherNotice("");
        return;
      }

      setLoadingOptions(true);

      try {
        const [studentsResponse, subjectsResponse] = await Promise.all([
          fetch(`/api/coordinator/classes/${form.courseId}/students`, { cache: "no-store" }),
          fetch(`/api/coordinator/classes/${form.courseId}/subjects`, { cache: "no-store" }),
        ]);
        const [studentsData, subjectsData] = await Promise.all([
          studentsResponse.json(),
          subjectsResponse.json(),
        ]);

        if (!studentsResponse.ok) {
          throw new Error(studentsData?.message || "Unable to load class students.");
        }
        if (!subjectsResponse.ok) {
          throw new Error(subjectsData?.message || "Unable to load class subjects.");
        }

        if (active) {
          setStudents(studentsData.items || []);
          setSubjects(subjectsData.items || []);
          setTeachers([]);
        }
      } catch (error) {
        if (active) {
          setStudents([]);
          setSubjects([]);
          setTeachers([]);
          window.alert(error instanceof Error ? error.message : "Unable to load class data.");
        }
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    }

    void loadClassData();

    return () => {
      active = false;
    };
  }, [form.courseId]);

  useEffect(() => {
    let active = true;

    async function loadAssignedTeachers() {
      if (!form.courseId || !form.subjectId) {
        setTeachers([]);
        setTeacherNotice("");
        setForm((current) => ({ ...current, teacherId: "" }));
        return;
      }

      setTeachersLoading(true);
      setTeacherNotice("");

      try {
        const lookupId = ++assignmentLookupRef.current;
        const response = await fetch(
          `/api/coordinator/teacher-assignments/lookup?course_id=${encodeURIComponent(form.courseId)}&subject_id=${encodeURIComponent(form.subjectId)}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load assigned teachers.");
        }

        if (active) {
          const assignedTeachers = data.items || [];
          setTeachers(assignedTeachers);

          if (lookupId === assignmentLookupRef.current) {
            if (assignedTeachers.length === 1) {
              setForm((current) => ({ ...current, teacherId: assignedTeachers[0].teacher_id }));
              setTeacherNotice("");
            } else {
              setForm((current) => ({ ...current, teacherId: "" }));
              setTeacherNotice(
                assignedTeachers.length
                  ? "Multiple teachers assigned for this class and subject. Please update the assignment so only one teacher is active."
                  : "No teacher assigned for this class and subject."
              );
            }
          }
        }
      } catch {
        if (active) {
          setTeachers([]);
          setTeacherNotice("No teacher assigned for this class and subject.");
          setForm((current) => ({ ...current, teacherId: "" }));
        }
      } finally {
        if (active) {
          setTeachersLoading(false);
        }
      }
    }

    void loadAssignedTeachers();

    return () => {
      active = false;
    };
  }, [form.courseId, form.subjectId]);

  function closeSelectState() {
    setClassOpen(false);
    setSubjectOpen(false);
    setTeacherOpen(false);
  }

  function showToast(message) {
    setToast(message);
    window.clearTimeout(window.__lectureScheduleToastTimer);
    window.__lectureScheduleToastTimer = window.setTimeout(() => setToast(""), 2800);
  }

  function toggleStudent(studentId) {
    setForm((current) => ({
      ...current,
      studentIds: current.studentIds.includes(studentId)
        ? current.studentIds.filter((id) => id !== studentId)
        : [...current.studentIds, studentId],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const startDate = new Date(form.startDate);
    const endDate = new Date(form.endDate);

    if (!form.courseId || !form.subjectId || !form.teacherId || !form.title) {
      showToast("Class, subject, teacher, and title are required.");
      return;
    }

    const meetLink = form.googleMeetLink.trim();

    if (meetLink && !meetLink.startsWith("https://meet.google.com/")) {
      showToast("Google Meet link must start with https://meet.google.com/.");
      return;
    }

    if (!form.startDate || !form.endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      showToast("Lecture end date must be on or after the start date.");
      return;
    }

    if (!form.startTime || !form.endTime) {
      showToast("Lecture start and end times are required.");
      return;
    }

    const [startHours, startMinutes] = form.startTime.split(":").map(Number);
    const [endHours, endMinutes] = form.endTime.split(":").map(Number);
    if (
      Number.isNaN(startHours) ||
      Number.isNaN(startMinutes) ||
      Number.isNaN(endHours) ||
      Number.isNaN(endMinutes) ||
      startHours < 0 ||
      startHours > 23 ||
      endHours < 0 ||
      endHours > 23 ||
      startMinutes < 0 ||
      startMinutes > 59 ||
      endMinutes < 0 ||
      endMinutes > 59
    ) {
      showToast("Please provide valid lecture start and end times.");
      return;
    }

    if (!form.days.length) {
      showToast("Select at least one lecture day.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = meetLink ? { ...form, googleMeetLink: meetLink } : { ...form };
      const response = await fetch("/api/coordinator/lecture-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to schedule lecture.");
      }

      setForm({
        courseId: "",
        studentIds: [],
        teacherId: "",
        subjectId: "",
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        days: [],
        googleMeetLink: "",
      });
      setStudents([]);
      setSubjects([]);
      setTeachers([]);
      setTeacherNotice("");
      onSuccess?.();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to schedule lecture.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {toast ? (
        <div className="fixed right-6 top-6 z-[90] rounded-2xl border border-[#2D8A6A]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-3 text-sm font-semibold text-[#063F32] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.22)] backdrop-blur-xl">
          {toast}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="grid gap-3 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl lg:grid-cols-2">
      <div className="relative">
        <select
          value={form.courseId}
          onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value, subjectId: "", teacherId: "" }))}
          onMouseDown={() => setClassOpen((current) => !current)}
          onFocus={() => setClassOpen(true)}
          onBlur={closeSelectState}
          className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
        >
          <option value="">Select class</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${classOpen ? "rotate-180" : "rotate-0"}`} />
      </div>

      <div className="relative">
        <select
          value={form.subjectId}
          onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value, teacherId: "" }))}
          onMouseDown={() => setSubjectOpen((current) => !current)}
          onFocus={() => setSubjectOpen(true)}
          onBlur={closeSelectState}
          className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
        >
          <option value="">{loadingOptions ? "Loading subjects..." : form.courseId ? "Select class subject" : "Select class first"}</option>
          {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${subjectOpen ? "rotate-180" : "rotate-0"}`} />
      </div>

      <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 text-sm text-[#245C4F]">
        {teachers.length === 1 ? teachers[0].teacher_name : teacherNotice || (teachersLoading ? "Loading assigned teacher..." : "Assigned teacher appears here")}
      </div>

      {teacherNotice ? <p className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 text-sm text-[#245C4F]">{teacherNotice}</p> : null}

      <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Lecture title" className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20" />
      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
        <div>
          <label className="block text-sm font-semibold text-[#245C4F]">Start date</label>
          <input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#245C4F]">End date</label>
          <input type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#245C4F]">Start time</label>
          <input type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#245C4F]">End time</label>
          <input type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20" />
        </div>
      </div>

      <div className="lg:col-span-2">
        <p className="mb-2 text-sm font-semibold text-[#245C4F]">Lecture days</p>
        <div className="grid gap-2 grid-cols-3 lg:grid-cols-7">
          {[
            { key: "sun", label: "Sunday" },
            { key: "mon", label: "Monday" },
            { key: "tue", label: "Tuesday" },
            { key: "wed", label: "Wednesday" },
            { key: "thu", label: "Thursday" },
            { key: "fri", label: "Friday" },
            { key: "sat", label: "Saturday" },
          ].map((weekday) => (
            <label key={weekday.key} className="inline-flex items-center gap-2 rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32]">
              <input
                type="checkbox"
                checked={form.days.includes(weekday.key)}
                onChange={() => setForm((current) => ({
                  ...current,
                  days: current.days.includes(weekday.key)
                    ? current.days.filter((value) => value !== weekday.key)
                    : [...current.days, weekday.key],
                }))}
              />
              {weekday.label}
            </label>
          ))}
        </div>
      </div>

      <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Coordinator notes or agenda" className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none lg:col-span-2 focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20" />

      <button type="submit" disabled={submitting} className="rounded-2xl bg-[#0D5C48] px-5 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] lg:col-span-2">
        {submitting ? "Saving..." : "Schedule for all active students"}
      </button>
      </form>
    </>
  );
}
