"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";
import { normalizeClassLevel as normalizeAcademicClassLevel } from "@/lib/academicCatalog";

function normalizeClassLevel(value) {
  const incoming = String(value || "").trim();
  const normalized = incoming.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = {
    prenursery: "Pre-Nursery",
    prenurserry: "Pre-Nursery",
    prepi: "Pre-Nursery",
    prep1: "Pre-Nursery",
    prepnursery: "Pre-Nursery",
    nursery: "Nursery",
    kg1: "KG-1",
    kg2: "KG-2",
  };

  return normalizeAcademicClassLevel(aliases[normalized] || incoming) || aliases[normalized] || incoming;
}

function getDefaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export default function FeeVoucherForm({
  leads,
  initialLeadId = "",
  showTrigger = true,
  onCreated,
  onClose,
  scholarshipAmount = 0,
  scholarshipFormId = "",
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState("");
  const [successEmail, setSuccessEmail] = useState(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [options, setOptions] = useState({
    discounts: [],
    feeSettings: {},
    otherFees: [],
    regularFees: [],
    paymentMethods: [],
    coordinatorMaxDiscountPercent: 20,
  });
  const [form, setForm] = useState({
    registrationLeadId: "",
    regularFeeApplied: true,
    regularFeeId: "",
    otherFeeId: "",
    admissionFeeAmount: "",
    scholarshipAmount: "",
    scholarshipFormId: "",
    discountId: "",
    discountPercent: "",
    dueDate: "",
    paymentMethodId: "",
    paymentMethod: "",
    paymentInstructions: "",
  });

  useEffect(() => {
    if (!initialLeadId) return;
    setOpen(true);
    setForm((current) => ({ ...current, registrationLeadId: initialLeadId }));
  }, [initialLeadId]);

  const selectedLead = useMemo(() => {
    const selectedId = initialLeadId || form.registrationLeadId;
    return leads.find((lead) => lead.id === selectedId) || null;
  }, [initialLeadId, form.registrationLeadId, leads]);

  const selectedRegularFeeRecord = useMemo(() => {
    if (!selectedLead) return null;
    return (
      options.regularFees.find(
        (item) =>
          normalizeClassLevel(item.class_level) === normalizeClassLevel(selectedLead.class_level)
      ) || null
    );
  }, [options.regularFees, selectedLead]);

  const selectedAdmissionFee = useMemo(() => {
    if (!selectedLead) return null;
    const normalizedLeadClass = normalizeClassLevel(selectedLead.class_level);
    return (
      options.otherFees.find((item) => {
        const isAdmissionFee = String(item.fee_type || "").trim().toLowerCase() === "admission_fee";
        const normalizedItemClass = normalizeClassLevel(item.class_level);
        return isAdmissionFee && (!normalizedLeadClass || !normalizedItemClass || normalizedLeadClass === normalizedItemClass);
      }) || null
    );
  }, [options.otherFees, selectedLead]);

  const selectedDiscount = useMemo(
    () => options.discounts.find((item) => item.id === form.discountId) || null,
    [form.discountId, options.discounts]
  );

  const selectedPaymentMethod = useMemo(
    () => options.paymentMethods.find((item) => item.id === form.paymentMethodId) || null,
    [form.paymentMethodId, options.paymentMethods]
  );

  const selectedRegularFee = Number(selectedRegularFeeRecord?.amount || 0);
  const admissionFeeAmount = Number(selectedAdmissionFee?.amount || 0);
  const scholarshipAmountInput = Number(form.scholarshipAmount || 0);
  const discountPercent = Number(form.discountPercent || 0);
  const discountAmount = selectedRegularFee * (discountPercent / 100);
  const totalAmount = selectedRegularFee + admissionFeeAmount - discountAmount - scholarshipAmountInput;
  const eligibleLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          lead.can_create_voucher === true ||
          lead.canCreateVoucher === true ||
          lead.status === "new_lead" ||
          lead.status === "new"
      ),
    [leads]
  );

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setLoadingOptions(true);
      setError("");
      try {
        const response = await fetch("/api/coordinator/fee-vouchers/options", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Unable to load voucher options.");
        }

        if (active) {
          setOptions({
            discounts: data.discounts || [],
            feeSettings: data.feeSettings || {},
            otherFees: data.otherFees || [],
            regularFees: data.regularFees || [],
            paymentMethods: data.paymentMethods || [],
            coordinatorMaxDiscountPercent: data.coordinatorMaxDiscountPercent || 20,
          });
        }
      } catch (optionError) {
        if (active) {
          setError(optionError instanceof Error ? optionError.message : "Unable to load voucher options.");
        }
      } finally {
        if (active) setLoadingOptions(false);
      }
    }

    if (open) void loadOptions();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (form.paymentMethodId) return;
    const firstPaymentMethod = options.paymentMethods[0];
    if (!firstPaymentMethod?.id) return;

    setForm((current) => {
      if (current.paymentMethodId) return current;
      return {
        ...current,
        paymentMethodId: firstPaymentMethod.id,
        paymentMethod: firstPaymentMethod.name || firstPaymentMethod.method_key || "",
      };
    });
  }, [open, options.paymentMethods, form.paymentMethodId]);

  useEffect(() => {
    if (!open || !selectedLead) return;
    if (selectedAdmissionFee?.id && form.otherFeeId !== selectedAdmissionFee.id) {
      setForm((current) => ({
        ...current,
        otherFeeId: selectedAdmissionFee.id,
        admissionFeeAmount: String(selectedAdmissionFee.amount || ""),
      }));
    }
  }, [open, selectedAdmissionFee, selectedLead, form.otherFeeId]);

  useEffect(() => {
    if (!open) return;
    setForm((current) => ({
      ...current,
      scholarshipAmount: scholarshipAmount ? String(scholarshipAmount) : "",
      scholarshipFormId: scholarshipFormId || "",
    }));
  }, [open, scholarshipAmount, scholarshipFormId]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function closeSelectState(setter) {
    window.setTimeout(() => setter(false), 0);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const payload = {
        ...form,
        dueDate: form.dueDate || getDefaultDueDate(),
        regularFeeId: selectedRegularFeeRecord?.id || "",
        regularFeeAmount: selectedRegularFee,
        otherFeeId: selectedAdmissionFee?.id || form.otherFeeId || "",
        admissionFeeAmount: admissionFeeAmount,
        scholarshipAmount: scholarshipAmountInput,
        scholarshipFormId: form.scholarshipFormId || "",
      };

      const response = await fetch("/api/coordinator/fee-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to create voucher.");
      }

      setSuccessEmail(data?.email || null);
      await onCreated?.(data);
      setForm({
        registrationLeadId: "",
        regularFeeApplied: true,
        regularFeeId: "",
        otherFeeId: "",
        admissionFeeAmount: "",
        scholarshipAmount: "",
        scholarshipFormId: "",
        discountId: "",
        discountPercent: "",
        dueDate: "",
        paymentMethodId: "",
        paymentMethod: "",
        paymentInstructions: "",
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create voucher.");
    } finally {
      setPending(false);
    }
  }

  async function copyEmailBody() {
    if (!successEmail?.body_text) return;
    await navigator.clipboard.writeText(successEmail.body_text);
  }

  async function copyParentNumber() {
    const parentNumber = successEmail?.recipient_phone || selectedLead?.phone || selectedLead?.parent_phone || "";
    if (!parentNumber) return;
    await navigator.clipboard.writeText(parentNumber);
  }

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending || loadingOptions || !eligibleLeads.length}
          className="inline-flex items-center justify-center rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Create fee voucher
        </button>
      ) : null}

      {open ? (
        <ClientPortal targetId="coordinator-page-portal-root">
          <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pb-10 pt-10">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-4xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                    Payment Details
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onClose?.();
                  }}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Close
                </button>
              </div>

              <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                {!selectedLead ? (
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Registration lead</span>
                    <div className="relative">
                      <select
                        value={form.registrationLeadId}
                        onMouseDown={() => setLeadOpen((current) => !current)}
                        onFocus={() => setLeadOpen(true)}
                        onBlur={() => closeSelectState(setLeadOpen)}
                        onChange={(event) => updateField("registrationLeadId", event.target.value)}
                        className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      >
                        <option value="" disabled>
                          Select registration lead
                        </option>
                        {eligibleLeads.map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {lead.student_name} - {lead.class_level}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${
                          leadOpen ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </div>
                  </label>
                ) : null}

                <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Regular fee</p>
                    <p className="mt-3 text-sm text-[#245C4F]">PKR {selectedRegularFee.toFixed(2)}</p>
                  </div>

                  <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Admission fee</p>
                    <p className="mt-3 text-sm text-[#245C4F]">PKR {admissionFeeAmount.toFixed(2)}</p>
                  </div>
                </div>

                <label className="block rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-4 md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">Need-based scholarship amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.scholarshipAmount}
                    onChange={(event) => setForm((current) => ({ ...current, scholarshipAmount: event.target.value }))}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                    placeholder="Enter scholarship amount"
                  />
                </label>

                <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                  <label className="block rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[#245C4F]">Discount</span>
                      <span className="rounded-full bg-[#EAF6EF] px-3 py-1 text-xs font-semibold text-[#0D5C48]">
                        {selectedDiscount ? `${selectedDiscount.percent || 0}%` : "No discount"}
                      </span>
                    </div>
                    <div className="relative mt-3">
                      <select
                        value={form.discountId}
                        onMouseDown={() => setDiscountOpen((current) => !current)}
                        onFocus={() => setDiscountOpen(true)}
                        onBlur={() => closeSelectState(setDiscountOpen)}
                        onChange={(event) => {
                          const nextDiscount = options.discounts.find((item) => item.id === event.target.value);
                          updateField("discountId", event.target.value);
                          updateField("discountPercent", nextDiscount?.percent || "");
                        }}
                        className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      >
                        <option value="">No discount</option>
                        {options.discounts
                          .filter((discount) => Number(discount.percent || 0) <= options.coordinatorMaxDiscountPercent)
                          .map((discount) => (
                            <option key={discount.id} value={discount.id}>
                              {discount.label}
                            </option>
                          ))}
                      </select>
                      <ChevronDown
                        className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${
                          discountOpen ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </div>
                  </label>

                  <label className="block rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-4">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payment instructions</span>
                    <textarea
                      rows={6}
                      value={form.paymentInstructions}
                      onChange={(event) => updateField("paymentInstructions", event.target.value)}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      placeholder="Provide account title, account number, branch details, and reference notes."
                    />
                  </label>
                </div>

                <div className="md:col-span-2">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Payment methods</p>
                  <div className="grid gap-3">
                    {options.paymentMethods.map((method) => {
                      return (
                        <div
                          key={method.id}
                          className="rounded-2xl border border-[#0D5C48] bg-[#EAF6EF] px-4 py-4 text-left"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[#063F32]">{method.name}</p>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-[#245C4F]">
                            {method.bank_name ? <p><span className="font-medium text-[#063F32]">Bank:</span> {method.bank_name}</p> : null}
                            {method.account_title ? <p><span className="font-medium text-[#063F32]">Account title:</span> {method.account_title}</p> : null}
                            {method.account_number ? <p><span className="font-medium text-[#063F32]">Account number:</span> {method.account_number}</p> : null}
                            {method.iban ? <p><span className="font-medium text-[#063F32]">IBAN:</span> {method.iban}</p> : null}
                            {method.branch_code ? <p><span className="font-medium text-[#063F32]">Branch code:</span> {method.branch_code}</p> : null}
                            {method.instructions ? <p><span className="font-medium text-[#063F32]">Instructions:</span> {method.instructions}</p> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-4 text-sm text-[#245C4F] md:col-span-2 sm:grid-cols-3">
                  <p>
                    Regular Fee: <span className="font-semibold text-[#063F32]">PKR {selectedRegularFee.toFixed(2)}</span>
                  </p>
                  <p>
                    Admission Fee: <span className="font-semibold text-[#063F32]">PKR {admissionFeeAmount.toFixed(2)}</span>
                  </p>
                  <p>
                    Discount on Regular Fee: <span className="font-semibold text-[#063F32]">PKR {discountAmount.toFixed(2)}</span>
                  </p>
                  <p>
                    Scholarship Amount: <span className="font-semibold text-[#063F32]">PKR {scholarshipAmountInput.toFixed(2)}</span>
                  </p>
                  <p className="sm:col-span-3">
                    Total Payable: <span className="font-semibold text-[#063F32]">PKR {totalAmount.toFixed(2)}</span>
                  </p>
                </div>

                {error ? (
                  <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">{error}</p>
                ) : null}

                <div className="flex justify-end gap-3 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onClose?.();
                    }}
                    className="rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending || loadingOptions}
                    className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {pending ? "Sending..." : "Send Fee Voucher"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </ClientPortal>
      ) : null}

      {successEmail ? (
        <ClientPortal targetId="coordinator-page-portal-root">
          <div className="absolute inset-x-0 top-0 z-[10000] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pb-10 pt-10">
            <div className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                Voucher Created Successfully
              </p>
              <div className="mt-4 space-y-3 rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 text-sm text-[#245C4F]">
                <p><span className="font-semibold text-[#063F32]">Recipient:</span> {successEmail.recipient_email || "—"}</p>
                <p><span className="font-semibold text-[#063F32]">Subject:</span> {successEmail.subject || "—"}</p>
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3">
                  <p className="text-sm text-[#245C4F]">
                    <span className="font-semibold text-[#063F32]">Parent Number:</span>{" "}
                    {successEmail?.recipient_phone || selectedLead?.phone || selectedLead?.parent_phone || "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyParentNumber()}
                    className="rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]"
                  >
                    Copy Number
                  </button>
                </div>
                <div>
                  <p className="font-semibold text-[#063F32]">Email Body</p>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 text-xs text-[#245C4F]">
                    {successEmail.body_text || successEmail.body_html || ""}
                  </pre>
                </div>
                {successEmail.payment_submit_url ? (
                  <div className="rounded-2xl border border-[#E4C766]/40 bg-[#FFF5D6] p-4 text-sm text-[#063F32]">
                    <p className="font-semibold">Payment submit link</p>
                    <a
                      href={successEmail.payment_submit_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex break-all font-medium text-[#0D5C48] underline-offset-4 hover:underline"
                    >
                      {successEmail.payment_submit_url}
                    </a>
                  </div>
                ) : null}
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={copyEmailBody}
                  className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
                >
                  Copy Message
                </button>
                {successEmail.payment_submit_url ? (
                  <a
                    href={successEmail.payment_submit_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]"
                  >
                    Open Payment Page
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSuccessEmail(null);
                    setOpen(false);
                    onClose?.();
                  }}
                  className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ClientPortal>
      ) : null}
    </>
  );
}
