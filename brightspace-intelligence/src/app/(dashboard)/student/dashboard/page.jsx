"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import StudentPortalNavbar from "@/components/student/StudentPortalNavbar";
import StudentStatsCards from "@/components/student/StudentStatsCards";
import HomeworkList from "@/components/student/HomeworkList";
import AttendanceSummary from "@/components/student/AttendanceSummary";
import NoteThreadsBoard from "@/components/shared/NoteThreadsBoard";
import LMSCalendar from "@/components/calendar/LMSCalendar";
import ActiveHeadlinesBanner from "@/components/shared/ActiveHeadlinesBanner";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatAgeValue(age, dateOfBirth) {
  const explicitAge = String(age || "").trim();
  if (explicitAge) return explicitAge;
  if (!dateOfBirth) return "";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    years -= 1;
  }
  return years > 0 ? `${years} year${years === 1 ? "" : "s"}` : "";
}

function formatDateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export default function StudentDashboardPage() {
  const [state, setState] = useState({
    stats: {},
    headlines: [],
    lectures: [],
    homework: [],
    attendance: { summary: {}, items: [] },
    profile: null,
    subjects: [],
    markedDates: [],
    loading: true,
    error: "",
    monthlyFee: null,
    filters: { date: todayDate(), range: "today", subjectId: "", status: "" },
  });

  async function loadDashboard() {
    const response = await fetch("/api/student/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load dashboard.");
    setState((current) => ({ ...current, stats: data.stats || {}, headlines: Array.isArray(data.headlines) ? data.headlines : [], error: "" }));
  }

  async function loadMonthlyFee() {
    const response = await fetch("/api/monthly-fee-status", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load monthly fee status.");
    setState((current) => ({ ...current, monthlyFee: data.available ? data : null }));
  }

  async function loadHomework() {
    const response = await fetch("/api/student/homework", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load homework.");
    setState((current) => ({ ...current, homework: data.items || [] }));
  }

  async function loadAttendance() {
    const response = await fetch("/api/student/attendance", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load attendance.");
    setState((current) => ({ ...current, attendance: { summary: data.summary || {}, items: data.items || [] } }));
  }

  async function loadProfile() {
    const response = await fetch("/api/student/profile", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load profile.");
    setState((current) => ({ ...current, profile: data.profile || null }));
  }

  async function loadLectures(filters = state.filters) {
    const safe = { ...filters, date: filters.date || todayDate() };
    const params = new URLSearchParams(safe);
    setState((current) => ({ ...current, loading: true }));
    const response = await fetch(`/api/student/calendar-lectures?${params.toString()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load lectures.");
    setState((current) => ({ ...current, filters: { ...current.filters, date: safe.date }, lectures: data.items || [], subjects: data.subjects || [], markedDates: data.markedDates || [], loading: false, error: "" }));
  }

  function updateFilters(filters) {
    setState((current) => ({ ...current, filters }));
    loadLectures(filters).catch((error) => setState((current) => ({ ...current, loading: false, error: error.message })));
  }

  useEffect(() => {
    async function initialize() {
      try { await loadDashboard(); } catch (error) { setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) })); }
      try { await loadHomework(); } catch (error) { setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) })); }
      try { await loadAttendance(); } catch (error) { setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) })); }
      try { await loadProfile(); } catch (error) { setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) })); }
      try { await loadMonthlyFee(); } catch (error) { setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) })); }
      try { await loadLectures({ date: todayDate(), range: "today", subjectId: "", status: "" }); } catch (error) { setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) })); }
    }
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profile = state.profile || {};

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAF7F0]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
        <div className="rounded-[2rem] relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
          <StudentPortalNavbar profile={profile} />

          {state.monthlyFee && !state.monthlyFee.is_paid ? (
            <section className={`w-full rounded-[2rem] border px-5 py-4 text-sm shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl ${state.monthlyFee.overdue ? "border-rose-200 bg-rose-50 text-rose-700" : state.monthlyFee.due_soon ? "border-[#E4C766]/70 bg-[#FFF5D6] text-[#8A6B00]" : "border-[#2D8A6A]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] text-[#0D5C48]"}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-medium">
                  <p className="text-[#BF2106] font-bold">{state.monthlyFee.message || "Monthly fee voucher is not submitted yet. Please submit to continue LMS access."}</p>
                  {typeof state.monthlyFee.days_left === "number" ? (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em]">
                      {state.monthlyFee.days_left >= 0 ? `${state.monthlyFee.days_left} day${state.monthlyFee.days_left === 1 ? "" : "s"} remaining` : `${Math.abs(state.monthlyFee.days_left)} day${Math.abs(state.monthlyFee.days_left) === 1 ? "" : "s"} overdue`}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <ActiveHeadlinesBanner items={state.headlines} />

          <section id="dashboard" className="scroll-mt-28 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#E4C766]">Student dashboard</p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Your learning command center</h1>
            {state.error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
            <div className="mt-6">
              <StudentStatsCards items={[
                { key: "subjects", label: "Assigned Teachers", value: state.stats.total_subjects || 0 },
                { key: "homework", label: "Pending Homeworks", value: state.stats.pending_homeworks || 0 },
                { key: "lectures", label: "Total Lectures", value: state.stats.total_lectures || 0 },
                { key: "conducted", label: "Conducted Lectures", value: state.stats.conducted_lectures || 0 },
                { key: "present", label: "Lectures Present", value: state.stats.lectures_present || 0 },
                { key: "attendance", label: "Attendance Percentage", value: `${state.stats.attendance_percentage || 0}%` },
                { key: "fee", label: "Fee Status", value: state.stats.fee_status_label || "Not Paid" },
              ]} />
            </div>
          </section>

          <motion.section id="calendar" className="scroll-mt-28 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Lecture Calendar</p>
              <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">Plan your study week</h2>
            </div>
            {state.loading ? <OpenBookLoader title="Loading lectures" subtitle="Preparing your calendar..." /> : null}
            <LMSCalendar apiUrl="/api/student/calendar-lectures" filters={state.filters} onDateSelect={(date) => updateFilters({ ...state.filters, date, range: "selected_date" })} />
          </motion.section>

          <motion.section id="homework" className="scroll-mt-28 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Homework</p>
              <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">Assigned work</h2>
            </div>
            <HomeworkList items={state.homework} onRefresh={() => loadHomework().catch((error) => setState((current) => ({ ...current, error: error.message })))} />
          </motion.section>

          <motion.section id="attendance" className="scroll-mt-28 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Attendance</p>
              <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">Conducted lecture attendance</h2>
            </div>
            <AttendanceSummary summary={state.attendance.summary} items={state.attendance.items} />
          </motion.section>

          <motion.section id="notes" className="scroll-mt-28 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Teacher notes</p>
              <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">Latest feedback and updates</h2>
            </div>
            <NoteThreadsBoard mode="student" />
          </motion.section>

          <motion.section id="profile" className="scroll-mt-28 mb-4 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Profile</p>
              <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">Student details</h2>
            </div>
            <div className="grid gap-3 text-sm text-[#245C4F] sm:grid-cols-2 lg:grid-cols-3">
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Name</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.full_name || "Not available"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Username</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.username || "Not available"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Email</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.email || "Not available"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Phone</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.phone || "Not available"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Admission</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.admission_no || "Not assigned"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Age</strong>
                <span className="mt-1 block break-words text-[#063F32]">{formatAgeValue(profile.age, profile.date_of_birth) || "Not assigned"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Date of birth</strong>
                <span className="mt-1 block break-words text-[#063F32]">{formatDateValue(profile.date_of_birth) || "Not assigned"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Class</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.grade_level || "Not assigned"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Status</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.profile_status || profile.user_status || "Not available"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Father name</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.father_name || "Not assigned"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Father phone</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.father_phone || "Not assigned"}</span>
              </p>
              <p className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-sm leading-6 text-[#245C4F]">
                <strong className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Father email</strong>
                <span className="mt-1 block break-words text-[#063F32]">{profile.father_email || "Not assigned"}</span>
              </p>
            </div>
          </motion.section>
        </div>
      </div>
  );
}
