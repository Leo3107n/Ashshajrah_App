"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import ClientPortal from "@/components/shared/ClientPortal";
import PaginationControls from "@/components/teacher/PaginationControls";
import { BadgeCheck, ChevronDown, Circle, Send, FileCheck2, ClipboardList } from "lucide-react";

const PAGE_SIZE = 7;

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDateOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function statusLabel(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function admissionStatusLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized || normalized === "pending") return "New Registrations";
  if (normalized === "live_students") return "Access Granted";
  if (normalized === "parent_interview_sent") return "Parent Interview Sent";
  if (normalized === "parent_interview_submitted") return "Parent Interview Submitted";
  if (normalized === "sent") return "Admission Form Sent";
  if (normalized === "reminded") return "Reminder Sent";
  if (normalized === "overdue") return "Needs Follow-up";
  if (normalized === "not_submitted") return "Form Not Submitted";
  if (normalized === "submitted" || normalized === "registered") return "Form Submitted";
  if (normalized === "not_submitted") return "Not Submitted";
  return statusLabel(normalized);
}

function admissionStatusTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "live_students") return "bg-[#EAF6EF] text-[#0D5C48]";
  if (["submitted", "sent", "registered", "pending", "parent_interview_submitted"].includes(normalized)) return "bg-[#EAF6EF] text-[#0D5C48]";
  if (["parent_interview_sent"].includes(normalized)) return "bg-[#FFF5D6] text-[#8A6A00]";
  if (["reminded"].includes(normalized)) return "bg-[#FFF5D6] text-[#8A6A00]";
  if (["overdue", "not_submitted", "failed"].includes(normalized)) return "bg-rose-50 text-rose-700";
  return "bg-[#EAF6EF] text-[#0D5C48]";
}

function textOrDash(value) {
  const text = String(value || "").trim();
  return text || "-";
}

function normalizeStatusValue(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

function truncate(value, maxLength = 72) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function InfoCell({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-[#063F32]">{value || "-"}</dd>
    </div>
  );
}

export default function InterestedStudentsPanel({
  items = [],
  onRefresh,
  portalTargetId = "coordinator-page-portal-root",
  showDetailsButton = true,
  showActionsColumn = true,
  allowSendFormAction = true,
  showFlowColumn = false,
  showStatusColumn = true,
  allowParentFormSentColumn = false,
  allowDetailsAction = true,
  hideDeleteAction = false,
  readOnlyMode = false,
  showTableControls = true,
  initialColumnFilter = "all",
  rightFilterMode = "none",
  rightFilterValue = "all",
  rightFilterOptions = [],
  onRightFilterChange = () => {},
}) {
  const [localItems, setLocalItems] = useState(items);
  const [page, setPage] = useState(1);
  const [classFilter, setClassFilter] = useState("all");
  const [columnFilter, setColumnFilter] = useState(initialColumnFilter);
  const [searchTerm, setSearchTerm] = useState("");
  const [parentFormSentDrafts, setParentFormSentDrafts] = useState({});
  const [savingParentFormSentId, setSavingParentFormSentId] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedLeadViewMode, setSelectedLeadViewMode] = useState("details");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const toastTimerRef = useRef(null);
  const [loadingId, setLoadingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [hiddenRowIds, setHiddenRowIds] = useState([]);
  const [previewAdmissionFeeId, setPreviewAdmissionFeeId] = useState("");
  const [previewDiscountId, setPreviewDiscountId] = useState("");
  const [previewPaymentMethodId, setPreviewPaymentMethodId] = useState("");
  const [previewPaymentInstructions, setPreviewPaymentInstructions] = useState("");
  const [paymentOptions, setPaymentOptions] = useState({
    discounts: [],
    paymentMethods: [],
    regularFees: [],
    admissionFees: [],
    classLevels: [],
    coordinatorMaxDiscountPercent: 20,
  });

  useEffect(() => {
    setLocalItems(items.filter((item) => String(item.status || "").toLowerCase() !== "archived"));
    setPage(1);
  }, [items]);

  useEffect(() => {
    setColumnFilter(initialColumnFilter);
  }, [initialColumnFilter]);

  useEffect(() => {
    let active = true;

    async function loadPaymentOptions() {
      try {
        const response = await fetch("/api/public/admission-form-options", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !active) return;

        setPaymentOptions({
          discounts: Array.isArray(data.discounts) ? data.discounts : [],
          paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
          regularFees: Array.isArray(data.regularFees) ? data.regularFees : [],
          admissionFees: Array.isArray(data.admissionFees) ? data.admissionFees : [],
          classLevels: Array.isArray(data.classLevels) ? data.classLevels : [],
          coordinatorMaxDiscountPercent: Number(data.coordinatorMaxDiscountPercent || 20),
        });
      } catch {
        // Keep popup usable even when payment options are unavailable.
      }
    }

    void loadPaymentOptions();

    return () => {
      active = false;
    };
  }, []);

  const selectedClassLevel = String(selectedLead?.class_level || "").trim();
  const regularFee = useMemo(() => {
    const normalizedLeadClass = selectedClassLevel.toLowerCase();
    return (
      paymentOptions.regularFees.find((item) => String(item.class_level || "").trim().toLowerCase() === normalizedLeadClass) ||
      null
    );
  }, [paymentOptions.regularFees, selectedClassLevel]);

  const admissionFee = useMemo(() => {
    const normalizedLeadClass = selectedClassLevel.toLowerCase();
    return (
      paymentOptions.admissionFees.find((item) => {
        const itemClass = String(item.class_level || "").trim().toLowerCase();
        return String(item.fee_type || "").trim().toLowerCase() === "admission_fee" && (!normalizedLeadClass || !itemClass || itemClass === normalizedLeadClass);
      }) || null
    );
  }, [paymentOptions.admissionFees, selectedClassLevel]);

  const discount = useMemo(() => {
    const eligibleDiscounts = paymentOptions.discounts.filter(
      (item) => Number(item.percent || 0) <= Number(paymentOptions.coordinatorMaxDiscountPercent || 20)
    );
    return eligibleDiscounts.find((item) => item.id === previewDiscountId) || null;
  }, [paymentOptions.coordinatorMaxDiscountPercent, paymentOptions.discounts, previewDiscountId]);

  const selectedPreviewAdmissionFee =
    paymentOptions.admissionFees.find((item) => item.id === previewAdmissionFeeId) || null;
  const selectedPreviewPaymentMethod =
    paymentOptions.paymentMethods.find((item) => item.id === previewPaymentMethodId) || null;

  const regularFeeAmount = Number(regularFee?.amount || 0);
  const admissionFeeAmount = Number(selectedPreviewAdmissionFee?.amount || 0);
  const discountPercent = Number(discount?.percent || 0);
  const discountAmount = Math.round(regularFeeAmount * (discountPercent / 100));
  const totalAmount = Math.max(regularFeeAmount - discountAmount + admissionFeeAmount, 0);
  const totalPages = Math.max(1, Math.ceil(localItems.length / PAGE_SIZE));
  const classFilterOptions = useMemo(() => {
    const classes = paymentOptions.classLevels
      .map((item) => String(item.class_level || item.name || item.label || item.title || "").trim())
      .filter(Boolean);
    return [{ value: "all", label: "All classes" }, ...Array.from(new Set(classes)).map((value) => ({ value, label: value }))];
  }, [paymentOptions.classLevels]);

  const columnFilterOptions = [
    { value: "all", label: "All columns" },
    { value: "registration_code", label: "Registration No" },
    { value: "parent_name", label: "Parent / Guardian" },
    { value: "phone", label: "WhatsApp Number" },
    { value: "email", label: "Email Address" },
    { value: "student_name", label: "Child Name" },
    { value: "child_dob", label: "Date of Birth" },
    { value: "class_level", label: "Interested Level" },
    { value: "city", label: "City" },
    { value: "country", label: "Country" },
    { value: "message", label: "Message" },
    ...(allowParentFormSentColumn ? [{ value: "parent_form_sent_status", label: "Parent Form Sent" }] : []),
    { value: "parent_interview_link", label: "Parent Interview Link" },
    { value: "created_at", label: "Created At" },
    { value: "current_status", label: "Current Status" },
  ];

  const filteredItems = useMemo(() => {
    const normalizedSearch = String(searchTerm || "").trim().toLowerCase();
    return localItems.filter((item) => {
      if (String(item.status || "").toLowerCase() === "archived" || String(item.admission_form_status || "").toLowerCase() === "failed") return false;
      const itemClass = String(item.class_level || "").trim();
      const matchesClass = classFilter === "all" || itemClass.toLowerCase() === classFilter.toLowerCase();
      if (!matchesClass) return false;

      if (rightFilterMode !== "none") {
        const currentParentFormSentStatus = normalizeStatusValue(item.parent_form_sent_status || "no");
        const selectedParentFormSentStatus = normalizeStatusValue(rightFilterValue || "all");
        if (selectedParentFormSentStatus !== "all" && currentParentFormSentStatus !== selectedParentFormSentStatus) {
          return false;
        }
      }

      if (!normalizedSearch) return true;

      const stageValue = getCurrentStage(item);
      const columnValueMap = {
        registration_code: item.registration_code || item.registration_lead_id || item.registration_token,
        parent_name: item.parent_name,
        phone: item.phone,
        email: item.email,
        student_name: item.student_name || item.child_name,
        child_dob: formatDateOnly(item.child_dob) || item.student_age,
        class_level: item.class_level,
        city: item.city,
        country: item.country,
        message: item.message || item.notes,
        parent_form_sent_status: item.parent_form_sent_status,
        parent_interview_link: item.parent_interview_link,
        created_at: formatDate(item.created_at),
        current_status: admissionStatusLabel(stageValue),
      };

      const searchableValue =
        columnFilter === "all"
          ? Object.values(columnValueMap).join(" | ")
          : String(columnValueMap[columnFilter] || "");

      return searchableValue.toLowerCase().includes(normalizedSearch);
    });
  }, [allowParentFormSentColumn, classFilter, columnFilter, localItems, rightFilterMode, rightFilterValue, searchTerm]);

  useEffect(() => {
    setParentFormSentDrafts((current) => {
      const next = {};
      for (const item of localItems) {
        next[item.id] = normalizeStatusValue(item.parent_form_sent_status || "no");
      }
      return next;
    });
  }, [localItems]);

  const totalCount = localItems.length;
  const filteredCount = filteredItems.length;
  const currentPage = Math.min(Math.max(1, page), Math.max(1, Math.ceil(filteredCount / PAGE_SIZE)));
  const visibleItems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredItems]);

  const selectedLeadStage = selectedLead ? getLeadStage(selectedLead) : null;
  const selectedLeadCanSend = selectedLeadStage ? selectedLeadStage.interviewSubmitted && !selectedLeadStage.sent && !selectedLeadStage.submitted : false;

  function openLeadDetails(item) {
    setMessage("");
    setSelectedLeadViewMode("details");
    setSelectedLead(item);
  }

  function openLeadSendForm(item) {
    setMessage("");
    setSelectedLeadViewMode("send");
    setSelectedLead(item);
  }

  async function copyParentInterviewLink(link) {
    if (!link) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setToastMessage("Parent interview link copied.");
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToastMessage(""), 2500);
    } catch {
      setToastMessage("Unable to copy parent interview link.");
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToastMessage(""), 2500);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [classFilter, columnFilter, searchTerm]);

  useEffect(() => {
    if (!selectedLead) return;
    setPreviewAdmissionFeeId("");
    setPreviewDiscountId("");
    setPreviewPaymentMethodId("");
    setPreviewPaymentInstructions("");
  }, [selectedLead]);

  function getLeadStage(item) {
    const archived = String(item?.status || "").toLowerCase() === "archived" || String(item?.admission_form_status || "").toLowerCase() === "failed";
    if (archived) {
      return {
        status: "archived",
        interviewStatus: "",
        registered: false,
        interviewSent: false,
        interviewSubmitted: false,
        sent: false,
        submitted: false,
        reminded: false,
        overdue: false,
      };
    }
    const status = String(item.admission_form_status || item.status || "pending").toLowerCase();
    const interviewStatus = String(item.parent_interview_status || "").toLowerCase();
    const registrationStatus = String(item.registration_status || item.status || "")
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_");
    const registered = Boolean(item.registration_code || item.registration_token || item.registration_lead_id || item.id);
    const sent = Boolean(item.admission_form_sent_at) || ["sent", "reminded", "submitted", "overdue", "not_submitted"].includes(status);
    const submittedBase = Boolean(item.admission_form_submitted_at) || status === "submitted" || status === "registered";
    const liveStudent = registrationStatus === "access_granted" && submittedBase;
    const submitted = submittedBase && !liveStudent;
    const reminded = Boolean(item.admission_form_last_reminder_at) || Number(item.admission_form_reminder_count || 0) > 0 || status === "reminded";
    const interviewSent = Boolean(item.parent_interview_form_id) || ["pending", "sent", "submitted", "reviewed"].includes(interviewStatus);
    const interviewSubmitted = Boolean(item.parent_interview_submitted_at) || ["submitted", "reviewed"].includes(interviewStatus);
    return {
      status,
      interviewStatus,
      registrationStatus,
      registered,
      interviewSent,
      interviewSubmitted,
      sent,
      submitted,
      liveStudent,
      reminded,
      overdue: status === "overdue" || (reminded && !submitted),
    };
  }

  function getCurrentStage(item) {
    const stage = getLeadStage(item);
    if (!stage.registered) return "pending";
    if (stage.liveStudent) return "live_students";
    if (stage.interviewSent && !stage.interviewSubmitted) return "parent_interview_sent";
    if (stage.interviewSubmitted && !stage.sent) return "parent_interview_submitted";
    if (stage.sent && stage.submitted) return "submitted";
    if (stage.sent && stage.reminded && !stage.submitted) return "follow_up";
    if (stage.sent) return "sent";
    if (stage.submitted) return "submitted";
    return "pending";
  }

  function FlowStep({ active, done, icon: Icon, label }) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-xl px-1 py-1 text-sm font-medium ${
          done
            ? "bg-transparent text-[#0D5C48]"
            : active
              ? "bg-transparent text-[#8A6B00]"
              : "bg-transparent text-[#7A938B]"
        }`}
      >
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
            done
              ? "bg-[#0D5C48]"
              : active
                ? "bg-[#C9A227]"
                : "bg-[#D6DDD8]"
          }`}
        >
          {done ? (
            <BadgeCheck className="h-3.5 w-3.5 text-[#FAF7F0]" strokeWidth={2.3} />
          ) : (
            active ? (
              <BadgeCheck className="block h-3 w-3 text-[#8A6B00]" strokeWidth={2.3} />
            ) : (
              <Circle className="block h-2.5 w-2.5 text-[#D6DDD8]" strokeWidth={2.5} />
            )
          )}
        </span>
        <span className="min-w-0 whitespace-nowrap leading-5">{label}</span>
      </div>
    );
  }

  async function sendAdmissionForm(item) {
    if (!item?.id) return;

    setLoadingId(item.id);
    setMessage("");

    try {
      const payload = {
        admissionFeeId: previewAdmissionFeeId,
        admissionFeeAmount: selectedPreviewAdmissionFee?.amount || "",
        discountPercent: discount?.percent || "",
        discountId: previewDiscountId,
        paymentMethodId: previewPaymentMethodId,
        paymentMethodName: selectedPreviewPaymentMethod?.name || "",
        paymentInstructions: previewPaymentInstructions,
      };
      const response = await fetch(
        `/api/coordinator/interested-students/${encodeURIComponent(item.id)}/registration-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to generate registration message.");
      }

      setMessage(
        data.already_generated
          ? "Existing admission form link loaded and sent."
          : "Admission form link sent."
      );
      setLocalItems((current) =>
        current.map((lead) =>
          lead.id === item.id
            ? {
                ...lead,
                admission_form_status: "sent",
                admission_form_sent_at: lead.admission_form_sent_at || new Date().toISOString(),
                admission_form_due_at: lead.admission_form_due_at || data.admission_form_due_at || null,
                admission_form_last_channel: "email_whatsapp",
                admission_form_last_error: null,
              }
            : lead
        )
      );
      setSelectedLead((current) =>
        current?.id === item.id
          ? {
              ...current,
              admission_form_status: "sent",
              admission_form_sent_at: current.admission_form_sent_at || new Date().toISOString(),
              admission_form_due_at: current.admission_form_due_at || data.admission_form_due_at || null,
              admission_form_last_channel: "email_whatsapp",
              admission_form_last_error: null,
            }
          : current
      );
      if (data?.whatsapp_url) {
        window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
      }
      await onRefresh?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate registration message.");
    } finally {
      setLoadingId("");
    }
  }

  async function deleteInterestedStudent(item) {
    if (!item?.id) return;

    setDeletingId(item.id);
    setMessage("");

    try {
      const response = await fetch(`/api/coordinator/interested-students/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to delete interested student.");
      }

      setLocalItems((current) => current.filter((lead) => lead.id !== item.id));
      setHiddenRowIds((current) => [...new Set([...current, item.id])]);
      setSelectedLead((current) => (current?.id === item.id ? null : current));
      setSelectedMessage((current) => (current?.id === item.id ? null : current));
      setDeleteTarget(null);
      setMessage("Interested student archived.");
      await onRefresh?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete interested student.");
    } finally {
      setDeletingId("");
    }
  }

  async function saveParentFormSentStatus(item) {
    if (!item?.id) return;

    const parentFormSentStatus = normalizeStatusValue(parentFormSentDrafts[item.id] || item.parent_form_sent_status || "no");
    setSavingParentFormSentId(item.id);
    setMessage("");

    try {
      const response = await fetch(`/api/coordinator/interested-students/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentFormSentStatus }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to update parent form sent status.");
      }

      setLocalItems((current) =>
        current.map((lead) =>
          lead.id === item.id
            ? { ...lead, parent_form_sent_status: parentFormSentStatus }
            : lead
        )
      );
      setMessage("Parent form sent status updated.");
      await onRefresh?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update parent form sent status.");
    } finally {
      setSavingParentFormSentId("");
    }
  }

  return (
    <>
      {toastMessage ? (
        <div className="fixed right-4 top-4 z-[12000] rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_20px_60px_-36px_rgba(13,59,46,0.4)]">
          {toastMessage}
        </div>
      ) : null}
      {(() => {
        const showActionHeader = visibleItems.some((item) => {
          if (readOnlyMode) return false;
          const stage = getLeadStage(item);
          return (
            (allowDetailsAction && showDetailsButton && !stage.sent && !stage.submitted) ||
            (allowSendFormAction && stage.interviewSubmitted && !stage.sent && !stage.submitted) ||
            (showActionsColumn && !stage.interviewSubmitted && !stage.sent && !stage.submitted)
          );
        });
        const showParentFormSentColumn = visibleItems.some((item) => {
          if (readOnlyMode) return false;
          const stage = getLeadStage(item);
          if (!allowParentFormSentColumn) return false;
          return (
            (stage.registered && !stage.interviewSent) ||
            (stage.interviewSent && !stage.interviewSubmitted && !stage.sent && !stage.submitted)
          );
        });

      return (
      <section className="hidden overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl min-[992px]:block">
        {message ? (
          <div className="border-b border-[#2D8A6A]/10 px-6 py-4 text-sm font-medium text-[#0D5C48]">{message}</div>
        ) : null}
        {showTableControls ? (
          <div className="border-b border-[#2D8A6A]/10 px-6 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap gap-3 xl:flex-nowrap">
                <div className="relative min-w-[15rem] shrink-0">
                  <select
                    value={classFilter}
                    onChange={(event) => setClassFilter(event.target.value)}
                    className="h-12 w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 pr-11 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                  >
                    {classFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" strokeWidth={2.5} />
                </div>
                <div className="relative min-w-[15rem] shrink-0">
                  <select
                    value={columnFilter}
                    onChange={(event) => setColumnFilter(event.target.value)}
                    className="h-12 w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 pr-11 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                  >
                    {columnFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" strokeWidth={2.5} />
                </div>
                {rightFilterMode !== "none" && allowParentFormSentColumn && columnFilter === "parent_form_sent_status" ? (
                  <div className="relative min-w-[12rem] shrink-0">
                    <select
                      value={rightFilterValue}
                      onChange={(event) => onRightFilterChange(event.target.value)}
                      className="h-12 w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 pr-11 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                    >
                      <option value="all">{rightFilterMode === "follow_up" ? "All follow-ups" : "All statuses"}</option>
                      {rightFilterOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" strokeWidth={2.5} />
                  </div>
                ) : null}
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  type="search"
                  placeholder="Search in selected column"
                  className="h-12 min-w-0 flex-[1_1_14rem] rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                />
              </div>
              <div className="text-sm font-semibold text-[#0D5C48]">
                Showing {filteredCount} of {totalCount}
              </div>
            </div>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          {visibleItems.length ? (
            <table className="inline-table w-max divide-y divide-[#F1EADC]">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Registration No</th>
                {showStatusColumn ? <th className="px-6 py-4">Current Status</th> : null}
                {showFlowColumn ? <th className="px-6 py-4">Flow</th> : null}
                <th className="px-6 py-4">Parent / Guardian</th>
                <th className="px-6 py-4">WhatsApp Number</th>
                <th className="px-6 py-4">Email Address</th>
                <th className="px-6 py-4">Child Name</th>
                <th className="px-6 py-4">Date of Birth</th>
                <th className="px-6 py-4">Interested Level</th>
                <th className="px-6 py-4">City</th>
                <th className="px-6 py-4">Country</th>
                <th className="px-6 py-4">Message</th>
                <th className="px-6 py-4">Created At</th>
                {showParentFormSentColumn ? <th className="px-6 py-4">Parent Interview Link</th> : null}
                {showActionHeader ? <th className="px-6 py-4 text-right">Action</th> : null}
                {showParentFormSentColumn ? <th className="px-6 py-4">Parent Form Sent</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {visibleItems.filter((item) => !hiddenRowIds.includes(item.id)).map((item, index) => {
                const stage = getLeadStage(item);
                if (stage.status === "archived") return null;
                const showRowAction =
                  !readOnlyMode &&
                  (
                    (allowDetailsAction && showDetailsButton && !stage.sent && !stage.submitted) ||
                    (allowSendFormAction && stage.interviewSubmitted && !stage.sent && !stage.submitted) ||
                    (showActionsColumn && !stage.interviewSubmitted && !stage.sent && !stage.submitted)
                  );
                const canDeleteRow = !hideDeleteAction && !readOnlyMode && !stage.interviewSubmitted && !stage.sent && !stage.submitted;

                return (
                  <tr key={item.id} className="align-top">
                  <td className="px-5 py-5 text-sm font-semibold text-[#0D5C48]">
                    {String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                  </td>
                  <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.registration_code || item.registration_lead_id || item.registration_token)}</td>
                  {showStatusColumn ? (
                    <td className="px-5 py-5">
                      <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${admissionStatusTone(getCurrentStage(item))}`}>
                        {admissionStatusLabel(getCurrentStage(item))}
                      </span>
                    </td>
                  ) : null}
                  {showFlowColumn ? (
                    <td className="px-5 py-5">
                        {(() => {
                          const stage = getLeadStage(item);
                          return (
                            <div className="space-y-2 text-sm text-[#245C4F]">
                              <FlowStep active={!stage.registered} done={stage.registered} label="New Registration" />
                              <FlowStep active={stage.registered && !stage.interviewSent} done={stage.interviewSent} label="Parent Interview Sent" />
                              <FlowStep active={stage.interviewSent && !stage.interviewSubmitted} done={stage.interviewSubmitted} label="Parent Interview Submitted" />
                              <FlowStep active={stage.interviewSubmitted && !stage.sent} done={stage.sent} label="Admission Form Sent" />
                              <FlowStep active={stage.sent && !stage.submitted && !stage.reminded} done={stage.reminded} label="Admission Form Not Submitted" />
                              <FlowStep active={stage.sent && stage.reminded && !stage.submitted} done={stage.overdue} label="Needs Follow-up" />
                              <FlowStep active={stage.submitted} done={stage.submitted} label="Admission Form Submitted" />
                            </div>
                          );
                        })()}
                      </td>
                    ) : null}
                    <td className="px-5 py-5 text-[#063F32]">{textOrDash(item.parent_name)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.phone)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.email)}</td>
                    <td className="px-5 py-5 font-semibold text-[#063F32]">{textOrDash(item.student_name)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{formatDateOnly(item.child_dob) || textOrDash(item.student_age)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.class_level)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.city)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.country)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => setSelectedMessage((current) => (current?.id === item.id ? null : item))}
                    className="inline-flex w-max whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-left text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7] hover:text-[#063F32]"
                        >
                          Message View
                        </button>
                        {selectedMessage?.id === item.id ? (
                          <div
                            className={`absolute z-[10000] w-[min(32rem,calc(100vw-3rem))] rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 shadow-[0_16px_50px_-36px_rgba(13,59,46,0.18)] ${
                              stage.interviewSubmitted && !stage.sent && !stage.submitted
                                ? "right-32 top-full mt-3"
                                : "left-1/2 -translate-x-1/2 " +
                                  (index === 0 ? "top-full mt-3" : "bottom-full mb-3")
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9A227]">
                                  Full message
                                </p>
                                <p className="mt-2 text-sm font-semibold text-[#063F32]">
                                  {textOrDash(item.student_name)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedMessage(null)}
                                className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                              >
                                Close
                              </button>
                            </div>
                            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#245C4F]">
                              {textOrDash(item.message || item.notes)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-5 pr-4 text-sm text-[#245C4F]">{formatDate(item.created_at)}</td>
                    {showParentFormSentColumn ? (
                      <td className="px-5 py-5 text-[#245C4F]">
                        {(() => {
                          const canShowInterviewLink =
                            (stage.registered && !stage.interviewSent) ||
                            (stage.interviewSent && !stage.interviewSubmitted && !stage.sent && !stage.submitted);
                          if (!canShowInterviewLink) return null;
                          return item.parent_interview_link ? (
                            <button
                              type="button"
                              onClick={() => copyParentInterviewLink(item.parent_interview_link)}
                              className="inline-flex w-max whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7] hover:text-[#063F32]"
                            >
                              Copy Link
                            </button>
                          ) : (
                            <span className="text-sm text-[#7A938B]">-</span>
                          );
                        })()}
                      </td>
                    ) : null}
                    {showRowAction ? (
                      <td className="px-5 py-5 pl-4 pr-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                          {readOnlyMode ? null : allowDetailsAction && showDetailsButton && !stage.sent && !stage.submitted ? (
                            <button
                              type="button"
                              onClick={() => {
                                openLeadDetails(item);
                              }}
                              className="inline-flex w-max whitespace-nowrap rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                              disabled={loadingId === item.id}
                              >
                                View Details
                              </button>
                          ) : null}
                          {readOnlyMode ? null : allowSendFormAction && stage.interviewSubmitted && !stage.sent && !stage.submitted ? (
                            <button
                              type="button"
                              onClick={() => {
                                openLeadSendForm(item);
                              }}
                              className="inline-flex w-max whitespace-nowrap rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                              disabled={loadingId === item.id}
                            >
                              Send Form
                            </button>
                          ) : null}
                          {hideDeleteAction || readOnlyMode ? null : canDeleteRow ? (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                              disabled={loadingId === item.id || deletingId === item.id}
                            >
                              {deletingId === item.id ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                    {showParentFormSentColumn ? (
                    <td className="px-5 py-5">
                      {(() => {
                        const currentStatus = String(item.parent_form_sent_status || "no").toLowerCase();
                        const canEditParentForm = !stage.sent && !stage.submitted;
                        const shouldShowParentFormColumn =
                          (stage.registered && !stage.interviewSent) ||
                          (stage.interviewSent && !stage.interviewSubmitted && !stage.sent && !stage.submitted);

                        if (!shouldShowParentFormColumn) return null;

                        return (
                          <div className="flex min-w-[16rem] flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0D5C48]">
                              {currentStatus}
                            </span>
                            <select
                              value={parentFormSentDrafts[item.id] || currentStatus}
                              onChange={(event) =>
                                setParentFormSentDrafts((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              disabled={!canEditParentForm || savingParentFormSentId === item.id}
                              className="h-11 min-w-[10.5rem] rounded-2xl border border-[#2D8A6A]/20 bg-white px-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {["no", "checking issue", "resolved", "yes"].map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => saveParentFormSentStatus(item)}
                              disabled={!canEditParentForm || savingParentFormSentId === item.id}
                              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingParentFormSentId === item.id ? "Saving..." : "Save"}
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
            </table>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-[#245C4F]">
              No interested students found.
            </div>
          )}
        </div>
        {items.length > PAGE_SIZE ? (
          <div className="border-t border-[#2D8A6A]/10 bg-[#FAF7F0]/50 px-4 py-4">
            <PaginationControls
              page={currentPage}
              pageSize={PAGE_SIZE}
              totalItems={items.length}
              onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
            />
          </div>
        ) : null}
      </section>
        );
      })()}

      <div className="mb-4 grid gap-3 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl min-[992px]:hidden">
        <div className="relative">
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            className="h-12 w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 pr-11 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
          >
            {classFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" strokeWidth={2.5} />
        </div>
        <div className="relative">
          <select
            value={columnFilter}
            onChange={(event) => setColumnFilter(event.target.value)}
            className="h-12 w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 pr-11 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
          >
            {columnFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" strokeWidth={2.5} />
        </div>
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          type="search"
          placeholder="Search in selected column"
          className="h-12 w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
        />
        <div className="text-sm font-semibold text-[#0D5C48]">
          Showing {filteredCount} of {totalCount}
        </div>
      </div>

      <div className="grid gap-4 min-[992px]:hidden">
        {visibleItems.filter((item) => !hiddenRowIds.includes(item.id)).map((item) => {
          const stage = getLeadStage(item);
          if (stage.status === "archived") return null;
                return (
          <article
            key={item.id}
            className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl"
          >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[#063F32]">{textOrDash(item.student_name)}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">{textOrDash(item.class_level)}</p>
                </div>
              <span className={`inline-flex rounded-full px-4 py-1 text-xs font-semibold ${admissionStatusTone(getCurrentStage(item))}`}>
                {admissionStatusLabel(getCurrentStage(item))}
              </span>
            </div>

            {showFlowColumn ? (
              <div className="mt-4 rounded-[1.25rem] border border-[#2D8A6A]/10 bg-white p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Flow</p>
                <div className="mt-3 space-y-2 text-sm text-[#245C4F]">
                  <FlowStep active={!stage.registered} done={stage.registered} label="New Registration" />
                  <FlowStep active={stage.registered && !stage.interviewSent} done={stage.interviewSent} label="Parent Interview Sent" />
                  <FlowStep active={stage.interviewSent && !stage.interviewSubmitted} done={stage.interviewSubmitted} label="Parent Interview Submitted" />
                  <FlowStep active={stage.interviewSubmitted && !stage.sent} done={stage.sent} label="Admission Form Sent" />
                  <FlowStep active={stage.sent && !stage.submitted && !stage.reminded} done={stage.reminded} label="Admission Form Not Submitted" />
                  <FlowStep active={stage.sent && stage.reminded && !stage.submitted} done={stage.overdue} label="Needs Follow-up" />
                  <FlowStep active={stage.submitted} done={stage.submitted} label="Admission Form Submitted" />
                </div>
              </div>
            ) : null}

            <dl className="mt-4 grid gap-3 text-sm text-[#245C4F] sm:grid-cols-2">
              <InfoCell label="Parent / Guardian" value={item.parent_name} />
              <InfoCell label="WhatsApp Number" value={item.phone} />
              <InfoCell label="Email Address" value={item.email} />
              <InfoCell
                label="Parent Form Sent"
                value={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0D5C48]">
                      {normalizeStatusValue(item.parent_form_sent_status || "no")}
                    </span>
                    {((stage.registered && !stage.interviewSent) ||
                      (stage.interviewSent && !stage.interviewSubmitted && !stage.sent && !stage.submitted)) ? (
                      <>
                        <select
                          value={parentFormSentDrafts[item.id] || normalizeStatusValue(item.parent_form_sent_status || "no")}
                          onChange={(event) =>
                            setParentFormSentDrafts((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          disabled={savingParentFormSentId === item.id}
                          className="h-11 min-w-[10.5rem] rounded-2xl border border-[#2D8A6A]/20 bg-white px-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {["no", "checking_issue", "resolved", "yes"].map((option) => (
                            <option key={option} value={option}>
                              {option.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => saveParentFormSentStatus(item)}
                          disabled={savingParentFormSentId === item.id}
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingParentFormSentId === item.id ? "Saving..." : "Save"}
                        </button>
                      </>
                    ) : null}
                  </div>
                }
              />
              <InfoCell label="Child Name" value={item.student_name} />
              <InfoCell label="Date of Birth" value={formatDateOnly(item.child_dob) || item.student_age} />
              <InfoCell label="Interested Level" value={item.class_level} />
              <InfoCell label="City" value={item.city} />
              <InfoCell label="Country" value={item.country} />
              <InfoCell
                label="Message"
                value={
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(item)}
                    className="inline-flex w-max whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-left text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7] hover:text-[#063F32]"
                  >
                    Message View
                  </button>
                }
              />
            </dl>

                {readOnlyMode ? null : allowDetailsAction || showActionsColumn ? (
                  <div className="mt-4 inline-flex items-center gap-2 whitespace-nowrap">
                {readOnlyMode ? null : allowDetailsAction && showDetailsButton && !stage.sent && !stage.submitted ? (
                  <button
                    type="button"
                    onClick={() => {
                      openLeadDetails(item);
                    }}
                    className="inline-flex w-max whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-4 py-2 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7] hover:text-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={loadingId === item.id}
                  >
                    View Details
                  </button>
                ) : null}
                {readOnlyMode ? null : allowSendFormAction && stage.interviewSubmitted && !stage.sent && !stage.submitted ? (
                  <button
                    type="button"
                    onClick={() => {
                      openLeadSendForm(item);
                    }}
                    className="inline-flex w-max whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-4 py-2 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7] hover:text-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={loadingId === item.id}
                  >
                    Send Form
                  </button>
                ) : null}
                {hideDeleteAction || readOnlyMode ? null : showActionsColumn && !stage.interviewSubmitted && !stage.sent && !stage.submitted ? (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={loadingId === item.id || deletingId === item.id}
                  >
                    {deletingId === item.id ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        );
        })}
        {items.length > PAGE_SIZE ? (
          <div className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <PaginationControls
              page={currentPage}
              pageSize={PAGE_SIZE}
              totalItems={items.length}
              onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
            />
          </div>
        ) : null}
      </div>

      {selectedLead && showDetailsButton ? (
        <ClientPortal targetId={portalTargetId}>
          <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pb-10 pt-10">
            <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                    Interested student details
                  </p>
                  <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#063F32]">
                    {textOrDash(selectedLead.student_name)}
                  </h2>
                  <p className="mt-2 text-sm text-[#245C4F]">
                    Send the admission form link and keep the registration record in one place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                {selectedLeadViewMode === "details" ? (
                  <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.10)]">
                    <h3 className="text-lg font-semibold text-[#063F32]">Interested student details</h3>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <InfoCell label="Registration No" value={selectedLead.registration_code || selectedLead.registration_lead_id || selectedLead.registration_token} />
                      <InfoCell label="Parent / Guardian" value={selectedLead.parent_name} />
                      <InfoCell label="WhatsApp Number" value={selectedLead.phone} />
                      <InfoCell label="Email Address" value={selectedLead.email} />
                      <InfoCell label="Child Name" value={selectedLead.student_name} />
                      <InfoCell label="Date of Birth" value={formatDateOnly(selectedLead.child_dob) || selectedLead.student_age} />
                      <InfoCell label="Interested Level" value={selectedLead.class_level} />
                      <InfoCell label="City" value={selectedLead.city} />
                      <InfoCell label="Country" value={selectedLead.country} />
                      <InfoCell label="Current Status" value={admissionStatusLabel(getCurrentStage(selectedLead))} />
                    </dl>
                    <div className="mt-4 rounded-[1rem] border border-[#2D8A6A]/10 bg-[#FAF7F0] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Message</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-[#245C4F]">
                        {textOrDash(selectedLead.message || selectedLead.notes)}
                      </p>
                    </div>
                  </section>
                ) : null}

                {selectedLeadViewMode === "send" && selectedLeadCanSend ? (
                  <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
                    <h3 className="text-lg font-semibold text-[#063F32]">Payment details</h3>
                    <p className="mt-2 text-sm text-[#245C4F]">
                      These are the same payment values the admission form will use in step 6.
                    </p>

                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Admission fee</p>
                          <div className="mt-3 relative">
                            <select
                              value={previewAdmissionFeeId}
                              onChange={(event) => setPreviewAdmissionFeeId(event.target.value)}
                              className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                            >
                              <option value="">No admission fee selected</option>
                              {paymentOptions.admissionFees.map((item) => (
                                <option key={item.id || item.title} value={item.id}>
                                  {item.title || item.name || "Admission fee"} - PKR{" "}
                                  {Number(item.amount || 0).toLocaleString("en-PK")}
                                </option>
                              ))}
                            </select>
                          </div>
                          <p className="mt-2 text-sm text-[#245C4F]">
                            {selectedPreviewAdmissionFee?.title ||
                              selectedPreviewAdmissionFee?.name ||
                              "Choose an admission-fee item from fee management."}
                          </p>
                        </div>

                        <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Discount</p>
                          <div className="mt-3 relative">
                            <select
                              value={previewDiscountId}
                              onChange={(event) => setPreviewDiscountId(event.target.value)}
                              className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                            >
                              <option value="">No discount selected</option>
                              {paymentOptions.discounts
                                .filter(
                                  (item) =>
                                    Number(item.percent || 0) <=
                                    Number(paymentOptions.coordinatorMaxDiscountPercent || 20)
                                )
                                .map((item) => (
                                  <option key={item.id || item.label} value={item.id}>
                                    {item.label || `${Number(item.percent || 0)}%`}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <p className="mt-2 text-sm text-[#245C4F]">
                            Allowed discounts are limited to coordinator-approved values up to 20%.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                          Payment instructions
                        </p>
                        <textarea
                          rows={4}
                          value={previewPaymentInstructions}
                          onChange={(event) => setPreviewPaymentInstructions(event.target.value)}
                          placeholder={selectedPreviewPaymentMethod?.instructions || "Add payment instructions for this admission"}
                          className="mt-3 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                        />
                        <p className="mt-2 text-sm text-[#245C4F]">
                          {previewPaymentInstructions || selectedPreviewPaymentMethod?.instructions || "No payment instructions added yet."}
                        </p>
                      </div>

                      <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Payment methods</p>
                        <div className="mt-3 grid gap-3">
                          {paymentOptions.paymentMethods.length ? (
                            paymentOptions.paymentMethods.map((method) => (
                              <div
                                key={method.id || method.name}
                                className="rounded-xl border border-[#2D8A6A]/10 bg-[#FAF7F0] px-3 py-2 text-sm text-[#063F32]"
                              >
                                <p className="font-semibold">{method.name || "Payment method"}</p>
                                <div className="mt-2 grid gap-1 text-xs text-[#245C4F]">
                                  {method.bank_name ? (
                                    <p>
                                      <span className="font-semibold text-[#063F32]">Bank:</span> {method.bank_name}
                                    </p>
                                  ) : null}
                                  {method.account_title ? (
                                    <p>
                                      <span className="font-semibold text-[#063F32]">Account title:</span> {method.account_title}
                                    </p>
                                  ) : null}
                                  {method.account_number ? (
                                    <p>
                                      <span className="font-semibold text-[#063F32]">Account number:</span> {method.account_number}
                                    </p>
                                  ) : null}
                                  {method.iban ? (
                                    <p>
                                      <span className="font-semibold text-[#063F32]">IBAN:</span> {method.iban}
                                    </p>
                                  ) : null}
                                  {method.branch_code ? (
                                    <p>
                                      <span className="font-semibold text-[#063F32]">Branch code:</span> {method.branch_code}
                                    </p>
                                  ) : null}
                                  {method.instructions ? (
                                    <p>
                                      <span className="font-semibold text-[#063F32]">Instructions:</span> {method.instructions}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[#245C4F]">No payment methods available.</p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Regular fee</p>
                          <p className="mt-3 text-2xl font-bold text-[#063F32]">
                            {regularFee ? `PKR ${regularFeeAmount.toLocaleString("en-PK")}` : "No regular fee selected"}
                          </p>
                          <p className="mt-2 text-sm text-[#245C4F]">
                            {regularFee?.title || regularFee?.name || `Based on ${selectedClassLevel || "the selected class"}.`}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4 text-sm text-[#245C4F]">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Discount amount</p>
                          <p className="mt-2 text-lg font-bold text-[#063F32]">PKR {discountAmount.toLocaleString("en-PK")}</p>
                          <p className="mt-1">Applied on the regular fee only.</p>
                        </div>
                        <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4 text-sm text-[#245C4F]">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                            Total after discount
                          </p>
                          <p className="mt-2 text-lg font-bold text-[#063F32]">PKR {totalAmount.toLocaleString("en-PK")}</p>
                          <p className="mt-1">Regular fee minus discount plus admission fee.</p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedLead(null)}
                          className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await sendAdmissionForm(selectedLead);
                            setSelectedLead(null);
                          }}
                          disabled={loadingId === selectedLead.id || !selectedLeadCanSend}
                          className="rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {loadingId === selectedLead.id
                            ? "Sending..."
                            : selectedLeadCanSend
                              ? "Send Form"
                              : "Already Sent"}
                        </button>
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </ClientPortal>
      ) : null}

      {deleteTarget ? (
        <ClientPortal targetId={portalTargetId}>
          <div className="absolute inset-x-0 top-0 z-[10000] isolate flex min-h-full items-center justify-center bg-[#063F32]/45 px-4 py-10">
            <div className="w-full max-w-lg rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Delete interested student</p>
              <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#063F32]">
                {textOrDash(deleteTarget.student_name)}
              </h3>
              <p className="mt-2 text-sm text-[#245C4F]">
                This will permanently remove the registration record from the interested students list.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  disabled={deletingId === deleteTarget.id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteInterestedStudent(deleteTarget)}
                  className="rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={deletingId === deleteTarget.id}
                >
                  {deletingId === deleteTarget.id ? "Deleting..." : "Delete Row"}
                </button>
              </div>
            </div>
          </div>
        </ClientPortal>
      ) : null}

    </>
  );
}
