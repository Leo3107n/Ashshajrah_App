"use client";

import { formatDateTimeRange } from "@/lib/dateTime";
import { getLectureDisplayStatus, getLecturePrimaryLink } from "@/lib/lectureStatus";

export default function UpcomingClassesCard({ items = [] }) {
  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">
          Upcoming lectures
        </p>
        <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
          Google Meet schedule
        </h2>
      </div>

      <div className="space-y-3">
        {items.length ? items.map((item, index) => {
          const primaryLink = getLecturePrimaryLink(item);

          return (
            <article key={`${item.id || "upcoming"}-${index}`} className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-[#063F32]">{item.title}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">
                    {item.subject_name} with {item.teacher_name}
                  </p>
                  <p className="mt-1 text-sm text-[#0D5C48]">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{item.display_status || getLectureDisplayStatus(item)}</p>
                </div>
                {primaryLink ? (
                  <a
                    href={primaryLink.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-2xl px-4 py-2 text-center text-sm font-semibold transition ${
                      primaryLink.kind === "recording"
                        ? "bg-[#FAF7F0] text-[#0D5C48] ring-1 ring-[#2D8A6A]/15 hover:bg-[#F1EADC]"
                        : "bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FAF7F0] hover:brightness-110"
                    }`}
                  >
                    {primaryLink.label}
                  </a>
                ) : (
                  <span className="rounded-2xl bg-[#E9F8F1] px-4 py-2 text-center text-sm font-semibold text-[#0D5C48]">
                    {item.display_status || getLectureDisplayStatus(item)}
                  </span>
                )}
              </div>
            </article>
          );
        }) : (
          <p className="rounded-2xl border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-5 text-sm text-[#245C4F]">
            No upcoming lectures are scheduled yet.
          </p>
        )}
      </div>
    </section>
  );
}
