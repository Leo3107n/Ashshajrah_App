"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { getLectureDisplayStatus, getLectureEventDetailLink, getLecturePrimaryLink } from "@/lib/lectureStatus";

const APP_TIMEZONE = "Asia/Karachi";

function isJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

function parseDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function formatLocalDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
}

function formatLocalDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-PK", { timeZone: APP_TIMEZONE, dateStyle: "medium", timeStyle: "short" });
}

function pickActiveTime(lecture) {
  const start = lecture?.rescheduled_start || lecture?.rescheduledStartTime || lecture?.rescheduled_scheduled_start || lecture?.scheduled_start || lecture?.scheduledStart;
  const end = lecture?.rescheduled_end || lecture?.rescheduledEndTime || lecture?.rescheduled_scheduled_end || lecture?.scheduled_end || lecture?.scheduledEnd;
  return { start, end };
}

function getLectureClassLabel(lecture) {
  return (
    lecture?.class_level ||
    lecture?.classLevel ||
    lecture?.course_title ||
    lecture?.courseTitle ||
    lecture?.course_name ||
    lecture?.courseName ||
    lecture?.class_name ||
    lecture?.className ||
    lecture?.grade_level ||
    lecture?.gradeLevel ||
    ""
  );
}

export default function LMSCalendar({ apiUrl, filters = {}, extraParams = {}, onDateSelect, onEventClick, popupMode = "screen" }) {
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("timeGridWeek");
  const [copyToast, setCopyToast] = useState("");
  const activeDate = filters.date || formatLocalDate(new Date());
  const firstEventDate = events[0]?.start ? String(events[0].start).slice(0, 10) : "";

  const query = useMemo(() => {
    const params = new URLSearchParams({
      range: "all",
      date: activeDate,
      classLevel: filters.classLevel || "",
      subjectId: filters.subjectId || "",
      status: filters.status || "",
      ...Object.fromEntries(Object.entries(extraParams || {}).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")),
    });
    return params.toString();
  }, [activeDate, extraParams, filters.classLevel, filters.subjectId, filters.status]);

  useEffect(() => {
    calendarRef.current?.getApi?.().gotoDate?.(activeDate);
  }, [activeDate, view]);

  useEffect(() => {
    const api = calendarRef.current?.getApi?.();
    if (!api || !events.length) return;
    if (view !== "dayGridMonth") {
      const hasEventOnActiveDate = events.some((event) => String(event.start || "").slice(0, 10) === activeDate);
      const targetDate = hasEventOnActiveDate ? activeDate : firstEventDate || activeDate;
      if (targetDate) api.gotoDate?.(targetDate);
    }
  }, [activeDate, events, firstEventDate, view]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!apiUrl) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${apiUrl}?${query}`, { cache: "no-store" });
        const payload = isJsonResponse(response) ? await response.json() : { message: await response.text() };
        if (!response.ok) throw new Error(payload?.message || "Unable to load lectures.");
        if (ignore) return;
        const rows = Array.isArray(payload?.items) ? payload.items : [];
        setEvents(
          rows.map((lecture) => {
            const displayStatus = lecture.display_status || getLectureDisplayStatus(lecture);
            const { start: activeStartValue, end: activeEndValue } = pickActiveTime(lecture);
            const startDate = parseDate(activeStartValue);
            const endDate = parseDate(activeEndValue);
            const startText = startDate ? new Date(startDate).toLocaleTimeString("en-PK", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }) : "";
            const endText = endDate ? new Date(endDate).toLocaleTimeString("en-PK", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }) : "";
            const palette = displayStatus === "live" ? ["#2563eb", "#1d4ed8"] : ["#75797D", "#666A6E"];
            const classLevel = getLectureClassLabel(lecture);
            return {
              id: lecture.id,
              title: `${startText}${endText ? ` - ${endText}` : ""}${lecture.subject_name ? ` ${lecture.subject_name}` : ""}`,
              start: startDate,
              end: endDate,
              backgroundColor: palette[0],
              borderColor: palette[1],
              textColor: displayStatus === "live" ? "#ffffff" : "#063F32",
              extendedProps: {
                lecture_id: lecture.id,
                title: lecture.title,
                subject_name: lecture.subject_name,
                class_level: classLevel,
                class_name: lecture.class_name || lecture.className || "",
                course_title: lecture.course_title || lecture.courseTitle || "",
                grade_level: lecture.grade_level || lecture.gradeLevel || "",
                teacher_name: lecture.teacher_name,
                scheduled_start: activeStartValue,
                scheduled_end: activeEndValue,
                display_status: displayStatus,
                status: lecture.status,
                google_meet_link: lecture.google_meet_link,
                recording_drive_url: lecture.recording_drive_url,
                primary_link: getLecturePrimaryLink(lecture),
                event_detail_link: getLectureEventDetailLink(lecture),
                description: lecture.description,
                rescheduled_start: lecture.rescheduled_start || lecture.rescheduledStartTime || lecture.rescheduled_scheduled_start,
                rescheduled_end: lecture.rescheduled_end || lecture.rescheduledEndTime || lecture.rescheduled_scheduled_end,
              },
            };
          })
        );
      } catch (fetchError) {
        if (!ignore) setError(fetchError instanceof Error ? fetchError.message : "Unable to load lectures.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [apiUrl, query]);

  function handleEventClick(info) {
    const lecture = info.event.extendedProps || null;
    setSelected(lecture);
    onEventClick?.(lecture);
  }

  function handleDateClick(info) {
    onDateSelect?.(info.dateStr);
  }

  async function handleCopyMeetLink(link) {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopyToast("Meet link copied.");
      window.setTimeout(() => setCopyToast(""), 2200);
    } catch {
      setCopyToast("Unable to copy meet link.");
      window.setTimeout(() => setCopyToast(""), 2200);
    }
  }

  return (
    <div className="relative rounded-[1.75rem] bg-[#FAF7F0] p-0 px-0 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-3">
        <FullCalendar
          key={view}
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          initialDate={activeDate}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
          events={events}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          height="auto"
          nowIndicator
          selectable={false}
          editable={false}
          weekends
          allDaySlot={false}
          timeZone={APP_TIMEZONE}
          eventDisplay="block"
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", hour12: true }}
          loading={setLoading}
          slotMinTime="08:00:00"
          slotMaxTime="18:00:00"
          scrollTime="08:00:00"
          slotDuration="01:00:00"
          expandRows
          datesSet={(info) => {
            const nextView = info?.view?.type;
            if (nextView && nextView !== view) setView(nextView);
          }}
          eventClassNames={() => ["cursor-pointer"]}
          eventContent={(arg) => (
            <div className="overflow-hidden px-1 text-[11px] leading-tight text-white">
              <div className="truncate font-semibold">{arg.event.title}</div>
              {arg.event.extendedProps?.class_level ? (
                <div className="truncate text-[10px] text-white/90">{arg.event.extendedProps.class_level}</div>
              ) : null}
            </div>
          )}
        />
        {loading ? <p className="mt-3 text-sm text-[#245C4F]">Loading lectures...</p> : null}
      </div>

      {copyToast ? (
        <div className="absolute right-4 top-4 z-[10000] rounded-2xl border border-[#2D8A6A]/20 bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-3 text-sm font-semibold text-[#FFF5D6] shadow-[0_18px_40px_-24px_rgba(13,59,46,0.55)]">
          {copyToast}
        </div>
      ) : null}

      {selected ? (
        <div
          className={
            popupMode === "page"
              ? "absolute inset-0 z-[9999] rounded-[2rem] flex items-center justify-center bg-[#063F32]/45 px-4 pt-16 backdrop-blur-sm"
              : "fixed inset-0 z-[9999] rounded-[2rem] flex items-center justify-center bg-[#063F32]/45 px-4 pt-16 backdrop-blur-sm"
          }
        >
          <div className={`w-full overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] ${popupMode === "page" ? "max-w-lg" : "max-w-lg"}`}>
            <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Lecture details</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">{selected.title || "Lecture"}</h3>
                <p className="mt-1 text-sm text-[#245C4F]">
                  {selected.subject_name || "Subject not available"}
                  {selected.class_level ? ` - ${selected.class_level}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  onEventClick?.(null);
                }}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-6 text-sm text-[#245C4F]">
              <p><strong className="text-[#063F32]">Class:</strong> {getLectureClassLabel(selected) || "Not available"}</p>
              <p><strong className="text-[#063F32]">Teacher:</strong> {selected.teacher_name || "Not available"}</p>
              <p><strong className="text-[#063F32]">Start:</strong> {formatLocalDateTime(selected.scheduled_start)}</p>
              <p><strong className="text-[#063F32]">End:</strong> {formatLocalDateTime(selected.scheduled_end)}</p>
              <p className="whitespace-pre-line"><strong className="text-[#063F32]">Description:</strong> {selected.description || "Not available"}</p>
              {selected.google_meet_link ? (
                <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C9A227]">Class Joining link</p>
                      <p className="mt-2 break-all text-sm text-[#245C4F]">{selected.google_meet_link}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyMeetLink(selected.google_meet_link)}
                        className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]"
                      >
                        Copy
                      </button>
                      <a
                        href={selected.google_meet_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-2 text-sm font-semibold text-[#FFF5D6]"
                      >
                        Join Class
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}
              {selected.event_detail_link && selected.event_detail_link.href !== selected.google_meet_link ? (
                <a
                  href={selected.event_detail_link.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${selected.event_detail_link.kind === "recording" ? "bg-[#FAF7F0] text-[#0D5C48] ring-1 ring-[#2D8A6A]/20" : "bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FFF5D6]"}`}
                >
                  {selected.event_detail_link.label}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .fc {
          --fc-border-color: rgba(13, 92, 72, 0.12);
          --fc-page-bg-color: #ffffff;
          --fc-neutral-bg-color: #faf7f0;
          --fc-today-bg-color: rgba(201, 162, 39, 0.08);
          --fc-now-indicator-color: #c94f4f;
        }

        .fc .fc-toolbar.fc-header-toolbar {
          margin-bottom: 1rem;
        }

        .fc .fc-toolbar-title {
          color: #063f32;
          font-size: 1.05rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .fc .fc-button {
          border-radius: 999px;
          border: 1px solid rgba(45, 138, 106, 0.16);
          background: #ffffff;
          color: #245c4f;
          box-shadow: none;
          font-weight: 600;
          text-transform: capitalize;
        }

        .fc .fc-button:hover,
        .fc .fc-button:focus {
          background: #f1eadc;
          color: #063f32;
          box-shadow: none;
        }

        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          border-color: rgba(201, 162, 39, 0.45);
          background: linear-gradient(135deg, #c9a227, #e4c766);
          color: #063f32;
          box-shadow: 0 10px 24px -14px rgba(201, 162, 39, 0.5);
        }

        .fc .fc-scrollgrid,
        .fc .fc-timegrid-slot,
        .fc .fc-timegrid-axis,
        .fc .fc-col-header-cell,
        .fc .fc-daygrid-day,
        .fc .fc-daygrid-day-frame {
          border-color: rgba(13, 92, 72, 0.12) !important;
        }

        .fc .fc-col-header-cell {
          background: #faf7f0;
        }

        .fc .fc-col-header-cell-cushion {
          padding: 0.9rem 0.35rem;
          color: #063f32;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .fc .fc-timegrid-axis-cushion,
        .fc .fc-timegrid-slot-label-cushion {
          color: #245c4f;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .fc .fc-timegrid-slot {
          height: 4.2rem;
          background-image: linear-gradient(to bottom, rgba(13, 92, 72, 0.03), rgba(13, 92, 72, 0.03));
          background-size: 100% 1px;
          background-repeat: no-repeat;
          background-position: bottom;
        }

        .fc .fc-timegrid-col-frame {
          min-height: 100%;
        }

        .fc .fc-timegrid-now-indicator-line {
          border-color: #c94f4f;
          border-width: 2px;
        }

        .fc .fc-timegrid-now-indicator-arrow {
          border-top-color: #c94f4f;
          border-bottom-color: #c94f4f;
        }

        .fc .fc-daygrid-day-number {
          color: #245c4f;
          font-weight: 600;
          padding: 0.5rem;
        }

        .fc .fc-event {
          border-radius: 0.9rem;
          padding: 0.15rem;
        }
      `}</style>
    </div>
  );
}
