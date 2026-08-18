"use client";

import { useState } from "react";

export default function AttendanceForm({ lecture, onSaved }) {
  const [status, setStatus] = useState("present");
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!lecture?.id) {
      window.alert("Please select a class first.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/teacher/lectures/${lecture.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to save attendance.");
      onSaved?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save attendance.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="present">Present</option>
        <option value="absent">Absent</option>
        <option value="late">Late</option>
        <option value="partial">Partial</option>
      </select>
      <button disabled={pending} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">{pending ? "Saving..." : "Save attendance"}</button>
    </form>
  );
}
