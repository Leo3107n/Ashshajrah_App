import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function requireAdminSession() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return { error: json("Unauthorized.", 401) };
  }

  if (role !== "admin" && role !== "superadmin") {
    return { error: json("Forbidden.", 403) };
  }

  return { session };
}

async function getRoleId(roleName) {
  const [row] = await prisma.$queryRaw`
    SELECT id::text AS id
    FROM roles
    WHERE LOWER(name) = ${roleName}
    LIMIT 1
  `;

  if (!row?.id) {
    throw new Error(`Role not found: ${roleName}`);
  }

  return row.id;
}

async function getUserById(id) {
  const [row] = await prisma.$queryRaw`
    SELECT
      u.id::text AS id,
      COALESCE(u.full_name, '') AS full_name,
      COALESCE(NULLIF(u.full_name, ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User') AS name,
      u.email,
      u.phone,
      u.status::text AS user_status,
      sp.id::text AS student_profile_id,
      sp.admission_no,
      sp.age,
      sp.grade_level,
      sp.status::text AS student_profile_status,
      c.title AS course_title,
      rl.student_name AS lead_student_name,
      rl.parent_name AS lead_parent_name,
      rl.parent_relation AS lead_parent_relation,
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
      rl.device_available,
      CASE
        WHEN LOWER(COALESCE(pp.relation, '')) IN ('', 'parent')
          THEN COALESCE(NULLIF(latest_registration.parent_relation, ''), COALESCE(pp.relation, ''))
        ELSE COALESCE(pp.relation, '')
      END AS relation,
      COALESCE(STRING_AGG(DISTINCT su.full_name, ', ' ORDER BY su.full_name) FILTER (WHERE su.full_name IS NOT NULL), '') AS student_names,
      LOWER(u.status::text) AS status,
      LOWER(r.name) AS role
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    LEFT JOIN student_profiles sp ON sp.user_id = u.id
    LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
    LEFT JOIN courses c ON c.id = e.course_id
    LEFT JOIN registration_leads rl ON rl.id = e.registration_id
    LEFT JOIN parent_profiles pp ON pp.user_id = u.id
    LEFT JOIN student_parents spp ON spp.parent_id = pp.id
    LEFT JOIN student_profiles linked_sp ON linked_sp.id = spp.student_id
    LEFT JOIN users su ON su.id = linked_sp.user_id
    LEFT JOIN LATERAL (
      SELECT rl.parent_relation
      FROM student_parents spp_latest
      INNER JOIN enrollments e ON e.student_id = spp_latest.student_id
      INNER JOIN registration_leads rl ON rl.id = e.registration_id
      WHERE spp_latest.parent_id = pp.id
      ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, rl.created_at DESC NULLS LAST
      LIMIT 1
    ) latest_registration ON TRUE
    WHERE u.id = ${id}::uuid
    GROUP BY u.id, u.full_name, u.email, u.phone, u.status, sp.id, sp.admission_no, sp.age, sp.grade_level, sp.status, c.title, rl.student_name, rl.parent_name, rl.parent_relation, rl.program_name, rl.gender, rl.date_of_birth, rl.city, rl.country, rl.nationality, rl.religion, rl.child_profile, rl.child_strengths, rl.child_support_needs, rl.child_special_interests, rl.developmental_concern, rl.developmental_concern_details, rl.medical_conditions, rl.support_person_during_learning, rl.device_available, pp.relation, latest_registration.parent_relation, r.name
    LIMIT 1
  `;

  return row;
}

export async function DELETE(_request, { params }) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const { id } = await params;
    const existing = await getUserById(id);

    if (!existing?.id) {
      return json("User not found.", 404);
    }

    const actorRole = String(authState.session.user.role || "").toLowerCase();
    if (
      actorRole === "admin" &&
      ["superadmin", "admin"].includes(String(existing.role || "").toLowerCase())
    ) {
      return json("Admins cannot archive administrator accounts.", 403);
    }

    const [updated] = await prisma.$queryRaw`
      UPDATE users
      SET status = ${"archived"}::user_status
      WHERE id = ${id}::uuid
      RETURNING id::text AS id
    `;

    if (!updated?.id) {
      return json("User not found.", 404);
    }

    return json("User archived.", 200, { item: updated });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to delete user.",
      500
    );
  }
}

export async function PATCH(request, { params }) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const { id } = await params;
    const existing = await getUserById(id);
    const body = await request.json().catch(() => ({}));
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const nextRole = String(body?.role || existing.role || "").trim().toLowerCase();
    const relation = String(body?.relation || "").trim().toLowerCase();
    const nextStatus = String(body?.status || existing.status || "active").toLowerCase();
    const admissionNo = String(body?.admissionNo || "").trim();
    const gradeLevel = String(body?.gradeLevel || "").trim();
    const age = body?.age === "" || body?.age == null ? null : Number(body.age);
    const actorRole = String(authState.session.user.role || "").toLowerCase();

    if (!existing?.id) {
      return json("User not found.", 404);
    }

    if (
      actorRole === "admin" &&
      ["superadmin", "admin"].includes(String(existing.role || "").toLowerCase())
    ) {
      return json("Admins cannot modify administrator accounts.", 403);
    }

    if (
      actorRole === "admin" &&
      ["superadmin", "admin"].includes(nextRole)
    ) {
      return json("Admins cannot assign administrator roles.", 403);
    }

    if (!["active", "suspended", "archived"].includes(nextStatus)) {
      return json("Invalid user status.", 400);
    }

    if (
      fullName ||
      email ||
      phone ||
      nextRole ||
      relation ||
      (existing.status && nextStatus !== existing.status)
    ) {
      await prisma.$transaction(async (tx) => {
        const roleId = nextRole ? await getRoleId(nextRole) : null;
        if (roleId) {
          await tx.$executeRaw`
            UPDATE users
            SET
              full_name = ${fullName || existing.full_name || existing.name},
              email = ${email || existing.email || null},
              phone = ${phone || existing.phone || null},
              role_id = ${roleId}::uuid,
              status = ${nextStatus}::user_status,
              updated_at = NOW()
            WHERE id = ${id}::uuid
          `;
        } else {
          await tx.$executeRaw`
            UPDATE users
            SET
              full_name = ${fullName || existing.full_name || existing.name},
              email = ${email || existing.email || null},
              phone = ${phone || existing.phone || null},
              status = ${nextStatus}::user_status,
              updated_at = NOW()
            WHERE id = ${id}::uuid
          `;
        }

        if (existing.role === "parent") {
          await tx.$executeRaw`
            UPDATE parent_profiles
            SET relation = ${relation || existing.relation || null}, updated_at = NOW()
            WHERE user_id = ${id}::uuid
          `;
        } else if (existing.role === "student") {
          await tx.$executeRaw`
            UPDATE student_profiles
            SET
              admission_no = ${admissionNo || existing.admission_no || null},
              age = ${age === null ? existing.age || null : age},
              grade_level = ${gradeLevel || existing.grade_level || null},
              status = ${nextStatus}::user_status,
              updated_at = NOW()
            WHERE user_id = ${id}::uuid
          `;
        }
      });
    } else {
      await prisma.$executeRaw`
        UPDATE users
        SET status = ${nextStatus}::user_status,
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }

    const updated = await getUserById(id);
    return json("User updated.", 200, { item: updated });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to update user.",
      500
    );
  }
}
