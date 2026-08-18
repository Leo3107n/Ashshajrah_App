"use client";

import { useEffect, useState } from "react";
import CoordinatorStatsCards from "@/components/coordinator/CoordinatorStatsCards";
import CoordinatorGoTopButton from "@/components/coordinator/CoordinatorGoTopButton";
import CoordinatorPortalSection from "@/components/coordinator/CoordinatorPortalSection";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

const CACHE_KEY = "coordinator-dashboard";
const CACHE_TTL = 60 * 1000;

function readCache() {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(CACHE_KEY);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function writeCache(payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

function writeNamedCache(key, payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function CoordinatorDashboardPage() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    stats: null,
    classDistribution: [],
    recentLectures: [],
    recentLeads: [],
    reports: null,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const cached = readCache();

      if (cached && active) {
          setState({
            loading: false,
            error: "",
            stats: cached.stats || null,
            classDistribution: cached.classDistribution || [],
            recentLectures: cached.recentLectures || [],
            recentLeads: cached.recentLeads || [],
            reports: cached.reports || null,
          });
      }

      try {
        const response = await fetch("/api/coordinator/dashboard", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load coordinator dashboard.");
        }

        if (active) {
          writeCache(data);
          setState({
            loading: false,
            error: "",
            stats: data.stats,
            classDistribution: data.classDistribution || [],
            recentLectures: data.recentLectures || [],
            recentLeads: data.recentLeads || [],
            reports: data.reports || null,
          });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load coordinator dashboard.",
            stats: null,
            classDistribution: [],
            recentLectures: [],
            recentLeads: [],
            reports: null,
          });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const stats = state.stats || {};
  const reportData = state.reports || null;
  const classDistribution = Array.isArray(state.classDistribution) ? state.classDistribution : [];
  const classColorPalette = ["#2D8A6A", "#2F6BFF", "#D94B4B", "#D4A017", "#7A5AF8", "#EF7D10"];
  const preferredClasses = ["Prep-I", "Prep-II", "Play Group"];
  const selectedClasses = preferredClasses.map((className) => {
    const matchedClass = classDistribution.find(
      (item) => String(item.classLevel || "").trim().toLowerCase() === className.toLowerCase()
    );
    return {
      classLevel: className,
      total: Number(matchedClass?.total || 0),
    };
  });
  const chartItems = [
    {
      key: "total",
      label: "Total",
      value: selectedClasses.reduce((sum, item) => sum + Number(item.total || 0), 0),
      color: "#2D8A6A",
    },
    ...selectedClasses.map((item, index) => ({
      key: item.classLevel,
      label: item.classLevel,
      value: Number(item.total || 0),
      color: classColorPalette[index + 1] || classColorPalette[index] || "#2D8A6A",
    })),
  ];
  const maxChartValue = Math.max(...chartItems.map((item) => item.value), 1);
  const getChartHeight = (value) => {
    if (value <= 0) return 14;
    const scaledHeight = Math.round((value / maxChartValue) * 112);
    return Math.max(26, Math.min(112, scaledHeight));
  };

  return (
    <div className="min-h-screen space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
        <div className="relative max-w-3xl">
          <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
            Coordinator dashboard
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">
            Coordinator command center
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Review admission progress, voucher movement, and classroom activity from one concise coordinator view.
          </p>
        </div>
      </section>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      {state.loading ? (
        <OpenBookLoader
          title="Loading coordinator dashboard"
          subtitle="Fetching summary cards and recent activity..."
        />
      ) : null}

      <CoordinatorPortalSection
        id="summary"
        title="Coordinator Summary"
        description="Key operational counts in the same compact card style used across the portal."
        showBrand={false}
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="min-w-0">
            <CoordinatorStatsCards
              items={[
                { key: "totalRegistrations", label: "Total registrations", value: state.loading ? "..." : stats.totalRegistrations || 0 },
                { key: "newLeads", label: "Parent Interview Form Not Submitted", value: state.loading ? "..." : stats.newLeads || 0 },
                { key: "parentInterviewSubmitted", label: "Parent Interview Form Submitted", value: state.loading ? "..." : stats.parentInterviewSubmitted || 0 },
                { key: "pendingVouchers", label: "Pending vouchers", value: state.loading ? "..." : stats.pendingVouchers || 0 },
                { key: "pendingPaymentVerifications", label: "Pending payment verifications", value: state.loading ? "..." : stats.pendingPaymentVerifications || 0 },
                { key: "activeStudents", label: "Active students", value: state.loading ? "..." : stats.activeStudents || 0 },
              ]}
            />
          </div>

          <section className="relative overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2D8A6A_0%,#2F6BFF_30%,#D94B4B_60%,#D4A017_100%)]" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#063F32] opacity-75">
                  Class Wise Chart
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#063F32]">
                  Active students by class
                </h3>
              </div>
              <div className="grid gap-2 text-xs sm:min-w-[11rem]">
                {chartItems.map((item) => (
                  <div key={item.key} className="flex items-center gap-2 text-[#245C4F]">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-semibold">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex min-h-[210px] items-end justify-between gap-3 rounded-[1.5rem] border border-[#2D8A6A]/10 bg-[#FFFDF7] px-4 py-5">
              {chartItems.map((item) => {
                const height = getChartHeight(item.value);
                return (
                  <div key={item.key} className="flex flex-1 flex-col items-center justify-end gap-3">
                    <span className="text-sm font-semibold text-[#063F32]">{item.value}</span>
                    <div
                      className="w-full max-w-[44px] rounded-t-[1rem] shadow-[0_12px_28px_-20px_rgba(13,59,46,0.3)] transition-all duration-300"
                      style={{ height: `${height}px`, backgroundColor: item.color }}
                    />
                    <span className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#245C4F]">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </CoordinatorPortalSection>
      <CoordinatorGoTopButton />
      </div>
    </div>
  );
}
