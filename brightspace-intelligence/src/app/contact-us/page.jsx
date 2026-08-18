"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const initialForm = {
  studentName: "",
  parentName: "",
  email: "",
  phone: "",
};

const initialErrors = {
  studentName: "",
  parentName: "",
  email: "",
  phone: "",
  form: "",
};

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ContactUsPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState(initialErrors);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    const nextErrors = { ...initialErrors };
    if (!form.studentName.trim()) nextErrors.studentName = "Student name is required.";
    if (!form.parentName.trim()) nextErrors.parentName = "Parent name is required.";
    if (!form.email.trim()) nextErrors.email = "Email is required.";
    else if (!isValidEmail(form.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required.";
    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate();
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      setSuccessMessage("");
      return;
    }

    setPending(true);
    setErrors(initialErrors);
    setSuccessMessage("");

    try {
      const response = await fetch("/api/public/contact-us", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: form.studentName,
          parent_name: form.parentName,
          email: form.email,
          phone: form.phone,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit contact request.");
      }

      setForm(initialForm);
      setSuccessMessage(data?.message || "Thank you. Our coordinator will contact you soon.");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "Unable to submit contact request.",
      }));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-[#f5f7fb] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.22)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Contact us</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Request LMS admission contact</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Share the student and parent details and our coordinator will contact you soon.</p>

        {errors.form ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.form}</div> : null}
        {successMessage ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}

        <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="studentName">Student Name</label>
            <input id="studentName" value={form.studentName} onChange={(event) => updateField("studentName", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            {errors.studentName ? <p className="mt-2 text-sm text-rose-600">{errors.studentName}</p> : null}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="parentName">Parent Name</label>
            <input id="parentName" value={form.parentName} onChange={(event) => updateField("parentName", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            {errors.parentName ? <p className="mt-2 text-sm text-rose-600">{errors.parentName}</p> : null}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            {errors.email ? <p className="mt-2 text-sm text-rose-600">{errors.email}</p> : null}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="phone">Phone Number</label>
            <input id="phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            {errors.phone ? <p className="mt-2 text-sm text-rose-600">{errors.phone}</p> : null}
          </div>
          <motion.button type="submit" whileTap={{ scale: 0.99 }} disabled={pending} className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
            {pending ? "Submitting..." : "Submit request"}
          </motion.button>
        </form>
      </div>
    </main>
  );
}
