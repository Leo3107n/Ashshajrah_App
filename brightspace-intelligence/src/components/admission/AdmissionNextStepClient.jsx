"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PaymentSubmissionForm from "@/components/payment/PaymentSubmissionForm";
import { BadgePercent, Calculator, CalendarDays, FileText, Info, School } from "lucide-react";

const RESIDENCE_OPTIONS = ["Owned", "Rented", "Shared", "Other"];

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
      <div className="rounded-2xl border border-[#E4D9BE] bg-[#FFFEFB] px-2.5 py-2.5 shadow-[0_8px_18px_rgba(13,59,46,0.05)]">
        <p className="truncate text-center text-xs font-bold text-[#063F32] sm:text-sm">
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
        <p className="truncate text-center text-xs font-bold sm:text-sm">
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

export default function AdmissionNextStepClient({
  registrationId,
  leadToken = "",
  submitted = false,
  voucher = null,
  lead = null,
  scholarship = null,
}) {
  const router = useRouter();
  const [useScholarship, setUseScholarship] = useState(Boolean(scholarship));
  const [form, setForm] = useState({
    dependentsCount: scholarship?.dependents_count ? String(scholarship.dependents_count) : "",
    schoolGoingChildrenCount: scholarship?.school_going_children_count ? String(scholarship.school_going_children_count) : "",
    residenceType: scholarship?.residence_type || "",
    requestedAmount: scholarship?.requested_amount ? String(scholarship.requested_amount) : "",
    reason: scholarship?.scholarship_reason || "",
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("neutral");

  const scholarshipSubmitted = Boolean(scholarship);
  const paymentReady = Boolean(voucher?.voucher_no);
  const paymentLockedStatuses = new Set(["submitted", "verified"]);
  const paymentAlreadySubmitted = paymentLockedStatuses.has(String(voucher?.status || "").toLowerCase());
  const paymentLockedByScholarship = scholarshipSubmitted;
  const scholarshipLockMessage = scholarshipSubmitted
    ? "Need based scholarship has already been submitted."
    : "Need based scholarship is locked because the payment has already been submitted.";
  const paymentLockMessage = paymentLockedByScholarship
    ? "Payment form is no longer available because the need based scholarship form has already been submitted."
    : "";

  useEffect(() => {
    if (!submitted || paymentAlreadySubmitted || scholarshipSubmitted) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setTone("success");
      setMessage("Admission form is submitted and you are also redirected to your payment page.");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [paymentAlreadySubmitted, scholarshipSubmitted, submitted]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setMessage("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [message]);

  const feeSummary = useMemo(() => {
    if (!voucher) {
      return {
        regularFee: 0,
        admissionFee: 0,
        discountAmount: 0,
        totalAmount: 0,
      };
    }

    return {
      regularFee: Number(voucher.regular_fee_amount || 0),
      admissionFee: Number(voucher.admission_fee_amount || 0),
      discountAmount: Number(voucher.discount_amount || 0),
      totalAmount: Number(voucher.total_amount || voucher.amount || 0),
    };
  }, [voucher]);

  function renderFeeDetailsCard({ scholarshipMode = false } = {}) {
    const monthlyFee = feeSummary.regularFee;
    const admissionFee = feeSummary.admissionFee;
    const discountAmount = scholarshipMode ? 0 : feeSummary.discountAmount;
    const totalAmount = scholarshipMode
      ? Math.max(monthlyFee + admissionFee, 0)
      : Math.max(monthlyFee - discountAmount + admissionFee, 0);
    const discountPercent =
      !scholarshipMode && monthlyFee > 0 && discountAmount > 0
        ? Math.round((discountAmount / monthlyFee) * 100)
        : 0;
    const hasDiscount = discountPercent > 0 && discountAmount > 0;
    const nextMonthlyFee = Math.max(monthlyFee - discountAmount, 0);

    return (
      <section className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFAF5_100%)] p-4 shadow-[0_18px_45px_rgba(13,59,46,0.08)] sm:p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F1EADC] text-[#0D5C48] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold uppercase text-[#063F32] sm:text-xl">
              Payment Details
            </h3>
            <p className="mt-1.5 text-[11px] leading-5 text-[#245C4F] sm:text-xs">
              Please review your fee breakdown before moving to the next step.
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
                PKR {monthlyFee.toLocaleString("en-PK")}
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
                className={`hidden items-start gap-1 text-center text-[#063F32] sm:grid ${
                  hasDiscount
                    ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
                    : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
                }`}
              >
                <FormulaBox value={monthlyFee} label="Monthly Fee" />
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

              <div className="grid gap-2 sm:hidden">
                <FormulaBoxSmall value={monthlyFee} label="Monthly Fee" />
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
    );
  }

  async function handleScholarshipSubmit(event) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/public/admission-next-step/scholarship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          leadToken,
          dependentsCount: form.dependentsCount,
          schoolGoingChildrenCount: form.schoolGoingChildrenCount,
          residenceType: form.residenceType,
          requestedAmount: form.requestedAmount,
          scholarshipReason: form.reason,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to submit need based scholarship form.");
      }

      setTone("success");
      setMessage("Need based scholarship form submitted successfully.");
      window.setTimeout(() => {
        router.refresh();
      }, 800);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit need based scholarship form.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative space-y-6">
      {message ? (
        <div
          className={`fixed right-4 top-4 z-[10000] rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(13,59,46,0.45)] ${
            tone === "success"
              ? "border-[#2D8A6A]/25 bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FFF5D6]"
              : "border-rose-200 bg-white text-rose-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[2.25rem] border border-[#0D5C48]/25 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,199,102,0.22),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(250,247,240,0.08),transparent_30%)]" />
        <div className="relative grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
              Admission submitted
            </p>
            <h2 className="mb-3 mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Continue with payment or need based scholarship
            </h2>
            <p className="text-sm leading-7 text-[#EAF6EF] sm:text-base">
              Your admission form has been received. Please continue with the next step from this page.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3 text-sm text-[#FAF7F0]">
            {lead?.student_name || "Student"}
            {lead?.class_level ? ` • ${lead.class_level}` : ""}
          </div>
        </div>
      </section>

      <section className="rounded-[1.85rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.18)]">
        <label className="flex items-start gap-3 rounded-2xl border border-[rgba(201,162,39,0.22)] bg-[#FFF5D6]/70 px-4 py-4 text-sm text-[#063F32]">
          <input
            type="checkbox"
            checked={useScholarship}
            onChange={(event) => setUseScholarship(event.target.checked)}
            disabled={paymentAlreadySubmitted || scholarshipSubmitted}
            className="mt-1 h-4 w-4 rounded border-[#2D8A6A]/30 text-[#0D5C48] focus:ring-[#C9A227]"
          />
          <span>
            <span className="block font-semibold">Do you want to avail need based scholarship?</span>
            <span className="mt-1 block text-[#245C4F]">
              Need base scholarship is for Zakat, Khairat and Atiyah.
            </span>
            {paymentAlreadySubmitted || scholarshipSubmitted ? (
              <span className="mt-2 block text-xs font-medium text-[#8A6B00]">
                {scholarshipLockMessage}
              </span>
            ) : null}
          </span>
        </label>

        {!useScholarship || paymentAlreadySubmitted || paymentLockedByScholarship ? (
          <div className="mt-6">
            {paymentLockedByScholarship ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {paymentLockMessage}
              </div>
            ) : paymentReady ? (
              <PaymentSubmissionForm voucher={voucher} />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Payment voucher is not available yet for this admission.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.10fr_0.80fr]">
            {renderFeeDetailsCard({ scholarshipMode: true })}

            <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.18)] sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                Need based scholarship
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
                Scholarship request form
              </h2>

              {scholarshipSubmitted ? (
                <div className="mt-6 rounded-2xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-4 py-3 text-sm text-[#0D5C48]">
                  Need based scholarship form is already submitted for this admission.
                </div>
              ) : (
                <form className="mt-6 grid gap-4" onSubmit={handleScholarshipSubmit}>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Dependents count</span>
                    <input
                      type="number"
                      min="0"
                      value={form.dependentsCount}
                      onChange={(event) => setForm((current) => ({ ...current, dependentsCount: event.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">School-going children count</span>
                    <input
                      type="number"
                      min="0"
                      value={form.schoolGoingChildrenCount}
                      onChange={(event) => setForm((current) => ({ ...current, schoolGoingChildrenCount: event.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Residence type</span>
                    <select
                      value={form.residenceType}
                      onChange={(event) => setForm((current) => ({ ...current, residenceType: event.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      required
                    >
                      <option value="">Select residence type</option>
                      {RESIDENCE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Requested amount</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.requestedAmount}
                      onChange={(event) => setForm((current) => ({ ...current, requestedAmount: event.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Reason for scholarship</span>
                    <textarea
                      rows={5}
                      value={form.reason}
                      onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {pending ? "Submitting..." : "Submit scholarship form"}
                  </button>
                </form>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
