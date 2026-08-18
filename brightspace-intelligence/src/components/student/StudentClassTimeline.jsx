"use client";

import { motion } from "framer-motion";
import { formatDateTimeRange } from "@/lib/dateTime";
import { getLectureDisplayStatus, getLecturePrimaryLink } from "@/lib/lectureStatus";

const STATUS_BADGES = {
  scheduled: "bg-[#FAF7F0] text-[#245C4F] ring-1 ring-[#2D8A6A]/15",
  upcoming: "bg-[#E9F8F1] text-[#0D5C48] ring-1 ring-[#2D8A6A]/15",
  live: "bg-[#FFF5D6] text-[#8A6B00] ring-1 ring-[#E4C766]/50",
  completed_by_teacher: "bg-[#FAF7F0] text-[#245C4F] ring-1 ring-[#2D8A6A]/15",
  verified_by_coordinator: "bg-[#E9F8F1] text-[#0D5C48] ring-1 ring-[#2D8A6A]/15",
  missed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  cancelled: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  disputed: "bg-[#FFF5D6] text-[#8A6B00] ring-1 ring-[#E4C766]/50",
  rescheduled: "bg-[#FFF5D6] text-[#8A6B00] ring-1 ring-[#E4C766]/50",
};

const STATUS_MARKERS = {
  scheduled: "bg-[#9ca3af]",
  upcoming: "bg-emerald-600",
  live: "bg-[#C9A227]",
  completed_by_teacher: "bg-[#9ca3af]",
  verified_by_coordinator: "bg-[#0D5C48]",
  missed: "bg-rose-600",
  cancelled: "bg-rose-600",
  disputed: "bg-[#C9A227]",
  rescheduled: "bg-[#C9A227]",
};

export default function StudentClassTimeline({ items = [] }) {
  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(233,248,241,0.82)_100%)] p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.14)] backdrop-blur-xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Learning timeline</p>
          <h2 className="mt-1 font-body text-xl font-semibold tracking-tight text-[#063F32]">Track your lessons and progress</h2>
        </div>
      </div>

      <div className="relative mt-5">
        <div className="pointer-events-none absolute left-10 top-0 bottom-0 w-px bg-[#E4C766]/50" />
        <div className="space-y-3">
          {items.map((item, index) => {
            const displayStatus = item.display_status || getLectureDisplayStatus(item);
            const statusKey = String(displayStatus || item.status || "").toLowerCase();
            const badgeClass = STATUS_BADGES[statusKey] || "bg-[#FAF7F0] text-[#245C4F] ring-1 ring-[#2D8A6A]/15";
            const markerClass = STATUS_MARKERS[statusKey] || "bg-[#9ca3af]";
            const primaryLink = getLecturePrimaryLink(item);

            return (
              <motion.article
                key={`${item.id}-${index}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="relative overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(233,248,241,0.74)_100%)] p-3 pl-16 shadow-[0_14px_40px_-28px_rgba(13,59,46,0.14)] transition duration-200 hover:shadow-[0_18px_50px_-32px_rgba(13,59,46,0.18)] backdrop-blur-xl"
              >
                <div className="absolute left-4 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow ring-1 ring-[#F1EADC]">
                  <span className={`h-2.5 w-2.5 rounded-full ${markerClass}`} />
                </div>

                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="font-body text-base font-semibold tracking-tight text-[#063F32]">{item.title || "Untitled lesson"}</h3>
                    <p className="text-sm text-[#245C4F]">
                      {item.subject_name || "Unspecified subject"}
                      {item.teacher_name ? ` · ${item.teacher_name}` : ""}
                    </p>
                  </div>

                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${badgeClass}`}>
                    {displayStatus}
                  </span>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#0D5C48]">When</p>
                    <p className="mt-1 text-sm font-medium text-[#063F32]">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</p>
                  </div>
                  {item.completion_summary ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-[#0D5C48]">Summary</p>
                      <p className="mt-1 text-sm text-[#245C4F]">{item.completion_summary}</p>
                    </div>
                  ) : null}
                </div>

                {item.description ? <p className="mt-2 text-sm leading-6 text-[#245C4F]">{item.description}</p> : null}

                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {primaryLink ? (
                    <a
                      href={primaryLink.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`rounded-full px-3 py-1.5 font-semibold transition ${
                        primaryLink.kind === "recording"
                          ? "bg-[#FAF7F0] text-[#0D5C48] ring-1 ring-[#2D8A6A]/15 hover:bg-[#F1EADC]"
                          : "bg-white/90 text-[#063F32] hover:bg-[#E9F8F1]"
                      }`}
                    >
                      {primaryLink.label}
                    </a>
                  ) : null}
                </div>
              </motion.article>
            );
          })}

          {!items.length ? <div className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(233,248,241,0.78)_100%)] p-6 text-sm text-[#245C4F]">No timeline records found.</div> : null}
        </div>
      </div>
    </section>
  );
}
