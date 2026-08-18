import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const ALLOWED_PUBLIC_STATUSES = new Set(["unpaid", "rejected"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(_request, { params }) {
  try {
    const { voucherNo } = await params;
    const [item] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount,
        fv.due_date,
        LOWER(fv.status::text) AS status,
        fv.payment_method,
        fv.payment_instructions,
        COALESCE(su.full_name, rl.student_name, item.student_name, '') AS student_name,
        COALESCE(rl.parent_name, item.parent_name, '') AS parent_name,
        COALESCE(rl.email, item.student_email, item.parent_email, '') AS email,
        COALESCE(rl.phone, item.student_phone, item.parent_phone, '') AS phone,
        COALESCE(rl.class_level, c.class_level, c.title, '') AS class_level
      FROM fee_vouchers fv
      LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
      LEFT JOIN regular_monthly_fee_voucher_items item ON item.voucher_id = fv.id
      LEFT JOIN student_profiles sp ON sp.id = item.student_id
      LEFT JOIN users su ON su.id = sp.user_id
      LEFT JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
      LEFT JOIN courses c ON c.id = b.class_id
      WHERE fv.voucher_no = ${voucherNo}
      LIMIT 1
    `;

    if (!item?.id) {
      return json("Voucher not found.", 404);
    }

    return json("Voucher fetched.", 200, {
      item: {
        ...item,
        canSubmit: ALLOWED_PUBLIC_STATUSES.has(String(item.status || "").toLowerCase()),
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch voucher.",
      500
    );
  }
}
