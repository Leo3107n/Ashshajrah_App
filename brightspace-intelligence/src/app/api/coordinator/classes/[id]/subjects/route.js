import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { CLASS_SUBJECTS } from "@/lib/academicCatalog";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function ensureClassSubjects(courseId) {
  const [course] = await prisma.$queryRaw`
    SELECT COALESCE(NULLIF(class_level, ''), title) AS class_level
    FROM courses
    WHERE id = ${courseId}::uuid
    LIMIT 1
  `;
  const subjects = CLASS_SUBJECTS[course?.class_level] || [];

  if (!subjects.length) return;

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO course_subjects (course_id, subject_id)
      SELECT ${courseId}::uuid, s.id
      FROM subjects s
      WHERE s.name IN (${Prisma.join(subjects)})
      ON CONFLICT (course_id, subject_id) DO NOTHING
    `
  );
}

export async function GET(_request, { params }) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { id } = await params;
    await ensureClassSubjects(id);

    const items = await prisma.$queryRaw`
      SELECT
        s.id::text AS id,
        s.name
      FROM courses c
      INNER JOIN course_subjects cs ON cs.course_id = c.id
      INNER JOIN subjects s ON s.id = cs.subject_id
      WHERE c.id = ${id}::uuid
        AND COALESCE(s.status, 'active'::user_status) = 'active'::user_status
        AND NOT EXISTS (
          SELECT 1
          FROM lecture_schedules ls
          INNER JOIN enrollments e ON e.id = ls.enrollment_id
          WHERE e.course_id = c.id
            AND ls.subject_id = s.id
        )
      ORDER BY s.name ASC
    `;

    return json("Class subjects fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;

    return json(error instanceof Error ? error.message : "Unable to fetch class subjects.", 500);
  }
}
