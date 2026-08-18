"use client";

import { useEffect, useMemo, useState } from "react";
import PaginationControls from "@/components/teacher/PaginationControls";

export default function AssignedStudentsTable({ items = [] }) {
  const pageSize = 7;
  const [page, setPage] = useState(1);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPage(1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items]);

  const dedupedItems = useMemo(() => {
    const seen = new Map();
    for (const item of items) {
      const key = [
        item.id || "",
        item.subject_name || "",
        item.course_title || "",
      ].join("|");
      if (!seen.has(key)) {
        seen.set(key, item);
      }
    }
    return Array.from(seen.values());
  }, [items]);

  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return dedupedItems.slice(startIndex, startIndex + pageSize);
  }, [dedupedItems, page]);

  const totalPages = Math.max(1, Math.ceil(dedupedItems.length / pageSize));

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#F1EADC] text-left text-sm">
          <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
            <tr><th className="px-6 py-4">Student</th><th className="px-6 py-4">Username</th><th className="px-6 py-4">Class</th><th className="px-6 py-4">Subject</th><th className="px-6 py-4">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-[#F1EADC]">
            {visibleItems.length ? visibleItems.map((item) => (
              <tr key={[item.id || "", item.subject_name || "", item.course_title || ""].join("|")}><td className="px-6 py-4 font-semibold text-[#063F32]">{item.full_name}</td><td className="px-6 py-4 text-[#245C4F]">{item.username || "-"}</td><td className="px-6 py-4 text-[#245C4F]">{item.grade_level || "-"}</td><td className="px-6 py-4 text-[#245C4F]">{item.subject_name || "-"}</td><td className="px-6 py-4 text-[#245C4F]">{item.status}</td></tr>
            )) : <tr><td colSpan={5} className="px-6 py-8 text-center text-[#245C4F]">No assigned students found.</td></tr>}
          </tbody>
        </table>
      </div>
      {dedupedItems.length > pageSize ? (
        <PaginationControls page={page} pageSize={pageSize} totalItems={dedupedItems.length} onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))} />
      ) : null}
    </section>
  );
}
