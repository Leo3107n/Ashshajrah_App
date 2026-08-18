"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import { LeafSpinnerInline, OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

const TABS = [
  { key: "regular", label: "Regular Fees" },
  { key: "other", label: "Other Fees" },
  { key: "payment", label: "Payment Methods" },
  { key: "global", label: "Global Settings" },
];

const EMPTY_FORM = {
  regular: { class_level: "", name: "", amount: "", status: "active" },
  other: {
    name: "",
    fee_type: "admission_fee",
    class_level: "",
    amount: "",
    description: "",
    status: "active",
  },
  payment: {
    name: "",
    method_key: "",
    account_title: "",
    account_number: "",
    iban: "",
    bank_name: "",
    branch_code: "",
    instructions: "",
    status: "active",
  },
  settings: {},
};

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function rowKey(item, index) {
  return item?.id || `${index}`;
}

function TabButton({ active, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
        active
          ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow-[0_14px_30px_-18px_rgba(201,162,39,0.55)]"
          : "border border-[#2D8A6A]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(250,247,240,0.98)_100%)] text-[#063F32] hover:border-[#C9A227]/35 hover:bg-[#FFF5D6]"
      }`}
    >
      {children}
    </button>
  );
}

const fieldClass =
  "w-full rounded-2xl border border-[#2D8A6A]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-3 text-[#063F32] outline-none transition placeholder:text-[#6A8B82] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]";

const selectClass =
  "w-full appearance-none rounded-2xl border border-[#2D8A6A]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-3 pr-11 text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]";

const panelClass =
  "rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl";

const tablePanelClass =
  "hidden overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl lg:block";

const tableHeadClass =
  "bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]";

const tableRowClass =
  "transition hover:bg-[rgba(255,245,214,0.24)]";

const actionButtonClass =
  "rounded-xl border border-[#2D8A6A]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(250,247,240,0.98)_100%)] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:border-[#C9A227]/35 hover:bg-[#FFF5D6]";

export default function AdminFeeSettingsPage() {
  const pathname = usePathname() || "";
  const isSuperAdminPortal = pathname.startsWith("/superadmin");
  const [activeTab, setActiveTab] = useState("regular");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [finance, setFinance] = useState({
    totalSettings: 0,
    voucherCreated: 0,
    vouchersSubmitted: 0,
    paymentsVerified: 0,
  });
  const [regularFees, setRegularFees] = useState([]);
  const [otherFees, setOtherFees] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [coordinatorMaxDiscountPercent, setCoordinatorMaxDiscountPercent] = useState(20);
  const [classLevels, setClassLevels] = useState([]);
  const [settings, setSettings] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [forms, setForms] = useState(EMPTY_FORM);
  const [otherDiscountId, setOtherDiscountId] = useState("");
  const [otherBaseAmount, setOtherBaseAmount] = useState("");
  const [deletingOtherFeeId, setDeletingOtherFeeId] = useState("");
  const [deleteOtherFeeTarget, setDeleteOtherFeeTarget] = useState(null);
  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState("");
  const [deletePaymentMethodTarget, setDeletePaymentMethodTarget] = useState(null);
  const [editing, setEditing] = useState({
    regular: "",
    other: "",
    payment: "",
    setting: "",
  });
  const [regularClassOpen, setRegularClassOpen] = useState(false);
  const [regularStatusOpen, setRegularStatusOpen] = useState(false);
  const [otherStatusOpen, setOtherStatusOpen] = useState(false);
  const [otherDiscountOpen, setOtherDiscountOpen] = useState(false);
  const [paymentStatusOpen, setPaymentStatusOpen] = useState(false);

  function closeSelectState(setter) {
    window.setTimeout(() => setter(false), 0);
  }

  const cards = useMemo(
    () => [
      {
        key: "voucherCreated",
        label: "Vouchers created",
        value: !loading ? finance.voucherCreated : 0,
        tone: "bg-[#EAF6EF] text-[#0D5C48]",
      },
      {
        key: "submitted",
        label: "Vouchers submitted",
        value: !loading ? finance.vouchersSubmitted : 0,
        tone: "bg-[#FFF5D6] text-[#8A6B00]",
      },
      {
        key: "verified",
        label: "Payments verified",
        value: !loading ? finance.paymentsVerified : 0,
        tone: "bg-[#EAF6EF] text-[#0D5C48]",
      },
    ],
    [finance, loading]
  );

  const selectedOtherDiscount = useMemo(
    () => discounts.find((item) => item.id === otherDiscountId) || null,
    [discounts, otherDiscountId]
  );
  const otherDiscountPercent = Number(selectedOtherDiscount?.percent || 0);
  const otherAmountBase = Number(otherBaseAmount || forms.other.amount || 0);
  const otherDiscountAmount = otherAmountBase * (otherDiscountPercent / 100);
  const otherFinalAmount = Math.max(otherAmountBase - otherDiscountAmount, 0);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [feeSettingsRes, regularRes, otherRes, paymentRes, classLevelsRes, publicOptionsRes] = await Promise.all([
        fetch("/api/admin/fee-settings", { cache: "no-store" }),
        fetch("/api/admin/regular-fees", { cache: "no-store" }),
        fetch("/api/admin/other-fees", { cache: "no-store" }),
        fetch("/api/admin/payment-methods", { cache: "no-store" }),
        fetch("/api/admin/class-levels", { cache: "no-store" }),
        fetch("/api/public/admission-form-options", { cache: "no-store" }),
      ]);

      const [feeSettingsData, regularData, otherData, paymentData, classLevelsData, publicOptionsData] = await Promise.all([
        feeSettingsRes.json(),
        regularRes.json(),
        otherRes.json(),
        paymentRes.json(),
        classLevelsRes.json(),
        publicOptionsRes.json(),
      ]);

      if (!feeSettingsRes.ok) throw new Error(feeSettingsData?.message || "Unable to load fee settings.");
      if (!regularRes.ok) throw new Error(regularData?.message || "Unable to load regular fees.");
      if (!otherRes.ok) throw new Error(otherData?.message || "Unable to load other fees.");
      if (!paymentRes.ok) throw new Error(paymentData?.message || "Unable to load payment methods.");

      setFinance(
        feeSettingsData.finance || {
          totalSettings: 0,
          voucherCreated: 0,
          vouchersSubmitted: 0,
          paymentsVerified: 0,
        }
      );
      const allowedSettingKeys = new Set([
        "coordinator_max_discount_percent",
        "payment_support_email",
        "payment_support_phone",
        "default_voucher_due_days",
      ]);
      const nextSettings = (feeSettingsData.settings || []).filter((item) =>
        allowedSettingKeys.has(item.key)
      );
      setSettings(nextSettings);
      setDrafts(
        nextSettings.reduce((accumulator, item) => {
          accumulator[item.id] = {
            value: item.value || "",
            description: item.description || "",
            status: item.status || "active",
          };
          return accumulator;
        }, {})
      );
      setRegularFees(regularData.items || []);
      setOtherFees(otherData.items || []);
      setPaymentMethods(paymentData.items || []);
      setDiscounts(Array.isArray(publicOptionsData?.discounts) ? publicOptionsData.discounts : []);
      setCoordinatorMaxDiscountPercent(Number(publicOptionsData?.coordinatorMaxDiscountPercent || 20));
      setClassLevels((classLevelsData.items || []).filter((item) => item.class_level));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load fee management data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function updateForm(section, name, value) {
    setForms((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [name]: value,
      },
    }));
  }

  function startEdit(section, item) {
    if (section === "regular") {
      setForms((current) => ({
        ...current,
        regular: {
          class_level: item.class_level || "",
          name: item.name || item.title || "",
          amount: item.amount ?? "",
          status: item.status || "active",
        },
      }));
    }

    if (section === "other") {
      setForms((current) => ({
        ...current,
        other: {
          name: item.name || item.title || "",
          fee_type: item.fee_type || "admission_fee",
          class_level: item.class_level || "",
          amount: item.amount ?? "",
          description: item.description || "",
          status: item.status || "active",
        },
      }));
      setOtherDiscountId("");
      setOtherBaseAmount(String(item.amount ?? ""));
    }

    if (section === "payment") {
      setForms((current) => ({
        ...current,
        payment: {
          name: item.name || "",
          method_key: item.method_key || "",
          account_title: item.account_title || "",
          account_number: item.account_number || "",
          iban: item.iban || "",
          bank_name: item.bank_name || "",
          branch_code: item.branch_code || "",
          instructions: item.instructions || "",
          status: item.status || "active",
        },
      }));
    }

    setEditing((current) => ({ ...current, [section]: item.id }));
    setActiveTab(section);
  }

  async function submitEntity(section) {
    setSaving(true);
    setError("");

    try {
      const endpointMap = {
        regular: "/api/admin/regular-fees",
        other: "/api/admin/other-fees",
        payment: "/api/admin/payment-methods",
      };
      const isEditing = Boolean(editing[section]);
      const payload = { ...forms[section] };

      if (section === "other") {
        delete payload.discount_id;
        delete payload.discount_percent;
        delete payload.discount_amount;
        delete payload.net_amount;
      }

      if (section === "regular") {
        payload.class_level = String(payload.class_level || "").trim();
        payload.name = String(payload.name || payload.title || "").trim();
        payload.amount = Number(payload.amount || 0);
        payload.status = String(payload.status || "active").trim().toLowerCase() || "active";
      }

      if (section === "other") {
        payload.name = String(payload.name || payload.title || "").trim();
        payload.fee_type = String(payload.fee_type || payload.feeType || "admission_fee").trim();
        payload.class_level = String(payload.class_level || payload.classLevel || "").trim();
        payload.amount = Number(payload.amount || 0);
        payload.description = String(payload.description || "").trim();
        payload.status = String(payload.status || "active").trim().toLowerCase() || "active";
      }

      if (section === "payment") {
        payload.name = String(payload.name || "").trim();
        payload.method_key = String(payload.method_key || "").trim();
        payload.account_title = String(payload.account_title || "").trim();
        payload.account_number = String(payload.account_number || "").trim();
        payload.iban = String(payload.iban || "").trim();
        payload.bank_name = String(payload.bank_name || "").trim();
        payload.branch_code = String(payload.branch_code || "").trim();
        payload.instructions = String(payload.instructions || "").trim();
        payload.status = String(payload.status || "active").trim().toLowerCase() || "active";
      }

      const response = await fetch(endpointMap[section], {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing[section] || undefined,
          ...payload,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to save record.");

      setForms((current) => ({ ...current, [section]: EMPTY_FORM[section] }));
      if (section === "other") {
        setOtherDiscountId("");
        setOtherBaseAmount("");
      }
      setEditing((current) => ({ ...current, [section]: "" }));
      await loadAll();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOtherFee(id) {
    if (!id) return;
    setDeleteOtherFeeTarget(otherFees.find((item) => item.id === id) || { id });
  }

  async function confirmDeleteOtherFee() {
    const id = deleteOtherFeeTarget?.id;
    if (!id) return;

    setDeleteOtherFeeTarget(null);
    setDeletingOtherFeeId(id);
    setError("");

    try {
      const response = await fetch(`/api/admin/other-fees?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to delete other fee.");
      await loadAll();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete other fee.");
    } finally {
      setDeletingOtherFeeId("");
    }
  }

  async function deletePaymentMethod(id) {
    if (!id) return;
    setDeletePaymentMethodTarget(paymentMethods.find((item) => item.id === id) || { id });
  }

  async function confirmDeletePaymentMethod() {
    const id = deletePaymentMethodTarget?.id;
    if (!id) return;

    setDeletePaymentMethodTarget(null);
    setDeletingPaymentMethodId(id);
    setError("");

    try {
      const response = await fetch(`/api/admin/payment-methods?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to delete payment method.");
      await loadAll();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete payment method.");
    } finally {
      setDeletingPaymentMethodId("");
    }
  }

  async function saveSetting(id) {
    try {
      const draft = drafts[id];
      const response = await fetch("/api/admin/fee-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          value: draft?.value || "",
          description: draft?.description || "",
          status: draft?.status || "active",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update setting.");
      setEditing((current) => ({ ...current, setting: "" }));
      await loadAll();
    } catch (settingError) {
      setError(settingError instanceof Error ? settingError.message : "Unable to update setting.");
    }
  }

  const sectionContent = {
    regular: (
      <div className="space-y-6">
        <div className={panelClass + " p-5"}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Regular fees</p>
              <h3 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
                Class fee setup
              </h3>
            </div>
          </div>

          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEntity("regular");
            }}
          >
          {classLevels.length ? (
            <div className="relative">
              <select
                className={selectClass}
                value={forms.regular.class_level}
                onMouseDown={() => setRegularClassOpen((current) => !current)}
                onFocus={() => setRegularClassOpen(true)}
                onBlur={() => closeSelectState(setRegularClassOpen)}
                onChange={(event) => updateForm("regular", "class_level", event.target.value)}
              >
                <option value="">Select class level</option>
                {classLevels.map((level) => (
                  <option key={level.id} value={level.class_level}>
                    {level.title ? `${level.title} - ${level.class_level}` : level.class_level}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${regularClassOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
          ) : (
            <p className="rounded-2xl border border-[#C9A227]/25 bg-[#FFF5D6] px-4 py-3 text-sm text-[#8A6B00] md:col-span-4">
              No active class levels found. Please add courses first.
            </p>
          )}
          <input className={fieldClass} placeholder="Fee name" value={forms.regular.name} onChange={(event) => updateForm("regular", "name", event.target.value)} />
          <input type="number" min="0" step="0.01" className={fieldClass} placeholder="Amount" value={forms.regular.amount} onChange={(event) => updateForm("regular", "amount", event.target.value)} />
          <div className="relative">
            <select className={selectClass} value={forms.regular.status} onMouseDown={() => setRegularStatusOpen((current) => !current)} onFocus={() => setRegularStatusOpen(true)} onBlur={() => closeSelectState(setRegularStatusOpen)} onChange={(event) => updateForm("regular", "status", event.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${regularStatusOpen ? "rotate-180" : "rotate-0"}`} />
          </div>
          <div className="flex gap-3 md:col-span-4">
            <button disabled={saving || !forms.regular.class_level} className="rounded-2xl bg-[linear-gradient(135deg,#0D5C48,#2D8A6A)] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_16px_32px_-20px_rgba(13,92,72,0.55)] transition hover:brightness-105 disabled:opacity-60">
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <LeafSpinnerInline />
                  {editing.regular ? "Saving..." : "Adding..."}
                </span>
              ) : (
                editing.regular ? "Save regular fee" : "Add regular fee"
              )}
            </button>
            {editing.regular ? (
              <button type="button" className="rounded-2xl border border-[#2D8A6A]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:border-[#C9A227]/35 hover:bg-[#FFF5D6]" onClick={() => { setEditing((current) => ({ ...current, regular: "" })); setForms((current) => ({ ...current, regular: EMPTY_FORM.regular })); }}>
                Cancel
              </button>
            ) : null}
          </div>
          </form>
        </div>

        <div className={tablePanelClass}>
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className={tableHeadClass}>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Name</th>
	                <th className="px-6 py-4">Amount</th>
	                <th className="px-6 py-4">Discount</th>
	                <th className="px-6 py-4">Final</th>
	                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {regularFees.map((item, index) => (
                <tr key={rowKey(item, index)} className={tableRowClass}>
                  <td className="px-4 py-3 text-sm">{item.class_level || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.name || item.title || "—"}</td>
	                  <td className="px-4 py-3 text-sm">PKR {money(item.amount)}</td>
	                  <td className="px-4 py-3 text-sm">{item.discount_percent ? `${Number(item.discount_percent)}%` : "—"}</td>
	                  <td className="px-4 py-3 text-sm">
	                    PKR {money(
	                      typeof item.net_amount !== "undefined" && item.net_amount !== null
	                        ? item.net_amount
	                        : Number(item.amount || 0) - Number(item.discount_amount || 0)
	                    )}
	                  </td>
	                  <td className="px-4 py-3 text-sm">{item.status || "active"}</td>
                  <td className="px-6 py-5 align-top text-sm text-[#245C4F]">
                    <button type="button" className={actionButtonClass} onClick={() => startEdit("regular", item)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    ),
    other: (
      <div className="space-y-6">
        <div className={panelClass + " p-5"}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Other fees</p>
              <h3 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
                Additional fee setup
              </h3>
            </div>
          </div>

          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEntity("other");
            }}
          >
            <input className={fieldClass} placeholder="Fee title" value={forms.other.name} onChange={(event) => updateForm("other", "name", event.target.value)} />
            <input className={fieldClass} placeholder="Fee type" value={forms.other.fee_type} onChange={(event) => updateForm("other", "fee_type", event.target.value)} />
            <input className={fieldClass} placeholder="Class level (optional)" value={forms.other.class_level} onChange={(event) => updateForm("other", "class_level", event.target.value)} />
            <input
              type="number"
              min="0"
              step="0.01"
              className={fieldClass}
              placeholder="Amount"
              value={forms.other.amount}
              onChange={(event) => {
                const nextAmount = event.target.value;
                setOtherBaseAmount(nextAmount);
                updateForm("other", "amount", nextAmount);
              }}
            />
            <div className="relative md:col-span-2">
              <select
                className={selectClass}
                value={otherDiscountId}
                onMouseDown={() => setOtherDiscountOpen((current) => !current)}
                onFocus={() => setOtherDiscountOpen(true)}
                onBlur={() => closeSelectState(setOtherDiscountOpen)}
                onChange={(event) => {
                  const selectedDiscount = discounts.find((item) => item.id === event.target.value);
                  setOtherDiscountId(event.target.value);
                  const baseAmount = Number(otherBaseAmount || forms.other.amount || 0);
                  const percent = Number(selectedDiscount?.percent || 0);
                  const nextAmount = Math.max(baseAmount - baseAmount * (percent / 100), 0);
                  updateForm("other", "amount", nextAmount ? nextAmount.toFixed(2) : "0.00");
                }}
              >
                <option value="">No discount selected</option>
                {discounts
                  .filter((discount) => Number(discount.percent || 0) <= coordinatorMaxDiscountPercent)
                  .map((discount) => (
                    <option key={discount.id} value={discount.id}>
                      {discount.label}
                    </option>
                  ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${otherDiscountOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
            <textarea rows={3} className={`${fieldClass} md:col-span-4`} placeholder="Description" value={forms.other.description} onChange={(event) => updateForm("other", "description", event.target.value)} />
            <div className="relative md:col-span-1">
              <select className={selectClass} value={forms.other.status} onMouseDown={() => setOtherStatusOpen((current) => !current)} onFocus={() => setOtherStatusOpen(true)} onBlur={() => closeSelectState(setOtherStatusOpen)} onChange={(event) => updateForm("other", "status", event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${otherStatusOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
            <div className="flex gap-3 md:col-span-3 md:justify-end">
              <button disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#0D5C48,#2D8A6A)] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_16px_32px_-20px_rgba(13,92,72,0.55)] transition hover:brightness-105 disabled:opacity-60">
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <LeafSpinnerInline />
                    {editing.other ? "Saving..." : "Adding..."}
                  </span>
                ) : (
                  editing.other ? "Save other fee" : "Add other fee"
                )}
              </button>
              {editing.other ? (
                <button type="button" className="rounded-2xl border border-[#2D8A6A]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:border-[#C9A227]/35 hover:bg-[#FFF5D6]" onClick={() => { setEditing((current) => ({ ...current, other: "" })); setForms((current) => ({ ...current, other: EMPTY_FORM.other })); setOtherDiscountId(""); setOtherBaseAmount(""); }}>
                  Cancel
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 rounded-[1.5rem] border border-[#2D8A6A]/12 bg-white/70 p-4 md:col-span-4 md:grid-cols-3">
              <div className="rounded-2xl bg-[#EAF6EF] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Discount</p>
                <p className="mt-2 text-2xl font-bold text-[#063F32]">{otherDiscountPercent ? `${otherDiscountPercent}%` : "No discount selected"}</p>
                <p className="mt-1 text-sm text-[#245C4F]">Allowed discounts are limited to coordinator-approved values up to {coordinatorMaxDiscountPercent}%.</p>
              </div>
              <div className="rounded-2xl bg-[#FFF5D6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A6B00]">Discount amount</p>
                <p className="mt-2 text-2xl font-bold text-[#8A6B00]">PKR {money(otherDiscountAmount)}</p>
                <p className="mt-1 text-sm text-[#6B5500]">Applied on the base other fee amount.</p>
              </div>
              <div className="rounded-2xl bg-[#F1EADC] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Final amount</p>
                <p className="mt-2 text-2xl font-bold text-[#063F32]">PKR {money(otherFinalAmount)}</p>
                <p className="mt-1 text-sm text-[#245C4F]">Base amount minus discount.</p>
              </div>
            </div>
          </form>
        </div>

        <div className={tablePanelClass}>
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className={tableHeadClass}>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {otherFees.map((item, index) => (
                <tr key={rowKey(item, index)} className={tableRowClass}>
                  <td className="px-4 py-3 text-sm">{item.name || item.title || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.fee_type || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.class_level || "—"}</td>
                  <td className="px-4 py-3 text-sm">PKR {money(item.amount)}</td>
                  <td className="px-4 py-3 text-sm">{item.status || "active"}</td>
                  <td className="px-6 py-5 align-top text-sm text-[#245C4F]">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className={actionButtonClass} onClick={() => startEdit("other", item)}>Edit</button>
                      <button
                        type="button"
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => deleteOtherFee(item.id)}
                        disabled={deletingOtherFeeId === item.id}
                      >
                        {deletingOtherFeeId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    ),
    payment: (
      <div className="space-y-6">
        <div className={panelClass + " p-5"}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Payment methods</p>
              <h3 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
                Payment channel setup
              </h3>
            </div>
          </div>

          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEntity("payment");
            }}
          >
            <input className={fieldClass} placeholder="Method name" value={forms.payment.name} onChange={(event) => updateForm("payment", "name", event.target.value)} />
            <input className={fieldClass} placeholder="Method key" value={forms.payment.method_key} onChange={(event) => updateForm("payment", "method_key", event.target.value)} />
            <input className={fieldClass} placeholder="Account title" value={forms.payment.account_title} onChange={(event) => updateForm("payment", "account_title", event.target.value)} />
            <input className={fieldClass} placeholder="Account number" value={forms.payment.account_number} onChange={(event) => updateForm("payment", "account_number", event.target.value)} />
            <input className={fieldClass} placeholder="IBAN" value={forms.payment.iban} onChange={(event) => updateForm("payment", "iban", event.target.value)} />
            <input className={fieldClass} placeholder="Bank name" value={forms.payment.bank_name} onChange={(event) => updateForm("payment", "bank_name", event.target.value)} />
            <input className={fieldClass} placeholder="Branch code" value={forms.payment.branch_code} onChange={(event) => updateForm("payment", "branch_code", event.target.value)} />
            <textarea rows={3} className={`${fieldClass} md:col-span-4`} placeholder="Instructions" value={forms.payment.instructions} onChange={(event) => updateForm("payment", "instructions", event.target.value)} />
            <div className="relative md:col-span-1">
              <select className={selectClass} value={forms.payment.status} onMouseDown={() => setPaymentStatusOpen((current) => !current)} onFocus={() => setPaymentStatusOpen(true)} onBlur={() => closeSelectState(setPaymentStatusOpen)} onChange={(event) => updateForm("payment", "status", event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${paymentStatusOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
            <div className="flex gap-3 md:col-span-3 md:justify-end">
              <button disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#0D5C48,#2D8A6A)] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_16px_32px_-20px_rgba(13,92,72,0.55)] transition hover:brightness-105 disabled:opacity-60">
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <LeafSpinnerInline />
                    {editing.payment ? "Saving..." : "Adding..."}
                  </span>
                ) : (
                  editing.payment ? "Save payment method" : "Add payment method"
                )}
              </button>
              {editing.payment ? (
                <button type="button" className="rounded-2xl border border-[#2D8A6A]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:border-[#C9A227]/35 hover:bg-[#FFF5D6]" onClick={() => { setEditing((current) => ({ ...current, payment: "" })); setForms((current) => ({ ...current, payment: EMPTY_FORM.payment })); }}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className={tablePanelClass}>
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className={tableHeadClass}>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Method key</th>
                <th className="px-6 py-4">Account</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {paymentMethods.map((item, index) => (
                <tr key={rowKey(item, index)} className={tableRowClass}>
                  <td className="px-4 py-3 text-sm">{item.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.method_key || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.account_number || item.account_title || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.status || "active"}</td>
                  <td className="px-6 py-5 align-top text-sm text-[#245C4F]">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className={actionButtonClass} onClick={() => startEdit("payment", item)}>Edit</button>
                      <button
                        type="button"
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => deletePaymentMethod(item.id)}
                        disabled={deletingPaymentMethodId === item.id}
                      >
                        {deletingPaymentMethodId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    ),
    global: (
      <div className="space-y-6">
        <div className={panelClass + " p-5"}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Global settings</p>
              <h3 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
                Voucher and support defaults
              </h3>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {settings.map((setting) => {
              const draft = drafts[setting.id] || {};
              const isEditing = editing.setting === setting.id;
              return (
                <article key={setting.id} className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_14px_40px_-28px_rgba(13,59,46,0.18)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#063F32]">{setting.name}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#245C4F]">{setting.key}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing((current) => ({ ...current, setting: isEditing ? "" : setting.id }))}
                      className={actionButtonClass}
                    >
                      {isEditing ? "Close" : "Edit"}
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                      {setting.key === "coordinator_max_discount_percent" ||
                      setting.key === "payment_support_email" ||
                      setting.key === "payment_support_phone" ||
                      setting.key === "default_voucher_due_days" ? (
                        <input
                          disabled={!isEditing}
                          value={draft.value || ""}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [setting.id]: { ...current[setting.id], value: event.target.value },
                            }))
                          }
                          className={fieldClass + " text-sm disabled:bg-[#F1EADC]"}
                        />
                      ) : (
                        <p className="rounded-2xl border border-[#C9A227]/25 bg-[#FFF5D6] px-4 py-3 text-sm text-[#8A6B00]">
                          Locked in fee management
                        </p>
                      )}
                    <textarea
                      rows={3}
                      disabled={!isEditing}
                      value={draft.description || ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [setting.id]: { ...current[setting.id], description: event.target.value },
                        }))
                      }
                      className={fieldClass + " text-sm disabled:bg-[#F1EADC]"}
                    />
                    <select
                      disabled={!isEditing}
                      value={draft.status || "active"}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [setting.id]: { ...current[setting.id], status: event.target.value },
                        }))
                      }
                      className={selectClass + " text-sm disabled:bg-[#F1EADC]"}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => void saveSetting(setting.id)}
                        className="rounded-2xl bg-[linear-gradient(135deg,#0D5C48,#2D8A6A)] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_16px_32px_-20px_rgba(13,92,72,0.55)] transition hover:brightness-105"
                      >
                        {saving ? (
                          <span className="inline-flex items-center gap-2">
                            <LeafSpinnerInline />
                            Saving...
                          </span>
                        ) : (
                          "Save setting"
                        )}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.14),transparent_28%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
              Fee management
            </p>
            <h1 className="mb-3 mt-4 text-3xl font-bold text-white-deep sm:text-4xl lg:text-4xl font-display">
              {isSuperAdminPortal
                ? "Super Admin fee management and payment setup"
                : "Admin fee management and payment setup"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
              Manage class fees, extra charges, payment methods, and global voucher settings from one place.
            </p>
          </div>
        </section>

        <AdminDashboardCards items={cards} />

        {error ? (
          <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50/95 p-5 text-sm text-rose-700 shadow-[0_18px_60px_-36px_rgba(185,28,28,0.12)] backdrop-blur-xl">
            {error}
          </section>
        ) : null}

        <section className={panelClass + " p-5"}>
          <div className="flex flex-wrap gap-3">
            {TABS.map((tab) => (
              <TabButton key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
                {tab.label}
              </TabButton>
            ))}
          </div>

          <div className="mt-6">
            {loading ? (
              <OpenBookLoader
                title="Loading fee management"
                subtitle="Fetching regular fees, payment methods, and settings..."
              />
            ) : (
              sectionContent[activeTab]
            )}
          </div>
        </section>

        {deleteOtherFeeTarget ? (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/45 px-4">
            <div className="w-full max-w-lg rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#C9A227]">Delete other fee</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#063F32]">Remove this fee row?</h2>
              <p className="mt-3 text-sm leading-7 text-[#245C4F]">
                This action will permanently delete{" "}
                <span className="font-semibold text-[#063F32]">
                  {deleteOtherFeeTarget.name || deleteOtherFeeTarget.title || "this other fee"}
                </span>
                . You can not undo this after deletion.
              </p>

              <div className="mt-6 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-4 text-sm text-[#245C4F]">
                <p>
                  <span className="font-semibold text-[#063F32]">Type:</span> {deleteOtherFeeTarget.fee_type || "—"}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[#063F32]">Class:</span> {deleteOtherFeeTarget.class_level || "—"}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[#063F32]">Amount:</span> PKR {money(deleteOtherFeeTarget.amount)}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteOtherFeeTarget(null)}
                  className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteOtherFee()}
                  disabled={deletingOtherFeeId === deleteOtherFeeTarget.id}
                  className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {deletingOtherFeeId === deleteOtherFeeTarget.id ? "Deleting..." : "Delete fee"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deletePaymentMethodTarget ? (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/45 px-4">
            <div className="w-full max-w-lg rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#C9A227]">Delete payment method</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#063F32]">Remove this payment method?</h2>
              <p className="mt-3 text-sm leading-7 text-[#245C4F]">
                This action will permanently delete{" "}
                <span className="font-semibold text-[#063F32]">
                  {deletePaymentMethodTarget.name || "this payment method"}
                </span>
                . You can not undo this after deletion.
              </p>

              <div className="mt-6 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-4 text-sm text-[#245C4F]">
                <p>
                  <span className="font-semibold text-[#063F32]">Method key:</span> {deletePaymentMethodTarget.method_key || "—"}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[#063F32]">Account:</span>{" "}
                  {deletePaymentMethodTarget.account_number || deletePaymentMethodTarget.account_title || "—"}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[#063F32]">Status:</span> {deletePaymentMethodTarget.status || "active"}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletePaymentMethodTarget(null)}
                  className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeletePaymentMethod()}
                  disabled={deletingPaymentMethodId === deletePaymentMethodTarget.id}
                  className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {deletingPaymentMethodId === deletePaymentMethodTarget.id ? "Deleting..." : "Delete method"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
