"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";

const ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Coordinator", value: "coordinator" },
  { label: "Teacher", value: "teacher" },
];

const ALL_ROLE_OPTIONS = [
  { label: "Super Admin", value: "superadmin" },
  { label: "Admin", value: "admin" },
  { label: "Coordinator", value: "coordinator" },
  { label: "Teacher", value: "teacher" },
  { label: "Parent", value: "parent" },
  { label: "Student", value: "student" },
];

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
];

const PARENT_RELATION_OPTIONS = [
  { label: "Mother", value: "mother" },
  { label: "Father", value: "father" },
  { label: "Guardian", value: "guardian" },
];

function getInitialState(record) {
  return {
    fullName: record?.name || record?.full_name || "",
    email: record?.email || "",
    phone: record?.phone || "",
    relation: record?.relation || "",
    studentNames: record?.student_names || "",
    admissionNo: record?.admission_no || "",
    gradeLevel: record?.class_level || "",
    age: record?.age || "",
    role: record?.role || "coordinator",
    status: record?.status || "active",
    password: "",
  };
}

export default function StaffFormModal({
  open,
  mode = "create",
  record,
  onClose,
  onSuccess,
  roleOptions = ROLE_OPTIONS,
  createEndpoint = "/api/admin/staff",
  updateEndpoint,
  badgeLabel = "Super Admin staff",
}) {
  const [form, setForm] = useState(getInitialState(record));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [relationOpen, setRelationOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const isParentEdit = mode === "edit" && form.role === "parent";
  const isStudentEdit = mode === "edit" && form.role === "student";

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(getInitialState(record));
    setPending(false);
    setError("");
    setShowPassword(false);
    setRelationOpen(false);
    setRoleOpen(false);
    setStatusOpen(false);
  }, [open, record, mode]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleClose() {
    setShowPassword(false);
    setRelationOpen(false);
    setRoleOpen(false);
    setStatusOpen(false);
    setError("");
    setForm(getInitialState(record));
    onClose?.();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const endpoint =
        mode === "edit" && record?.id
          ? updateEndpoint || (
              form.role === "coordinator" || form.role === "teacher"
                ? `/api/admin/staff/${record.id}`
                : `/api/admin/users/${record.id}`
            )
          : createEndpoint;
      const method = mode === "edit" ? "PATCH" : "POST";
      const payload =
        mode === "edit"
          ? {
              id: record?.id,
              fullName: form.fullName,
              email: form.email,
              phone: form.phone,
              relation: form.relation,
              admissionNo: form.admissionNo,
              gradeLevel: form.gradeLevel,
              age: form.age,
              role: form.role,
              status: form.status,
            }
          : {
              fullName: form.fullName,
              email: form.email,
              phone: form.phone,
              role: form.role,
              password: form.password,
            };

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to save staff record.");
      }

      onSuccess?.(data?.item);
      setShowPassword(false);
      setRelationOpen(false);
      setRoleOpen(false);
      setStatusOpen(false);
      onClose?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save staff record."
      );
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#65B891]/20";
  const selectClass = `${inputClass} pr-12 appearance-none`;
  const selectIconClass = "pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200";

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#063F32]/45 px-4 py-8 pt-24 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.22)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">
                  {badgeLabel}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#063F32]">
                  {mode === "edit" ? "Edit staff member" : "Create staff member"}
                </h2>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                    Full name
                  </span>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    className={inputClass}
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                    Email
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                    Phone
                  </span>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    className={inputClass}
                  />
                </label>

                {isParentEdit ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                      Relation
                    </span>
                    <div className="relative">
                      <select
                        value={form.relation}
                        onChange={(event) => updateField("relation", event.target.value)}
                        className={selectClass}
                        onFocus={() => setRelationOpen(true)}
                        onBlur={() => window.setTimeout(() => setRelationOpen(false), 0)}
                        onMouseDown={() => setRelationOpen((current) => !current)}
                      >
                        <option value="">Select relation</option>
                        {PARENT_RELATION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`${selectIconClass} ${relationOpen ? "rotate-180" : "rotate-0"}`}
                      />
                    </div>
                  </label>
                ) : null}

                {isStudentEdit ? (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                        Admission number
                      </span>
                      <input
                        type="text"
                        value={form.admissionNo}
                        onChange={(event) => updateField("admissionNo", event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                        Class
                      </span>
                      <input
                        type="text"
                        value={form.gradeLevel}
                        onChange={(event) => updateField("gradeLevel", event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                        Age
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={form.age}
                        onChange={(event) => updateField("age", event.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </>
                ) : null}

                {!isParentEdit ? (
              <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                      Role
                    </span>
                    <div className="relative">
                      <select
                        value={form.role}
                        onChange={(event) => updateField("role", event.target.value)}
                        className={selectClass}
                        onFocus={() => setRoleOpen(true)}
                        onBlur={() => window.setTimeout(() => setRoleOpen(false), 0)}
                        onMouseDown={() => setRoleOpen((current) => !current)}
                      >
                        {(mode === "edit" ? ALL_ROLE_OPTIONS : roleOptions).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`${selectIconClass} ${roleOpen ? "rotate-180" : "rotate-0"}`}
                      />
                    </div>
                  </label>
                ) : null}

                {mode === "edit" && !isParentEdit ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                      Status
                    </span>
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={(event) => updateField("status", event.target.value)}
                        className={selectClass}
                        onFocus={() => setStatusOpen(true)}
                        onBlur={() => window.setTimeout(() => setStatusOpen(false), 0)}
                        onMouseDown={() => setStatusOpen((current) => !current)}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`${selectIconClass} ${statusOpen ? "rotate-180" : "rotate-0"}`}
                      />
                    </div>
                  </label>
                ) : mode !== "edit" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                      Password
                    </span>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(event) => updateField("password", event.target.value)}
                        className={`${inputClass} pr-12`}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute inset-y-0 right-0 z-10 flex items-center justify-center px-4 text-[#0D5C48] transition hover:text-[#063F32]"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </label>
                ) : null}
              </div>

              {error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={pending}
                  className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-60"
                >
                  {pending ? "Saving..." : mode === "edit" ? "Save changes" : "Create staff"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
