"use client";

import { getLectureDisplayStatus, getLecturePrimaryLink } from "@/lib/lectureStatus";

export default function UpcomingClassCard({ item }) {
  const displayStatus = item?.display_status || getLectureDisplayStatus(item);
  const primaryLink = item ? getLecturePrimaryLink(item) : null;

  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,234,220,0.65))] p-5 text-[#063F32] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#C9A227]">Next lecture</p>
      {item ? (
        <div className="mt-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#063F32]">{item.title}</h2>
          <p className="mt-2 text-sm text-[#245C4F]">
            {item.subject_name} with {item.teacher_name}
          </p>
          {primaryLink ? (
            <a
              href={primaryLink.href}
              target="_blank"
              rel="noreferrer"
              className={`mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold ${
                primaryLink.kind === "recording"
                  ? "border border-[#2D8A6A]/15 bg-white/85 text-[#0D5C48]"
                  : "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32]"
              }`}
            >
              {primaryLink.label}
            </a>
          ) : (
            <span className="mt-4 inline-flex rounded-xl border border-[#2D8A6A]/15 bg-white/85 px-4 py-2 text-sm font-semibold text-[#0D5C48]">{displayStatus}</span>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#245C4F]">No upcoming lectures scheduled.</p>
      )}
    </section>
  );
}
