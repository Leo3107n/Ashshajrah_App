import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSignedPaymentProofUrl } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

// DB status enum se complete sync: 'pending' mapping strictly managed
const FILTER_TO_DB_STATUS = {
  pending: "pending",
  verified: "verified",
  rejected: "rejected",
};

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function addSignedUrls(items) {
  return Promise.all(
    items.map(async (item) => {
      let proofFileUrl = item.stored_proof_file_url || "";
      if (item.proof_file_path) {
        try {
          proofFileUrl = await createSignedPaymentProofUrl(item.proof_file_path);
        } catch {
          // Local development may not have Supabase storage credentials.
          // Keep the payment visible and use the stored URL when available.
        }
      }
      const { stored_proof_file_url: _storedProofFileUrl, ...rest } = item;
      return { ...rest, proof_file_url: proofFileUrl };
    })
  );
}

export async function GET(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json("Forbidden.", 403);
  }

  const { searchParams } = new URL(request.url);
  const filter = normalizeText(searchParams.get("status")).toLowerCase();
  const dbStatus = FILTER_TO_DB_STATUS[filter] || "";
  const whereClause = filter === "monthly"
    ? `WHERE fv.registration_id IS NULL AND fs.id IS NOT NULL`
    : dbStatus
      ? `WHERE fs."status"::text = $1`
      : "";
  const values = dbStatus ? [dbStatus] : [];

  try {
    // 🟢 FIXED: Safe enum casting and exact string mapping
    const [pendingRow, verifiedRow, rejectedRow, monthlyRow, items] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'verified'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'rejected'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_vouchers WHERE registration_id IS NULL`,
      prisma.$queryRawUnsafe(
        `
        SELECT
          fs.id::text AS id,
          fs.payer_name,
          fs.transaction_id,
          fs.paid_amount,
          fs.paid_at,
          fs.proof_file_path,
          fs.proof_file_url AS stored_proof_file_url,
          fs."status"::text AS status,
          fv.id::text AS fee_voucher_id,
          fv.voucher_no,
          fv.amount AS voucher_amount,
          fv.status::text AS voucher_status,
          CASE WHEN fv.registration_id IS NULL THEN true ELSE false END AS is_monthly_voucher,
          rl.id::text AS registration_lead_id,
          CASE
            WHEN fv.registration_id IS NULL THEN COALESCE(su.full_name, '')
            ELSE COALESCE(rl.student_name, item.student_name, '')
          END AS student_name,
          COALESCE(rl.parent_name, item.parent_name) AS parent_name,
          COALESCE(rl.email, item.parent_email, item.student_email) AS email,
          COALESCE(rl.phone, item.parent_phone, item.student_phone) AS phone,
          c.title AS class_title,
          b.id::text AS batch_id
        FROM fee_submissions fs
        INNER JOIN fee_vouchers fv ON fv.id = fs.voucher_id
        LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
        LEFT JOIN regular_monthly_fee_voucher_items item ON item.voucher_id = fv.id
        LEFT JOIN student_profiles sp ON sp.id = item.student_id
        LEFT JOIN users su ON su.id = sp.user_id
        LEFT JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
        LEFT JOIN courses c ON c.id = b.class_id
        ${whereClause}
        ORDER BY fs.paid_at DESC NULLS LAST, fs.id DESC
        `,
        ...values
      ),
    ]);

    return json("Coordinator payments fetched.", 200, {
      counts: {
        pending: Number(pendingRow?.[0]?.total || 0),
        verified: Number(verifiedRow?.[0]?.total || 0),
        rejected: Number(rejectedRow?.[0]?.total || 0),
        monthly: Number(monthlyRow?.[0]?.total || 0),
      },
      items: await addSignedUrls(items),
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch payment submissions.",
      500
    );
  }
}
