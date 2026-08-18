import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function fetchProfile(session) {
  const [profile] = await prisma.$queryRaw`
    SELECT
      u.id::text AS user_id,
      u.full_name,
      u.email,
      u.phone,
      u.status::text AS status,
      pp.id::text AS parent_profile_id,
      pp.created_at,
      CASE
        WHEN LOWER(COALESCE(pp.relation, '')) IN ('', 'parent')
          THEN COALESCE(NULLIF(latest_child_relation.parent_relation, ''), COALESCE(pp.relation, ''))
        ELSE COALESCE(pp.relation, '')
      END AS relation,
      COALESCE(child_summary.student_names, '') AS child_names,
      COALESCE(child_summary.student_classes, '') AS child_classes,
      COALESCE(child_summary.student_emails, '') AS child_emails,
      COALESCE(child_summary.student_phones, '') AS child_phones,
      COALESCE(child_summary.student_ages, '') AS child_ages,
      COALESCE(child_summary.student_statuses, '') AS child_statuses,
      COALESCE(child_summary.student_genders, '') AS child_genders,
      COALESCE(child_summary.student_birth_dates, '') AS child_birth_dates,
      COALESCE(child_summary.student_programs, '') AS child_programs
    FROM users u
    LEFT JOIN parent_profiles pp ON pp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        STRING_AGG(su.full_name, ', ' ORDER BY su.full_name) AS student_names,
        STRING_AGG(COALESCE(sp.grade_level, rl.class_level, ''), ', ' ORDER BY su.full_name) AS student_classes,
        STRING_AGG(COALESCE(su.email, ''), ', ' ORDER BY su.full_name) AS student_emails,
        STRING_AGG(COALESCE(su.phone, ''), ', ' ORDER BY su.full_name) AS student_phones,
        STRING_AGG(COALESCE(sp.age::text, ''), ', ' ORDER BY su.full_name) AS student_ages,
        STRING_AGG(COALESCE(sp.status::text, ''), ', ' ORDER BY su.full_name) AS student_statuses,
        STRING_AGG(COALESCE(rl.gender, ''), ', ' ORDER BY su.full_name) AS student_genders,
        STRING_AGG(COALESCE(rl.date_of_birth::text, ''), ', ' ORDER BY su.full_name) AS student_birth_dates,
        STRING_AGG(COALESCE(rl.program_name, ''), ', ' ORDER BY su.full_name) AS student_programs
      FROM student_parents spp
      INNER JOIN student_profiles sp ON sp.id = spp.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN enrollments e ON e.student_id = spp.student_id
      INNER JOIN registration_leads rl ON rl.id = e.registration_id
      WHERE spp.parent_id = pp.id
    ) child_summary ON TRUE
    LEFT JOIN LATERAL (
      SELECT rl.parent_relation
      FROM student_parents spp_latest
      INNER JOIN student_profiles sp_latest ON sp_latest.id = spp_latest.student_id
      INNER JOIN enrollments e_latest ON e_latest.student_id = spp_latest.student_id
      INNER JOIN registration_leads rl ON rl.id = e_latest.registration_id
      WHERE spp_latest.parent_id = pp.id
      ORDER BY e_latest.updated_at DESC NULLS LAST, e_latest.created_at DESC NULLS LAST, rl.created_at DESC NULLS LAST
      LIMIT 1
    ) latest_child_relation ON TRUE
    WHERE u.id = ${session.user.id}::uuid
    LIMIT 1
  `;

  return profile || null;
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const profile = await fetchProfile(session);
    return json("Profile fetched.", 200, { profile });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load profile.", 500);
  }
}

export async function PATCH(request) {
  try {
    await request.json().catch(() => null);
    await requireRole(ALLOWED_ROLES);
    return json("Parent profile editing is not available.", 403);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update profile.", 500);
  }
}
