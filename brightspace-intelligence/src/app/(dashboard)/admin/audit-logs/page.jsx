"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";

const CACHE_TTL = 60 * 1000;

function formatLabel(value) {
  const text = String(value || "");
  return text
    ? text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getCacheKey(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entityType", filters.entityType);
  return `admin-audit-logs:${params.toString()}`;
}

function readCache(key) {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(key);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

function writeCache(key, payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function AdminAuditLogsPage() {
  const pathname = usePathname() || "";
  const isSuperAdminPortal = pathname.startsWith("/superadmin");
  const [filters, setFilters] = useState({
    search: "",
    action: "",
    entityType: "",
  });
  const [state, setState] = useState({
    loading: true,
    error: "",
    available: true,
    actions: [],
    entityTypes: [],
    items: [],
    summary: { total: 0, recent: 0 },
  });
  const [actionOpen, setActionOpen] = useState(false);
  const [entityOpen, setEntityOpen] = useState(false);
  const closeSelectState = (setter) => {
    window.setTimeout(() => setter(false), 0);
  };

  const load = useCallback(async (options = {}) => {
    const force = options.force === true;
    const cacheKey = getCacheKey(filters);

    setState((current) => ({ ...current, loading: true, error: "" }));

    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        setState({
          loading: false,
          error: "",
          available: cached.available !== false,
          actions: cached.actions || [],
          entityTypes: cached.entityTypes || [],
          items: cached.items || [],
          summary: cached.summary || { total: 0, recent: 0 },
        });
        return;
      }
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.action) params.set("action", filters.action);
      if (filters.entityType) params.set("entityType", filters.entityType);

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load audit logs.");
      }

      writeCache(cacheKey, data);
      setState({
        loading: false,
        error: "",
        available: data.available !== false,
        actions: data.actions || [],
        entityTypes: data.entityTypes || [],
        items: data.items || [],
        summary: data.summary || { total: 0, recent: 0 },
      });
    } catch (error) {
      setState({
        loading: false,
        error:
          error instanceof Error ? error.message : "Unable to load audit logs.",
        available: false,
        actions: [],
        entityTypes: [],
        items: [],
        summary: { total: 0, recent: 0 },
      });
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.14),transparent_28%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
              Audit history
            </p>
            <h1 className="mb-3 mt-4 text-3xl font-bold text-white-deep sm:text-4xl lg:text-4xl font-display">
              {isSuperAdminPortal
                ? "Review super admin actions and change history"
                : "Review admin actions and change history"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
              Track administrative activity across users, subjects, courses, finance settings, and system operations.
            </p>
          </div>
        </section>

        <AdminDashboardCards
          items={[
            {
              key: "total",
              label: "Visible records",
              value: state.summary.total,
              tone: "bg-[#0D5C48] text-[#FAF7F0]",
            },
            {
              key: "recent",
              label: "Last 7 days",
              value: state.summary.recent,
              tone: "bg-[#EAF6EF] text-[#0D5C48]",
            },
            {
              key: "status",
              label: "Section status",
              value: state.available ? "Ready" : "Pending",
              tone: "bg-[#FFF5D6] text-[#8A6B00]",
            },
          ]}
        />

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl sm:p-5">
          <form
            className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              load();
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                Search logs
              </span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Action, entity, or description"
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                Action
              </span>
              <div className="relative">
                <select
                  value={filters.action}
                  onMouseDown={() => setActionOpen((current) => !current)}
                  onFocus={() => setActionOpen(true)}
                  onBlur={() => closeSelectState(setActionOpen)}
                  onChange={(event) => {
                    setState((current) => ({ ...current, loading: true }));
                    setFilters((current) => ({
                      ...current,
                      action: event.target.value,
                    }));
                  }}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                >
                  <option value="">All actions</option>
                  {state.actions.map((item) => (
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${
                    actionOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                Entity type
              </span>
              <div className="relative">
                <select
                  value={filters.entityType}
                  onMouseDown={() => setEntityOpen((current) => !current)}
                  onFocus={() => setEntityOpen(true)}
                  onBlur={() => closeSelectState(setEntityOpen)}
                  onChange={(event) => {
                    setState((current) => ({ ...current, loading: true }));
                    setFilters((current) => ({
                      ...current,
                      entityType: event.target.value,
                    }));
                  }}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                >
                  <option value="">All entity types</option>
                  {state.entityTypes.map((item) => (
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${
                    entityOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </div>
            </label>

            <button
              type="submit"
              className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl bg-[#0D5C48] px-4 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
            >
              Apply
            </button>
          </form>
        </section>

        {state.error ? (
          <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50/95 p-5 text-sm text-rose-700 shadow-[0_18px_60px_-36px_rgba(185,28,28,0.12)] backdrop-blur-xl">
            {state.error}
          </section>
        ) : null}

         <AdminDataTable
            key={`${filters.search}|${filters.action}|${filters.entityType}`}
            resetKey={`${filters.search}|${filters.action}|${filters.entityType}`}
            loading={state.loading}
            loadingTitle="Loading audit logs"
            loadingSubtitle="Preparing the audit history table..."
            columns={[
              {
                key: "action",
                label: "Action",
                render: (row) => formatLabel(row.action),
              },
              { key: "entity_type", label: "Entity" },
              { key: "actor_name", label: "Actor" },
              {
                key: "actor_email",
                label: "Email",
                render: (row) => row.actor_email || "-",
              },
              { key: "description", label: "Description" },
              {
                key: "created_at",
                label: "Created",
                render: (row) => formatDate(row.created_at),
              },
            ]}
            rows={state.loading ? [] : state.items}
            emptyMessage={
              state.loading
                ? "Loading audit logs..."
                : "No audit activity matched the current view."
            }
          />
        </div>
      </div>
  );
}
