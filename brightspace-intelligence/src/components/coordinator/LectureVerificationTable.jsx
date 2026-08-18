"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatDateTime, formatDateTimeRange } from "@/lib/dateTime";
import { getAttendanceStatus, getLectureDisplayStatus } from "@/lib/lectureStatus";

export default function LectureVerificationTable({ items = [], onRefresh }) {
  const [syncNotice, setSyncNotice] = useState("");
  const [syncingId, setSyncingId] = useState("");
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  useEffect(() => {
    if (!syncNotice) return undefined;
    const timeout = window.setTimeout(() => {
      setSyncNotice("");
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [syncNotice]);

  async function syncMeetAttendance(id) {
    setSyncingId(id);
    try {
      const response = await fetch(`/api/coordinator/lecture-schedules/${id}/meet-attendance-sync`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to sync Meet attendance.");
      }

      if (data.available === false || data.partial || data.recording?.share_errors?.length) {
        setSyncNotice(
          data.message ||
            (data.recording?.share_errors?.length
              ? "Meet attendance synced, but recording sharing still needs attention."
              : "Meet attendance may be available only after Google finishes processing the conference record.")
        );
      } else {
        setSyncNotice("Meet data synced successfully.");
      }

      onRefresh?.();
    } finally {
      setSyncingId("");
    }
  }

  async function updateVerification(id, payload) {
    const response = await fetch(`/api/coordinator/lecture-verifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to update lecture verification.");
    }

    onRefresh?.();
  }

  async function submitReject() {
    if (!rejectingItem) return;

    setSubmittingReject(true);
    try {
      await updateVerification(rejectingItem.id, {
        action: "reject",
        remarks: rejectRemarks,
      });
      setRejectingItem(null);
      setRejectRemarks("");
    } finally {
      setSubmittingReject(false);
    }
  }

  function resolveMeetingPerson(person, fallbacks = {}) {
    return {
      name: person?.name || fallbacks.name || "",
      email: person?.email || fallbacks.email || "",
      joined:
        typeof person?.joined === "boolean"
          ? person.joined
          : typeof fallbacks.joined === "boolean"
            ? fallbacks.joined
            : Boolean(person?.joined_at || fallbacks.joined_at),
      status: person?.status || fallbacks.status || "absent",
      joined_at: person?.joined_at || fallbacks.joined_at || null,
      left_at: person?.left_at || fallbacks.left_at || null,
      duration_minutes: Number(person?.duration_minutes ?? fallbacks.duration_minutes ?? 0),
    };
  }

  function isOpaqueParticipantValue(value) {
    const text = String(value || "").trim();
    return /^\d+$/.test(text) || /^\d{15,}$/.test(text);
  }

  function renderParticipantLabel(person) {
    const name = String(person?.name || "").trim();
    const email = String(person?.email || "").trim();

    if (name && !isOpaqueParticipantValue(name)) {
      return name;
    }

    if (email && !isOpaqueParticipantValue(email)) {
      return email;
    }

    return "Participant";
  }

  function renderParticipantEmail(person) {
    const email = String(person?.email || "").trim();
    if (email && !isOpaqueParticipantValue(email)) {
      return email;
    }
    return "";
  }

  function formatAttendanceLabel(status, fallbackDuration) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized) return normalized;
    return getAttendanceStatus(fallbackDuration);
  }

  function getAttendanceTone(status, source) {
    const normalized = String(status || "").trim().toLowerCase();
    if (source === "manual") {
      if (normalized === "present") return "bg-amber-100 text-amber-800";
      if (normalized === "leave") return "bg-sky-100 text-sky-800";
      if (normalized === "absent") return "bg-rose-100 text-rose-700";
      return "bg-[#F1EADC] text-[#245C4F]";
    }

    if (normalized === "present") return "bg-emerald-100 text-emerald-800";
    if (normalized === "leave") return "bg-sky-100 text-sky-800";
    if (normalized === "absent") return "bg-rose-100 text-rose-700";
    return "bg-[#F1EADC] text-[#245C4F]";
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative space-y-4">
      {items.length ? (
        items.map((item) => (
          <article key={item.id} className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(6,63,50,0.18)] backdrop-blur-xl">
            {(() => {
              const meetMeta =
                item.google_meet_sync_meta && typeof item.google_meet_sync_meta === "object"
                  ? item.google_meet_sync_meta
                  : {};
              const host = resolveMeetingPerson(meetMeta.host, {
                name: item.coordinator_name,
                email: item.coordinator_email,
                joined: item.coordinator_joined,
                status: item.coordinator_attendance_status,
                joined_at: item.coordinator_joined_at,
                left_at: item.coordinator_left_at,
                duration_minutes: item.coordinator_duration_minutes,
              });
              const cohost = resolveMeetingPerson(meetMeta.cohost, {
                name: item.teacher_name,
                email: item.teacher_email,
                joined: item.teacher_joined,
                status: item.teacher_attendance_status,
                joined_at: item.teacher_joined_at,
                left_at: item.teacher_left_at,
                duration_minutes: item.teacher_duration_minutes,
              });
              const others = Array.isArray(meetMeta.others) ? meetMeta.others : [];
              const recording = meetMeta.recording || null;

              return (
                <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-[#063F32]">{item.title}</p>
                <p className="mt-1 text-sm text-[#245C4F]">
                  Class roster: {item.course_title || item.class_level || "Class"} · {item.subject_name} · {item.teacher_name}
                </p>
                <p className="mt-1 text-sm text-[#245C4F]">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{item.display_status || getLectureDisplayStatus(item)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={syncingId === item.id}
                  onClick={() => syncMeetAttendance(item.id).catch((error) => window.alert(error.message))}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF1E7] focus:outline-none focus:ring-4 focus:ring-[#C9A227]/20 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {syncingId === item.id ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0D5C48]/25 border-t-[#0D5C48]" />
                      Syncing...
                    </>
                  ) : (
                    "Sync Meet Attendance"
                  )}
                </button>
                {['completed_by_teacher', 'live', 'scheduled', 'upcoming'].includes(String(item.display_status || item.status || '').toLowerCase()) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const manualConfirm = !item.summary && !item.topic_covered
                          ? window.confirm("Teacher completion report is missing. Approve manually?")
                          : false;
                        if (!item.summary && !item.topic_covered && !manualConfirm) return;
                        updateVerification(item.id, { action: "approve", manualConfirm }).catch((error) => window.alert(error.message));
                      }}
                      className="rounded-xl bg-[#0D5C48] px-3 py-2 text-xs font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-[#C9A227]/20"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingItem(item);
                        setRejectRemarks(item.remarks || "");
                      }}
                      className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] focus:outline-none focus:ring-4 focus:ring-[#C9A227]/20"
                    >
                      Reject
                    </button>
                    <button type="button" onClick={() => updateVerification(item.id, { action: "mark_missed" }).catch((error) => window.alert(error.message))} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] focus:outline-none focus:ring-4 focus:ring-[#C9A227]/20">
                      Mark missed
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
                <p className="font-semibold text-[#063F32]">Teacher report</p>
                <p className="mt-2">{item.summary || item.topic_covered || "No teacher summary submitted."}</p>
              </div>
              <div className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
                <p className="font-semibold text-[#063F32]">Host attendance</p>
                <p className="mt-2">{host.name || "Coordinator"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Email: {host.email || "-"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Joined: {host.joined ? "Yes" : "No"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Status: {host.status || "absent"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Joined at: {host.joined_at ? formatDateTime(host.joined_at) : "-"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Left at: {host.left_at ? formatDateTime(host.left_at) : "-"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">{host.duration_minutes} minutes</p>
              </div>
              <div className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
                <p className="font-semibold text-[#063F32]">Teacher attendance</p>
                <p className="mt-2">{cohost.name || item.teacher_name}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Email: {cohost.email || "-"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Role: Co-host</p>
                <p className="mt-1 text-xs text-[#245C4F]">Joined: {cohost.joined ? "Yes" : "No"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Status: {cohost.status || "absent"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Joined at: {cohost.joined_at ? formatDateTime(cohost.joined_at) : "-"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Left at: {cohost.left_at ? formatDateTime(cohost.left_at) : "-"}</p>
                <p className="mt-1 text-xs text-[#245C4F]">{cohost.duration_minutes} minutes</p>
              </div>
              <div className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
                <p className="font-semibold text-[#063F32]">Recording</p>
                {recording?.url || item.recording_drive_url ? (
                  <a
                    href={recording?.url || item.recording_drive_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex rounded-xl border border-[#2D8A6A]/15 bg-white/80 px-3 py-2 text-sm font-semibold text-[#0D5C48]"
                  >
                    Open recording
                  </a>
                ) : (
                  <p className="mt-2">No recording link available yet.</p>
                )}
                <p className="mt-2 text-xs text-[#245C4F]">Recording appears after Google Meet finishes processing it.</p>
              </div>
              <div className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
                <p className="font-semibold text-[#063F32]">Student attendance</p>
                <p className="mt-2">Class roster: {item.total_students_count || 0}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Present count: {item.joined_students_count || 0}</p>
                <p className="mt-1 text-xs text-[#245C4F]">Absent count: {item.absent_students_count ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
                <p className="font-semibold text-[#063F32]">Remarks</p>
                <p className="mt-2">{item.remarks || item.student_performance || "No remarks yet."}</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[#2D8A6A]/15">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr] bg-[#FAF7F0] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#245C4F]">
                <span>Student Name</span>
                <span>Username / Phone</span>
                <span>Teacher Marked</span>
                <span>Stored Status</span>
              </div>
              {Array.isArray(item.attendance_rows) && item.attendance_rows.length ? (
                item.attendance_rows.map((row) => (
                  <div key={row.id || row.user_id} className="grid grid-cols-[1fr_1fr_1fr_1fr] px-4 py-3 text-sm text-[#245C4F]">
                    <span>{row.student_name}</span>
                    <span>{row.username || row.student_phone || row.student_email || "-"}</span>
                    <span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getAttendanceTone(row.pending_status || row.status, row.source)}`}>
                        {formatAttendanceLabel(row.pending_status || row.status, row.duration_minutes)}
                      </span>
                      <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-[#8A7A63]">
                        {row.source === "manual" ? "Teacher mark" : "Meet sync"}
                      </span>
                    </span>
                    <span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getAttendanceTone(row.status, row.pending_status ? "" : row.source)}`}>
                        {formatAttendanceLabel(row.status, row.duration_minutes)}
                      </span>
                    </span>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr] px-4 py-3 text-sm text-[#245C4F]">
                  <span>{item.course_title || item.class_level || "Class roster"}</span>
                  <span>{item.total_students_count || 0} students</span>
                  <span>-</span>
                  <span>{item.student_attendance_status || getAttendanceStatus(item.student_duration_minutes)}</span>
                </div>
              )}
            </div>
                </>
              );
            })()}
          </article>
        ))
      ) : (
        <div className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-5 py-10 text-sm text-[#245C4F] shadow-[0_20px_70px_-36px_rgba(6,63,50,0.18)] backdrop-blur-xl">
          No lecture verification records available.
        </div>
      )}

      {syncNotice ? (
        <div className="pointer-events-none fixed right-4 top-24 z-[92] w-full max-w-sm sm:right-6">
          <div className="pointer-events-auto rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.99)_100%)] p-4 shadow-[0_24px_70px_-30px_rgba(13,59,46,0.28)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex rounded-full border border-[#2D8A6A]/15 bg-[#EAF6EF] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">
                  Meet sync
                </p>
                <p className="mt-2 text-sm font-medium text-[#245C4F]">{syncNotice}</p>
              </div>
              <button
                type="button"
                onClick={() => setSyncNotice("")}
                className="rounded-lg border border-[#2D8A6A]/15 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectingItem ? (
        <div className="absolute inset-0 z-[80] rounded-[2rem] bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.99)_100%)] p-6 shadow-[0_30px_90px_-36px_rgba(13,59,46,0.28)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-700">
                  Reject lecture
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-[#063F32]">Add rejection reason</h3>
                <p className="mt-2 text-sm text-[#245C4F]">
                  Share the reason for rejecting <span className="font-semibold text-[#063F32]">{rejectingItem.title}</span>.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <textarea
                value={rejectRemarks}
                onChange={(event) => setRejectRemarks(event.target.value)}
                rows={5}
                placeholder="Write rejection reason..."
                className="w-full rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#2D8A6A]/10"
              />
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (submittingReject) return;
                    setRejectingItem(null);
                    setRejectRemarks("");
                  }}
                  className="rounded-xl border border-[#2D8A6A]/15 bg-white/80 px-4 py-3 text-sm font-semibold text-[#245C4F] transition hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingReject || !rejectRemarks.trim()}
                  onClick={() => submitReject().catch((error) => setSyncNotice(error.message))}
                  className="rounded-xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingReject ? "Rejecting..." : "Reject lecture"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
