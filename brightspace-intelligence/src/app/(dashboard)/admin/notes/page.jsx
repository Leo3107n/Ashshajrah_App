"use client";

import { usePathname } from "next/navigation";
import NoteThreadsBoard from "@/components/shared/NoteThreadsBoard";

export default function AdminNotesPage() {
  const pathname = usePathname() || "";
  const isSuperAdminPortal = pathname.startsWith("/superadmin");
  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.14),transparent_28%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div id="admin-page-portal-root" className="relative mx-auto max-w-7xl min-h-screen space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
              Notes
            </p>
            <h1 className="mb-3 mt-4 text-3xl font-bold text-white-deep sm:text-4xl lg:text-4xl font-display">
              Teacher notes across the portal
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
              {isSuperAdminPortal
                ? "Review threaded notes, replies, and teacher updates from a single super admin workspace."
                : "Review threaded notes, replies, and teacher updates from a single admin workspace."}
            </p>
          </div>
        </section>

        <NoteThreadsBoard mode="admin" allowReply={!isSuperAdminPortal} portalTargetId="admin-page-portal-root" />
      </div>
    </div>
  );
}
