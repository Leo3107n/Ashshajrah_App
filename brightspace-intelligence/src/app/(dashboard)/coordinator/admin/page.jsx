"use client";

import { useEffect, useState } from "react";
import InterestedStudentsPageShell from "@/components/coordinator/InterestedStudentsPageShell";
import ParentInterviewFormsPanel from "@/components/admin/ParentInterviewFormsPanel";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

export default function CoordinatorAdminPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [interestedStudentItems, setInterestedStudentItems] = useState([]);
  const [parentInterviewItems, setParentInterviewItems] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadPageData() {
      try {
        const [interestedStudentsResponse, parentInterviewResponse] = await Promise.all([
          fetch("/api/coordinator/interested-students", { cache: "no-store" }),
          fetch("/api/coordinator/parent-interview-forms", { cache: "no-store" }),
        ]);

        const [interestedStudentsData, parentInterviewData] = await Promise.all([
          interestedStudentsResponse.json().catch(() => ({})),
          parentInterviewResponse.json().catch(() => ({})),
        ]);

        if (!active) return;

        setInterestedStudentItems(Array.isArray(interestedStudentsData?.items) ? interestedStudentsData.items : []);
        setParentInterviewItems(Array.isArray(parentInterviewData?.items) ? parentInterviewData.items : []);
      } catch {
        if (!active) return;
        setInterestedStudentItems([]);
        setParentInterviewItems([]);
      } finally {
        if (active) setPageLoading(false);
      }
    }

    void loadPageData();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div id="admin-page-portal-root" className="relative min-h-screen bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        {pageLoading ? (
          <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
            <OpenBookLoader title="Loading admin records" subtitle="Fetching interested students and parent interview forms..." />
          </section>
        ) : (
          <>
            <InterestedStudentsPageShell
              portalLabel="Coordinator portal"
              title="New interested records of students"
              description="Review interested student submissions and generate registration links."
              insidePageLayout={true}
              initialItems={interestedStudentItems}
              showDetailsButton={true}
              showActionsColumn={false}
              allowSendFormAction={false}
              allowParentFormSentColumn={true}
              allowDetailsAction={true}
              hideDeleteAction={true}
              readOnlyMode={false}
              showTableControls={true}
              portalTargetId="admin-page-portal-root"
            />
            <section className="overflow-visible rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
              <div className="border-b border-[#2D8A6A]/10 px-6 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">
                  Parent Interview Forms
                </p>
              </div>
              <div className="px-6 py-5">
                <ParentInterviewFormsPanel
                  apiUrl="/api/coordinator/parent-interview-forms"
                  initialItems={parentInterviewItems}
                  portalTargetId="admin-page-portal-root"
                />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
