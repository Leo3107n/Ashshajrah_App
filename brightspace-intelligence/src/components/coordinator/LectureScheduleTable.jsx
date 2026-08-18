"use client";

import { motion } from "framer-motion";
import { formatDateTimeRange } from "@/lib/dateTime";
import { getLectureDisplayStatus, getLecturePrimaryLink } from "@/lib/lectureStatus";

export default function LectureScheduleTable({ items = [], onRefresh }) {
  const finalStatuses = new Set(["cancelled", "verified_by_coordinator", "completed_by_teacher"]);

  async function patchSchedule(id, payload) {
    const response = await fetch(`/api/coordinator/lecture-schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to update lecture schedule.");
    }

    onRefresh?.();
  }

  function promptReschedule(item) {
    const scheduledStart = window.prompt("New start (YYYY-MM-DDTHH:mm)", item.scheduled_start?.replace(" ", "T").slice(0, 16) || "");
    const scheduledEnd = window.prompt("New end (YYYY-MM-DDTHH:mm)", item.scheduled_end?.replace(" ", "T").slice(0, 16) || "");
    if (!scheduledStart || !scheduledEnd) return;
    const googleMeetLink = window.prompt("New Google Meet Link (optional fallback)", item.google_meet_link || "") || "";
    if (googleMeetLink.trim() && !googleMeetLink.trim().startsWith("https://meet.google.com/")) {
      window.alert("Google Meet link must start with https://meet.google.com/.");
      return;
    }
    const notes = window.prompt("Optional reason / notes", item.description || "") || "";
    patchSchedule(item.id, { action: "reschedule", scheduledStart, scheduledEnd, googleMeetLink: googleMeetLink.trim(), description: notes }).catch((error) => window.alert(error.message));
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(6,63,50,0.18)] backdrop-blur-xl">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.15fr)_minmax(0,1.35fr)_180px] gap-3 border-b border-[#2D8A6A]/10 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48] lg:grid lg:items-center">
        <span>Lecture</span>
        <span>Subject</span>
        <span>Start date</span>
        <span>End date</span>
        <span>Start time</span>
        <span>End time</span>
        <span>Days</span>
        <span>Status</span>
        <span>Class / Meet</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-[#2D8A6A]/10">
        {items.length ? (
          items.map((item) => {
            const statusKey = String(item.status || "").toLowerCase();
            const isFinal = finalStatuses.has(statusKey);
            const primaryLink = getLecturePrimaryLink(item);

            return (
              <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.15fr)_minmax(0,1.35fr)_180px] lg:items-center">
                <div>
                  <p className="font-semibold text-[#063F32]">{item.title}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">
                    {item.student_count > 1 ? `${item.student_count} students` : item.student_names} with {item.teacher_name}
                  </p>
                </div>
                <p className="text-sm text-[#245C4F]">{item.subject_name}</p>
                <p className="text-sm text-[#245C4F]">{item.start_date || String(item.scheduled_start || '').split('T')[0]}</p>
                <p className="text-sm text-[#245C4F]">{item.end_date || String(item.scheduled_end || '').split('T')[0]}</p>
                <p className="text-sm text-[#245C4F]">{item.start_time || ''}</p>
                <p className="text-sm text-[#245C4F]">{item.end_time || ''}</p>
                <p className="text-sm text-[#245C4F]">{item.days_active || 'N/A'}</p>
                <p className="min-w-0 text-sm leading-6 text-[#245C4F] break-words">{item.display_status || item.status || getLectureDisplayStatus(item)}</p>
                <div className="min-w-0 text-sm leading-6 text-[#245C4F] break-words">
                  <p>{item.course_title}</p>
                  {item.meet_link_source ? <p className="mt-1 text-xs text-[#245C4F]">Link source: {item.meet_link_source}</p> : null}
                  {primaryLink ? (
                    <a href={primaryLink.href} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-semibold text-[#0D5C48]">
                      {primaryLink.label}
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-[#245C4F]">No active Meet or recording link</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button type="button" disabled={isFinal} onClick={() => patchSchedule(item.id, { action: "cancel" }).catch((error) => window.alert(error.message))} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isFinal}
                    onClick={() => promptReschedule(item)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reschedule
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-5 py-10 text-sm text-[#245C4F]">No lecture schedules available.</div>
        )}
      </div>
    </motion.div>
  );
}
