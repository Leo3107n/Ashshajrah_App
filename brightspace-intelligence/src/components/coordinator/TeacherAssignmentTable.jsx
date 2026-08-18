"use client";

import { motion } from "framer-motion";

function formatDateOnly(value) {
  if (!value) return "-";
  const text = String(value).trim();
  if (!text) return "-";
  return text.split("T")[0].replace(/\.000$/i, "");
}

export default function TeacherAssignmentTable({ items = [], onRefresh }) {
  async function updateStatus(id, status) {
    const response = await fetch(`/api/coordinator/teacher-assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to update assignment.");
    }

    onRefresh?.();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(6,63,50,0.18)] backdrop-blur-xl">
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-3 border-b border-[#2D8A6A]/10 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48] lg:grid lg:items-center">
        <span>Teacher</span>
        <span>Class</span>
        <span>Start month</span>
        <span>Subject / Status</span>
        <span className="text-right">Action</span>
      </div>
      <div className="divide-y divide-[#2D8A6A]/10">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px] lg:items-center">
              <p className="text-sm font-semibold text-[#063F32]">{item.teacher_name}</p>
              <p className="text-sm text-[#245C4F]">{item.course_title || "-"}</p>
              <p className="text-sm text-[#245C4F]">{formatDateOnly(item.start_date || item.created_at)}</p>
              <div>
                <p className="text-sm text-[#245C4F]">{item.subject_name}</p>
                <p className="mt-1 text-xs text-[#245C4F]">{item.status}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateStatus(item.id, item.status === "active" ? "suspended" : "active").catch((error) =>
                    window.alert(error.message)
                  )
                }
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] lg:justify-self-end"
              >
                {item.status === "active" ? "Suspend" : "Activate"}
              </button>
            </div>
          ))
        ) : (
          <div className="px-5 py-10 text-sm text-[#245C4F]">No teacher assignments available.</div>
        )}
      </div>
    </motion.div>
  );
}
