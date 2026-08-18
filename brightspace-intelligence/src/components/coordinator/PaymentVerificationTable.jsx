"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PaymentProofPreview from "@/components/coordinator/PaymentProofPreview";
import ClientPortal from "@/components/shared/ClientPortal";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

const STATUS_STYLES = {
  submitted: "bg-amber-50 text-amber-700",
  verified: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  monthly: "bg-[#FFF5D6] text-[#8A6B00]",
};

function formatStatus(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "Unknown";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isMonthlyVoucher(item) {
  return Boolean(item?.is_monthly_voucher || !item?.registration_lead_id);
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function PaymentVerificationTable({ items, onRefresh }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [credentialsEmail, setCredentialsEmail] = useState(null);
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [refreshOnCredentialsClose, setRefreshOnCredentialsClose] = useState(false);

  function refreshNow() {
    requestAnimationFrame(() => {
      if (onRefresh) onRefresh();
      else router.refresh();
    });
  }
  function openProofPreview(item) {
    const previewItem = {
      ...item,
      proof_file_url:
        item.proof_file_url ||
        (item.proof_file_path
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/payment_proofs/${String(item.proof_file_path).replace(/^payment_proofs\//, "")}`
          : ""),
    };

    setSelectedItem(previewItem);
  }

  async function verifyPayment(id, action) {
    if (action === "reject") {
      const item = items.find((entry) => entry.id === id) || null;
      setRejectingItem(item);
      setRejectionReason("");
      return;
    }

    setPendingId(`${id}:${action}`);

    try {
      const response = await fetch(`/api/coordinator/payments/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason: "" }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Verify API error:", data);
        alert(data.message || "Payment verification failed");
        return;
      }

      if (data?.credentials_email) {
        setCredentialsEmail(data.credentials_email);
        setRefreshOnCredentialsClose(true);
      } else {
        refreshNow();
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Payment verification failed.");
    } finally {
      setPendingId("");
    }
  }

  async function copyParentPhone() {
    const phone = credentialsEmail?.parent_phone || "";
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
  }

  async function submitRejection(event) {
    event.preventDefault();
    if (!rejectingItem) return;
    if (!rejectionReason.trim()) return;

    setRejecting(true);
    setPendingId(`${rejectingItem.id}:reject`);

    try {
      const response = await fetch(`/api/coordinator/payments/${rejectingItem.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectionReason: rejectionReason.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.message || "Payment verification failed");
        return;
      }

      setRejectingItem(null);
      refreshNow();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Payment verification failed.");
    } finally {
      setRejecting(false);
      setPendingId("");
      setRejectionReason("");
    }
  }

  if (!items.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/30 bg-[#FAF7F0]/80 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(6,63,50,0.16)]">
        No payment submissions match the current filter.
      </section>
    );
  }

  return (
    <>
      <section className="space-y-4">
        <div className="hidden overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#F1EADC]">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Voucher</th>
                  <th className="px-6 py-4">Submitted amount</th>
                  <th className="px-6 py-4">Transaction</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {items.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.02 }}
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold text-[#063F32]">{item.student_name}</p>
                      <p className="mt-1 text-sm text-[#245C4F]">
                        {item.parent_name || "Parent pending"}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-[#063F32]">{item.voucher_no}</p>
                      <p className="mt-1 text-sm text-[#245C4F]">
                        Voucher amount: PKR {item.voucher_amount}
                      </p>
                      {isMonthlyVoucher(item) ? (
                        <span className="mt-2 inline-flex rounded-full bg-[#FFF5D6] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A6B00]">
                          Monthly
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-[#063F32]">PKR {item.paid_amount}</p>
                      <p className="mt-1 text-sm text-[#245C4F]">{formatDate(item.paid_at)}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-[#063F32]">{item.transaction_id}</p>
                      <p className="mt-1 text-sm text-[#245C4F]">
                        {item.phone || item.email || "No contact"}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[normalizeStatus(item.status)] || "bg-[#F1EADC] text-[#245C4F]"
                          }`}
                      >
                        {formatStatus(normalizeStatus(item.status))}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openProofPreview(item)}
                          className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                        >
                          View proof
                        </button>
                        {normalizeStatus(item.status) === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={pendingId === `${item.id}:approve`}
                              onClick={() => verifyPayment(item.id, "approve")}
                              className="rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF1E7] disabled:opacity-60"
                            >
                              Approve payment
                            </button>
                            <button
                              type="button"
                              disabled={pendingId === `${item.id}:reject`}
                              onClick={() => verifyPayment(item.id, "reject")}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                            >
                              Reject payment
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:hidden">
          {items.map((item, index) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.02 }}
              className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[#063F32]">{item.student_name}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">{item.voucher_no}</p>
                  {isMonthlyVoucher(item) ? (
                    <span className="mt-2 inline-flex rounded-full bg-[#FFF5D6] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A6B00]">
                      Monthly
                    </span>
                  ) : null}
                  <p className="mt-1 text-sm text-[#245C4F]/80">
                    {item.parent_name || "Parent pending"}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[normalizeStatus(item.status)] || "bg-[#F1EADC] text-[#245C4F]"
                    }`}
                >
                  {formatStatus(normalizeStatus(item.status))}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-[#245C4F]">
                <p>Submitted amount: PKR {item.paid_amount}</p>
                <p>Voucher amount: PKR {item.voucher_amount}</p>
                <p>Transaction: {item.transaction_id}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openProofPreview(item)}
                  className="rounded-xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#245C4F] transition hover:bg-[#FAF7F0]"
                >
                  View proof
                </button>
                {normalizeStatus(item.status) === "pending" ? (
                  <>
                    <button
                      type="button"
                      disabled={pendingId === `${item.id}:approve`}
                      onClick={() => verifyPayment(item.id, "approve")}
                      className="rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF1E7] disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-2">
                        {pendingId === `${item.id}:approve` ? (
                          <LeafSpinnerInline className="h-3.5 w-3.5 border-[#0D5C48]/30 border-t-[#0D5C48]" />
                        ) : null}
                        <span>{pendingId === `${item.id}:approve` ? "Approving..." : "Approve payment"}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === `${item.id}:reject`}
                      onClick={() => verifyPayment(item.id, "reject")}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-2">
                        {pendingId === `${item.id}:reject` ? (
                          <LeafSpinnerInline className="h-3.5 w-3.5 border-rose-300 border-t-rose-700" />
                        ) : null}
                        <span>{pendingId === `${item.id}:reject` ? "Rejecting..." : "Reject payment"}</span>
                      </span>
                    </button>
                  </>
                ) : null}
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <PaymentProofPreview
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onApprove={(item) => verifyPayment(item.id, "approve")}
        onReject={(item) => verifyPayment(item.id, "reject")}
      />

      {credentialsEmail ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pt-10 pb-10">
          <div className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
              Payment Approved Successfully
            </p>
            <div className="mt-4 space-y-3 rounded-2xl border border-[#2D8A6A]/15 bg-white/85 p-4 text-sm text-[#245C4F]">
              <p><span className="font-semibold text-[#063F32]">Recipient Email:</span> {credentialsEmail.recipient_email || "â€”"}</p>
              <p><span className="font-semibold text-[#063F32]">Subject:</span> {credentialsEmail.subject || "â€”"}</p>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3">
                <p className="text-sm text-[#245C4F]">
                  <span className="font-semibold text-[#063F32]">Parent Phone:</span>{" "}
                  {credentialsEmail.parent_phone || "â€”"}
                </p>
                <button
                  type="button"
                  onClick={() => void copyParentPhone()}
                  className="rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]"
                >
                  Copy Number
                </button>
              </div>
              <div>
                <p className="font-semibold text-[#063F32]">Credentials Email Content</p>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 text-xs text-[#245C4F]">
                  {credentialsEmail.body_text || ""}
                </pre>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(credentialsEmail.body_text || "")}
                className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
              >
                Copy Message
              </button>
              <button
                type="button"
                onClick={() => {
                  setCredentialsEmail(null);
                  if (refreshOnCredentialsClose) {
                    setRefreshOnCredentialsClose(false);
                    window.location.reload();
                  }
                }}
                className="rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#FAF7F0]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        </ClientPortal>
      ) : null}

      {rejectingItem ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pt-10 pb-10 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/20 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(6,63,50,0.24)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-700">Reject Payment</p>
            <p className="mt-2 text-sm text-[#245C4F]">
              Enter the rejection reason for <span className="font-semibold text-[#063F32]">{rejectingItem.student_name || "this payment"}</span>.
            </p>

            <form onSubmit={submitRejection} className="mt-5 space-y-4">
              <label className="space-y-2 block">
                <span className="text-sm font-medium text-[#245C4F]">Reason</span>
                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  rows={5}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                  placeholder="Enter reason for rejection"
                />
              </label>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (rejecting) return;
                    setRejectingItem(null);
                    setRejectionReason("");
                    requestAnimationFrame(() => {
                      if (onRefresh) onRefresh();
                      else router.refresh();
                    });
                  }}
                  className="rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#FAF7F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejecting || !rejectionReason.trim()}
                  className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    {rejecting ? (
                      <LeafSpinnerInline className="h-4 w-4 border-white/35 border-t-white" />
                    ) : null}
                    <span>{rejecting ? "Rejecting..." : "Reject payment"}</span>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
        </ClientPortal>
      ) : null}
    </>
  );
}
