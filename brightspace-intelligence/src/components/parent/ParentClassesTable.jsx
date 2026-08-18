"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeRange } from "@/lib/dateTime";
import { getLectureDisplayStatus, getLecturePrimaryLink } from "@/lib/lectureStatus";
import PaginationControls from "@/components/parent/PaginationControls";

export default function ParentClassesTable({ items = [] }) {
  const pageSize = 7;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">
          Lecture records
        </p>
        <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
          Scheduled and completed lectures
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#F1EADC] text-left text-sm">
          <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
            <tr>
              <th className="px-3 py-3">Lecture</th>
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Teacher</th>
              <th className="px-3 py-3">Schedule</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1EADC]">
            {visibleItems.length ? visibleItems.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-4 font-semibold text-[#063F32]">{item.title}</td>
                <td className="px-3 py-4 text-[#245C4F]">{item.subject_name}</td>
                <td className="px-3 py-4 text-[#245C4F]">{item.teacher_name}</td>
                <td className="px-3 py-4 text-[#245C4F]">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</td>
                <td className="px-3 py-4 text-[#245C4F]">{item.display_status || getLectureDisplayStatus(item)}</td>
                <td className="px-3 py-4">
                  <div className="flex flex-wrap gap-2">
                    {getLecturePrimaryLink(item) ? <a className="font-semibold text-[#0D5C48]" href={getLecturePrimaryLink(item).href} target="_blank" rel="noreferrer">{getLecturePrimaryLink(item).label}</a> : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td className="px-3 py-8 text-center text-[#245C4F]" colSpan={6}>No lecture records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {items.length > pageSize ? (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalItems={items.length}
          onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
        />
      ) : null}
    </section>
  );
}
