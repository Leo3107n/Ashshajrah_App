"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LeafSpinnerInline, OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

const STATUS_OPTIONS = [
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" },
  { label: "Leave", value: "leave" },
];

export default function TeacherAttendancePage() {
  const MIN_LOADING_MS = 700;
  const [state, setState] = useState({
    classes: [],
    subjects: [],
    lectures: [],
    selectedLecture: null,
    students: [],
    filters: { classLevel: "", subjectId: "", lectureId: "" },
    saving: false,
    loading: false,
    error: "",
  });
  const [classOpen, setClassOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [lectureOpen, setLectureOpen] = useState(false);
  const [statusOpenId, setStatusOpenId] = useState("");
  const [selectedClassLevel, setSelectedClassLevel] = useState("");
  const [selectedClassLabel, setSelectedClassLabel] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedSubjectLabel, setSelectedSubjectLabel] = useState("");
  const [selectedLectureId, setSelectedLectureId] = useState("");
  const [selectedLectureLabel, setSelectedLectureLabel] = useState("");
  const filteredSubjects = useMemo(() => {
    const selected = String(selectedClassLevel || "").trim().toLowerCase();
    if (!selected) return [];
    return state.subjects.filter((item) => String(item.class_level || "").trim().toLowerCase() === selected);
  }, [selectedClassLevel, state.subjects]);

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error(await response.text());
    return response.json();
  }

  async function load(nextFilters = state.filters, options = {}) {
    const showLoader = Boolean(options.showLoader);
    const keepSelection = Boolean(options.keepSelection);
    const nextClassLevel = String(nextFilters.classLevel || "");
    const nextSubjectId = String(nextFilters.subjectId || "");
    const nextLectureId = String(nextFilters.lectureId || "");
    const startedAt = Date.now();
    setState((current) => ({
      ...current,
      filters: nextFilters,
      selectedLecture: keepSelection ? current.selectedLecture : null,
      loading: showLoader ? true : current.loading,
      error: "",
    }));
    setSelectedClassLevel(nextClassLevel);
    setSelectedSubjectId(nextSubjectId);
    setSelectedLectureId(nextLectureId);
    try {
      const params = new URLSearchParams();
      if (nextFilters.classLevel) params.set("classLevel", nextFilters.classLevel);
      if (nextFilters.subjectId) params.set("subjectId", nextFilters.subjectId);
      if (nextFilters.lectureId) params.set("lectureId", nextFilters.lectureId);
      const response = await fetch(`/api/teacher/attendance?${params.toString()}`, { cache: "no-store" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.message || "Unable to load attendance.");
      const elapsed = Date.now() - startedAt;
      if (showLoader && elapsed < MIN_LOADING_MS) {
        await new Promise((resolve) => window.setTimeout(resolve, MIN_LOADING_MS - elapsed));
      }
      setState((current) => ({
        ...current,
        classes: Array.isArray(data.classes) ? data.classes : [],
        subjects: Array.isArray(data.subjects) ? data.subjects : [],
        lectures: Array.isArray(data.lectures) ? data.lectures : [],
        selectedLecture: data.selectedLecture || (keepSelection ? current.selectedLecture : null),
        students: Array.isArray(data.students) ? data.students : [],
        filters: nextFilters,
        loading: false,
        error: "",
      }));
      if (nextClassLevel) {
        const matchedClass = (Array.isArray(data.classes) ? data.classes : []).find(
          (item) => String(item.class_level) === nextClassLevel
        );
        if (matchedClass) {
          setSelectedClassLabel(
            `${matchedClass.class_level}${matchedClass.course_title ? ` - ${matchedClass.course_title}` : ""}`
          );
        }
      }
      if (nextSubjectId) {
        const matchedSubject = (Array.isArray(data.subjects) ? data.subjects : []).find(
          (item) => String(item.id) === nextSubjectId
        );
        if (matchedSubject) {
          setSelectedSubjectLabel(matchedSubject.name || "Selected subject");
        }
      }
      if (data?.selectedLecture?.id) {
        setSelectedClassLevel(nextClassLevel);
        setSelectedSubjectId(nextSubjectId);
        setSelectedLectureId(String(data.selectedLecture.id));
        setSelectedLectureLabel(
          `${data.selectedLecture.title || "Selected lecture"}${data.selectedLecture.subject_name ? ` - ${data.selectedLecture.subject_name}` : ""}${data.selectedLecture.class_level ? ` (${data.selectedLecture.class_level})` : ""}`
        );
      }
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      if (showLoader && elapsed < MIN_LOADING_MS) {
        await new Promise((resolve) => window.setTimeout(resolve, MIN_LOADING_MS - elapsed));
      }
      setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) }));
    }
  }

  useEffect(() => {
    load(undefined, { showLoader: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roster = useMemo(
    () =>
      state.students.map((student) => ({
        ...student,
        currentStatus: String(student.currentStatus || student.status || "absent").toLowerCase(),
      })),
    [state.students]
  );

  const lectureLabel = (item) => {
    const dateLabel = item.scheduled_start ? new Date(item.scheduled_start).toLocaleDateString() : "";
    return `${item.title}${dateLabel ? ` - ${dateLabel}` : ""}${item.subject_name ? ` - ${item.subject_name}` : ""}${item.class_level ? ` (${item.class_level})` : ""}`;
  };

  async function saveAttendance() {
    if (!state.selectedLecture?.id) {
      setState((current) => ({ ...current, error: "Please select an lecture first." }));
      return;
    }

    setState((current) => ({ ...current, saving: true, error: "" }));
    try {
      const response = await fetch("/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lectureId: state.selectedLecture.id,
          students: roster.map((student) => ({
            studentUserId: student.user_id || student.id,
            status: student.currentStatus,
          })),
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.message || "Unable to save attendance.");
      await load(state.filters);
    } catch (error) {
      setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setState((current) => ({ ...current, saving: false }));
    }
  }

  return (
    <div className="min-h-screen border-0 space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none border-0 absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative rounded-[2rem] border-0 mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">Attendance</p>
            <h1 className="mb-2 mt-4 text-3xl font-bold text-[#FAF7F0] sm:text-4xl lg:text-4xl font-display">Manual student attendance</h1>
            <p className="mt-2 max-w-5xl text-sm leading-7 text-[#EAF6EF] sm:text-base lg:whitespace-nowrap">Select a class, subject, and lecture to mark student attendance. Teacher Meet attendance remains synced separately.</p>
          </div>
        </section>

        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className={`grid gap-3 transition-opacity duration-200 md:grid-cols-3 ${state.loading ? "opacity-60" : "opacity-100"}`}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Class</span>
              <div className="relative">
                <select
                  value={selectedClassLevel}
                  onMouseDown={() => setClassOpen((current) => !current)}
                  onChange={(event) => {
                    setClassOpen(false);
                    const nextClassLevel = event.target.value;
                    const nextClassLabel = event.currentTarget.options[event.currentTarget.selectedIndex]?.text || "";
                    setSelectedClassLevel(nextClassLevel);
                    setSelectedClassLabel(nextClassLabel);
                    setSelectedSubjectId("");
                    setSelectedSubjectLabel("");
                    setSelectedLectureId("");
                    setSelectedLectureLabel("");
                    setState((current) => ({ ...current, selectedLecture: null, students: [] }));
                    load({ classLevel: nextClassLevel, subjectId: "", lectureId: "" });
                  }}
                  onFocus={() => setClassOpen(true)}
                  onBlur={() => setClassOpen(false)}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                >
                  <option value="">Select class</option>
                  {selectedClassLevel &&
                  !state.classes.some((item) => String(item.class_level) === String(selectedClassLevel)) &&
                  selectedClassLabel ? (
                    <option value={selectedClassLevel}>{selectedClassLabel}</option>
                  ) : null}
                  {state.classes.map((item) => (
                    <option key={item.class_level} value={item.class_level}>
                      {item.class_level}
                      {item.course_title ? ` - ${item.course_title}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${classOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Subject</span>
              <div className="relative">
                <select
                  value={selectedSubjectId}
                  onMouseDown={() => setSubjectOpen((current) => !current)}
                  onChange={(event) => {
                    setSubjectOpen(false);
                    const nextSubjectId = event.target.value;
                    const nextSubjectLabel = event.currentTarget.options[event.currentTarget.selectedIndex]?.text || "";
                    setSelectedSubjectId(nextSubjectId);
                    setSelectedSubjectLabel(nextSubjectLabel);
                    setSelectedLectureId("");
                    setSelectedLectureLabel("");
                    setState((current) => ({ ...current, selectedLecture: null, students: [] }));
                    load({ classLevel: selectedClassLevel, subjectId: nextSubjectId, lectureId: "" });
                  }}
                  onFocus={() => setSubjectOpen(true)}
                  onBlur={() => setSubjectOpen(false)}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  disabled={!selectedClassLevel}
                >
                  <option value="">Select subject</option>
                  {selectedSubjectId &&
                  !filteredSubjects.some((item) => String(item.id) === String(selectedSubjectId)) &&
                  selectedSubjectLabel ? (
                    <option value={selectedSubjectId}>{selectedSubjectLabel}</option>
                  ) : null}
                  {filteredSubjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${subjectOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Lecture</span>
              <div className="relative">
                <select
                  value={selectedLectureId}
                  onMouseDown={() => setLectureOpen((current) => !current)}
                  onChange={(event) => {
                    setLectureOpen(false);
                    const nextLectureId = event.target.value;
                    const nextLectureLabel = event.currentTarget.options[event.currentTarget.selectedIndex]?.text || "";
                    setSelectedLectureId(nextLectureId);
                    setSelectedLectureLabel(nextLectureLabel);
                    load(
                      {
                        classLevel: selectedClassLevel,
                        subjectId: selectedSubjectId,
                        lectureId: nextLectureId,
                      },
                      { showLoader: true, keepSelection: true }
                    );
                  }}
                  onFocus={() => setLectureOpen(true)}
                  onBlur={() => setLectureOpen(false)}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  disabled={!selectedSubjectId || !state.lectures.length}
                >
                  <option value="">Select lecture</option>
                  {selectedLectureId &&
                  !state.lectures.some((item) => String(item.id) === String(selectedLectureId)) &&
                  selectedLectureLabel ? (
                    <option value={selectedLectureId}>{selectedLectureLabel}</option>
                  ) : null}
                  {state.lectures.map((item) => (
                    <option key={item.id} value={item.id}>
                      {lectureLabel(item)}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${lectureOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </label>
          </div>

          {state.loading ? (
            <div className="mt-4 rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/70 px-4 py-5 shadow-[0_16px_48px_-30px_rgba(13,59,46,0.12)]">
              <OpenBookLoader title="Loading attendance" subtitle="Fetching roster and lecture data..." />
            </div>
          ) : null}
        </section>

        {state.selectedLecture ? (
          <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Lecture</p>
                <h2 className="mt-2 font-body text-2xl font-semibold text-[#063F32]">{state.selectedLecture.title}</h2>
                <p className="mt-1 text-sm text-[#245C4F]">{state.selectedLecture.subject_name} · {state.selectedLecture.class_level}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
                  {state.students.some((student) => String(student.source || "").toLowerCase() === "manual")
                    ? "Edit saved attendance"
                    : "Mark attendance"}
                </p>
              </div>
              <button
                onClick={saveAttendance}
                disabled={state.saving || !roster.length}
                className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state.saving ? (
                  <span className="inline-flex items-center gap-2">
                    <LeafSpinnerInline />
                    Saving...
                  </span>
                ) : (
                  "Save / Update attendance"
                )}
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/80 shadow-[0_16px_48px_-30px_rgba(13,59,46,0.18)]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#F1EADC] text-left text-sm">
                  <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                  <tr>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Username</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Attendance</th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1EADC]">
                    {roster.length ? (
                      roster.map((student) => (
                        <tr key={student.student_id} className="bg-white/70">
                          <td className="px-3 py-4 font-semibold text-[#063F32]">{student.full_name}</td>
                          <td className="px-3 py-4 text-[#245C4F]">{student.username || "-"}</td>
                          <td className="px-3 py-4 text-[#245C4F]">{student.email || "-"}</td>
                          <td className="px-3 py-4 text-[#245C4F]">{student.phone || "-"}</td>
                          <td className="px-3 py-4">
                            <div className="relative max-w-[170px]">
                              <select
                                value={student.currentStatus}
                                onChange={(event) =>
                                  setState((current) => ({
                                    ...current,
                                    students: current.students.map((item) =>
                                      item.student_id === student.student_id ? { ...item, currentStatus: event.target.value } : item
                                    ),
                                  }))
                                }
                                onFocus={() => setStatusOpenId(student.student_id)}
                                onBlur={() => setStatusOpenId((current) => (current === student.student_id ? "" : current))}
                                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                              >
                                {STATUS_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${
                                  statusOpenId === student.student_id ? "rotate-180" : "rotate-0"
                                }`}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-[#245C4F]">
                          No students found for this lecture.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
