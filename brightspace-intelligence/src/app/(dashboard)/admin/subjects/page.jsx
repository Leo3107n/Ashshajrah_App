"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";
import SubjectFormModal from "@/components/admin/SubjectFormModal";

const CACHE_TTL = 60 * 1000;

function formatLabel(value) {
  const text = String(value || "");
  return text
    ? text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
}

function getCacheKey(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.courseId) params.set("courseId", filters.courseId);
  return `admin-subjects:${params.toString()}`;
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

export default function AdminSubjectsPage() {
  const pathname = usePathname() || "";
  const isAdminReadonlyPortal = pathname.startsWith("/admin") && !pathname.startsWith("/superadmin");
  const [filters, setFilters] = useState({ search: "", status: "", courseId: "" });
  const [state, setState] = useState(() => {
    const cached = readCache(getCacheKey({ search: "", status: "", courseId: "" }));

    return {
      loading: !cached,
      error: "",
      available: cached?.available !== false,
      classOptions: cached?.classOptions || [],
      items: cached?.items || [],
      summary: cached?.summary || { total: 0, active: 0, inactive: 0 },
    };
  });
  const [modal, setModal] = useState({ open: false, record: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  function closeSelectState(setter) {
    window.setTimeout(() => setter(false), 0);
  }

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
          classOptions: cached.classOptions || [],
          items: cached.items || [],
          summary: cached.summary || { total: 0, active: 0, inactive: 0 },
        });
        return;
      }
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.courseId) params.set("courseId", filters.courseId);

      const response = await fetch(`/api/admin/subjects?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load subjects.");
      }

      writeCache(cacheKey, data);
      setState({
        loading: false,
        error: "",
        available: data.available !== false,
        classOptions: data.classOptions || [],
        items: data.items || [],
        summary: data.summary || { total: 0, active: 0, inactive: 0 },
      });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load subjects.",
        available: false,
        classOptions: [],
        items: [],
        summary: { total: 0, active: 0, inactive: 0 },
      });
    }
  }, [filters]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/subjects/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete subject.");
      }

      setState((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== deleteTarget.id),
        summary: {
          total: Math.max(0, (current.summary?.total || 0) - 1),
          active: Math.max(0, (current.summary?.active || 0) - (deleteTarget.status === "active" ? 1 : 0)),
          inactive: Math.max(0, (current.summary?.inactive || 0) - (deleteTarget.status === "inactive" ? 1 : 0)),
        },
      }));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget]);

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
        <section className="relative overflow-hidden rounded-[2.25rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-6xl">
              <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
                Subject catalog
              </p>
              <h1 className="mb-3 mt-4 text-3xl font-bold text-white-deep sm:text-4xl lg:text-4xl font-display">
                Maintain the subject catalog
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
                Create and refine the academic subject structure that courses and classes will build on.
              </p>
            </div>

            {!isAdminReadonlyPortal ? (
              <button
                type="button"
                onClick={() => setModal({ open: true, record: null })}
                className="inline-flex items-center justify-center rounded-2xl bg-[#FAF7F0] px-5 py-3 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DBD8D5]"
              >
                Create subject
              </button>
            ) : null}
          </div>
        </section>

      <AdminDashboardCards
        items={[
          {
            key: "total",
            label: "Total subjects",
            value: state.summary.total,
            tone: "bg-[#0D5C48] text-[#FAF7F0]",
          },
          {
            key: "active",
            label: "Active subjects",
            value: state.summary.active,
            tone: "bg-[#EAF6EF] text-[#0D5C48]",
          },
          {
            key: "inactive",
            label: "Inactive subjects",
            value: state.summary.inactive,
            tone: "bg-[#FFF5D6] text-[#8A6B00]",
          },
          {
            key: "availability",
            label: "Catalog status",
            value: state.available ? "Ready" : "Pending",
            tone: "bg-[#EAF6EF] text-[#0D5C48]",
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
              Search subjects
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
              placeholder="Name, code, or description"
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">
              Class
            </span>
            <div className="relative">
              <select
                value={filters.courseId}
                onMouseDown={() => setClassOpen((current) => !current)}
                onFocus={() => setClassOpen(true)}
                onBlur={() => closeSelectState(setClassOpen)}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    courseId: event.target.value,
                  }))
                }
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
              >
                <option value="">All classes</option>
                {state.classOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.class_level || item.title}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${classOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">
              Status
            </span>
            <div className="relative">
              <select
                value={filters.status}
                onMouseDown={() => setStatusOpen((current) => !current)}
                onFocus={() => setStatusOpen(true)}
                onBlur={() => closeSelectState(setStatusOpen)}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${statusOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
          </label>

          <button
            type="submit"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 text-sm font-semibold text-white transition hover:bg-[#063F32]"
          >
            Apply
          </button>
        </form>
        </section>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

        <AdminDataTable
        columns={[
          {
            key: "name",
            label: "Subject",
            render: (row) => (
              <div>
                <p className="font-semibold text-[#063F32]">{row.name}</p>
              </div>
            ),
          },
          {
            key: "class_level",
            label: "Class",
            render: (row) => row.class_level || "-",
          },
          { key: "description", label: "Description" },
          {
            key: "status",
            label: "Status",
            render: (row) => formatLabel(row.status),
          },
        ]}
        loading={state.loading}
        loadingTitle="Loading subjects"
        loadingSubtitle="Preparing the subject table..."
        rows={state.loading ? [] : state.items}
        emptyMessage={
          state.loading
            ? "Loading subjects..."
            : "No subjects matched the current view."
        }
        actions={!isAdminReadonlyPortal ? (row) => (
          <>
            <button
              type="button"
              onClick={() => setModal({ open: true, record: row })}
              className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Delete
            </button>
          </>
        ) : null}
      />

        {!isAdminReadonlyPortal && modal.open ? (
          <SubjectFormModal
          key={modal.record?.id || "create-subject"}
          open={modal.open}
          record={modal.record}
          classOptions={state.classOptions}
          onClose={() => setModal({ open: false, record: null })}
          onSuccess={() => load({ force: true })}
        />
        ) : null}

        {deleteTarget ? (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-[#063F32]/45 px-4 pt-10 pb-8">
            <div className="w-full max-w-lg rounded-[2rem] border border-[#2D8A6A]/15 bg-white shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="border-b border-[#F1EADC] px-6 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#C9A227]">Delete subject</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">Remove this subject record?</h3>
              </div>
              <div className="space-y-4 px-6 py-5">
                <p className="text-sm text-[#245C4F]">
                  This will permanently delete{" "}
                  <span className="font-semibold text-[#063F32]">{deleteTarget.name || "this subject"}</span>{" "}
                  and unlink it from any assigned classes.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete now"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
