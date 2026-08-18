"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";
import { BadgePercent, Calculator, CalendarDays, FileText, Info, School } from "lucide-react";

const LOCKED_STATUSES = new Set(["submitted", "verified"]);
const NAME_PATTERN = "^[A-Za-zÀ-ÿ'’.-]{2,}(?:\\s+[A-Za-zÀ-ÿ'’.-]{2,})+$";
const PHONE_PATTERN = "^(?:\\+92|0)?[0-9]{10,12}$";
const TRANSACTION_PATTERN = "^[A-Za-z0-9_-]{3,150}$";

function FormulaOperator({ value }) {
  return (
    <div className="flex items-center justify-center pt-1 text-base font-bold text-[#063F32] sm:text-xl">
      {value}
    </div>
  );
}

function FormulaBox({ value, label }) {
  return (
    <div className="min-w-0">
      <div className="rounded-2xl border border-[#E4D9BE] bg-[#FFFEFB] px-1 py-2.5 shadow-[0_8px_18px_rgba(13,59,46,0.05)]">
        <p className="text-center text-[11px] font-bold text-[#063F32] sm:text-xs">
          {Number(value || 0).toLocaleString("en-PK")}
        </p>
      </div>
      <p className="mt-1.5 text-center text-[9px] font-medium leading-3 text-[#245C4F] sm:text-[10px]">
        {label}
      </p>
    </div>
  );
}

function FormulaTotal({ value }) {
  return (
    <div className="min-w-0">
      <div className="rounded-2xl bg-[linear-gradient(135deg,#063F32,#0D5C48)] px-2.5 py-2.5 text-[#FAF7F0] shadow-[0_14px_28px_rgba(13,59,46,0.24)]">
        <p className="text-center text-[11px] font-bold sm:text-xs">
          {Number(value || 0).toLocaleString("en-PK")}
        </p>
      </div>
      <p className="mt-1.5 text-center text-[9px] font-medium leading-3 text-[#245C4F] sm:text-[10px]">
        Total Amount
      </p>
    </div>
  );
}

function FormulaBoxSmall({ value, label }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E4D9BE] bg-[#FFFEFB] px-3 py-2 shadow-[0_8px_18px_rgba(13,59,46,0.05)]">
      <p className="text-[9px] font-semibold leading-4 text-[#245C4F]">{label}</p>
      <p className="text-xs font-bold text-[#063F32] sm:text-sm">{Number(value || 0).toLocaleString("en-PK")}</p>
    </div>
  );
}

function FormulaTotalSmall({ value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[linear-gradient(135deg,#063F32,#0D5C48)] px-3 py-2 text-[#FAF7F0] shadow-[0_14px_28px_rgba(13,59,46,0.24)]">
      <p className="text-[9px] font-semibold leading-4 text-[#FAF7F0]/85">Total Amount</p>
      <p className="text-xs font-bold sm:text-sm">{Number(value || 0).toLocaleString("en-PK")}</p>
    </div>
  );
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

export default function PaymentSubmissionForm({ voucher }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("neutral");
  const [proofPreview, setProofPreview] = useState("");

  const paymentMethods = useMemo(
    () => voucher.available_payment_methods || [],
    [voucher.available_payment_methods]
  );
  const regularFee = Number(voucher.regular_fee_amount || 0);
  const admissionFee = Number(voucher.admission_fee_amount || 0);
  const discountAmount = Number(voucher.discount_amount || 0);
  const totalAmount = Number(voucher.total_amount || voucher.amount || 0);
  const hasDiscount = regularFee > 0 && discountAmount > 0;
  const discountPercent = hasDiscount ? Math.round((discountAmount / regularFee) * 100) : 0;
  const nextMonthlyFee = Math.max(regularFee - discountAmount, 0);

  useEffect(() => {
    return () => {
      if (proofPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(proofPreview);
      }
    };
  }, [proofPreview]);

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const proofInput = formElement.elements.namedItem("proofFile");

    setPending(true);
    setMessage("");

    try {
      if (!(proofInput instanceof HTMLInputElement) || !proofInput.files?.length) {
        throw new Error("Payment proof file is required.");
      }

      const formData = new FormData(formElement);
      formData.set("voucherNo", voucher.voucher_no);

      const response = await fetch("/api/payment/submit", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Payment submission failed.");
      }

      setTone("success");
      setMessage("Payment proof submitted successfully. The coordinator will review it shortly.");
      formElement.reset();
      if (proofPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(proofPreview);
      }
      setProofPreview("");
      window.setTimeout(() => {
        router.refresh();
      }, 800);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Payment submission failed.");
    } finally {
      setPending(false);
    }
  }

  const submissionLocked = LOCKED_STATUSES.has(String(voucher.status || "").toLowerCase());

  function handleProofChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      if (proofPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(proofPreview);
      }
      setProofPreview("");
      return;
    }

    if (proofPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(proofPreview);
    }
    setProofPreview(URL.createObjectURL(file));
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.10fr_0.70fr]">
      <section className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:p-6">
        <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Student</p>
              <p className="mt-2 text-sm font-semibold text-[#063F32]">{voucher.student_name || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Parent</p>
              <p className="mt-2 text-sm font-semibold text-[#063F32]">{voucher.parent_name || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Class level</p>
              <p className="mt-2 text-sm font-semibold text-[#063F32]">{voucher.class_level || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Due date</p>
              <p className="mt-2 text-sm font-semibold text-[#063F32]">{formatDate(voucher.due_date)}</p>
            </div>
          </div>
        </div>

        <section className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFAF5_100%)] p-4 shadow-[0_18px_45px_rgba(13,59,46,0.08)] sm:p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F1EADC] text-[#0D5C48] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold uppercase text-[#063F32] sm:text-xl">
                Voucher Details
              </h3>
              <p className="mt-1.5 text-[11px] leading-5 text-[#245C4F] sm:text-xs">
                Please review your voucher fee breakdown before uploading payment proof.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-[#E4D9BE] bg-[#FCFAF5] p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#0D5C48] sm:text-sm">
              Fee Breakdown
            </p>

            <div className="mt-5 divide-y divide-[#E4D9BE]">
              <div className="flex items-center gap-3 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EADC] text-[#0D5C48]">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#063F32] sm:text-base">Monthly Fee</p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold text-[#063F32] sm:text-base">
                  PKR {regularFee.toLocaleString("en-PK")}
                </p>
              </div>

              {hasDiscount ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EADC] text-[#0D5C48]">
                    <BadgePercent className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#063F32] sm:text-base">Discount</p>
                    <p className="mt-1 text-xs text-[#245C4F]">{discountPercent}% monthly fee discount</p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-bold text-[#063F32] sm:text-base">
                    - PKR {discountAmount.toLocaleString("en-PK")}
                  </p>
                </div>
              ) : null}

              <div className="flex items-center gap-3 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EADC] text-[#0D5C48]">
                  <School className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#063F32] sm:text-base">Admission Fee</p>
                  <p className="mt-1 text-xs text-[#245C4F]">One-time fee only</p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold text-[#063F32] sm:text-base">
                  PKR {admissionFee.toLocaleString("en-PK")}
                </p>
              </div>
            </div>

            <div className="my-4 border-t border-dashed border-[#D8CBAA]" />

            <div className="rounded-[1.25rem] border border-[#E4D9BE] bg-white p-3.5 sm:p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] md:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#063F32,#0D5C48)] text-[#FAF7F0] shadow-[0_12px_30px_rgba(13,59,46,0.22)]">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#0D5C48] sm:text-[10px]">Total Amount</p>
                    <p className="mt-1 text-lg font-bold leading-tight text-[#063F32] sm:text-xl">
                      PKR {totalAmount.toLocaleString("en-PK")}
                    </p>
                  </div>
                </div>
                <div
                  className={`hidden items-start gap-1 text-center text-[#063F32] xl:grid ${
                    hasDiscount
                      ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
                      : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
                  }`}
                >
                  <FormulaBox value={regularFee} label="Monthly Fee" />
                  {hasDiscount ? <FormulaOperator value="-" /> : <FormulaOperator value="+" />}
                  {hasDiscount ? (
                    <FormulaBox value={discountAmount} label={`Discount (${discountPercent}%)`} />
                  ) : (
                    <FormulaBox value={admissionFee} label="Admission Fee" />
                  )}
                  {hasDiscount ? <FormulaOperator value="+" /> : <FormulaOperator value="=" />}
                  {hasDiscount ? (
                    <FormulaBox value={admissionFee} label="Admission Fee" />
                  ) : (
                    <FormulaTotal value={totalAmount} />
                  )}
                  {hasDiscount ? <FormulaOperator value="=" /> : null}
                  {hasDiscount ? <FormulaTotal value={totalAmount} /> : null}
                </div>

                <div className="grid gap-2 xl:hidden">
                  <FormulaBoxSmall value={regularFee} label="Monthly Fee" />
                  {hasDiscount ? <FormulaOperator value="-" /> : <FormulaOperator value="+" />}
                  {hasDiscount ? (
                    <FormulaBoxSmall value={discountAmount} label={`Discount (${discountPercent}%)`} />
                  ) : (
                    <FormulaBoxSmall value={admissionFee} label="Admission Fee" />
                  )}
                  {hasDiscount ? <FormulaOperator value="+" /> : <FormulaOperator value="=" />}
                  {hasDiscount ? (
                    <FormulaBoxSmall value={admissionFee} label="Admission Fee" />
                  ) : (
                    <FormulaTotalSmall value={totalAmount} />
                  )}
                  {hasDiscount ? <FormulaOperator value="=" /> : null}
                  {hasDiscount ? <FormulaTotalSmall value={totalAmount} /> : null}
                </div>
              </div>
            </div>

            {hasDiscount ? (
              <div className="mt-3 flex items-start gap-3 rounded-[1rem] border border-[#E4D9BE] bg-[#FFF5D6]/65 px-4 py-3 text-sm text-[#063F32]">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#0D5C48]" />
                <p>From next month onward, the monthly fee will be PKR {nextMonthlyFee.toLocaleString("en-PK")}/month.</p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Payment methods</p>
          <div className="mt-3 space-y-2">
            {paymentMethods.length ? paymentMethods.map((method) => (
              <div key={method.id || method.name} className="rounded-xl border border-[#2D8A6A]/10 bg-[#FAF7F0] px-3 py-3 text-sm text-[#063F32]">
                <p className="text-sm font-semibold sm:text-[15px]">{method.name || "Payment method"}</p>
                <div className="mt-2 grid gap-1.5 text-[13px] leading-5 text-[#245C4F] sm:text-sm">
                  {method.bank_name ? <p><span className="font-semibold text-[#063F32]">Bank:</span> {method.bank_name}</p> : null}
                  {method.account_title ? <p><span className="font-semibold text-[#063F32]">Account title:</span> {method.account_title}</p> : null}
                  {method.account_number ? <p><span className="font-semibold text-[#063F32]">Account number:</span> {method.account_number}</p> : null}
                  {method.iban ? <p><span className="font-semibold text-[#063F32]">IBAN:</span> {method.iban}</p> : null}
                  {method.branch_code ? <p><span className="font-semibold text-[#063F32]">Branch code:</span> {method.branch_code}</p> : null}
                  {method.instructions ? <p><span className="font-semibold text-[#063F32]">Instructions:</span> {method.instructions}</p> : null}
                </div>
              </div>
            )) : (
              <p className="text-sm text-[#245C4F]">No payment methods available.</p>
            )}
          </div>
        </div>

        <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-[#FAF7F0] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Payment instructions</p>
          <p className="mt-2 whitespace-pre-line text-sm text-[#245C4F]">
            {voucher.payment_instructions || "No payment instructions were provided."}
          </p>
        </div>
      </section>

      <section className="self-start rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.18)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
          Submit payment
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
          Share payment proof
        </h2>

        {submissionLocked ? (
          <div className="mt-6 rounded-2xl border border-[#E4C766]/40 bg-[#FFF5D6] px-4 py-3 text-sm text-[#8A6B00]">
            This voucher is currently marked as {voucher.status}. New submissions are temporarily disabled.
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payer name</span>
            <input
              type="text"
              name="payerName"
              disabled={submissionLocked || pending}
              pattern={NAME_PATTERN}
              title="Please enter a valid name."
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
              placeholder="Enter payer name"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payer email</span>
              <input
                type="email"
                name="payerEmail"
                disabled={submissionLocked || pending}
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
                placeholder="payer@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payer phone</span>
              <input
                type="tel"
                name="payerPhone"
                disabled={submissionLocked || pending}
                pattern={PHONE_PATTERN}
                title="Enter a valid phone number."
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
                placeholder="03xx-xxxxxxx"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">Transaction ID</span>
            <input
              type="text"
              name="transactionId"
              disabled={submissionLocked || pending}
              pattern={TRANSACTION_PATTERN}
              title="Enter a valid transaction ID."
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
              placeholder="Bank reference or wallet transaction ID"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Paid amount</span>
              <input
                type="number"
                min="1"
                step="0.01"
                name="paidAmount"
                disabled={submissionLocked || pending}
                inputMode="decimal"
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
                placeholder="5000"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Paid at</span>
              <input
                type="datetime-local"
                name="paidAt"
                disabled={submissionLocked || pending}
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payment proof file</span>
            <input
              type="file"
              name="proofFile"
              accept="image/*,.pdf"
              onChange={handleProofChange}
              disabled={submissionLocked || pending}
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0] hover:file:bg-[#063F32] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
              required
            />
          </label>

          {proofPreview ? (
            <a
              href={proofPreview}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl border border-[#2D8A6A]/15 bg-white"
            >
              {String(voucher.proof_file_name || "").toLowerCase().includes(".pdf") ? (
                <div className="p-6 text-center text-sm font-semibold text-[#0D5C48]">
                  Open selected proof
                </div>
              ) : (
                <img
                  src={proofPreview}
                  alt="Selected proof preview"
                  className="h-52 w-full object-contain bg-[#FAF7F0] p-3"
                />
              )}
            </a>
          ) : null}

          {message ? (
            <p
              className={`rounded-2xl px-4 py-3 text-sm ${
                tone === "success"
                  ? "border border-[#2D8A6A]/20 bg-[#EAF6EF] text-[#0D5C48]"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submissionLocked || pending}
            className="inline-flex items-center justify-center rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <LeafSpinnerInline />
                Submitting...
              </span>
            ) : (
              "Submit payment proof"
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
