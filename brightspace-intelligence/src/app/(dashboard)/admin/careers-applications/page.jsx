"use client";

import { usePathname } from "next/navigation";
import CareerApplicationsPanel from "@/components/admin/CareerApplicationsPanel";

export default function AdminCareersApplicationsPage() {
  const pathname = usePathname() || "";
  const isSuperAdminPortal = pathname.startsWith("/superadmin");

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))]" />
          <div className="relative">
            <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
              {isSuperAdminPortal ? "Super Admin portal" : "Admin portal"}
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">
              Careers applications
            </h1>
            <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
              Review job applications, open submitted resumes, and download application files from one place.
            </p>
          </div>
        </section>

        <CareerApplicationsPanel />
      </div>
    </div>
  );
}
