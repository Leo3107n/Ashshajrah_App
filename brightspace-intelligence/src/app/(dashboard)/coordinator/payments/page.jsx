import { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import PaymentVerificationTable from "@/components/coordinator/PaymentVerificationTable";
import ShowMoreSectionServer from "@/components/coordinator/ShowMoreSectionServer";
import { auth, roleToDashboard } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSignedPaymentProofUrl } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

const FILTER_TO_DB_STATUS = {
  pending: "pending",
  verified: "verified",
  rejected: "rejected",
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function buildProofPreviewUrl(proofFilePath, proofFileUrl) {
  if (proofFileUrl) {
    return proofFileUrl;
  }

  const supabaseUrl = normalizeText(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const normalizedPath = normalizeText(proofFilePath);

  if (!supabaseUrl || !normalizedPath) {
    return "";
  }

  const objectPath = normalizedPath.replace(/^payment_proofs\//, "");
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/payment_proofs/${objectPath}`;
}

async function getCounts() {
  // 🟢 FIXED: Explicit fallback to lowercase identifier strings with direct native casting
  try {
    const [pendingRows, verifiedRows, rejectedRows] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "fee_submissions" WHERE "status"::text = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "fee_submissions" WHERE "status"::text = 'verified'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "fee_submissions" WHERE "status"::text = 'rejected'`,
    ]);

    return {
      pending: Number(pendingRows?.[0]?.total || 0),
      verified: Number(verifiedRows?.[0]?.total || 0),
      rejected: Number(rejectedRows?.[0]?.total || 0),
    };
  } catch (error) {
    console.error("Count query error fallback triggered:", error);
    return { pending: 0, verified: 0, rejected: 0 };
  }
}

async function getItems(status) {
  const dbStatus = FILTER_TO_DB_STATUS[status] || "";
  const whereClause = dbStatus ? `WHERE fs."status"::text = $1` : "";
  const values = dbStatus ? [dbStatus] : [];

  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT
      fs."id"::text AS id,
      fs."payer_name",
      fs."transaction_id",
      fs."paid_amount",
      fs."paid_at",
      fs."proof_file_path",
      fs."status"::text AS status,
      fv."id"::text AS fee_voucher_id,
      fv."voucher_no",
      fv."amount" AS voucher_amount,
      fv."status"::text AS voucher_status,
      CASE WHEN fv.registration_id IS NULL THEN true ELSE false END AS is_monthly_voucher,
      rl."id"::text AS registration_lead_id,
      CASE
        WHEN fv.registration_id IS NULL THEN COALESCE(su.full_name, '')
        ELSE COALESCE(rl."student_name", item.student_name, '')
      END AS student_name,
      rl."parent_name",
      rl."email",
      rl."phone"
    FROM "fee_submissions" fs
    INNER JOIN "fee_vouchers" fv ON fv."id" = fs."voucher_id"
    LEFT JOIN "registration_leads" rl ON rl."id" = fv."registration_id"
    LEFT JOIN "regular_monthly_fee_voucher_items" item ON item.voucher_id = fv.id
    LEFT JOIN "student_profiles" sp ON sp.id = item.student_id
    LEFT JOIN "users" su ON su.id = sp.user_id
    ${whereClause}
    ORDER BY fs."created_at" DESC NULLS LAST, fs."paid_at" DESC NULLS LAST, fs."id" DESC
    `,
    ...values
  );

  return Promise.all(
    rows.map(async (item) => ({
      ...item,
      is_monthly_voucher: Boolean(item.is_monthly_voucher),
      status: normalizeStatus(item.status),
      // 🟢 FIXED: Convert Decimal object to plain JavaScript Number/String
      paid_amount: item.paid_amount ? Number(item.paid_amount) : 0,
      voucher_amount: item.voucher_amount ? Number(item.voucher_amount) : 0,
      proof_file_url: buildProofPreviewUrl(
        item.proof_file_path,
        item.proof_file_path ? await createSignedPaymentProofUrl(item.proof_file_path) : ""
      ),
    }))
  );
}

function StatusChip({ label, active }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold transition ${active ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32]" : "bg-[#FAF7F0] text-[#245C4F] ring-1 ring-inset ring-[#2D8A6A]/20"}`}>
      {label}
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function CoordinatorPaymentsPage({ searchParams }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user || !ALLOWED_ROLES.has(role)) {
    redirect(session?.user ? roleToDashboard[role] || "/login" : "/login");
  }

  const resolvedParams = await searchParams;
  const status = normalizeStatus(resolvedParams?.status) || "pending";
  const safeStatus = FILTER_TO_DB_STATUS[status] ? status : "pending";
  const page = Number(resolvedParams?.page || 1) || 1;
  const [counts, items] = await Promise.all([getCounts(), getItems(safeStatus)]);

  return (
    <div className="min-h-screen bg-[#FAF7F0] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))]" />
        <div className="relative">
          <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
            Coordinator portal
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Payment verification queue</h1>
          <p className="mt-3 text-sm leading-7 text-[#FAF7F0] sm:text-base">
            Review submitted proof files, approve verified payments, or reject incomplete submissions.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        {[
          ["pending", `Pending (${counts.pending})`],
          ["verified", `Verified (${counts.verified})`],
          ["rejected", `Rejected (${counts.rejected})`],
        ].map(([value, label]) => (
          <Link key={value} href={`/coordinator/payments?status=${value}`}>
            <StatusChip label={label} active={safeStatus === value} />
          </Link>
        ))}
      </div>

      <ShowMoreSectionServer
        items={items}
        page={page}
        pageSize={7}
        renderItems={(visibleItems) => <PaymentVerificationTable items={visibleItems} />}
        emptyMessage="No payment submissions match this filter."
        hrefBase={`/coordinator/payments?status=${safeStatus}`}
      />
      </div>
    </div>
  );
}
