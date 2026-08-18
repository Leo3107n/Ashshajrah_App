"use client";

import { useEffect, useMemo, useState } from "react";
import PaginationControls from "@/components/teacher/PaginationControls";

function HomeworkSubmissionModal({ item, onClose, onAction }) {
  if (!item) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex min-h-screen items-start justify-center bg-[#063F32]/45 px-4 pt-14 pb-8">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Approve homework</p>
            <h3 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">{item.title}</h3>
            <p className="mt-1 text-sm text-[#245C4F]">
              {item.student_name} · {item.subject_name} · {item.class_level}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] hover:bg-[#F1EADC]"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
              <p className="font-semibold text-[#063F32]">Submission info</p>
              <p className="mt-2"><strong>Teacher:</strong> {item.teacher_name || "-"}</p>
              <p className="mt-1"><strong>Due date:</strong> {item.due_date ? new Date(item.due_date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" }) : "-"}</p>
              <p className="mt-1"><strong>Status:</strong> {item.status || "-"}</p>
              <p className="mt-1"><strong>Submitted text:</strong> {item.submission_note || "No text submitted."}</p>
            </div>
            <div className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
              <p className="font-semibold text-[#063F32]">Homework text</p>
              <p className="mt-2 whitespace-pre-line">{item.description || "No description."}</p>
            </div>
          </div>

          {item.submission_attachment_url ? (
            <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[#FAF7F0]">
              <a href={item.submission_attachment_url} target="_blank" rel="noreferrer" className="block">
                <img src={item.submission_attachment_url} alt={item.submission_attachment_name || "Homework submission"} className="h-72 w-full object-contain" />
              </a>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onAction("reject")}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => onAction("approve")}
              className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0]"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectHomeworkModal({ onClose, onSubmit }) {
  const [remarks, setRemarks] = useState("");

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex min-h-screen items-start justify-center bg-[#063F32]/45 px-4 pt-14 pb-8">
      <div className="w-full max-w-xl rounded-[2rem] border border-rose-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)]">
        <div className="border-b border-[#2D8A6A]/10 px-6 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-700">Reject homework</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">Add rejection reason</h3>
          <p className="mt-1 text-sm text-[#245C4F]">This will keep the homework in pending state so the student can resubmit.</p>
        </div>

        <div className="space-y-4 p-6">
          <textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none ring-0 placeholder:text-[#6A8C82] focus:border-[#2D8A6A]"
            placeholder="Write rejection reason..."
          />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] hover:bg-[#F1EADC]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmit(remarks)}
              className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Reject homework
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeworkApprovalTable({ items = [], onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [rejecting, setRejecting] = useState(null);
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

  async function handleAction(item, action, reason = "") {
    const response = await fetch(`/api/teacher/homework/submissions/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, remarks: reason }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Unable to update homework submission.");
    }
    setSelected(null);
    setRejecting(null);
    onRefresh?.();
  }

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC] text-left text-sm">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Homework</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4">Submitted Note</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {visibleItems.length ? visibleItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 font-semibold text-[#063F32]">{item.student_name || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{item.class_level || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{item.subject_name || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{item.title || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{item.due_date ? new Date(item.due_date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" }) : "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{item.submission_note || "No note."}</td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] hover:bg-[#F1EADC]"
                    >
                      View / Review
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#245C4F]">No homework submissions waiting for review.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {items.length > pageSize ? (
          <PaginationControls page={page} pageSize={pageSize} totalItems={items.length} onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))} />
        ) : null}
      </section>

      <HomeworkSubmissionModal
        item={selected}
        onClose={() => setSelected(null)}
        onAction={(action) => {
          if (action === "reject") {
            setRejecting({ item: selected, remarks: "" });
            return;
          }
          handleAction(selected, action).catch((error) => window.alert(error.message));
        }}
      />

      {rejecting?.item ? (
        <RejectHomeworkModal
          onClose={() => setRejecting(null)}
          onSubmit={(remarks) => {
            handleAction(rejecting.item, "reject", remarks).catch((error) => window.alert(error.message));
          }}
        />
      ) : null}
    </>
  );
}
