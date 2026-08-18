import ParentInterviewFormsPanel from "@/components/admin/ParentInterviewFormsPanel";
import ParentInterviewFormsHeader from "@/components/coordinator/ParentInterviewFormsHeader";

export default function SuperAdminParentInterviewFormsPage() {
  const previewPassword = process.env.PARENT_INTERVIEW_PREVIEW_PASSWORD || "";
  const previewUrl = `https://ashshajrah.com/parent-interview-preview${previewPassword ? `?password=${encodeURIComponent(previewPassword)}` : ""}`;

  return (
    <div id="admin-page-portal-root" className="relative min-h-screen space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <ParentInterviewFormsHeader previewPassword={previewPassword} previewUrl={previewUrl} />
        </section>

        <ParentInterviewFormsPanel />
      </div>
    </div>
  );
}
