import prisma from "@/lib/prisma";

/**
 * Returns the first non-cancelled lecture that overlaps the proposed interval.
 * Adjacent lectures are allowed: one may start exactly when another ends.
 */
export async function findTeacherScheduleConflict({
  teacherId,
  scheduledStart,
  scheduledEnd,
  excludeLectureId = "",
  db = prisma,
}) {
  const [conflict] = await db.$queryRaw`
    SELECT
      ls.id::text AS id,
      ls.title,
      ls.scheduled_start::text AS scheduled_start,
      ls.scheduled_end::text AS scheduled_end,
      COALESCE(c.class_level, c.title, 'another class') AS class_name
    FROM lecture_schedules ls
    LEFT JOIN enrollments e ON e.id = ls.enrollment_id
    LEFT JOIN courses c ON c.id = e.course_id
    WHERE ls.teacher_id = ${teacherId}::uuid
      AND ls.status NOT IN (
        'cancelled'::lecture_status,
        'rescheduled'::lecture_status
      )
      AND ls.scheduled_start < ${scheduledEnd}::timestamp
      AND ls.scheduled_end > ${scheduledStart}::timestamp
      AND (${excludeLectureId} = '' OR ls.id <> NULLIF(${excludeLectureId}, '')::uuid)
    ORDER BY ls.scheduled_start ASC
    LIMIT 1
  `;

  return conflict || null;
}

export function teacherConflictMessage(conflict) {
  if (!conflict) return "";
  const className = conflict.class_name || "another class";
  return `This teacher is already scheduled for ${className} during the selected time. Choose another teacher or time slot.`;
}
