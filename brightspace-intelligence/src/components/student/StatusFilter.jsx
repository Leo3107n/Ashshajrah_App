"use client";

const statuses = [
  { label: "All statuses", value: "" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Live", value: "live" },
  { label: "Ended", value: "ended" },
  { label: "Completed", value: "completed_by_teacher" },
  { label: "Verified", value: "verified_by_coordinator" },
  { label: "Missed", value: "missed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Rescheduled", value: "rescheduled" },
  { label: "Disputed", value: "disputed" },
];

export default function StatusFilter({ value = "", onChange }) {
  return (
    <select value={value} onChange={(event) => onChange?.(event.target.value)} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-medium text-[#063F32] outline-none transition focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]">
      <option value="">All statuses</option>
      {statuses.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
    </select>
  );
}
