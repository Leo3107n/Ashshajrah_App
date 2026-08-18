import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { searchParams } = new URL(request.url);
    const courseId = normalizeText(searchParams.get("course_id") || searchParams.get("courseId"));
    const subjectId = normalizeText(searchParams.get("subject_id") || searchParams.get("subjectId"));

    if (!courseId) {
      return json("course_id is required.", 400);
    }

    if (!subjectId) {
      const items = await prisma.$queryRaw`
        SELECT
          s.id::text AS id,
          s.name
        FROM course_subjects cs
        INNER JOIN subjects s ON s.id = cs.subject_id
        WHERE cs.course_id = ${courseId}::uuid
          AND COALESCE(s.status, 'active'::user_status) = 'active'::user_status
          AND NOT EXISTS (
            SELECT 1
            FROM teacher_assignments ta
            WHERE ta.course_id = cs.course_id
              AND ta.subject_id = cs.subject_id
              AND ta.student_id IS NULL
              AND ta.status = 'active'::user_status
          )
        ORDER BY s.name ASC
      `;

      return json("Available subjects fetched.", 200, { items });
    }

    const items = await prisma.$queryRaw`
      SELECT
        ta.teacher_id::text AS teacher_id,
        u.full_name AS teacher_name,
        u.email AS teacher_email
      FROM teacher_assignments ta
      INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
      INNER JOIN users u ON u.id = tp.user_id
      WHERE ta.course_id = ${courseId}::uuid
        AND ta.subject_id = ${subjectId}::uuid
        AND ta.student_id IS NULL
        AND ta.status = 'active'::user_status
        AND u.status = 'active'::user_status
      ORDER BY u.full_name ASC
    `;

    return json("Assigned teachers fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to fetch teacher assignments.", 500);
  }
}
