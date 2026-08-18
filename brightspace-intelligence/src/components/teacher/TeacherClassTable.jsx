"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeRange } from "@/lib/dateTime";
import { getLectureDisplayStatus, getTeacherLectureActionLink } from "@/lib/lectureStatus";
import PaginationControls from "@/components/teacher/PaginationControls";

export default function TeacherClassTable({ items = [], onOpen }) {
  const pageSize = 7;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  return (
    <section className="rounded-[2rem] border-0 border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-0 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="overflow-x-auto rounded-[2rem]">
        <table className="min-w-full divide-y rounded-[2rem] divide-[#F1EADC] text-left text-sm">
          <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
            <tr><th className="px-6 py-4">Class</th><th className="px-6 py-4">Student</th><th className="px-6 py-4">Subject</th><th className="px-6 py-4">Schedule</th><th className="px-6 py-4">Meet</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[#F1EADC]">
            {visibleItems.length ? visibleItems.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-4 font-semibold text-[#063F32]">{item.title}</td>
              <td className="px-3 py-4 text-[#245C4F]">{item.student_name}</td>
              <td className="px-3 py-4 text-[#245C4F]">{item.subject_name}</td>
              <td className="px-3 py-4 text-[#245C4F]">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</td>
              <td className="px-3 py-4 text-[#245C4F]">
                {getTeacherLectureActionLink(item) ? <a href={getTeacherLectureActionLink(item).href} target="_blank" rel="noreferrer" className="font-semibold text-[#0D5C48]">{getTeacherLectureActionLink(item).label}</a> : "-"}
              </td>
              <td className="px-3 py-4 text-[#245C4F]">{item.display_status || getLectureDisplayStatus(item)}</td>
                <td className="px-3 py-4">
                  {String(item.status || "").toLowerCase() === "verified_by_coordinator" ? null : (
                    <button onClick={() => onOpen?.(item)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Open</button>
                  )}
                </td>
              </tr>
            )) : <tr><td colSpan={7} className="px-3 py-8 text-center text-[#245C4F]">No lectures found.</td></tr>}
          </tbody>
        </table>
      </div>
      {items.length > pageSize ? (
        <PaginationControls page={page} pageSize={pageSize} totalItems={items.length} onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))} />
      ) : null}
    </section>
  );
}
