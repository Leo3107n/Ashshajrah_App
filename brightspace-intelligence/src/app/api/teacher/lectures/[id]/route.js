import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(_request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const teacherJoin = String(session.user.role).toLowerCase() === "admin" ? "" : "INNER JOIN teacher_profiles current_tp ON current_tp.id = ls.teacher_id AND current_tp.user_id = $2::uuid";
    const values = String(session.user.role).toLowerCase() === "admin" ? [id] : [id, session.user.id];
    const [item] = await prisma.$queryRawUnsafe(
      `
      SELECT
        ls.id::text AS id,
        ls.title,
        ls.description,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        ls.google_meet_link,
        ls.status::text AS status,
        sp.id::text AS student_id,
        su.full_name AS student_name,
        sub.id::text AS subject_id,
        sub.name AS subject_name,
        lcr.summary,
        lcr.topic_covered,
        lcr.homework_given,
        lcr.student_performance
      FROM lecture_schedules ls
      ${teacherJoin}
      INNER JOIN student_profiles sp ON sp.id = ls.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      LEFT JOIN lecture_completion_reports lcr ON lcr.lecture_id = ls.id
      WHERE ls.id = $1::uuid
      LIMIT 1
      `,
      ...values
    );
    if (!item?.id) return json("Lecture not found.", 404);
    return json("Lecture fetched.", 200, { item });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load lecture.", 500);
  }
}

export async function PATCH(_request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const [lecture] = isAdmin
      ? await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            ls.google_calendar_event_id,
            ls.google_meet_link,
            ls.meet_link_source,
            ls.teacher_id::text AS teacher_id,
            ls.subject_id::text AS subject_id,
            ls.title,
            ls.scheduled_start::text AS scheduled_start,
            ls.scheduled_end::text AS scheduled_end
          FROM lecture_schedules ls
          WHERE ls.id = ${id}::uuid
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            ls.google_calendar_event_id,
            ls.google_meet_link,
            ls.meet_link_source,
            ls.teacher_id::text AS teacher_id,
            ls.subject_id::text AS subject_id,
            ls.title,
            ls.scheduled_start::text AS scheduled_start,
            ls.scheduled_end::text AS scheduled_end
          FROM lecture_schedules ls
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          WHERE ls.id = ${id}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `;
    if (!lecture?.id) return json("Lecture not found.", 404);

    await prisma.$executeRaw`
      UPDATE lecture_schedules ls
      SET status = 'completed_by_teacher'::lecture_status, updated_at = NOW()
      WHERE ls.id = ${id}::uuid
    `;
    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'lecture_marked_conducted', 'lecture_schedules', ${id}::uuid, NOW())
    `;
    return json("Lecture marked conducted.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update lecture.", 500);
  }
}

export async function POST(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const body = await request.json();
    const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
    const topicCovered = typeof body?.topicCovered === "string" ? body.topicCovered.trim() : "";
    const homeworkGiven = typeof body?.homeworkGiven === "string" ? body.homeworkGiven.trim() : "";
    const studentPerformance = typeof body?.studentPerformance === "string" ? body.studentPerformance.trim() : "";

    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const [lecture] = isAdmin
      ? await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            ls.teacher_id::text AS teacher_id
          FROM lecture_schedules ls
          WHERE ls.id = ${id}::uuid
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            ls.teacher_id::text AS teacher_id
          FROM lecture_schedules ls
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          WHERE ls.id = ${id}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `;

    if (!lecture?.id) return json("Lecture not found.", 404);

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
