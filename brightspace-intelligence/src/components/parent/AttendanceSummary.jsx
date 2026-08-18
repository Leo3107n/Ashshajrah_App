"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeRange } from "@/lib/dateTime";
import PaginationControls from "@/components/parent/PaginationControls";

export default function AttendanceSummary({ summary = {}, items = [] }) {
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
    <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Attendance</p>
        <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
          {summary.percentage || 0}% present
        </h2>
        <p className="mt-2 text-sm text-[#245C4F]">{summary.present || 0} of {summary.total || 0} records marked present.</p>
      </div>
      <div className="space-y-3">
        {items.length ? (
          <>
            <div className="overflow-x-auto rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#FAF7F0]">
              <table className="min-w-full divide-y divide-[#F1EADC] text-left text-sm">
                <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                  <tr>
                    <th className="px-6 py-4">Lecture</th>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EADC]">
                  {visibleItems.map((item, index) => (
                    <tr key={`${item.id || "attendance"}-${index}`}>
                      <td className="px-6 py-4 font-semibold text-[#063F32]">{item.class_title || "-"}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{item.subject_name || "Subject not set"}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{item.status}</td>
                    </tr>
                  ))}
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
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-5 text-sm text-[#245C4F]">No attendance records yet.</p>
        )}
      </div>
    </section>
  );
}
