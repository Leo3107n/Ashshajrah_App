"use client";

import { useEffect, useMemo, useState } from "react";

const LABELS = {
  new_lead: "New Records",
  voucher_created: "Voucher created",
  fee_submitted: "Fee submitted",
  fee_verified: "Payment verified",
  access_granted: "LMS access granted",
  rejected: "Rejected",
  pending_clarification: "Pending clarification",
  pending: "Pending review",
  verified: "Verified",
  submitted: "Submitted",
  unpaid: "Unpaid",
  scheduled: "Scheduled",
  upcoming: "Upcoming",
  live: "Live",
  completed_by_teacher: "Completed by teacher",
  verified_by_coordinator: "Verified by coordinator",
  disputed: "Needs review",
  missed: "Missed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

const REPORTS = [
  {
    key: "registrationPipeline",
    title: "Registration Pipeline",
    description: "Where each student registration currently stands.",
    itemLabel: "Registration status",
    valueLabel: "Records",
  },
  {
    key: "feeVerification",
    title: "Payment Verification",
    description: "Payment proof records grouped by review status.",
    itemLabel: "Payment status",
    valueLabel: "Payments",
  },
  {
    key: "teacherClassReport",
    title: "Teacher Workload",
    description: "Teachers with the highest number of assigned lectures.",
    itemLabel: "Teacher",
    valueLabel: "Lectures",
  },
];

function formatDate(value) {
  if (!value) return "No date";
  const text = String(value).trim();
  if (!text) return "No date";
  return text.replace("T", " ").replace(".000", "").replace(/z$/i, "");
}

function humanize(value) {
  const text = String(value || "").trim();
  if (!text) return "Not specified";
  return LABELS[text.toLowerCase()] || text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueById(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row?.id || "").trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function ReportCard({ title, description, rows, itemLabel, valueLabel }) {
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    setVisibleCount(5);
  }, [rows]);

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const canPaginate = rows.length > 5;
  const hasMore = visibleCount < rows.length;

  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <p className="text-sm uppercase tracking-[0.22em] text-[#0D5C48] font-bold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#245C4F]">{description}</p>
      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/15">
        <div className="grid grid-cols-[1fr_110px] bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
          <span>{itemLabel}</span>
          <span className="text-right">{valueLabel}</span>
        </div>
        {rows?.length ? (
          <>
            {visibleRows.map((row) => (
            <div key={`${title}-${row.label}`} className="grid grid-cols-[1fr_110px] border-t border-[#F1EADC] px-4 py-3 text-sm">
              <span className="text-[#245C4F]">{humanize(row.label)}</span>
              <span className="font-semibold text-[#063F32]">{row.total}</span>
            </div>
            ))}
            {canPaginate ? (
              <div className="border-t border-[#F1EADC] px-4 py-3">
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => (current >= rows.length ? 5 : Math.min(current + 5, rows.length)))}
                  className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  {hasMore ? "Show more" : "Show less"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="border-t border-[#F1EADC] px-4 py-4 text-sm text-[#245C4F]">No records available for this report.</p>
        )}
      </div>
    </section>
  );
}

export default function CoordinatorReportsPanel({ data }) {
  const summary = data?.summary || data || {};
  const recentLectures = uniqueById(data?.recentLectures || []);
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {REPORTS.map((report) => (
          <ReportCard
            key={report.key}
            title={report.title}
            description={report.description}
            rows={summary?.[report.key] || []}
            itemLabel={report.itemLabel}
            valueLabel={report.valueLabel}
          />
        ))}
      </div>

      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Recent Lectures</p>
          <p className="mt-2 text-sm leading-6 text-[#245C4F]">Latest completed lectures shown in a compact portal table.</p>
          <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-[#2D8A6A]/15">
            <div className="min-w-[860px]">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_120px_110px] bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
              <span className="">Title</span>
              <span>Subject</span>
              <span>Teacher</span>
              <span>Class</span>
              <span className="text-right">Scheduled Time</span>
              <span className="text-right">Status</span>
            </div>
            {recentLectures.length ? recentLectures.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_120px_110px] border-t border-[#F1EADC] px-6 py-3 text-sm">
                <span className="text-[#245C4F]">{row.title}</span>
                <span className="text-[#245C4F]">{row.subject_name || "-"}</span>
                <span className="text-[#245C4F]">{row.teacher_name || "-"}</span>
                <span className="text-[#245C4F]">{row.class_name || "-"}</span>
                <span className="text-right text-[#245C4F]">{formatDate(row.scheduled_start)}</span>
                <span className="text-right text-[#245C4F]">  
                  {String(row.display_status || row.status || "").toLowerCase() === "ended"
                    ? "Ended"
                    : humanize(row.display_status || row.status)}
                </span>
              </div>
            )) : <p className="border-t border-[#F1EADC] px-4 py-4 text-sm text-[#245C4F]">No recent lectures found.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
