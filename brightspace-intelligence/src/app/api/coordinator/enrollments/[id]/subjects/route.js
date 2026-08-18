import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { CLASS_SUBJECTS } from "@/lib/academicCatalog";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function ensureEnrollmentCourseSubjects(enrollmentId) {
  const [enrollment] = await prisma.$queryRaw`
    SELECT
      e.course_id::text AS course_id,
      COALESCE(NULLIF(c.class_level, ''), NULLIF(c.title, '')) AS class_level
    FROM enrollments e
    INNER JOIN courses c ON c.id = e.course_id
    WHERE e.id = ${enrollmentId}::uuid
    LIMIT 1
  `;

  const subjects = CLASS_SUBJECTS[enrollment?.class_level] || [];
  if (!enrollment?.course_id || !subjects.length) {
    return;
  }

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO course_subjects (course_id, subject_id)
      SELECT ${enrollment.course_id}::uuid, s.id
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
    await ensureEnrollmentCourseSubjects(id);

    const subjects = await prisma.$queryRaw`
      SELECT
        s.id::text AS id,
        s.name
      FROM enrollments e
      INNER JOIN course_subjects cs ON cs.course_id = e.course_id
      INNER JOIN subjects s ON s.id = cs.subject_id
      WHERE e.id = ${id}::uuid
        AND COALESCE(s.status, 'active'::user_status) = 'active'::user_status
      ORDER BY s.name ASC
    `;

    return json("Enrollment subjects fetched.", 200, { items: subjects });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch enrollment subjects.",
      500
    );
  }
}
