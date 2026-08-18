"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import ClientPortal from "@/components/shared/ClientPortal";

const EMPTY_FORM = {
  id: "",
  full_name: "",
  email: "",
  phone: "",
  age: "",
  admission_no: "",
  grade_level: "",
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

export default function StudentTable({ items = [], onRefresh, classOptions = [] }) {
  const [editingItem, setEditingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const liveClassOptions = Array.isArray(classOptions)
    ? classOptions
        .map((level) => String(level || "").trim())
        .filter(Boolean)
        .filter((level, index, array) => array.findIndex((item) => item.toLowerCase() === level.toLowerCase()) === index)
    : [];

  function buildFormState(item) {
    const email =
      item.contact_email ||
      item.student_email ||
      item.email ||
      item.user_email ||
      item.studentUserEmail ||
      "";
    const phone =
      item.contact_phone ||
      item.student_phone ||
      item.phone ||
      item.user_phone ||
      item.studentUserPhone ||
      "";

    return {
      id: item.id || "",
      full_name: item.full_name || "",
      email,
      phone,
      age: item.age ?? "",
      admission_no: item.admission_no || "",
      grade_level: item.class_level || item.grade_level || "",
      status: item.status || "active",
    };
  }

  function openEdit(item) {
    setEditingItem(item);
    setForm(buildFormState(item));
    setFormError("");
  }

  function closeEdit() {
    if (saving) return;
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function closeSelectState() {
    setClassOpen(false);
    setStatusOpen(false);
  }

  async function submitEdit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/coordinator/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update student.");
      setEditingItem(null);
      setForm(EMPTY_FORM);
      setFormError("");
      onRefresh?.();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update student.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveStudent(item) {
    setDeleteItem(item);
  }

  async function confirmArchive() {
    if (!deleteItem) return;
    const item = deleteItem;
    const response = await fetch(`/api/coordinator/students?id=${item.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to archive student.");
    setDeleteItem(null);
    onRefresh?.();
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="hidden grid-cols-[0.9fr_1.4fr_1fr_1fr_1fr_220px] gap-4 border-b border-[#F1EADC] bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48] lg:grid">
        <span>Registration No</span>
        <span>Student</span>
        <span>Class</span>
        <span>Parent</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-[#F1EADC]">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[0.9fr_1.4fr_1fr_1fr_1fr_220px] lg:items-center lg:gap-4">
              <p className="text-sm font-semibold text-[#063F32]">{item.admission_no || "-"}</p>
              <div>
                <p className="font-semibold text-[#063F32]">{item.full_name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48] lg:hidden">
                  Registration No: {item.admission_no || "-"}
                </p>
                {item.email || item.student_email || item.user_email || item.phone || item.student_phone ? (
                  <p className="mt-1 text-sm text-[#245C4F]">
                    {item.email || item.student_email || item.user_email || item.phone || item.student_phone}
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-[#245C4F]">{item.grade_level || item.course_title || "-"}</p>
              <div className="text-sm text-[#245C4F]">
                <p>{item.parent_name || "-"}</p>
                <p className="mt-1 text-xs text-[#245C4F]/80">{item.parent_relation || item.parent_phone || item.parent_email || ""}</p>
              </div>
              <p className="text-sm font-medium text-[#245C4F]">{item.status}</p>
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
                <button type="button" onClick={() => archiveStudent(item)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-10 text-sm text-[#245C4F]">No student records available.</div>
        )}
      </div>

      {detailItem ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-[2rem] border border-[#2D8A6A]/20 bg-[#FAF7F0] shadow-[0_30px_90px_-40px_rgba(6,63,50,0.24)]">
            <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#063F32]">Student Details</h2>
                <p className="mt-1 text-sm text-[#245C4F]">Full linked student and admission information.</p>
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
                  <h3 className="text-lg font-semibold text-[#063F32]">Student profile</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <DetailRow label="Student name" value={detailItem.full_name} />
                    <DetailRow label="Admission number" value={detailItem.admission_no} />
                    <DetailRow label="Email" value={detailItem.email || detailItem.student_email} />
                    <DetailRow label="Phone" value={detailItem.phone || detailItem.student_phone} />
                    <DetailRow label="Age" value={detailItem.age ? String(detailItem.age) : ""} />
                    <DetailRow label="Class" value={detailItem.grade_level || detailItem.class_level} />
                    <DetailRow label="Course" value={detailItem.course_title} />
                    <DetailRow label="Status" value={detailItem.status} />
                    <DetailRow label="Created" value={formatDate(detailItem.created_at)} />
                  </dl>
                </section>

                <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-40px_rgba(13,59,46,0.12)]">
                  <h3 className="text-lg font-semibold text-[#063F32]">Parent link</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2 break-words">
                    <DetailRow label="Parent name" value={detailItem.parent_name} />
                    <DetailRow label="Relation" value={detailItem.parent_relation} />
                    <DetailRow label="Parent phone" value={detailItem.parent_phone} />
                    <DetailRow label="Parent email" value={detailItem.parent_email} />
                  </dl>
                </section>

                <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-40px_rgba(13,59,46,0.12)] lg:col-span-2">
                  <h3 className="text-lg font-semibold text-[#063F32]">Admission record snapshot</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailRow label="Lead student name" value={detailItem.lead_student_name} />
                    <DetailRow label="Programme" value={detailItem.program_name} />
                    <DetailRow label="Date of birth" value={formatDate(detailItem.date_of_birth)} />
                    <DetailRow label="Gender" value={detailItem.gender} />
                    <DetailRow label="City" value={detailItem.city} />
                    <DetailRow label="Nationality" value={detailItem.nationality} />
                    <DetailRow label="Admission email" value={detailItem.lead_email} />
                    <DetailRow label="Admission phone" value={detailItem.lead_phone} />
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
                <h2 className="text-xl font-semibold text-[#063F32]">Edit Student</h2>
                <p className="mt-1 text-sm text-[#245C4F]">Update student information in the coordinator portal.</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            {formError ? (
              <div className="mx-6 mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-[0_14px_30px_-24px_rgba(225,29,72,0.25)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">Update blocked</p>
                    <p className="mt-1 font-medium">{formError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormError("")}
                    className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}

            <form onSubmit={submitEdit} className="px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Student Name</span>
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Email</span>
                  <input
                    value={form.email}
                    onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Age</span>
                  <input
                    value={form.age}
                    onChange={(e) => setForm((current) => ({ ...current, age: e.target.value }))}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Class</span>
                  <div className="relative">
                    <select
                      value={form.grade_level}
                      onChange={(e) => setForm((current) => ({ ...current, grade_level: e.target.value }))}
                      onMouseDown={() => setClassOpen((current) => !current)}
                      onFocus={() => setClassOpen(true)}
                      onBlur={closeSelectState}
                      className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    >
                      <option value="" disabled>
                        Select class
                      </option>
                      {liveClassOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${classOpen ? "rotate-180" : "rotate-0"}`}
                    />
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#245C4F]">Status</span>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}
                      onMouseDown={() => setStatusOpen((current) => !current)}
                      onFocus={() => setStatusOpen(true)}
                      onBlur={closeSelectState}
                      className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    >
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                      <option value="archived">archived</option>
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${statusOpen ? "rotate-180" : "rotate-0"}`}
                    />
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
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-700">Delete Student</p>
              <h2 className="mt-2 text-xl font-semibold text-[#063F32]">Confirm student removal</h2>
              <p className="mt-1 text-sm text-[#245C4F]">
                This will archive <span className="font-semibold text-[#063F32]">{deleteItem.full_name}</span>.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-3 px-6 py-5">
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmArchive().catch((error) => setFormError(error instanceof Error ? error.message : "Unable to archive student."))}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
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
