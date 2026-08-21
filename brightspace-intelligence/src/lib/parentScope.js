import prisma from "@/lib/prisma";

function roleOf(session) {
  return String(session?.user?.role || "").toLowerCase();
}

export function isParentScopeAdmin(session) {
  return roleOf(session) === "admin";
}

export function normalizeChildId(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildParentStudentScope(session, childId = "") {
  const isAdmin = isParentScopeAdmin(session);
  const normalizedChildId = normalizeChildId(childId);

  if (isAdmin) {
    return normalizedChildId
      ? { isAdmin, joins: "", where: "WHERE sp.id = $1::uuid", values: [normalizedChildId] }
      : { isAdmin, joins: "", where: "", values: [] };
  }

  const joins =
    "INNER JOIN student_parents spp ON spp.student_id = sp.id INNER JOIN parent_profiles pp ON pp.id = spp.parent_id";

  return normalizedChildId
    ? {
        isAdmin,
        joins,
        where: "WHERE pp.user_id = $1::uuid AND sp.id = $2::uuid",
        values: [session.user.id, normalizedChildId],
      }
    : {
        isAdmin,
        joins,
        where: "WHERE pp.user_id = $1::uuid",
        values: [session.user.id],
      };
}

export async function getScopedParentChildren(session, options = {}) {
  const includeDetails = Boolean(options.includeDetails);

  if (isParentScopeAdmin(session)) {
    return includeDetails
      ? prisma.$queryRaw`
          SELECT DISTINCT ON (sp.id)
            sp.id::text AS id,
            sp.user_id::text AS user_id,
            u.full_name,
            u.username,
            u.email,
            u.phone,
            sp.age,
            sp.grade_level,
            sp.status::text AS status,
            sp.created_at,
            c.title AS course_title,
            rl.student_name AS lead_student_name,
            rl.parent_relation,
            rl.program_name,
            rl.gender,
            rl.date_of_birth,
            rl.city,
            rl.country,
            rl.nationality,
            rl.religion,
            rl.child_profile,
            rl.child_strengths,
            rl.child_support_needs,
            rl.child_special_interests,
            rl.developmental_concern,
            rl.developmental_concern_details,
            rl.medical_conditions,
            rl.support_person_during_learning,
            rl.device_available
          FROM student_profiles sp
          INNER JOIN users u ON u.id = sp.user_id
          LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
          LEFT JOIN courses c ON c.id = e.course_id
          LEFT JOIN registration_leads rl ON rl.id = e.registration_id
          ORDER BY sp.id, e.start_date DESC NULLS LAST, e.created_at DESC NULLS LAST
        `
      : prisma.$queryRaw`
          SELECT DISTINCT ON (sp.id)
            sp.id::text AS id,
            u.full_name,
            sp.grade_level
          FROM student_profiles sp
          INNER JOIN users u ON u.id = sp.user_id
          ORDER BY sp.id, u.full_name ASC
        `;
  }

  return includeDetails
    ? prisma.$queryRaw`
        SELECT DISTINCT ON (sp.id)
          sp.id::text AS id,
          sp.user_id::text AS user_id,
          u.full_name,
          u.username,
          u.email,
          u.phone,
          sp.age,
          sp.grade_level,
          sp.status::text AS status,
          sp.created_at,
          c.title AS course_title,
          rl.student_name AS lead_student_name,
          rl.parent_relation,
          rl.program_name,
          rl.gender,
          rl.date_of_birth,
          rl.city,
          rl.country,
          rl.nationality,
          rl.religion,
          rl.child_profile,
          rl.child_strengths,
          rl.child_support_needs,
          rl.child_special_interests,
          rl.developmental_concern,
          rl.developmental_concern_details,
          rl.medical_conditions,
          rl.support_person_during_learning,
          rl.device_available
        FROM parent_profiles pp
        INNER JOIN student_parents spp ON spp.parent_id = pp.id
        INNER JOIN student_profiles sp ON sp.id = spp.student_id
        INNER JOIN users u ON u.id = sp.user_id
        LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
        LEFT JOIN courses c ON c.id = e.course_id
        LEFT JOIN registration_leads rl ON rl.id = e.registration_id
        WHERE pp.user_id = ${session.user.id}::uuid
        ORDER BY sp.id, spp.is_primary DESC, e.start_date DESC NULLS LAST, e.created_at DESC NULLS LAST
      `
    : prisma.$queryRaw`
        SELECT DISTINCT ON (sp.id)
          sp.id::text AS id,
          u.full_name,
          sp.grade_level
        FROM parent_profiles pp
        INNER JOIN student_parents spp ON spp.parent_id = pp.id
        INNER JOIN student_profiles sp ON sp.id = spp.student_id
        INNER JOIN users u ON u.id = sp.user_id
        WHERE pp.user_id = ${session.user.id}::uuid
        ORDER BY sp.id, spp.is_primary DESC, u.full_name ASC
      `;
}
