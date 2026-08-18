"use client";

import { useEffect, useMemo, useState } from "react";
import PaginationControls from "@/components/parent/PaginationControls";

export default function TeacherNotesList({ items = [] }) {
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
    <section className="grid gap-4">
      {visibleItems.length ? visibleItems.map((item, index) => (
        <article key={`${item.id || "note"}-${index}`} className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_16px_55px_-34px_rgba(13,59,46,0.16)] backdrop-blur-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">{item.teacher_name ? `Teacher: ${item.teacher_name}` : "Teacher note"}</p>
          <p className="mt-3 leading-7 text-[#245C4F]">{item.note}</p>
        </article>
      )) : (
        <div className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-6 text-sm text-[#245C4F]">
          No teacher notes are available yet.
        </div>
      )}
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
