"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { ChevronDown, Copy, FileVideo, Link as LinkIcon, Plus, RefreshCw } from "lucide-react";

const APP_TIMEZONE = "Asia/Karachi";

function toPakistanDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-PK", { timeZone: APP_TIMEZONE, dateStyle: "medium", timeStyle: "short" });
}

function roleLabel(value) {
  return String(value || "")
    .replace(/^superadmin$/i, "Super Admin")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function eventStatus(item) {
  const status = String(item?.status || "scheduled").toLowerCase();
  if (status === "cancelled") return "Cancelled";
  const now = Date.now();
  const startTime = new Date(item?.scheduled_start || 0).getTime();
  const endTime = new Date(item?.scheduled_end || 0).getTime();
  if (Number.isFinite(startTime) && now < startTime) return "Upcoming";
  if (Number.isFinite(endTime) && now <= endTime) return "Live";
  return "Ended";
}

function getEventPalette(item) {
  const status = eventStatus(item).toLowerCase();
  if (status === "live") return { background: "#2563EB", border: "#1D4ED8", text: "#FFFFFF" };
  if (status === "upcoming") return { background: "#75797D", border: "#666A6E", text: "#FFFFFF" };
  if (status === "cancelled") return { background: "#B91C1C", border: "#991B1B", text: "#FFFFFF" };
  return { background: "#75797D", border: "#666A6E", text: "#FFFFFF" };
}

function canShowRecordingSection(item) {
  const status = eventStatus(item).toLowerCase();
  return status === "live" || status === "ended";
}

export default function InternalEventsPage({
  portalLabel = "Coordinator portal",
  canCreate = true,
} = {}) {
  const calendarRef = useRef(null);
  const [items, setItems] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [attendeeOpen, setAttendeeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    attendeeUserId: "",
    scheduledStart: "",
    scheduledEnd: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const response = await fetch(`/api/internal-events?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load events.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load events.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadOptions = useCallback(async () => {
    if (!canCreate) return;
    const response = await fetch("/api/internal-events?mode=options", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setAttendees(Array.isArray(data.attendees) ? data.attendees : []);
  }, [canCreate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOptions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOptions]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const calendarEvents = useMemo(
    () =>
      items.map((item) => {
        const palette = getEventPalette(item);
        return {
          id: item.id,
          title: item.title,
          start: toPakistanDateTimeInput(item.scheduled_start),
          end: toPakistanDateTimeInput(item.scheduled_end),
          allDay: false,
          backgroundColor: palette.background,
          borderColor: palette.border,
          textColor: palette.text,
          extendedProps: item,
        };
      }),
    [items]
  );

  const summary = useMemo(
    () => ({
      total: items.length,
      withMeet: items.filter((item) => item.google_meet_link).length,
      recorded: items.filter((item) => item.recording_drive_url).length,
    }),
    [items]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    const createdEventDate = form.scheduledStart;
    try {
      const response = await fetch("/api/internal-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to create event.");
      setMessage(data?.calendar_error ? data.message : "Event created successfully.");
      setForm({
        title: "",
        description: "",
        attendeeUserId: "",
        scheduledStart: "",
        scheduledEnd: "",
      });
      await load();
      calendarRef.current?.getApi?.().gotoDate?.(new Date(createdEventDate));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create event.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(value, label = "Link copied.") {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage(label);
    } catch {
      setMessage("Unable to copy link.");
    }
  }

  async function handleSyncRecording() {
    if (!selected?.id) return;
    setSyncingId(selected.id);
    try {
      const response = await fetch(`/api/internal-events/${selected.id}/recording-sync`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to sync recording.");
      const recordingUrl = data.recording_drive_url || "";
      setMessage(data?.message || "Recording sync checked.");
      setSelected((current) => current ? { ...current, recording_drive_url: recordingUrl || current.recording_drive_url } : current);
      await load();
    } catch (syncError) {
      setMessage(syncError instanceof Error ? syncError.message : "Unable to sync recording.");
    } finally {
      setSyncingId("");
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.14),transparent_28%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
                {portalLabel}
              </p>
              <h1 className="mb-3 mt-4 font-display text-3xl font-bold text-white-deep sm:text-4xl">
                Internal Events
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
                Create and review internal events with one selected attendee, a coordinator-hosted Meet link, and recording sync.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{summary.total}</p>
                <p className="text-xs text-[#EAF6EF]">Events</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{summary.withMeet}</p>
                <p className="text-xs text-[#EAF6EF]">Meet</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{summary.recorded}</p>
                <p className="text-xs text-[#EAF6EF]">Recorded</p>
              </div>
            </div>
          </div>
        </section>

        {canCreate ? (
          <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
            <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Event title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Attendee</span>
                <div className="relative">
                  <select
                    value={form.attendeeUserId}
                    onMouseDown={() => setAttendeeOpen((current) => !current)}
                    onChange={(event) => {
                      setAttendeeOpen(false);
                      setForm((current) => ({ ...current, attendeeUserId: event.target.value }));
                    }}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                    required
                  >
                    <option value="">Select attendee</option>
                    {attendees.map((attendee) => (
                      <option key={attendee.id} value={attendee.id}>
                        {attendee.full_name} - {roleLabel(attendee.role_name)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${attendeeOpen ? "rotate-180" : ""}`} />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Start time</span>
                <input
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(event) => setForm((current) => ({ ...current, scheduledStart: event.target.value }))}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">End time</span>
                <input
                  type="datetime-local"
                  value={form.scheduledEnd}
                  onChange={(event) => setForm((current) => ({ ...current, scheduledEnd: event.target.value }))}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  required
                />
              </label>
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                />
              </label>
              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-5 py-3 text-sm font-semibold text-[#FFF5D6] shadow-[0_16px_34px_-24px_rgba(13,59,46,0.65)] disabled:opacity-70"
                >
                  {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creating ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="border-b border-[#2D8A6A]/10 px-5 py-5">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search event, host, attendee, or description"
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
            />
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

        <div className="relative rounded-[1.75rem] bg-[#FAF7F0] p-0 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-3">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
              events={calendarEvents}
              eventClick={(info) => setSelected(info.event.extendedProps)}
              height="auto"
              nowIndicator
              editable={false}
              selectable={false}
              weekends
              allDaySlot={false}
              timeZone="local"
              eventDisplay="block"
              eventTimeFormat={{ hour: "numeric", minute: "2-digit", hour12: true }}
              slotMinTime="08:00:00"
              slotMaxTime="18:00:00"
              scrollTime="08:00:00"
              slotDuration="01:00:00"
              expandRows
              eventClassNames={() => ["cursor-pointer"]}
              eventContent={(arg) => (
                <div className="overflow-hidden px-1 text-[11px] leading-tight text-white">
                  <div className="truncate font-semibold">{arg.event.title}</div>
                  {arg.event.extendedProps?.attendee_name ? (
                    <div className="truncate text-[10px] text-white/90">{arg.event.extendedProps.attendee_name}</div>
                  ) : null}
                </div>
              )}
            />
            {loading ? <p className="mt-3 text-sm text-[#245C4F]">Loading events...</p> : null}
          </div>

          {selected ? (
            <div className="absolute inset-0 z-[9999] flex items-start justify-center rounded-[1.75rem] px-4 py-8 sm:px-6">
              <div className="absolute inset-0 rounded-[1.75rem] bg-[#063F32]/45 backdrop-blur-sm" />
              <div className="relative max-h-[calc(100%-4rem)] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Event details</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{selected.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-4 p-6 text-sm text-[#245C4F]">
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      ["Host", selected.host_name || "Coordinator"],
                      ["Attendee", `${selected.attendee_name || "-"}${selected.attendee_role ? ` - ${roleLabel(selected.attendee_role)}` : ""}`],
                      ["Start", formatDateTime(selected.scheduled_start)],
                      ["End", formatDateTime(selected.scheduled_end)],
                      ["Description", selected.description || "Not available"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</p>
                        <p className="mt-1 whitespace-pre-line text-[#245C4F]">{value}</p>
                      </div>
                    ))}
                  </div>

                  {selected.google_last_error ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                      {selected.google_last_error}
                    </div>
                  ) : null}

                  {selected.google_meet_link ? (
                    <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C9A227]">Meet link</p>
                      <p className="mt-2 break-all text-sm text-[#245C4F]">{selected.google_meet_link}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={selected.google_meet_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-2 text-sm font-semibold text-[#FFF5D6]">
                          <LinkIcon className="h-4 w-4" />
                          Join Event
                        </a>
                        <button type="button" onClick={() => handleCopy(selected.google_meet_link, "Meet link copied.")} className="inline-flex items-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0D5C48]">
                          <Copy className="h-4 w-4" />
                          Copy
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {canShowRecordingSection(selected) ? (
                    <div className="rounded-2xl border border-[#2D8A6A]/15 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C9A227]">Recording</p>
                          <p className="mt-1 text-[#245C4F]">
                            {selected.recording_drive_url ? "Recording is available." : "Recording appears after Google finishes processing it."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSyncRecording}
                          disabled={syncingId === selected.id}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#0D5C48] disabled:opacity-70"
                        >
                          <RefreshCw className={`h-4 w-4 ${syncingId === selected.id ? "animate-spin" : ""}`} />
                          Sync Recording
                        </button>
                      </div>
                      {selected.recording_drive_url ? (
                        <a href={selected.recording_drive_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-2 text-sm font-semibold text-[#FFF5D6]">
                          <FileVideo className="h-4 w-4" />
                          Open Recording
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {message ? (
          <div className="fixed right-4 top-4 z-[10000] rounded-2xl border border-[#2D8A6A]/20 bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-3 text-sm font-semibold text-[#FFF5D6] shadow-[0_18px_40px_-24px_rgba(13,59,46,0.55)]">
            {message}
          </div>
        ) : null}

      </div>

      <style jsx global>{`
        .fc {
          --fc-border-color: rgba(13, 92, 72, 0.12);
          --fc-page-bg-color: #ffffff;
          --fc-neutral-bg-color: #faf7f0;
          --fc-today-bg-color: rgba(201, 162, 39, 0.08);
          --fc-now-indicator-color: #c94f4f;
        }
        .fc .fc-toolbar.fc-header-toolbar { margin-bottom: 1rem; }
        .fc .fc-toolbar-title { color: #063f32; font-size: 1.05rem; font-weight: 700; }
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
        .fc .fc-button:focus { background: #f1eadc; color: #063f32; box-shadow: none; }
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
        .fc .fc-daygrid-day-frame { border-color: rgba(13, 92, 72, 0.12) !important; }
        .fc .fc-col-header-cell { background: #faf7f0; }
        .fc .fc-timegrid-slot { height: 4.2rem; }
        .fc .fc-event { border-radius: 0.9rem; padding: 0.15rem; }
      `}</style>
    </div>
  );
}
