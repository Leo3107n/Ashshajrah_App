import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const items = await prisma.$queryRaw`
      SELECT
        nbsf.id::text AS id,
        nbsf.registration_id::text AS registration_id,
        nbsf.interested_student_id::text AS interested_student_id,
        nbsf.lead_token,
        nbsf.dependents_count,
        nbsf.school_going_children_count,
        nbsf.residence_type,
        nbsf.requested_amount::float8 AS requested_amount,
        nbsf.scholarship_reason,
        LOWER(
          COALESCE(
            latest_submission.status::text,
            CASE
              WHEN COALESCE(nbsf.voucher_created, FALSE) OR nbsf.voucher_id IS NOT NULL THEN 'voucher_created'
              ELSE nbsf.status::text
            END,
            fv.status::text,
            'submitted'
          )
        ) AS status,
        (COALESCE(nbsf.voucher_created, FALSE) OR nbsf.voucher_id IS NOT NULL) AS voucher_created,
        nbsf.voucher_id::text AS voucher_id,
        (latest_submission.status IS NOT NULL) AS has_fee_submission,
        COALESCE(nbsf.scholarship_amount::float8, 0) AS scholarship_amount,
        nbsf.created_at,
        nbsf.updated_at,
        rl.student_name,
        rl.parent_name,
        rl.class_level,
        rl.email,
        rl.phone,
        LOWER(COALESCE(rl.status::text, 'new_lead')) AS lead_status
      FROM need_based_scholarship_forms nbsf
      INNER JOIN registration_leads rl ON rl.id = nbsf.registration_id
      LEFT JOIN fee_vouchers fv ON fv.id = nbsf.voucher_id
      LEFT JOIN LATERAL (
        SELECT fs.status
        FROM fee_submissions fs
        WHERE fs.voucher_id = nbsf.voucher_id
        ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
        LIMIT 1
      ) latest_submission ON TRUE
      ORDER BY nbsf.created_at DESC NULLS LAST, nbsf.id DESC
    `;

    return json("Need-based scholarship records fetched.", 200, {
      items,
      permissions: {
        reviewOnly: role === "admin",
        canApproveScholarship: role === "superadmin",
      },
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch scholarship records.", 500);
  }
}
