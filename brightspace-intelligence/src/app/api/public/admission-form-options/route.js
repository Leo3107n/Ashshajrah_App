import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const [discounts, paymentMethods, regularFees, admissionFees, classLevels, feeSettings] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          id::text AS id,
          label,
          percent::float8 AS percent,
          LOWER(status::text) AS status
        FROM discounts
        WHERE LOWER(status::text) = 'active'
          AND percent <= 20
        ORDER BY percent ASC
      `,
      prisma.$queryRaw`
        SELECT
          id::text AS id,
          name,
          method_key,
          bank_name,
          account_title,
          account_number,
          iban,
          branch_code,
          instructions
        FROM payment_methods
        WHERE LOWER(status::text) = 'active'
        ORDER BY name ASC
      `,
      prisma.$queryRaw`
        SELECT
          id::text AS id,
          class_level,
          COALESCE(NULLIF(TRIM(name), ''), 'Regular Fee') AS name,
          amount::float8 AS amount
        FROM regular_fee
        WHERE LOWER(status::text) = 'active'
        ORDER BY class_level ASC, name ASC
      `,
      prisma.$queryRaw`
        SELECT
          id::text AS id,
          title,
          name,
          fee_type,
          class_level,
          amount::float8 AS amount
        FROM other_fee
        WHERE LOWER(status::text) = 'active'
          AND LOWER(fee_type::text) = 'admission_fee'
        ORDER BY title ASC, id DESC
      `,
      prisma.$queryRaw`
        SELECT
          id::text AS id,
          COALESCE(NULLIF(TRIM(class_level), ''), NULLIF(TRIM(title), ''), '') AS class_level,
          COALESCE(NULLIF(TRIM(title), ''), NULLIF(TRIM(class_level), ''), 'Class') AS title
        FROM courses
        WHERE LOWER(status::text) = 'active'
          AND COALESCE(NULLIF(TRIM(class_level), ''), NULLIF(TRIM(title), '')) IS NOT NULL
        ORDER BY COALESCE(NULLIF(TRIM(class_level), ''), NULLIF(TRIM(title), '')) ASC
      `,
      prisma.$queryRaw`
        SELECT
          key,
          COALESCE(value, '') AS value
        FROM fee_settings
        WHERE key = 'coordinator_max_discount_percent'
        LIMIT 1
      `,
    ]);

    return json("Admission form options fetched.", 200, {
      discounts,
      paymentMethods,
      regularFees,
      admissionFees,
      classLevels,
      coordinatorMaxDiscountPercent: Number(feeSettings?.[0]?.value || 20),
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch admission form options.", 500);
  }
}
