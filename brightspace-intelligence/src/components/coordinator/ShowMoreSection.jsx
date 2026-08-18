"use client";

import { useEffect, useMemo, useState } from "react";

function PaginationControls({ page, pageSize, totalItems, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPage - 2),
    Math.max(0, currentPage - 2) + 5
  );

  return (
    <div className="flex flex-col gap-3 border-t border-[#2D8A6A]/12 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[#245C4F]">
        Showing <span className="font-semibold text-[#063F32]">{start}-{end}</span> of{" "}
        <span className="font-semibold text-[#063F32]">{totalItems}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        {pages.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPageChange(number)}
            className={`min-w-10 rounded-full px-4 py-2 text-sm font-semibold transition ${
              number === currentPage
                ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32]"
                : "border border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] hover:bg-[#F1EADC]"
            }`}
          >
            {number}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function ShowMoreSection({
  title,
  description,
  items = [],
  initialCount = 5,
  step = 5,
  renderItems,
  emptyMessage = "No records available.",
  wrapperClassName = "",
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items, initialCount]);

  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * initialCount;
    return items.slice(startIndex, startIndex + initialCount);
  }, [items, page, initialCount]);

  const totalPages = Math.max(1, Math.ceil(items.length / initialCount));

  return (
    <section className={`space-y-4 ${wrapperClassName}`}>
      {(title || description) && (
        <div className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          {title ? (
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">
              {title}
            </p>
          ) : null}
          {description ? (
            <p className="mt-2 text-sm leading-7 text-[#245C4F]">{description}</p>
          ) : null}
        </div>
      )}

      {items.length ? (
        <>
          {renderItems(visibleItems)}
          {items.length > initialCount ? (
            <PaginationControls
              page={page}
              pageSize={initialCount}
              totalItems={items.length}
              onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
            />
          ) : null}
        </>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-[#FAF7F0]/80 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(6,63,50,0.16)]">
          {emptyMessage}
        </section>
      )}
    </section>
  );
}
