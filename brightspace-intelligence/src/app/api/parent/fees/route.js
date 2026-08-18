import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createSignedPaymentProofUrl } from "@/lib/supabaseStorage";
import { buildParentStudentScope, getScopedParentChildren } from "@/lib/parentScope";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const childId = String(searchParams.get("childId") || "").trim();
    const scope = buildParentStudentScope(session, childId);

    const items = await prisma.$queryRawUnsafe(
      `
      WITH child_vouchers AS (
        SELECT
          fv.id,
          fv.voucher_no,
          fv.amount,
          fv.due_date,
          fv.payment_method,
          fv.status,
          fv.created_at,
          su.full_name AS student_name,
          false AS is_monthly_voucher
        FROM student_profiles sp
        INNER JOIN users su ON su.id = sp.user_id
        ${scope.joins}
        INNER JOIN fee_vouchers fv ON fv.student_id = sp.id
        ${scope.where}

        UNION ALL

        SELECT
          fv.id,
          fv.voucher_no,
          fv.amount,
          fv.due_date,
          fv.payment_method,
          fv.status,
          fv.created_at,
          su.full_name AS student_name,
          true AS is_monthly_voucher
        FROM student_profiles sp
        INNER JOIN users su ON su.id = sp.user_id
        ${scope.joins}
        INNER JOIN regular_monthly_fee_voucher_items item ON item.student_id = sp.id
        INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
        ${scope.where}
      )
      SELECT
        cv.id::text AS id,
        cv.voucher_no,
        cv.amount::text AS amount,
        cv.due_date,
        cv.payment_method::text AS payment_method,
        cv.status::text AS voucher_status,
        cv.is_monthly_voucher,
        fs.status::text AS submission_status,
        fs.transaction_id,
        fs.paid_amount::text AS paid_amount,
        fs.paid_at,
        fs.proof_file_path,
        cv.student_name
      FROM child_vouchers cv
      LEFT JOIN LATERAL (
        SELECT fs.status, fs.transaction_id, fs.paid_amount, fs.paid_at, fs.proof_file_path
        FROM fee_submissions fs
        WHERE fs.voucher_id = cv.id
        ORDER BY fs.created_at DESC
        LIMIT 1
      ) fs ON TRUE
      ORDER BY cv.created_at DESC NULLS LAST, cv.id DESC
      `,
      ...scope.values
    );

    const signedItems = await Promise.all(
      items.map(async (item) => ({
        ...item,
        proof_url: item.proof_file_path
          ? await createSignedPaymentProofUrl(item.proof_file_path).catch(() => "")
          : "",
      }))
    );

    const children = await getScopedParentChildren(session);

    return json("Fees fetched.", 200, { items: signedItems, children });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load fees.", 500);
  }
}
