"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import PaginationControls from "@/components/teacher/PaginationControls";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

function renderValue(column, row, index) {
  if (typeof column.render === "function") {
    return column.render(row, index);
  }

  const value = row?.[column.key];
  return value ?? "-";
}

export default function AdminDataTable({
  columns = [],
  rows = [],
  keyField = "id",
  emptyMessage = "No records found.",
  actions,
  pageSize = 7,
  loading = false,
  loadingTitle = "Loading data",
  loadingSubtitle = "Preparing the table...",
  resetKey = "",
}) {
  const effectiveActions = actions;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const visibleRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return rows.slice(startIndex, startIndex + pageSize);
  }, [currentPage, pageSize, rows]);

  if (!rows.length) {
    if (loading) {
      return (
        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-6 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <OpenBookLoader title={loadingTitle} subtitle={loadingSubtitle} />
        </section>
      );
    }
    return (
      <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(250,247,240,0.95)_100%)] p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        {emptyMessage}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="hidden overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                {columns.map((column) => (
                  <th key={column.key} className="px-6 py-4">
                    {column.label}
                  </th>
                ))}
                {effectiveActions ? <th className="px-6 py-4">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {visibleRows.map((row, index) => (
                <motion.tr
                  key={row[keyField] || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.02 }}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-5 align-top text-sm text-[#245C4F] ${column.cellClassName || ""}`}
                    >
                      {renderValue(column, row, index)}
                    </td>
                  ))}
                  {effectiveActions ? (
                    <td className="px-6 py-5 align-top">
                      <div className="flex flex-wrap gap-2">{effectiveActions(row)}</div>
                    </td>
                  ) : null}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > pageSize ? (
          <PaginationControls
            page={currentPage}
            pageSize={pageSize}
            totalItems={rows.length}
            onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:hidden">
        {visibleRows.map((row, index) => (
          <motion.article
            key={row[keyField] || index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: index * 0.02 }}
            className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl"
          >
            <div className="space-y-3">
              {columns.map((column) => (
                <div key={column.key}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                    {column.label}
                  </p>
                  <div className="mt-1 text-sm text-[#245C4F]">
                    {renderValue(column, row, index)}
                  </div>
                </div>
              ))}
            </div>

            {actions ? (
              <div className="mt-4 flex flex-wrap gap-2">{actions(row)}</div>
            ) : null}
          </motion.article>
        ))}
        {rows.length > pageSize ? (
          <div className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <PaginationControls
              page={currentPage}
              pageSize={pageSize}
              totalItems={rows.length}
              onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
