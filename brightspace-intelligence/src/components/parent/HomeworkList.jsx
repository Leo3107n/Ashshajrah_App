"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/dateTime";
import PaginationControls from "@/components/parent/PaginationControls";

export default function HomeworkList({ items = [] }) {
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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#F1EADC] text-left text-sm">
          <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
            <tr>
              <th className="px-6 py-4">Homework</th>
              <th className="px-6 py-4">Lecture</th>
              <th className="px-6 py-4">Subject</th>
              <th className="px-6 py-4">Teacher</th>
              <th className="px-6 py-4">Student</th>
              <th className="px-6 py-4">Attachment</th>
              <th className="px-6 py-4">Submitted Text</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1EADC]">
            {visibleItems.length ? visibleItems.map((item, index) => {
              const submitted = String(item.status || "").toLowerCase() === "submitted";
              return (
                <tr key={`${item.id || "homework"}-${index}`}>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-[#063F32]">{item.title}</p>
                    <p className="mt-1 text-xs text-[#245C4F]">{item.description || "No description provided."}</p>
                  </td>
                  <td className="px-6 py-4 text-[#245C4F]">{item.class_title || item.lecture_title || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{item.subject_name || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{item.teacher_name || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">
                    {submitted ? item.student_name || "Submitted" : "Not submitted yet"}
                  </td>
                  <td className="px-6 py-4 text-[#245C4F]">
                    {submitted && item.submission_attachment_url ? (
                      <a
                        href={item.submission_attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-24 overflow-hidden rounded-xl border border-[#2D8A6A]/12 bg-[#FAF7F0]"
                      >
                        <img
                          src={item.submission_attachment_url}
                          alt={item.submission_attachment_name || "Homework submission"}
                          className="h-16 w-full object-cover"
                        />
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4 text-[#245C4F]">{submitted ? item.submission_note || "No text submitted." : "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                      submitted ? "bg-[#E9F8F1] text-[#0D5C48]" : "bg-[#FAF7F0] text-[#245C4F]"
                    }`}>
                      {item.status || "pending"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#245C4F]">{formatDateTime(item.due_date)}</td>
                </tr>
              );
            }) : (
              <tr>
                <td className="px-3 py-8 text-center text-[#245C4F]" colSpan={8}>
                  No homework has been assigned yet.
                </td>
              </tr>
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
