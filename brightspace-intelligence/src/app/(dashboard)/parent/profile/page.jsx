"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function formatCityCountry(city, country) {
  return [city, country].filter(Boolean).join(", ");
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_16px_50px_-34px_rgba(13,59,46,0.16)] backdrop-blur-xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#063F32]">{value || "Not provided"}</p>
    </div>
  );
}

export default function ParentProfilePage() {
  const [state, setState] = useState({ profile: null, children: [], selectedChildId: "", error: "" });

  async function load() {
    const [profileResponse, childrenResponse] = await Promise.all([
      fetch("/api/parent/profile", { cache: "no-store" }),
      fetch("/api/parent/children", { cache: "no-store" }),
    ]);
    const profileData = await profileResponse.json();
    const childrenData = await childrenResponse.json();
    if (!profileResponse.ok || !childrenResponse.ok) throw new Error(profileData?.message || childrenData?.message || "Unable to load profile.");
    setState({
      profile: profileData.profile || null,
      children: childrenData.children || [],
      selectedChildId: "",
      error: "",
    });
  }

  useEffect(() => {
    async function initialize() {
      try {
        await load();
      } catch (error) {
        setState((current) => ({ ...current, error: error.message }));
      }
    }

    initialize();
  }, []);

  const profile = state.profile || {};
  const selectedChild = state.children.find((child) => String(child.id) === String(state.selectedChildId)) || null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 overflow-hidden rounded-[2rem] px-4 py-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
        <div className="relative max-w-6xl">
          <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
            Parent profile
          </p>
          <h1 className="mb-3 mt-4 text-2xl font-bold text-[#FAF7F0] sm:text-4xl lg:text-4xl font-display">
            Parent profile details
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[#F1EADC]/90 sm:text-base">
            View the parent account and linked child details from a single profile summary.
          </p>
        </div>
      </section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Full name" value={profile.full_name} />
          <DetailRow label="Email" value={profile.email} />
          <DetailRow label="Phone" value={profile.phone} />
          <DetailRow label="Relation" value={profile.relation} />
          <DetailRow label="Status" value={profile.status} />
          <DetailRow label="Children" value={profile.child_names} />
        </div>
      <ChildSwitcher
        childrenList={state.children}
        value={state.selectedChildId}
        onChange={(id) => setState((current) => ({ ...current, selectedChildId: id }))}
      />
      {!selectedChild ? (
        <div className="rounded-[2rem] border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-8 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]">
          Please select a child first.
        </div>
      ) : (
        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Full name" value={selectedChild.full_name} />
            <DetailRow label="Username" value={selectedChild.username} />
            <DetailRow label="Email" value={selectedChild.email} />
            <DetailRow label="Phone" value={selectedChild.phone} />
            <DetailRow label="Class" value={selectedChild.grade_level} />
            <DetailRow label="Status" value={selectedChild.status} />
            <DetailRow label="Age" value={selectedChild.age ? String(selectedChild.age) : ""} />
            <DetailRow label="Lead relation" value={selectedChild.parent_relation} />
            <DetailRow label="Programme" value={selectedChild.program_name} />
            <DetailRow label="Gender" value={selectedChild.gender} />
            <DetailRow label="Date of birth" value={formatDate(selectedChild.date_of_birth)} />
            <DetailRow label="City / country" value={formatCityCountry(selectedChild.city, selectedChild.country)} />
            <DetailRow label="Nationality" value={selectedChild.nationality} />
            <DetailRow label="Religion" value={selectedChild.religion} />
            <DetailRow label="Support person" value={selectedChild.support_person_during_learning} />
            <DetailRow label="Device available" value={selectedChild.device_available} />
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
