import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createSignedPaymentProofUrl } from "@/lib/supabaseStorage";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const items = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount::text AS amount,
        fv.due_date,
        fv.status::text AS status,
        CASE WHEN monthly_item.id IS NULL THEN false ELSE true END AS is_monthly_voucher,
        fs.status::text AS submission_status,
        fs.paid_amount::text AS paid_amount,
        fs.paid_at,
        fs.transaction_id,
        fs.proof_file_path
      FROM fee_vouchers fv
      INNER JOIN student_profiles sp ON (
        sp.id = fv.student_id
        OR sp.id IN (
          SELECT e.student_id
          FROM enrollments e
          WHERE e.registration_id = fv.registration_id
        )
      )
      LEFT JOIN LATERAL (
        SELECT fs.status, fs.paid_amount, fs.paid_at, fs.transaction_id, fs.proof_file_path
        FROM fee_submissions fs
        WHERE fs.voucher_id = fv.id
        ORDER BY fs.created_at DESC
        LIMIT 1
      ) fs ON TRUE
      LEFT JOIN regular_monthly_fee_voucher_items monthly_item ON monthly_item.voucher_id = fv.id
      WHERE sp.user_id = ${session.user.id}::uuid
      ORDER BY fv.created_at DESC
    `;

    const signedItems = await Promise.all(
      items.map(async (item) => ({
        ...item,
        proof_url: item.proof_file_path
          ? await createSignedPaymentProofUrl(item.proof_file_path).catch(() => "")
          : "",
      }))
    );

    return json("Fees fetched.", 200, { items: signedItems });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load fees.", 500);
  }
}
