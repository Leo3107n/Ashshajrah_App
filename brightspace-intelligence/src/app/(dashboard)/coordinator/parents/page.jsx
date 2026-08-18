"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ParentTable from "@/components/coordinator/ParentTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

export default function CoordinatorParentsPage() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    const response = await fetch("/api/coordinator/parents", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load parents.");
    }

    setState({ items: data.items || [], loading: false, error: "" });
  }, []);

  useEffect(() => {
    load().catch((error) =>
      setState({ items: [], loading: false, error: error.message })
    );
  }, [load]);

  const filteredItems = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();

    return state.items.filter((item) => {
      if (!term) return true;
      const name = String(item.full_name || "").toLowerCase();
      const email = String(item.email || item.parent_email || "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [state.items, search]);

  return (
    <div className="min-h-screen space-y-6 bg-[#FAF7F0] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))]" />
        <div className="relative">
          <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
            Coordinator portal
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Family registry</h1>
          <p className="mt-3 text-sm leading-7 text-[#FAF7F0] sm:text-base">
            Manage parent contact records and linked students.
          </p>
        </div>
      </section>

      <div className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#245C4F]">Search parent name or email</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by parent name or email"
            className="w-full rounded-2xl border border-[#2D8A6A]/25 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
          />
        </label>
      </div>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <OpenBookLoader title="Loading parents" subtitle="Fetching family records..." /> : null}
      <ShowMoreSection
        items={filteredItems}
        initialCount={7}
        step={7}
        renderItems={(visibleItems) => <ParentTable items={visibleItems} onRefresh={load} />}
        emptyMessage="No parent records available."
      />
      </div>
    </div>
  );
}
