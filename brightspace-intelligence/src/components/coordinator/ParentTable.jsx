"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import ClientPortal from "@/components/shared/ClientPortal";

const EMPTY_FORM = {
  id: "",
  full_name: "",
  email: "",
  phone: "",
  relation: "parent",
  status: "active",
};

function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function DetailRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-[#245C4F]">{value || "Not provided"}</dd>
    </div>
  );
}

export default function ParentTable({ items = [], onRefresh }) {
  const [editingItem, setEditingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [relationOpen, setRelationOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  function buildFormState(item) {
    return {
      id: item.id || "",
      full_name: item.full_name || "",
      email: item.email || item.parent_email || "",
      phone: item.phone || item.parent_phone || "",
      relation: item.relation || "parent",
      status: item.status || "active",
    };
  }

  async function submitEdit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/coordinator/parents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update parent.");
      setEditingItem(null);
      setForm(EMPTY_FORM);
      onRefresh?.();
    } catch (error) {
      window.alert(error.message || "Unable to update parent.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item) {
    setEditingItem(item);
    setForm(buildFormState(item));
  }

  function closeEdit() {
    if (saving) return;
    setEditingItem(null);
    setForm(EMPTY_FORM);
  }

  async function archiveParent(item) {
    setDeleteItem(item);
  }

  async function confirmArchive() {
    if (!deleteItem) return;
    const response = await fetch(`/api/coordinator/parents?id=${deleteItem.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to archive parent.");
    setDeleteItem(null);
    onRefresh?.();
  }

  function closeSelectState() {
    setRelationOpen(false);
    setStatusOpen(false);
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="hidden grid-cols-[1.4fr_1fr_1.2fr_0.8fr_220px] gap-4 border-b border-[#F1EADC] bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48] lg:grid">
        <span>Parent</span>
        <span>Relation</span>
        <span>Students</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-[#F1EADC]">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1.2fr_0.8fr_220px] lg:items-center lg:gap-4">
              <div>
                <p className="font-semibold text-[#063F32]">{item.full_name}</p>
                <p className="mt-1 text-sm text-[#245C4F]">
                  {item.email || item.phone || "No contact"}
                </p>
              </div>
              <p className="text-sm text-[#245C4F]">{item.relation || "-"}</p>
              <div className="text-sm text-[#245C4F]">
                <p>{item.student_names || "-"}</p>
                <p className="mt-1 text-xs text-[#245C4F]/80">{item.class_levels || item.course_titles || ""}</p>
              </div>
              <p className="text-sm font-medium text-[#245C4F]">{item.status || "-"}</p>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => setDetailItem(item)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Edit
                </button>
                <button type="button" onClick={() => archiveParent(item)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-10 text-sm text-[#245C4F]">No parent records available.</div>
        )}
      </div>

      {detailItem ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-[2rem] border border-[#2D8A6A]/20 bg-[#FAF7F0] shadow-[0_30px_90px_-40px_rgba(6,63,50,0.24)]">
            <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#063F32]">Parent Details</h2>
                <p className="mt-1 text-sm text-[#245C4F]">Full parent details with linked students and admission relation.</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-40px_rgba(13,59,46,0.12)]">
                  <h3 className="text-lg font-semibold text-[#063F32]">Parent profile</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2 break-words">
                    <DetailRow label="Parent name" value={detailItem.full_name} />
                    <DetailRow label="Relation" value={detailItem.relation} />
                    <DetailRow label="Email" value={detailItem.email} />
                    <DetailRow label="Phone" value={detailItem.phone} />
                    <DetailRow label="Status" value={detailItem.status} />
                    <DetailRow label="Created" value={formatDate(detailItem.created_at)} />
                  </dl>
                </section>

                <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-40px_rgba(13,59,46,0.12)]">
                  <h3 className="text-lg font-semibold text-[#063F32]">Linked students</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <DetailRow label="Student names" value={detailItem.student_names} />
                    <DetailRow label="Classes" value={detailItem.class_levels} />
                    <DetailRow label="Courses" value={detailItem.course_titles} />
                    <DetailRow label="Student relations" value={detailItem.student_relations} />
                  </dl>
                </section>

                <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-40px_rgba(13,59,46,0.12)] lg:col-span-2">
                  <h3 className="text-lg font-semibold text-[#063F32]">Admission-linked details</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailRow label="City" value={detailItem.city_country} />
                    <DetailRow label="Preferred contact person" value={detailItem.preferred_contact_person} />
                    <DetailRow label="Father name" value={detailItem.father_name_english} />
                    <DetailRow label="Mother name" value={detailItem.mother_name_english} />
                  </dl>
                </section>
              </div>
            </div>
          </div>
        </div>
        </ClientPortal>
      ) : null}

      {editingItem ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2rem] border border-[#2D8A6A]/20 bg-[#FAF7F0] shadow-[0_30px_90px_-40px_rgba(6,63,50,0.24)]">
            <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#063F32]">Edit Parent</h2>
                <p className="mt-1 text-sm text-[#245C4F]">Update parent information in the coordinator portal.</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitEdit} className="px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Parent Name</span>
                  <input
                    value={form.full_name}
                    onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Relation</span>
                  <div className="relative">
                    <select
                      value={form.relation}
                      onChange={(event) => setForm((current) => ({ ...current, relation: event.target.value }))}
                      onMouseDown={() => setRelationOpen((current) => !current)}
                      onFocus={() => setRelationOpen(true)}
                      onBlur={closeSelectState}
                      className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    >
                      <option value="parent">Parent</option>
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="guardian">Guardian</option>
                    </select>
                    <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${relationOpen ? "rotate-180" : "rotate-0"}`} />
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Email</span>
                  <input
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Status</span>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                      onMouseDown={() => setStatusOpen((current) => !current)}
                      onFocus={() => setStatusOpen(true)}
                      onBlur={closeSelectState}
                      className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    >
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                      <option value="archived">archived</option>
                    </select>
                    <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${statusOpen ? "rotate-180" : "rotate-0"}`} />
                  </div>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#2D8A6A]/10 pt-5">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-5 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-[#0D5C48] px-5 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ClientPortal>
      ) : null}

      {deleteItem ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/20 bg-[#FAF7F0] shadow-[0_30px_90px_-40px_rgba(6,63,50,0.24)]">
            <div className="border-b border-[#2D8A6A]/10 px-6 py-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-700">Delete Parent</p>
              <h2 className="mt-2 text-xl font-semibold text-[#063F32]">Confirm parent removal</h2>
              <p className="mt-1 text-sm text-[#245C4F]">
                This will archive <span className="font-semibold text-[#063F32]">{deleteItem.full_name}</span>.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-3 px-6 py-5">
              <button type="button" onClick={() => setDeleteItem(null)} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">
                Cancel
              </button>
              <button type="button" onClick={() => confirmArchive().catch((error) => window.alert(error.message))} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700">
                Delete
              </button>
            </div>
          </div>
        </div>
        </ClientPortal>
      ) : null}
    </div>
  );
}
