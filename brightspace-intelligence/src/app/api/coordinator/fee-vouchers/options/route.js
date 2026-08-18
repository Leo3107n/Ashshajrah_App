import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json("Forbidden.", 403);
  }

  try {
    const [discounts, feeSettings, otherFees, regularFees, paymentMethods] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          id::text AS id,
          label,
          percent::float8 AS percent,
          LOWER(status::text) AS status
        FROM discounts
        WHERE LOWER(status::text) = 'active'
        ORDER BY percent ASC
      `,
      prisma.$queryRaw`
        SELECT
          key,
          COALESCE(label, name) AS label,
          COALESCE(value::text, '') AS value
        FROM fee_settings
        WHERE key IN (
          'coordinator_max_discount_percent',
          'payment_support_email',
          'payment_support_phone',
          'default_voucher_due_days'
        )
      `,
      prisma.$queryRaw`
        SELECT
          ofe.id::text AS id,
          COALESCE(NULLIF(TRIM(ofe.title), ''), NULLIF(TRIM(ofe.name), ''), 'Other Fee') AS title,
          COALESCE(NULLIF(TRIM(ofe.name), ''), NULLIF(TRIM(ofe.title), ''), 'Other Fee') AS name,
          ofe.fee_type,
          ofe.class_level,
          ofe.amount::text AS amount,
          ofe.status
        FROM other_fee ofe
        WHERE ofe.status = 'active'
        ORDER BY ofe.title ASC, ofe.id DESC
      `,
      prisma.$queryRaw`
        SELECT
          rf.id::text AS id,
          rf.class_level,
          COALESCE(NULLIF(TRIM(rf.name), ''), 'Regular Fee') AS name,
          COALESCE(NULLIF(TRIM(rf.name), ''), 'Regular Fee') AS title,
          rf.amount::text AS amount,
          rf.status
        FROM regular_fee rf
        WHERE rf.status = 'active'
        ORDER BY rf.class_level ASC, rf.id DESC
      `,
      prisma.$queryRaw`
        SELECT
          pm.id::text AS id,
          pm.name,
          pm.name AS title,
          pm.method_key,
          pm.account_title,
          pm.account_number,
          pm.iban,
          pm.bank_name,
          pm.branch_code,
          pm.instructions,
          pm.status
        FROM payment_methods pm
        WHERE pm.status = 'active'
        ORDER BY pm.name ASC, pm.id DESC
      `,
    ]);

    return json("Voucher options fetched.", 200, {
      discounts,
      coordinatorMaxDiscountPercent:
        Number(feeSettings.find((item) => item.key === "coordinator_max_discount_percent")?.value || 20),
      feeSettings: feeSettings.reduce((accumulator, item) => {
        accumulator[item.key] = item;
        return accumulator;
      }, {}),
      otherFees,
      regularFees,
      paymentMethods,
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch voucher options.",
      500
    );
  }
}
