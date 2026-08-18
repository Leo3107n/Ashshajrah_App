"use client";

import { motion } from "framer-motion";
import { formatDateTimeRange } from "@/lib/dateTime";
import { getLectureDisplayStatus, getLecturePrimaryLink } from "@/lib/lectureStatus";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

export default function StudentSelectedDateLectures({ items = [], loading }) {
  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Selected date</p>
          <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">Lectures</h2>
        </div>
        <p className="text-sm text-[#245C4F]">{loading ? "Loading..." : `${items.length} found`}</p>
      </div>
      {loading ? <OpenBookLoader title="Loading lectures" subtitle="Preparing the selected day..." /> : null}
      <div className="mt-5 grid gap-3">
        {items.length ? items.map((item, index) => {
          const displayStatus = item.display_status || getLectureDisplayStatus(item);
          const primaryLink = getLecturePrimaryLink(item);

          return (
          <motion.article key={`${item.id}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: index * 0.02 }} className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold text-[#063F32]">{item.title}</p>
                <p className="mt-1 text-sm text-[#245C4F]">{item.subject_name} with {item.teacher_name}</p>
                <p className="mt-1 text-sm text-[#245C4F]">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</p>
                {item.completion_summary ? <p className="mt-2 text-sm text-[#245C4F]">{item.completion_summary}</p> : null}
              </div>
                <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#FFF5D6] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8A6B00]">{displayStatus}</span>
                {primaryLink ? <a href={primaryLink.href} target="_blank" rel="noreferrer" className={`rounded-xl px-4 py-2 text-sm font-semibold ${primaryLink.kind === "recording" ? "border border-[#2D8A6A]/15 bg-[#FAF7F0] text-[#0D5C48]" : "bg-[#0D5C48] text-[#FAF7F0]"}`}>{primaryLink.label}</a> : null}
              </div>
            </div>
          </motion.article>
        );
        }) : <p className="rounded-2xl border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-6 text-sm text-[#245C4F]">No lectures for the selected filters.</p>}
      </div>
    </section>
  );
}
