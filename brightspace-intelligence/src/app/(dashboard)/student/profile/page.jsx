"use client";

import { useEffect, useState } from "react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(233,248,241,0.72)_100%)] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-[#063F32]">{value || "Not provided"}</p>
    </div>
  );
}

function formatAgeValue(age, dateOfBirth) {
  const explicitAge = String(age || "").trim();
  if (explicitAge) return explicitAge;
  if (!dateOfBirth) return "";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    years -= 1;
  }
  return years > 0 ? `${years} year${years === 1 ? "" : "s"}` : "";
}

function formatCityCountry(city, country) {
  return [city, country].filter(Boolean).join(", ");
}

export default function StudentProfilePage() {
  const [state, setState] = useState({ profile: null, error: "", loading: true });

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/student/profile", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load profile.");
      setState({ profile: data.profile || null, error: "", loading: false });
    }

    load().catch((error) => setState({ profile: null, error: error.message, loading: false }));
  }, []);

  const profile = state.profile || {};

  return (
    <div className="min-h-screen space-y-6 rounded-[2rem] border-0 bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Student profile details</h1>
        <p className="mt-3 text-sm leading-7 text-[#F1EADC] sm:text-base">
          View your account, enrollment, and admission details in one place.
        </p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <OpenBookLoader title="Loading profile" subtitle="Fetching your account details..." /> : null}

      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Full name" value={profile.full_name} />
          <DetailRow label="Username" value={profile.username} />
          <DetailRow label="Email" value={profile.email} />
          <DetailRow label="Phone" value={profile.phone} />
          <DetailRow label="Admission number" value={profile.admission_no} />
          <DetailRow label="Age" value={formatAgeValue(profile.age, profile.date_of_birth)} />
          <DetailRow label="Class" value={profile.grade_level} />
          <DetailRow label="Status" value={profile.profile_status || profile.user_status} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <h2 className="font-body text-xl font-semibold text-[#063F32]">Admission snapshot</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Father name" value={profile.father_name} />
          <DetailRow label="Father phone" value={profile.father_phone} />
          <DetailRow label="Father email" value={profile.father_email} />
          <DetailRow label="Lead student name" value={profile.lead_student_name} />
          <DetailRow label="Parent relation" value={profile.lead_parent_relation} />
          <DetailRow label="Programme" value={profile.program_name} />
          <DetailRow label="Gender" value={profile.gender} />
          <DetailRow label="Date of birth" value={formatDate(profile.date_of_birth)} />
          <DetailRow label="City / country" value={formatCityCountry(profile.city, profile.country)} />
          <DetailRow label="Nationality" value={profile.nationality} />
          <DetailRow label="Religion" value={profile.religion} />
          <DetailRow label="Support person" value={profile.support_person_during_learning} />
          <DetailRow label="Device available" value={profile.device_available} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <h2 className="font-body text-xl font-semibold text-[#063F32]">Child profile</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <DetailRow label="Profile" value={profile.child_profile} />
          <DetailRow label="Strengths" value={profile.child_strengths} />
          <DetailRow label="Support needs" value={profile.child_support_needs} />
          <DetailRow label="Special interests" value={profile.child_special_interests} />
          <DetailRow label="Development concern" value={profile.developmental_concern ? "Yes" : "No"} />
          <DetailRow label="Concern details" value={profile.developmental_concern_details} />
          <DetailRow label="Medical conditions" value={profile.medical_conditions} />
        </div>
      </section>
      </div>
    </div>
  );
}
