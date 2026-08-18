"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

function getInitialState(record) {
  return {
    name: record?.name || "",
    description: record?.description || "",
    status: record?.status || "active",
    courseIds: Array.isArray(record?.course_ids)
      ? record.course_ids
      : record?.course_id
        ? [record.course_id]
        : [],
  };
}

export default function SubjectFormModal({
  open,
  record,
  classOptions = [],
  onClose,
  onSuccess,
}) {
  const [form, setForm] = useState(getInitialState(record));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleCourseId(courseId) {
    setForm((current) => {
      const exists = current.courseIds.includes(courseId);
      return {
        ...current,
        courseIds: exists
          ? current.courseIds.filter((item) => item !== courseId)
          : [...current.courseIds, courseId],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const endpoint = record?.id
        ? `/api/admin/subjects/${record.id}`
        : "/api/admin/subjects";
      const method = record?.id ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to save subject.");
      }

      onSuccess?.(data?.item);
      onClose?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save subject."
      );
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#65B891]/20";
  const selectClass = `${inputClass} appearance-none pr-12`;
  const selectIconClass =
    "pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200";

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#063F32]/45 px-4 pb-8 pt-24 backdrop-blur-sm sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.22)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">
                  Subject management
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#063F32]">
                  {record?.id ? "Edit subject" : "Create subject"}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                    Subject name
                  </span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className={inputClass}
                    required
                  />
                </label>

                <div className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                    Available classes
                  </span>
                  <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {classOptions.map((item) => {
                        const checked = form.courseIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                              checked
                                ? "border-[#C9A227]/35 bg-[#FFF5D6] text-[#063F32]"
                                : "border-[#2D8A6A]/15 bg-white text-[#245C4F]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCourseId(item.id)}
                              className="h-4 w-4 rounded border-[#2D8A6A]/30 text-[#0D5C48] focus:ring-[#65B891]"
                            />
                            <span>{item.class_level || item.title}</span>
                          </label>
                        );
                      })}
                    </div>
                    {!classOptions.length ? (
                      <p className="text-sm text-[#245C4F]">No active classes available.</p>
                    ) : null}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                    Status
                  </span>
                  <div className="relative">
                    <select
                      value={form.status}
                      onMouseDown={() => setStatusOpen((current) => !current)}
                      onFocus={() => setStatusOpen(true)}
                      onBlur={() => setTimeout(() => setStatusOpen(false), 0)}
                      onChange={(event) => updateField("status", event.target.value)}
                      className={selectClass}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="archived">Archived</option>
                    </select>
                    <ChevronDown className={`${selectIconClass} ${statusOpen ? "rotate-180" : "rotate-0"}`} />
                  </div>
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                    Description
                  </span>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              {error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
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
                  {pending ? "Saving..." : "Save subject"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
