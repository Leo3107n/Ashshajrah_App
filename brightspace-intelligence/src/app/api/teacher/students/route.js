import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const conditions = ["ta.status::text = 'active'", "LOWER(e.status::text) = 'active'"];
    const values = [];
    if (!isAdmin) {
      values.push(session.user.id);
      conditions.push(`tp.user_id = $${values.length}::uuid`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT DISTINCT ON (sp.id, sub.id, c.id)
        sp.id::text AS id,
        su.full_name,
        su.username,
        su.email,
        su.phone,
        sp.age,
        sp.grade_level,
        sp.status::text AS status,
        sub.name AS subject_name,
        COALESCE(NULLIF(c.class_level, ''), c.title) AS course_title
      FROM teacher_assignments ta
      INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
      INNER JOIN courses c ON c.id = ta.course_id
      INNER JOIN enrollments e ON e.course_id = c.id
      INNER JOIN student_profiles sp ON sp.id = e.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN subjects sub ON sub.id = ta.subject_id
      ${where}
      ORDER BY sp.id ASC, sub.id ASC, c.id ASC, su.full_name ASC, sub.name ASC, COALESCE(NULLIF(c.class_level, ''), c.title) ASC
      `,
      ...values
    );
    return json("Students fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load students.", 500);
  }
}
