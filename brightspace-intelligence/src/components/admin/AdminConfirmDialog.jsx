"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

export default function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  pending = false,
  onConfirm,
  onClose,
}) {
  const toneClass =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700"
      : "bg-[#0D5C48] hover:bg-[#063F32]";

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#063F32]/45 px-4 py-8 pt-24 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.22)] sm:p-8"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">
              Admin confirmation
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#063F32]">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#245C4F]">{description}</p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-60"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60 ${toneClass}`}
              >
                {pending ? (
                  <span className="inline-flex items-center gap-2">
                    <LeafSpinnerInline />
                    Working...
                  </span>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
