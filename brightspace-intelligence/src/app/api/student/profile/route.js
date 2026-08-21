import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const [profile] = await prisma.$queryRaw`
      SELECT
        u.full_name,
        COALESCE(
          NULLIF(TRIM(u.username), ''),
          NULLIF(REGEXP_REPLACE(COALESCE(u.email, ''), '@students\\.lms$', '', 'i'), ''),
          NULLIF(TRIM(u.email), '')
        ) AS username,
        u.email,
        u.phone,
        u.status::text AS user_status,
        sp.id::text AS student_id,
        sp.admission_no,
        COALESCE(
          NULLIF(TRIM(CAST(sp.age AS text)), ''),
          NULLIF(
            TRIM(
              CAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, rl.date_of_birth)) AS text)
            ),
            ''
          )
        ) AS age,
        sp.grade_level,
        sp.status::text AS profile_status,
        sp.created_at,
        c.title AS course_title,
        pu.full_name AS father_name,
        pu.phone AS father_phone,
        pu.email AS father_email,
        rl.student_name AS lead_student_name,
        rl.parent_name AS lead_parent_name,
        rl.parent_relation AS lead_parent_relation,
        rl.email AS lead_email,
        rl.phone AS lead_phone,
        rl.program_name,
        rl.class_level AS applied_class_level,
        rl.gender,
        rl.date_of_birth,
        rl.address,
        rl.city_country,
        rl.city,
        rl.country,
        rl.nationality,
        rl.religion,
        rl.preferred_starting_month,
        rl.preferred_starting_month_other,
        rl.preferred_contact_person,
        rl.applying_for_other,
        rl.interest_reason,
        rl.hear_about_source,
        rl.hear_about_other,
        rl.child_profile,
        rl.child_strengths,
        rl.child_support_needs,
        rl.child_special_interests,
        rl.developmental_concern,
        rl.developmental_concern_details,
        rl.medical_conditions,
        rl.father_name_english,
        rl.father_cnic,
        rl.father_qualification,
        rl.father_occupation,
        rl.father_mother_tongue,
        rl.father_contact_home,
        rl.father_contact_whatsapp,
        rl.father_emergency_contact,
        rl.father_email AS lead_father_email,
        rl.father_residential_address,
        rl.mother_name_english,
        rl.mother_cnic,
        rl.mother_qualification,
        rl.mother_occupation,
        rl.mother_mother_tongue,
        rl.mother_contact_home,
        rl.mother_contact_whatsapp,
        rl.mother_emergency_contact,
        rl.mother_email,
        rl.mother_residential_address,
        rl.support_person_during_learning,
        rl.device_available,
        rl.declaration_accepted
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND e.status = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE sp.user_id = ${session.user.id}::uuid
      LIMIT 1
    `;
    return json("Profile fetched.", 200, { profile });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load profile.", 500);
  }
}

export async function PATCH(request) {
  try {
    await request.json().catch(() => null);
    await requireRole(["student"]);
    return json("Student profile and password changes are not available.", 403);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to update profile.", 500);
  }
}
