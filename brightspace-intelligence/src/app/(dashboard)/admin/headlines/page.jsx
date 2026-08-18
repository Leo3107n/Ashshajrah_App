"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AdminDataTable from "@/components/admin/AdminDataTable";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

function emptyForm() {
  return {
    headline: "",
    startDate: "",
    endDate: "",
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatStatus(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function HeadlineForm({ form, onChange, onSubmit, onCancel, submitting, submitLabel }) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[#245C4F]">Headline text</span>
        <textarea
          value={form.headline}
          onChange={(event) => onChange((current) => ({ ...current, headline: event.target.value }))}
          rows={4}
          placeholder="Enter the announcement students, teachers, and parents should see"
          className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
          required
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#245C4F]">Start date</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => onChange((current) => ({ ...current, startDate: event.target.value }))}
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#245C4F]">End date</span>
          <input
            type="date"
            value={form.endDate}
            onChange={(event) => onChange((current) => ({ ...current, endDate: event.target.value }))}
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
            required
          />
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-5 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#063F32] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <LeafSpinnerInline />
              Saving...
            </span>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}

export default function AdminHeadlinesPage() {
  const pathname = usePathname() || "";
  const isAdminReadonlyPortal = pathname.startsWith("/admin") && !pathname.startsWith("/superadmin");
  const isSuperAdminPortal = pathname.startsWith("/superadmin");
  const [items, setItems] = useState([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [deletingItem, setDeletingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/headlines", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load headlines.");
      }

      setItems(Array.isArray(data.items) ? data.items : []);
      setAvailable(data.available !== false);
    } catch (loadError) {
      setItems([]);
      setAvailable(false);
      setError(loadError instanceof Error ? loadError.message : "Unable to load headlines.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function createHeadline(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/headlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to save headline.");
      }

      setCreateForm(emptyForm());
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save headline.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateHeadline(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/headlines/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to save headline.");
      }

      setEditingId("");
      setEditForm(emptyForm());
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save headline.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deletingItem?.id) return;
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/headlines/${deletingItem.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete headline.");
      }

      if (editingId === deletingItem.id) {
        setEditForm(emptyForm());
        setEditingId("");
      }

      setDeletingItem(null);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete headline.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditForm({
      headline: item.headline || "",
      startDate: String(item.start_date || "").slice(0, 10),
      endDate: String(item.end_date || "").slice(0, 10),
    });
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.14),transparent_28%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
              Headlines
            </p>
            <h1 className="mb-3 mt-4 text-3xl font-bold text-white-deep sm:text-4xl lg:text-4xl font-display">
              Schedule dashboard announcements
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
              {isSuperAdminPortal
                ? "Create time-based headlines that appear at the top of student, teacher, and parent dashboards while their date range is active."
                : "Create time-based headlines that appear at the top of student, teacher, and parent dashboards while their date range is active."}
            </p>
          </div>
        </section>

        {!isAdminReadonlyPortal ? (
        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Create headline</p>
              <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">New dashboard headline</h2>
            </div>
          </div>

          <HeadlineForm
            form={createForm}
            onChange={setCreateForm}
            onSubmit={createHeadline}
            submitting={submitting}
            submitLabel="Create headline"
          />
        </section>
        ) : null}

        {error ? (
          <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50/95 p-5 text-sm text-rose-700 shadow-[0_18px_60px_-36px_rgba(185,28,28,0.12)] backdrop-blur-xl">
            {error}
          </section>
        ) : null}

        {!available ? (
          <section className="rounded-[1.75rem] border border-dashed border-[#C9A227]/35 bg-[#FFF5D6] p-5 text-sm text-[#8A6B00] shadow-[0_18px_60px_-36px_rgba(201,162,39,0.12)]">
            Headlines table is not available yet. Run the SQL script first, then refresh this page.
          </section>
        ) : null}

         <AdminDataTable
            loading={loading}
            loadingTitle="Loading headlines"
            loadingSubtitle="Preparing the announcement table..."
            columns={[
              {
                key: "headline",
                label: "Headline",
                render: (row) => <p className="max-w-xl whitespace-pre-wrap font-medium text-[#063F32]">{row.headline}</p>,
              },
              {
                key: "date_range",
                label: "Date range",
                render: (row) => `${formatDate(row.start_date)} to ${formatDate(row.end_date)}`,
              },
              {
                key: "display_status",
                label: "Status",
                render: (row) => formatStatus(row.display_status),
              },
              {
                key: "created_by_name",
                label: "Created by",
                render: (row) => row.created_by_name || "Admin",
              },
            ]}
            rows={loading ? [] : items}
            emptyMessage={loading ? "Loading headlines..." : "No headlines have been created yet."}
            actions={!isAdminReadonlyPortal ? (row) => (
              <>
                <button
                  type="button"
                  onClick={() => startEdit(row)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingItem(row)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <LeafSpinnerInline />
                      Deleting...
                    </span>
                  ) : (
                    "Delete"
                  )}
                </button>
              </>
            ) : null}
          />
        </div>

        {!isAdminReadonlyPortal && editingId ? (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#063F32]/45 px-4 pb-8 pt-24 backdrop-blur-sm sm:pt-28">
            <div className="mx-auto w-full max-w-3xl">
              <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_32px_90px_-38px_rgba(13,59,46,0.24)]">
              <div className="bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] px-6 py-6 text-[#FAF7F0] sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#EAF6EF]">Edit headline</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Update the scheduled announcement</h2>
                    <p className="mt-3 text-sm leading-7 text-[#EAF6EF]">
                      Refine the message and schedule window here. This popup stays near the top so it feels connected to the admin header.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId("");
                      setEditForm(emptyForm());
                    }}
                    className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <HeadlineForm
                  form={editForm}
                  onChange={setEditForm}
                  onSubmit={updateHeadline}
                  onCancel={() => {
                    setEditingId("");
                    setEditForm(emptyForm());
                  }}
                  submitting={submitting}
                  submitLabel="Update headline"
                />
              </div>
              </section>
            </div>
          </div>
        ) : null}

        {!isAdminReadonlyPortal && deletingItem ? (
          <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#063F32]/45 px-4 pb-8 pt-20 backdrop-blur-sm sm:pt-24">
            <div className="mx-auto w-full max-w-2xl">
              <section className="overflow-hidden rounded-[2rem] border border-rose-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_32px_90px_-38px_rgba(13,59,46,0.24)]">
              <div className="bg-[linear-gradient(135deg,rgba(127,29,29,0.98),rgba(185,28,28,0.95),rgba(254,226,226,0.92))] px-6 py-6 text-white sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-100">Delete headline</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Remove this dashboard headline?</h2>
                    <p className="mt-3 text-sm leading-7 text-rose-50/90">
                      This action will permanently remove the scheduled announcement from student, teacher, and parent dashboards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeletingItem(null)}
                    className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6 sm:p-8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)]">
                <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#245C4F]">Headline preview</p>
                  <p className="mt-3 whitespace-pre-wrap text-base font-medium text-[#063F32]">{deletingItem.headline || "-"}</p>
                  <p className="mt-3 text-sm text-[#245C4F]">
                    {formatDate(deletingItem.start_date)} to {formatDate(deletingItem.end_date)}
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingItem(null)}
                    className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-5 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={submitting}
                    className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <LeafSpinnerInline />
                        Deleting...
                      </span>
                    ) : (
                      "Delete headline"
                    )}
                  </button>
                </div>
              </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
  );
}
