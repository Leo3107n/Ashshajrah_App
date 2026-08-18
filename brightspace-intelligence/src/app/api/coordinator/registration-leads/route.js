import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);
const VALID_STATUSES = new Set([
  "new_lead",
  "voucher_created",
  "fee_submitted",
  "fee_verified",
  "access_granted",
  "rejected",
  "pending_clarification",
]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeSearch(value) {
  return typeof value === "string" ? value.trim() : "";
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
  const status = normalizeSearch(searchParams.get("status")).toLowerCase();
  const search = normalizeSearch(searchParams.get("search"));
  const conditions = [];
  const values = [];

  if (status && VALID_STATUSES.has(status)) {
    values.push(status);
    conditions.push(`LOWER(rl.status::text) = $${values.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    values.push(term);
    conditions.push(`(
        rl.student_name ILIKE $${values.length}
        OR rl.parent_name ILIKE $${values.length}
        OR rl.email ILIKE $${values.length}
        OR rl.phone ILIKE $${values.length}
      )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const leads = await prisma.$queryRawUnsafe(
      `
    SELECT
      rl.id::text AS id,
      rl.student_name,
      rl.parent_name,
      rl.class_level,
      rl.parent_relation,
      rl.age AS student_age,
      rl.date_of_birth,
      COALESCE(rl.program_name, '') AS program_name,
      COALESCE(rl.preferred_starting_month, '') AS preferred_starting_month,
      COALESCE(rl.gender, '') AS gender,
      COALESCE(rl.city, '') AS city,
      COALESCE(rl.country, '') AS country,
      COALESCE(rl.nationality, '') AS nationality,
      COALESCE(rl.religion, '') AS religion,
      COALESCE(rl.interest_reason, '') AS interest_reason,
      COALESCE(rl.child_profile, '') AS child_profile,
      COALESCE(rl.child_strengths, '') AS child_strengths,
      COALESCE(rl.child_support_needs, '') AS child_support_needs,
      COALESCE(rl.child_special_interests, '') AS child_special_interests,
      COALESCE(rl.developmental_concern, false) AS developmental_concern,
      COALESCE(rl.developmental_concern_details, '') AS developmental_concern_details,
      COALESCE(rl.medical_conditions, '') AS medical_conditions,
      COALESCE(rl.support_person_during_learning, '') AS support_person_during_learning,
      COALESCE(rl.device_available, '') AS device_available,
      COALESCE(rl.declaration_accepted, false) AS declaration_accepted,
      rl.created_at AS submitted_at,
      COALESCE(rl.source::text, 'website_registration') AS source,
      rl.email,
      rl.phone,
      LOWER(rl.status::text) AS status,
      fv.id::text AS voucher_id,
      LOWER(fv.status::text) AS voucher_status,
      CASE
        WHEN rl.status::text = 'new_lead' AND fv.id IS NULL THEN true
        ELSE false
      END AS can_create_voucher
    FROM registration_leads rl
    LEFT JOIN LATERAL (
      SELECT
        fv_inner.id,
        fv_inner.status
      FROM fee_vouchers fv_inner
      WHERE fv_inner.registration_id = rl.id
      ORDER BY fv_inner.created_at DESC NULLS LAST, fv_inner.id DESC
      LIMIT 1
    ) fv ON true
    ${whereClause}
    ORDER BY rl.created_at DESC NULLS LAST, rl.id DESC
      `,
      ...values
    );

    return json("Registration records fetched.", 200, {
      items: leads,
      permissions: {
        reviewOnly: role === "admin",
        canFinalizeAdmission: role === "superadmin",
        canCreateAccounts: role === "superadmin",
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch registration records.",
      500
    );
  }
}
