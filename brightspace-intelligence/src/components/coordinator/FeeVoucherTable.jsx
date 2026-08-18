"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { jsPDF } from "jspdf";
import FeeVoucherPreviewModal from "@/components/coordinator/FeeVoucherPreviewModal";

const STATUS_STYLES = {
  unpaid: "bg-[#FFF5D6] text-[#8A6B00]",
  submitted: "bg-[#FFF5D6] text-[#8A6B00]",
  verified: "bg-[#EAF6EF] text-[#0D5C48]",
  rejected: "bg-rose-50 text-rose-700",
  expired: "bg-[#FFF5D6] text-[#8A6B00]",
  new_lead: "bg-[#EAF6EF] text-[#0D5C48]",
  voucher_created: "bg-[#FFF5D6] text-[#8A6B00]",
  fee_submitted: "bg-[#FFF5D6] text-[#8A6B00]",
  fee_verified: "bg-[#EAF6EF] text-[#0D5C48]",
  access_granted: "bg-[#EAF6EF] text-[#0D5C48]",
  pending_clarification: "bg-[#FFF5D6] text-[#8A6B00]",
};

function formatStatus(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function getDisplayStatus(voucher) {
  return voucher?.lead_status || voucher?.voucher_status || voucher?.status || "";
}

function getDisplayBankName(voucher) {
  return (
    voucher?.bank_name ||
    voucher?.payment_method_details?.bank_name ||
    voucher?.payment_method ||
    "Payment method unavailable"
  );
}

function getDisplayPaymentMethod(voucher) {
  return (
    voucher?.payment_method_name ||
    voucher?.payment_method_details?.name ||
    voucher?.payment_method ||
    "Payment method unavailable"
  );
}

function getPaymentSubmitLink(voucher) {
  const voucherNo = String(voucher?.voucher_no || "").trim();
  if (!voucherNo) return "";
  return `${window.location.origin.replace(/\/+$/, "")}/payment/${encodeURIComponent(voucherNo)}`;
}

async function fetchVoucherDetails(voucherId) {
  if (!voucherId) return null;

  try {
    const response = await fetch(`/api/coordinator/fee-vouchers/${voucherId}`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    return data?.item || null;
  } catch {
    return null;
  }
}

function normalizeVoucherForPdf(voucher) {
  const paymentMethodDetails = voucher?.payment_method_details || {};
  const amount = Number(voucher?.amount || 0);
  const regularFeeAmount = Number(voucher?.regular_fee_amount || 0);
  const otherFeeAmount = Number(voucher?.admission_fee_amount || 0);
  const subtotalAmount = Number(voucher?.subtotal_amount || regularFeeAmount + otherFeeAmount);
  const discountPercent = Number(voucher?.discount_percent || 0);
  const discountAmount = Number(voucher?.discount_amount || 0);
  const totalAmount = Number(voucher?.total_amount || subtotalAmount - discountAmount || amount);
  return {
    ...voucher,
    amount,
    class_level: voucher?.class_level || voucher?.grade_level || voucher?.course_title || "-",
    payment_method_name:
      voucher?.payment_method_name ||
      paymentMethodDetails.name ||
      voucher?.payment_method ||
      "",
    bank_name: voucher?.bank_name || paymentMethodDetails.bank_name || "",
    account_title: voucher?.account_title || paymentMethodDetails.account_title || "",
    account_number: voucher?.account_number || paymentMethodDetails.account_number || "",
    iban: voucher?.iban || paymentMethodDetails.iban || "",
    branch_code: voucher?.branch_code || paymentMethodDetails.branch_code || "",
    payment_method_instructions:
      voucher?.payment_method_instructions ||
      voucher?.payment_instructions ||
      paymentMethodDetails.instructions ||
      "",
    payment_method_details: {
      name:
        voucher?.payment_method_name ||
        paymentMethodDetails.name ||
        voucher?.payment_method ||
        "",
      bank_name: voucher?.bank_name || paymentMethodDetails.bank_name || "",
      account_title: voucher?.account_title || paymentMethodDetails.account_title || "",
      account_number: voucher?.account_number || paymentMethodDetails.account_number || "",
      iban: voucher?.iban || paymentMethodDetails.iban || "",
      branch_code: voucher?.branch_code || paymentMethodDetails.branch_code || "",
      instructions:
        voucher?.payment_method_instructions ||
        voucher?.payment_instructions ||
        paymentMethodDetails.instructions ||
        "",
    },
    regular_fee_amount: regularFeeAmount,
    admission_fee_amount: otherFeeAmount,
    subtotal_amount: subtotalAmount,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    total_amount: totalAmount,
  };
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `PKR ${Number.isFinite(amount) ? amount.toLocaleString("en-PK") : "0"}`;
}

function buildVoucherPrintHtml(voucher) {
  const safe = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const bankName = getDisplayBankName(voucher);
  const paymentMethod = voucher?.payment_method_details || voucher || {};
  const paymentMethodName =
    voucher?.payment_method_name ||
    paymentMethod.name ||
    voucher?.payment_method ||
    "Payment method unavailable";
  const regularFeeAmount = Number(voucher?.regular_fee_amount || 0);
  const otherFeeAmount = Number(voucher?.admission_fee_amount || 0);
  const subtotalAmount = Number(voucher?.subtotal_amount || regularFeeAmount + otherFeeAmount);
  const discountPercent = Number(voucher?.discount_percent || 0);
  const discountAmount = Number(voucher?.discount_amount || 0);
  const totalAmount = Number(voucher?.total_amount || subtotalAmount - discountAmount);
  const feeRows = [
    voucher?.regular_fee_applied && regularFeeAmount > 0
      ? `<tr><td style="padding:10px 0;color:#64748b;">Regular Fee</td><td style="padding:10px 0;text-align:right;font-weight:700;">${safe(formatMoney(regularFeeAmount))}</td></tr>`
      : "",
    otherFeeAmount > 0
      ? `<tr><td style="padding:10px 0;color:#64748b;">Other Fee</td><td style="padding:10px 0;text-align:right;font-weight:700;">${safe(formatMoney(otherFeeAmount))}</td></tr>`
      : "",
    `<tr><td style="padding:10px 0;color:#64748b;">Subtotal</td><td style="padding:10px 0;text-align:right;font-weight:700;">${safe(formatMoney(subtotalAmount))}</td></tr>`,
    `<tr><td style="padding:10px 0;color:#64748b;">Discount on Regular Fee</td><td style="padding:10px 0;text-align:right;font-weight:700;">${safe(`${discountPercent}% (${formatMoney(discountAmount)})`)}</td></tr>`,
    `<tr><td style="padding:10px 0;color:#64748b;">Total Payable</td><td style="padding:10px 0;text-align:right;font-weight:800;">${safe(formatMoney(totalAmount))}</td></tr>`,
  ]
    .filter(Boolean)
    .join("");

  return `
    <html>
      <head>
        <title>${safe(voucher.voucher_no || "Voucher")}</title>
        <style>
          @page { size: A4; margin: 18mm; }
          body { margin:0; font-family: Arial, sans-serif; color:#063F32; background:#FAF7F0; }
          .card { border:1px solid #2D8A6A; border-radius:24px; overflow:hidden; background:#FAF7F0; }
          .header { background:linear-gradient(135deg,#0D3B2E,#0D5C48); color:#FAF7F0; padding:28px; }
          .body { padding:28px; }
          .meta { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:18px; }
          .box { border:1px solid #2D8A6A; border-radius:18px; background:#ffffff; padding:18px; }
          table { width:100%; border-collapse:collapse; }
          td { font-size:14px; }
          .section { margin-top:20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.85;color:#FFF5D6;">Ash-Shajrah Learning Hub (ALH) Fee Voucher</div>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;">${safe(voucher.voucher_no || "Voucher")}</h1>
          </div>
          <div class="body">
            <div class="meta">
              <div class="box"><div style="color:#245C4F;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Student</div><div style="margin-top:8px;font-weight:700;color:#063F32;">${safe(voucher.student_name || "")}</div></div>
              <div class="box"><div style="color:#245C4F;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Parent</div><div style="margin-top:8px;font-weight:700;color:#063F32;">${safe(voucher.parent_name || "Not provided")}</div></div>
              <div class="box"><div style="color:#245C4F;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Bank Name</div><div style="margin-top:8px;font-weight:700;color:#063F32;">${safe(bankName)}</div></div>
              <div class="box"><div style="color:#245C4F;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Due Date</div><div style="margin-top:8px;font-weight:700;color:#063F32;">${safe(formatDate(voucher.due_date))}</div></div>
            </div>

            <div class="section box">
              <table>
                ${feeRows}
              </table>
            </div>

            <div class="section box">
              <div style="color:#245C4F;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Payment Instructions</div>
              <p style="margin:12px 0 0;white-space:pre-line;line-height:1.7;color:#245C4F;">${safe(voucher.payment_instructions || "No payment instructions were added for this voucher.")}</p>
            </div>

            <div class="section box">
              <div style="color:#245C4F;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Payment Method Details</div>
              <table style="margin-top:10px;">
                <tr><td style="padding:6px 0;color:#245C4F;">Method</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#063F32;">${safe(paymentMethodName)}</td></tr>
                <tr><td style="padding:6px 0;color:#245C4F;">Bank Name</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#063F32;">${safe(voucher.bank_name || paymentMethod.bank_name || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#245C4F;">Account Title</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#063F32;">${safe(voucher.account_title || paymentMethod.account_title || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#245C4F;">Account Number</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#063F32;">${safe(voucher.account_number || paymentMethod.account_number || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#245C4F;">IBAN</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#063F32;">${safe(voucher.iban || paymentMethod.iban || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#245C4F;">Branch Code</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#063F32;">${safe(voucher.branch_code || paymentMethod.branch_code || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#245C4F;">Instructions</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#063F32;">${safe(voucher.payment_method_instructions || voucher.payment_instructions || paymentMethod.instructions || "-")}</td></tr>
              </table>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function downloadVoucherPdf(voucher) {
  const detail = voucher?.id ? await fetchVoucherDetails(voucher.id) : null;
  const normalized = normalizeVoucherForPdf(detail || voucher);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  const regularFeeAmount = Number(normalized?.regular_fee_amount || 0);
  const otherFeeAmount = Number(normalized?.admission_fee_amount || 0);
  const subtotalAmount = Number(normalized?.subtotal_amount || regularFeeAmount + otherFeeAmount);
  const discountPercent = Number(normalized?.discount_percent || 0);
  const discountAmount = Number(normalized?.discount_amount || 0);
  const totalAmount = Number(normalized?.total_amount || subtotalAmount - discountAmount);
  const paymentMethod = normalized?.payment_method_details || {};
  const paymentMethodName = getDisplayPaymentMethod(normalized);
  const rows = [
    ["Voucher No", normalized?.voucher_no],
    ["Student", normalized?.student_name],
    ["Parent", normalized?.parent_name || "Not provided"],
    ["Class", normalized?.class_level || "-"],
    ["Due Date", formatDate(normalized?.due_date)],
    ["Regular Fee", regularFeeAmount > 0 ? formatMoney(regularFeeAmount) : "0"],
    ["Other Fee", otherFeeAmount > 0 ? formatMoney(otherFeeAmount) : "0"],
    ["Subtotal", formatMoney(subtotalAmount)],
    ["Discount on Regular Fee", `${discountPercent}% (${formatMoney(discountAmount)})`],
    ["Total Payable", formatMoney(totalAmount)],
    ["Payment Method", paymentMethodName],
    ["Bank Name", voucher?.bank_name || paymentMethod.bank_name || "-"],
    ["Account Title", voucher?.account_title || paymentMethod.account_title || "-"],
    ["Account Number", voucher?.account_number || paymentMethod.account_number || "-"],
    ["IBAN", voucher?.iban || paymentMethod.iban || "-"],
    ["Branch Code", voucher?.branch_code || paymentMethod.branch_code || "-"],
    ["Instructions", voucher?.payment_method_instructions || voucher?.payment_instructions || paymentMethod.instructions || "-"],
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Ash-Shajrah Learning Hub (ALH) Fee Voucher", margin, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  rows.forEach(([label, value]) => {
    const line = `${label}: ${String(value || "-")}`;
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
    if (y + wrapped.length * 16 > 800) {
      doc.addPage();
      y = margin;
    }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 16;
  });

  const link = getPaymentSubmitLink(normalized);
  if (link) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Submit Payment", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    const wrappedLink = doc.splitTextToSize(link, pageWidth - margin * 2);
    doc.text(wrappedLink, margin, y);
  }

  doc.save(`${String(voucher?.voucher_no || "voucher").replace(/[^\w.-]+/g, "_")}.pdf`);
}

export default function FeeVoucherTable({ vouchers }) {
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [toast, setToast] = useState("");

  async function copyVoucherLink(voucherId) {
    const voucher = vouchers.find((item) => item.id === voucherId);
  const link = voucher ? getPaymentSubmitLink(voucher) : "";
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setToast("Voucher link copied.");
    window.clearTimeout(window.__voucherToastTimer);
    window.__voucherToastTimer = window.setTimeout(() => setToast(""), 2500);
  }

  if (!vouchers.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-white/85 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
        No fee vouchers match the current filters.
      </section>
    );
  }

  return (
    <>
      {toast ? (
        <div className="fixed right-6 top-6 z-[80] rounded-2xl border border-[#2D8A6A]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-3 text-sm font-semibold text-[#063F32] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.22)] backdrop-blur-xl">
          {toast}
        </div>
      ) : null}
      <section className="space-y-4">
        <div className="hidden overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#F1EADC]">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                  <th className="px-6 py-4">Voucher</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Due date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {vouchers.map((voucher, index) => (
                  (() => {
                    const displayStatus = getDisplayStatus(voucher);
                    return (
                  <motion.tr
                    key={voucher.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.02 }}
                  >
                    <td className="px-6 py-5">
                  <p className="font-semibold text-[#063F32]">{voucher.voucher_no}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">{getDisplayBankName(voucher)}</p>
                    </td>
                    <td className="px-6 py-5">
                  <p className="font-semibold text-[#063F32]">{voucher.student_name}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">
                        {voucher.parent_name || "Parent pending"}
                      </p>
                    </td>
                    <td className="px-6 py-5 font-semibold text-[#063F32]">
                      {formatMoney(voucher.amount)}
                    </td>
                    <td className="px-6 py-5 text-sm text-[#245C4F]">
                      {formatDate(voucher.due_date)}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[displayStatus] || "bg-[#FFF5D6] text-[#8A6B00]"
                        }`}
                      >
                        {formatStatus(displayStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(voucher)}
                          className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                        >
                          View voucher
                        </button>
                        <button
                          type="button"
                          onClick={() => copyVoucherLink(voucher.id)}
                          className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                        >
                          Copy voucher link
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadVoucherPdf(voucher)}
                          className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                        >
                          Download PDF
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:hidden">
          {vouchers.map((voucher, index) => (
            (() => {
              const displayStatus = getDisplayStatus(voucher);
              return (
            <motion.article
              key={voucher.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.02 }}
              className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[#063F32]">{voucher.voucher_no}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">{voucher.student_name}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">
                    {getDisplayBankName(voucher)}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[displayStatus] || "bg-[#FFF5D6] text-[#8A6B00]"
                  }`}
                >
                  {formatStatus(displayStatus)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-[#245C4F]">
                <p>Regular Fee: {formatMoney(voucher.regular_fee_amount)}</p>
                <p>Other Fee: {formatMoney(voucher.admission_fee_amount)}</p>
                <p>Subtotal: {formatMoney(voucher.subtotal_amount)}</p>
                <p>Discount on Regular Fee: {Number(voucher.discount_percent || 0)}% ({formatMoney(voucher.discount_amount)})</p>
                <p>Total Payable: {formatMoney(voucher.total_amount || voucher.amount)}</p>
                <p>Due date: {formatDate(voucher.due_date)}</p>
                <p>Method: {getDisplayPaymentMethod(voucher)}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(voucher)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  View voucher
                </button>
                <button
                  type="button"
                  onClick={() => copyVoucherLink(voucher.id)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Copy voucher link
                </button>
                <button
                  type="button"
                  onClick={() => downloadVoucherPdf(voucher)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Download PDF
                </button>
              </div>
            </motion.article>
              );
            })()
          ))}
        </div>
      </section>

      <FeeVoucherPreviewModal
        voucher={selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
      />
    </>
  );
}
