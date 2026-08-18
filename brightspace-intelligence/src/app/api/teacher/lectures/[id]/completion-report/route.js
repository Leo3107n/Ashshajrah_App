import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const body = await request.json();
    const summary = clean(body?.summary);
    const topicCovered = clean(body?.topicCovered);
    const homeworkGiven = clean(body?.homeworkGiven);
    const studentPerformance = clean(body?.studentPerformance);
    if (!summary || !topicCovered) {
      return json("Lecture summary and topic covered are required.", 400);
    }

    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const [lecture] = isAdmin
      ? await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            ls.teacher_id::text AS teacher_id,
            ls.subject_id::text AS subject_id,
            ls.title,
            ls.status::text AS status,
            ls.scheduled_start::text AS scheduled_start,
            ls.scheduled_end::text AS scheduled_end,
            (ls.scheduled_end <= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi') AS has_ended,
            ls.google_calendar_event_id,
            ls.google_meet_link
          FROM lecture_schedules ls
          WHERE ls.id = ${id}::uuid
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            ls.teacher_id::text AS teacher_id,
            ls.subject_id::text AS subject_id,
            ls.title,
            ls.status::text AS status,
            ls.scheduled_start::text AS scheduled_start,
            ls.scheduled_end::text AS scheduled_end,
            (ls.scheduled_end <= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi') AS has_ended,
            ls.google_calendar_event_id,
            ls.google_meet_link
          FROM lecture_schedules ls
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          WHERE ls.id = ${id}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `;
    if (!lecture?.id) return json("Lecture not found.", 404);
    const status = String(lecture.status || "").toLowerCase();
    if (status === "verified_by_coordinator") {
      return json("A coordinator has already verified this completion report.", 409);
    }
    if (!lecture.has_ended && !["live", "completed_by_teacher", "missed"].includes(status)) {
      return json("A completion report can only be submitted after the lecture has ended.", 400);
    }

    await prisma.$executeRaw`
      INSERT INTO lecture_completion_reports (
        id, lecture_id, teacher_id, summary, topic_covered, homework_given, student_performance, submitted_at, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), ${id}::uuid, ${lecture.teacher_id}::uuid, ${summary || null}, ${topicCovered || null}, ${homeworkGiven || null}, ${studentPerformance || null}, NOW(), NOW(), NOW()
      )
      ON CONFLICT (lecture_id)
      DO UPDATE SET
        summary = ${summary || null},
        topic_covered = ${topicCovered || null},
        homework_given = ${homeworkGiven || null},
        student_performance = ${studentPerformance || null},
        submitted_at = NOW(),
        updated_at = NOW()
    `;
    await prisma.$executeRaw`
      UPDATE lecture_schedules ls
      SET status = 'completed_by_teacher'::lecture_status, updated_at = NOW()
      WHERE ls.id = ${id}::uuid
    `;
    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'completion_report_submitted', 'lecture_schedules', ${id}::uuid, NOW())
    `;
    return json("Completion report submitted.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to submit completion report.", 500);
  }
}
