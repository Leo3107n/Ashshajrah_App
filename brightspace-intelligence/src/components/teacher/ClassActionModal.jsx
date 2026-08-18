"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CompletionReportForm from "@/components/teacher/CompletionReportForm";
import { canShowMarkConducted, getLectureDisplayStatus, getTeacherLectureActionLink } from "@/lib/lectureStatus";

export default function ClassActionModal({ lecture, open, onClose, onChanged }) {
  const [markingConducted, setMarkingConducted] = useState(false);
  const [conductedLectureId, setConductedLectureId] = useState("");

  useEffect(() => {
    if (!open) {
      setMarkingConducted(false);
      setConductedLectureId("");
      return;
    }
    if (lecture?.id) {
      setMarkingConducted(false);
      setConductedLectureId("");
    }
  }, [lecture?.id, open]);

  if (!open || !lecture?.id) {
    return null;
  }

  const primaryLink = getTeacherLectureActionLink(lecture);
  const displayStatus = getLectureDisplayStatus(lecture);

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function markConducted() {
    if (markingConducted) return;
    setMarkingConducted(true);
    try {
      const response = await fetch(`/api/teacher/lectures/${lecture.id}`, { method: "PATCH" });
      const data = await readJson(response);
      if (!response.ok) {
        window.alert(data?.message || "Unable to mark conducted.");
        return;
      }
      setConductedLectureId(lecture.id);
      await onChanged?.();
    } finally {
      setMarkingConducted(false);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex min-h-screen items-start justify-center overflow-y-auto bg-[#063F32]/45 px-4 pt-12 pb-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Class actions</p>
              <h2 className="mt-2 font-body text-2xl font-semibold text-[#063F32]">{lecture.title}</h2>
              <p className="mt-1 text-sm text-[#245C4F]">{lecture.student_name} - {lecture.subject_name}</p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32]">Close</button>
          </div>
          <div className="mt-5 grid gap-5">
            {primaryLink ? (
              <a
                href={primaryLink.href}
                target="_blank"
                rel="noreferrer"
                className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${
                  primaryLink.kind === "recording"
                    ? "bg-[#FAF7F0] text-[#0D5C48] ring-1 ring-[#2D8A6A]/15"
                    : "bg-[#0D5C48] text-[#FAF7F0]"
                }`}
              >
                {primaryLink.label}
              </a>
            ) : (
              <span className="rounded-2xl bg-[#FAF7F0] px-4 py-3 text-center text-sm font-semibold text-[#245C4F]">{displayStatus}</span>
            )}
            {canShowMarkConducted(lecture) ? (
              <button
                onClick={markConducted}
                disabled={markingConducted || conductedLectureId === lecture.id}
                className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                {markingConducted ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#063F32]/20 border-t-[#063F32]" />
                    Marking...
                  </span>
                ) : conductedLectureId === lecture.id ? (
                  "Conducted"
                ) : (
                  "Mark conducted"
                )}
              </button>
            ) : null}
            <CompletionReportForm
              lecture={lecture}
              onSaved={async () => {
                await onChanged?.();
                onClose?.();
              }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
