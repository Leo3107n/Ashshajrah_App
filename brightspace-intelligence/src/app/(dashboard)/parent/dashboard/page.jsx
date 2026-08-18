"use client";

import { useEffect, useMemo, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import ParentStatsCards from "@/components/parent/ParentStatsCards";
import ActiveHeadlinesBanner from "@/components/shared/ActiveHeadlinesBanner";

export default function ParentDashboardPage() {
  const [showAllMonthlyChildren, setShowAllMonthlyChildren] = useState(false);
  const [state, setState] = useState({
    children: [],
    headlines: [],
    selectedChildId: "",
    stats: {},
    error: "",
    loading: true,
    monthlyFee: null,
  });

  async function loadChildren() {
    const response = await fetch("/api/parent/children", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Unable to load children.");
    }
    setState((current) => ({
      ...current,
      children: data.children || [],
      selectedChildId: "",
      loading: false,
      error: "",
    }));
  }

  async function loadHeadlines() {
    const response = await fetch("/api/headlines/active", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Unable to load headlines.");
    }
    setState((current) => ({
      ...current,
      headlines: Array.isArray(data.headlines) ? data.headlines : [],
    }));
  }

  async function loadDashboard(childId = state.selectedChildId) {
    if (!childId) {
      setState((current) => ({ ...current, stats: {}, error: "" }));
      return;
    }

    const response = await fetch(`/api/parent/dashboard?childId=${encodeURIComponent(childId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Unable to load dashboard.");
    }

    setState((current) => ({
      ...current,
      headlines: Array.isArray(data.headlines) ? data.headlines : current.headlines,
      stats: data.stats || {},
      error: "",
    }));
  }

  async function loadMonthlyFee() {
    const response = await fetch("/api/monthly-fee-status", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Unable to load monthly fee status.");
    }
    setState((current) => ({ ...current, monthlyFee: data.available ? data : null }));
  }

  const visibleMonthlyChildren = useMemo(() => {
    const children = Array.isArray(state.monthlyFee?.children) ? state.monthlyFee.children : [];
    return showAllMonthlyChildren ? children : children.slice(0, 4);
  }, [showAllMonthlyChildren, state.monthlyFee]);

  const hasUnpaidMonthlyChildren = useMemo(() => {
    const children = Array.isArray(state.monthlyFee?.children) ? state.monthlyFee.children : [];
    return children.some((child) => !child?.is_paid);
  }, [state.monthlyFee]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([loadChildren(), loadHeadlines(), loadMonthlyFee()]).catch((error) =>
        setState((current) => ({ ...current, loading: false, error: error.message }))
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 overflow-hidden rounded-[2rem] px-4 py-4 sm:px-6 lg:px-8">
        {state.monthlyFee && hasUnpaidMonthlyChildren ? (
          <section
            className={`w-full rounded-[2rem] border px-5 py-4 text-sm shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl ${
              state.monthlyFee.overdue
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : state.monthlyFee.due_soon
                  ? "border-[#E4C766]/70 bg-[#FFF5D6] text-[#8A6B00]"
                  : "border-[#2D8A6A]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] text-[#0D5C48]"
            }`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-medium">
                  <p className="font-bold text-[#BF2106]">
                    {state.monthlyFee.message || "Monthly fee voucher is not submitted yet. Please submit to continue LMS access."}
                  </p>
                  {typeof state.monthlyFee.days_left === "number" ? (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em]">
                      {state.monthlyFee.days_left >= 0
                        ? `${state.monthlyFee.days_left} day${state.monthlyFee.days_left === 1 ? "" : "s"} remaining`
                        : `${Math.abs(state.monthlyFee.days_left)} day${Math.abs(state.monthlyFee.days_left) === 1 ? "" : "s"} overdue`}
                    </p>
                  ) : null}
                </div>
              </div>

              {Array.isArray(state.monthlyFee.children) && state.monthlyFee.children.length ? (
                <div className="overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(250,247,240,0.96)_100%)]">
                  <table className="min-w-full divide-y divide-[#F1EADC] text-left text-sm">
                    <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                      <tr>
                        <th className="px-4 py-3">Child</th>
                        <th className="px-4 py-3">Class</th>
                        <th className="px-4 py-3">Voucher</th>
                        <th className="px-4 py-3">Due</th>
                        <th className="px-4 py-3">Days</th>
                        <th className="px-4 py-3">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1EADC]">
                      {visibleMonthlyChildren.map((child) => (
                        <tr key={child.student_id || child.voucher_no}>
                          <td className="px-4 py-4 font-semibold text-[#063F32]">{child.student_name || "Not available"}</td>
                          <td className="px-4 py-4 text-[#245C4F]">{child.class_title || "Not assigned"}</td>
                          <td className="px-4 py-4 text-[#245C4F]">{child.voucher_no || "-"}</td>
                          <td className="px-4 py-4 text-[#245C4F]">{child.due_date ? new Date(child.due_date).toLocaleDateString() : "-"}</td>
                          <td className="px-4 py-4 text-[#245C4F]">
                            {typeof child.days_left === "number"
                              ? child.days_left >= 0
                                ? `${child.days_left} day${child.days_left === 1 ? "" : "s"} left`
                                : `${Math.abs(child.days_left)} day${Math.abs(child.days_left) === 1 ? "" : "s"} overdue`
                              : "-"}
                          </td>
                          <td className="px-4 py-4 text-[#245C4F]">
                            {child.is_paid
                              ? "Verified"
                              : child.overdue
                                ? "Overdue"
                                : child.due_soon
                                  ? "Due soon"
                                  : String(child.payment_status || "Not submitted")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {state.monthlyFee.children.length > 4 ? (
                    <div className="border-t border-[#F1EADC] px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setShowAllMonthlyChildren((current) => !current)}
                        className="inline-flex items-center justify-center rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                      >
                        {showAllMonthlyChildren ? "Show less" : `Show more (${state.monthlyFee.children.length - 4} more)`}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <ActiveHeadlinesBanner items={state.headlines} />

        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
              Parent dashboard
            </p>
            <h1 className="mb-3 mt-4 text-2xl font-bold font-display text-[#FAF7F0] sm:text-4xl lg:text-4xl">
              Child learning overview
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 sm:text-base">
              Monitor classes, homework, attendance, fee status, and upcoming Google Meet sessions in one place.
            </p>
          </div>
        </section>

        <ParentStatsCards items={[{ key: "children", label: "Total children", value: state.children.length || 0 }]} />

        <ChildSwitcher
          childrenList={state.children}
          value={state.selectedChildId}
          onChange={(id) => {
            setState((current) => ({ ...current, selectedChildId: id }));
            loadDashboard(id).catch((error) => setState((current) => ({ ...current, error: error.message })));
          }}
        />

        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

        {!state.selectedChildId ? (
          <div className="rounded-[2rem] border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-8 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]">
            Please select a child first.
          </div>
        ) : (
          <ParentStatsCards
            items={[
              { key: "attended", label: "Attended lectures", value: state.stats.present_lectures || 0 },
              { key: "homework", label: "Pending homework", value: state.stats.pending_homework || 0 },
              { key: "attendance", label: "Attendance", value: `${state.stats.attendance_percentage || 0}%` },
              { key: "fees", label: "Fee status", value: state.stats.fee_status || "not_available" },
            ]}
          />
        )}
      </div>
    </div>
  );
}
