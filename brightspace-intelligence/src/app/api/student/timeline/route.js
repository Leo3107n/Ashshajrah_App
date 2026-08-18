import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["student"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function getStudentId(session) {
  const [student] = await prisma.$queryRaw`
    SELECT id::text AS id FROM student_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
  `;
  if (!student?.id) throw new Error("Student profile not found.");
  return student.id;
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const studentId = await getStudentId(session);
    const { searchParams } = new URL(request.url);
    const range = String(searchParams.get("range") || "all").trim().toLowerCase();

    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        ls.id::text AS id,
        ls.title,
        ls.status::text AS status,
        ls.scheduled_start AS occurred_at,
        ls.google_meet_link,
        ls.recording_drive_url,
        sub.name AS subject_name,
        tu.full_name AS teacher_name,
        su.full_name AS student_name
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN student_profiles sp ON sp.id = $1::uuid
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      WHERE (
        ls.student_id = sp.id
        OR e.student_id = sp.id
        OR e.course_id IN (
          SELECT course_id FROM enrollments
          WHERE student_id = sp.id
            AND LOWER(status) = 'active'
        )
      )
      ORDER BY ls.scheduled_start ASC
      LIMIT 50
      `,
      studentId
    );

    const notes = await prisma.$queryRawUnsafe(
      `
      SELECT
        tn.id::text AS id,
        tn.note,
        tn.visibility,
        tn.created_at,
        'Teacher'::text AS source_role,
        tu.full_name AS teacher_name,
        su.full_name AS student_name
      FROM teacher_notes tn
      INNER JOIN student_profiles sp ON sp.id = tn.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = tn.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      WHERE tn.student_id = $1::uuid
        AND COALESCE(tn.visibility, 'student') IN ('student', 'parent')
      ORDER BY tn.created_at ASC
      LIMIT 20
      `,
      studentId
    );

    return json("Timeline fetched.", 200, { items, notes, range });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load timeline.", 500);
  }
}
