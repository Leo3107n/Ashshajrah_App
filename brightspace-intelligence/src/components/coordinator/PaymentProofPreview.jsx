"use client";

import { AnimatePresence, motion } from "framer-motion";
import ClientPortal from "@/components/shared/ClientPortal";
import { buildInlinePreviewUrl } from "@/lib/filePreview";

function isPdf(url) {
  return String(url || "").toLowerCase().includes(".pdf");
}

export default function PaymentProofPreview({ item, onClose, onApprove, onReject }) {
  return (
    <AnimatePresence>
      {item ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pt-10 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-4xl rounded-[2rem] border border-[#2D8A6A]/20 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(6,63,50,0.22)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">
                  Payment proof
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
                  {item.voucher_no}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.14)] sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Student</p>
                <p className="mt-2 font-semibold text-[#063F32]">{item.student_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Transaction ID</p>
                <p className="mt-2 font-semibold text-[#063F32]">{item.transaction_id}</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)]">
              {item.proof_file_url ? (
                isPdf(item.proof_file_url) ? (
                  <iframe
                    title="Payment proof PDF"
                    src={buildInlinePreviewUrl(item.proof_file_url)}
                    className="h-[70vh] w-full"
                  />
                ) : (
                  <img
                    src={buildInlinePreviewUrl(item.proof_file_url)}
                    alt="Payment proof"
                    className="max-h-[70vh] w-full object-contain bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] p-3"
                  />
                )
              ) : (
                <div className="p-10 text-center text-sm text-[#245C4F]">
                  Preview unavailable for this payment proof.
                </div>
              )}
            </div>

            {String(item?.status || "").toLowerCase() === "pending" ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onApprove?.(item)}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-4 py-2 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DFF1E7]"
                >
                  Approve payment
                </button>
                <button
                  type="button"
                  onClick={() => onReject?.(item)}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Reject payment
                </button>
              </div>
            ) : null}
          </motion.div>
        </div>
        </ClientPortal>
      ) : null}
    </AnimatePresence>
  );
}
