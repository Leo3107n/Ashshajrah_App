"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ClipboardList, HelpCircle } from "lucide-react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";
import InterestedStudentsPanel from "@/components/coordinator/InterestedStudentsPanel";

const FILTERS = [
  { id: "all", label: "All Records" },
  { id: "pending", label: "Total Registrations" },
  { id: "parent_interview_sent", label: "Parent Interview Sent" },
  { id: "parent_interview_submitted", label: "Parent Interview Submitted" },
  { id: "parent_form_sent", label: "Parent Form Sent" },
  { id: "sent", label: "Admission Form Sent" },
  { id: "submitted", label: "Admission Form Submitted" },
  { id: "live_students", label: "Live Students" },
  { id: "not_submitted", label: "Admission Form Not Submitted" },
  { id: "follow_up", label: "Needs Follow-up" },
];

const FOLLOW_UP_BUCKETS = [
  { id: "10", label: "10 days" },
  { id: "20", label: "20 days" },
  { id: "30", label: "30 days" },
  { id: "30plus", label: "1 month+" },
];

const PARENT_FORM_SENT_BUCKETS = [
  { id: "no", label: "No" },
  { id: "checking_issue", label: "Checking Issue" },
  { id: "resolved", label: "Resolved" },
  { id: "yes", label: "Yes" },
];

const STATUS_HELP = {
  pending: { title: "Total Registrations", lines: ["This is the total number of interested student records currently stored.", "Use this card to review every registration record in one place."] },
  parent_interview_sent: { title: "Parent Interview Sent", lines: ["The parent interview form link has been sent to the parent or guardian.", "The application is waiting for the parent to complete the interview form."] },
  parent_interview_submitted: { title: "Parent Interview Submitted", lines: ["The parent interview form has been completed and submitted.", "This is the next step before the admission form stage."] },
  parent_form_sent: { title: "Parent Form Sent", lines: ["Track the save status for parent interview / form send progress.", "Use the right-side dropdown to narrow by no, checking issue, resolved, or yes."] },
  sent: { title: "Admission Form Sent", lines: ["The admission form link has been sent to the parent or guardian.", "The application is waiting for the parent to complete the form."] },
  submitted: { title: "Admission Form Submitted", lines: ["The parent completed and submitted the admission form.", "This is ready for admissions review."] },
  live_students: { title: "Live Students", lines: ["These are approved students who are now active in the LMS.", "Use this card to review students whose payment has been approved."] },
  not_submitted: { title: "Admission Form Not Submitted", lines: ["The form was sent, but the parent has not completed it yet.", "This status helps you track incomplete applications."] },
  follow_up: { title: "Needs Follow-up", lines: ["The due date has passed or the reminder window needs attention.", "Use the dropdown to narrow records by how old the follow-up is."] },
};

function getPipelineStage(item) {
  const stage = item.__stage || {};
  if (!stage.registered) return "pending";
  if (stage.liveStudent) return "live_students";
  if (stage.interviewSent && !stage.interviewSubmitted) return "parent_interview_sent";
  if (stage.interviewSubmitted && !stage.sent) return "parent_interview_submitted";
  if (stage.sent && stage.submitted) return "submitted";
  if (stage.sent && stage.overdue) return "follow_up";
  if (stage.sent) return "sent";
  if (stage.submitted) return "submitted";
  return "pending";
}

export default function InterestedStudentsPageShell({
  portalLabel,
  title,
  description,
  portalTargetId,
  insidePageLayout = false,
  initialItems = null,
  showDetailsButton = true,
  showActionsColumn = false,
  allowSendFormAction = true,
  allowParentFormSentColumn = false,
  showTableControls = false,
  hideDeleteAction = false,
}) {
  const resolvedPortalTargetId =
    portalTargetId ||
    (String(portalLabel || "").toLowerCase().includes("super admin")
      ? "superadmin-page-portal-root"
      : String(portalLabel || "").toLowerCase().includes("admin")
        ? "admin-page-portal-root"
        : "coordinator-page-portal-root");
  const [state, setState] = useState({
    items: Array.isArray(initialItems) ? initialItems : [],
    loading: !Array.isArray(initialItems),
    error: "",
  });
  const [activeFilter, setActiveFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [followUpBucket, setFollowUpBucket] = useState("all");
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [parentFormSentBucket, setParentFormSentBucket] = useState("all");

  useEffect(() => {
    let active = true;
    async function load() {
      setState((current) => ({
        ...current,
        loading: Array.isArray(initialItems) ? current.loading : true,
      }));
      const response = await fetch(`/api/coordinator/interested-students?t=${Date.now()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to load interested students.");
      if (active) setState({ items: Array.isArray(data.items) ? data.items : [], loading: false, error: "" });
    }
    load().catch((error) => active && setState({ items: [], loading: false, error: error.message }));
    return () => {
      active = false;
    };
  }, [initialItems]);

  const normalizedItems = useMemo(
    () =>
      state.items
        .filter((item) => String(item.status || "").toLowerCase() !== "archived")
        .map((item) => {
          const rawStatus = String(item.admission_form_status || item.status || "pending").toLowerCase();
          const status = rawStatus === "registered" ? "submitted" : rawStatus;
          const interviewStatus = String(item.parent_interview_status || "").toLowerCase();
          const sent = Boolean(item.admission_form_sent_at) || ["sent", "reminded", "submitted", "overdue", "not_submitted"].includes(status);
          const paymentStatus = String(item.registration_status || item.status || "")
            .toLowerCase()
            .trim()
            .replace(/[\s-]+/g, "_");
          const submittedBase = Boolean(item.admission_form_submitted_at) || status === "submitted" || status === "registered";
          const liveStudent = paymentStatus === "access_granted" && submittedBase;
          const submitted = submittedBase && !liveStudent;
          const interviewSent = Boolean(item.parent_interview_form_id) || ["pending", "sent", "submitted", "reviewed"].includes(interviewStatus);
          const interviewSubmitted = Boolean(item.parent_interview_submitted_at) || ["submitted", "reviewed"].includes(interviewStatus);
          const reminderCount = Number(item.admission_form_reminder_count || 0);
          const reminded = Boolean(item.admission_form_last_reminder_at) || reminderCount > 0 || status === "reminded";
          const dueAt = item.admission_form_due_at ? new Date(item.admission_form_due_at) : null;
          const sentAt = item.admission_form_sent_at ? new Date(item.admission_form_sent_at) : null;
          const dueDate = dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : sentAt && !Number.isNaN(sentAt.getTime()) ? new Date(sentAt.getTime() + 5 * 24 * 60 * 60 * 1000) : null;
          const daysSinceDue = dueDate && !Number.isNaN(dueDate.getTime()) ? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000))) : null;
          const overdue = status === "overdue" || (reminded && !submitted) || (daysSinceDue !== null && daysSinceDue > 0 && !submitted);
          return { ...item, __status: status, __interviewStatus: interviewStatus, __stage: { registered: Boolean(item.id), interviewSent, interviewSubmitted, sent, submitted, reminded, liveStudent, overdue, dueDate, daysSinceDue } };
        }),
    [state.items]
  );

  const statusCounts = useMemo(() => {
    const counts = { all: normalizedItems.length, pending: normalizedItems.length, parent_interview_sent: 0, parent_interview_submitted: 0, parent_form_sent: 0, sent: 0, submitted: 0, live_students: 0, follow_up: 0 };
    for (const item of normalizedItems) {
      const pipelineStage = getPipelineStage(item);
      counts[pipelineStage] += 1;
    }
    return counts;
  }, [normalizedItems]);

  const visibleFilters = useMemo(() => FILTERS.filter((item) => item.id === "all" || !["parent_form_sent", "not_submitted", "follow_up"].includes(item.id)), []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return normalizedItems.filter((item) => {
      const pipelineStage = getPipelineStage(item);
      if (activeFilter !== "all" && activeFilter !== "pending" && pipelineStage !== activeFilter) return false;
      if (query) {
        const searchableValues = [item.parent_name, item.email, item.phone, item.student_name, item.child_name, item.child_age, item.child_dob, item.class_level, item.registration_code, item.city_country, item.city, item.country, item.message, item.notes, item.__status, item.parent_interview_status, item.admission_form_status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
        if (!searchableValues) return false;
      }
      if ((activeFilter === "pending" || activeFilter === "parent_interview_sent" || activeFilter === "parent_form_sent") && parentFormSentBucket !== "all") {
        const value = String(item.parent_form_sent_status || "no").toLowerCase();
        if (value !== parentFormSentBucket) return false;
      }
      if (activeFilter === "follow_up" && followUpBucket !== "all") {
        const daysSinceDue = item.__stage?.daysSinceDue;
        if (daysSinceDue === null || Number.isNaN(daysSinceDue)) return false;
        if (followUpBucket === "10" && !(daysSinceDue <= 10)) return false;
        if (followUpBucket === "20" && !(daysSinceDue > 10 && daysSinceDue <= 20)) return false;
        if (followUpBucket === "30" && !(daysSinceDue > 20 && daysSinceDue <= 30)) return false;
        if (followUpBucket === "30plus" && !(daysSinceDue > 30)) return false;
      }
      return true;
    });
  }, [activeFilter, followUpBucket, normalizedItems, parentFormSentBucket, search]);

  useEffect(() => {
    setFollowUpOpen(false);
    setFollowUpBucket("all");
    setParentFormSentBucket("all");
    setSearch("");
  }, [activeFilter]);

  const content = (
    <>
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))]" />
        <div className="relative">
          <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">{portalLabel}</p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">{description}</p>
        </div>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <OpenBookLoader title="Loading interested students" subtitle="Fetching website registration records..." /> : null}

      {!state.loading ? (
        <section className="overflow-x-hidden overflow-y-visible rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <div className="border-b border-[#2D8A6A]/10 px-6 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:flex-nowrap xl:items-end xl:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Admission Process</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 [@media(min-width:500px)]:grid-cols-3 [@media(min-width:668px)]:grid-cols-4 [@media(min-width:992px)]:grid-cols-7 lg:grid-cols-7 xl:grid-cols-7">
                    {visibleFilters.filter((item) => item.id !== "all").map((item, index) => {
                      const help = STATUS_HELP[item.id];
                      const isSubmitted = item.id === "submitted";
                      const isFirstCard = index === 0;
                      const isLastCard = index === visibleFilters.filter((filterItem) => filterItem.id !== "all").length - 1;
                      const tooltipPlacement = isFirstCard ? "left-1/2 -translate-x-1/2 md:left-full md:translate-x-0 md:ml-3" : isLastCard || item.id === "follow_up" || isSubmitted ? "left-auto right-0 -translate-x-2 md:right-full md:left-auto md:translate-x-0 md:mr-3" : "left-1/2 -translate-x-1/2";
                      return (
                        <button key={item.id} type="button" onClick={() => { setActiveFilter(item.id); if (item.id === "follow_up") setFollowUpOpen((current) => !current); }} className={`group relative flex min-h-[108px] flex-col overflow-visible rounded-2xl border px-4 py-4 text-left shadow-[0_12px_30px_-24px_rgba(13,59,46,0.2)] transition ${activeFilter === item.id ? "border-[#0D5C48] bg-[#EAF6EF]" : "border-[#2D8A6A]/15 bg-[#FAF7F0] hover:border-[#0D5C48]/30 hover:bg-[#FFFDF7]"}`}>
                          <div className="absolute right-4 top-4">
                            <div className="relative">
                              <span aria-hidden="true" className="peer inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0D5C48] text-[11px] font-bold text-white transition hover:bg-[#063F32]">{String(index + 1)}</span>
                              <div className={`pointer-events-none absolute top-full z-20 mt-2 w-[min(15rem,calc(100vw-1rem))] rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 text-left text-xs leading-6 text-[#245C4F] opacity-0 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.22)] transition peer-hover:opacity-100 peer-focus-visible:opacity-100 ${tooltipPlacement}`}>
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">{help.title}</p>
                                {help.lines.map((line) => <p key={line} className="mt-2">{line}</p>)}
                              </div>
                            </div>
                          </div>
                          <div className="min-h-[42px] pr-10 pt-1">
                            <p className="min-h-[42px] text-[11px] font-semibold uppercase tracking-[0.2em] leading-5 text-[#0D5C48]">{item.label}</p>
                          </div>
                          <p className="mt-auto pt-3 text-2xl font-bold leading-none text-[#063F32]">{statusCounts[item.id] || 0}</p>
                          {item.id === "follow_up" && activeFilter === "follow_up" && followUpBucket !== "all" ? <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7A938B]">Selected: {FOLLOW_UP_BUCKETS.find((bucket) => bucket.id === followUpBucket)?.label || "10 days"}</p> : null}
                          {item.id === "follow_up" && activeFilter === "follow_up" && followUpOpen ? (
                            <div className="absolute left-0 right-0 top-full z-30 mt-1 w-full rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-3 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.28)]">
                              <div className="grid gap-2">
                                {FOLLOW_UP_BUCKETS.map((bucket) => (
                                  <div key={bucket.id} onClick={(event) => { event.stopPropagation(); setFollowUpBucket(bucket.id); setFollowUpOpen(false); }} role="button" tabIndex={0} className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${followUpBucket === bucket.id ? "border-[#0D5C48] bg-[#EAF6EF] text-[#063F32]" : "border-[#2D8A6A]/15 bg-white text-[#245C4F] hover:border-[#0D5C48]/30 hover:bg-[#FFFDF7]"}`}>{bucket.label}</div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <InterestedStudentsPanel
                key={activeFilter}
                items={filteredItems}
                onRefresh={() => {}}
                portalTargetId={resolvedPortalTargetId}
                showDetailsButton={showDetailsButton}
                showTableControls={showTableControls}
                showFlowColumn={false}
                showStatusColumn={true}
                showActionsColumn={showActionsColumn}
                allowSendFormAction={allowSendFormAction}
                allowParentFormSentColumn={allowParentFormSentColumn && ["pending", "parent_interview_sent"].includes(activeFilter)}
                hideDeleteAction={hideDeleteAction}
                rightFilterMode={allowParentFormSentColumn && ["pending", "parent_interview_sent"].includes(activeFilter) ? "parent_form_sent" : "none"}
                rightFilterValue={allowParentFormSentColumn && ["pending", "parent_interview_sent"].includes(activeFilter) ? parentFormSentBucket : "all"}
                rightFilterOptions={PARENT_FORM_SENT_BUCKETS}
                onRightFilterChange={setParentFormSentBucket}
              />
            </div>
          </section>
      ) : null}
    </>
  );

  if (insidePageLayout) {
    return <div id={resolvedPortalTargetId} className="space-y-4 overflow-x-hidden">{content}</div>;
  }

  return (
    <div id={resolvedPortalTargetId} className="min-h-screen space-y-6 overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]">
      <div className="pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">{content}</div>
    </div>
  );
}
