import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(_request, { params }) {
  try {
    const session = await requireRole(["student"]);
    const { id } = await params;
    const [item] = await prisma.$queryRaw`
      SELECT
        ls.id::text AS id,
        ls.title,
        ls.description,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        ls.google_meet_link,
        ls.recording_drive_url,
        ls.status::text AS status,
        sub.name AS subject_name,
        tu.full_name AS teacher_name,
        lcr.summary,
        lcr.topic_covered,
        lcr.homework_given,
        lcr.student_performance
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN student_profiles sp ON (
        sp.id = ls.student_id
        OR sp.id = e.student_id
        OR e.course_id IN (
          SELECT course_id FROM enrollments
          WHERE student_id = sp.id
            AND LOWER(status) = 'active'
        )
      )
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      LEFT JOIN lecture_completion_reports lcr ON lcr.lecture_id = ls.id
      WHERE ls.id = ${id}::uuid
        AND sp.user_id = ${session.user.id}::uuid
      LIMIT 1
    `;
    if (!item?.id) return json("Lecture not found.", 404);
    return json("Lecture fetched.", 200, { item });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load lecture.", 500);
  }
}
