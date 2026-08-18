import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator", "superadmin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function reportStartDate(request) {
  const days = Number(new URL(request.url).searchParams.get("days") || 30);
  if (!Number.isInteger(days) || ![7, 30, 90, 365].includes(days)) {
    return null;
  }

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  return { days, start };
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const range = reportStartDate(request);

    if (!range) {
      return json("Report range must be 7, 30, 90, or 365 days.", 400);
    }

    const [
      registrationPipeline,
      feeVerification,
      teacherClassReport,
      studentActivity,
      recentLeads,
      recentLectures,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT status::text AS label, COUNT(*)::int AS total
        FROM registration_leads
        WHERE created_at >= ${range.start}
        GROUP BY status
        ORDER BY status::text
      `,
      prisma.$queryRaw`
        SELECT status::text AS label, COUNT(*)::int AS total
        FROM fee_submissions
        WHERE created_at >= ${range.start}
        GROUP BY status
        ORDER BY status::text
      `,
      prisma.$queryRaw`
        SELECT
          u.full_name AS label,
          COUNT(ls.id)::int AS total
        FROM teacher_profiles tp
        INNER JOIN users u ON u.id = tp.user_id
        LEFT JOIN lecture_schedules ls
          ON ls.teacher_id = tp.id
         AND ls.scheduled_start >= ${range.start}
        GROUP BY u.full_name
        ORDER BY total DESC, u.full_name ASC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT
          u.full_name AS label,
          COUNT(DISTINCT ls.id)::int AS total
        FROM student_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        LEFT JOIN lecture_schedules ls
          ON ls.student_id = sp.id
         AND ls.scheduled_start >= ${range.start}
        GROUP BY u.full_name
        ORDER BY total DESC, u.full_name ASC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT
          rl.id::text AS id,
          rl.student_name,
          rl.parent_name,
          rl.class_level,
          rl.status::text AS status,
          rl.created_at
        FROM registration_leads rl
        WHERE rl.created_at >= ${range.start}
        ORDER BY rl.created_at DESC NULLS LAST, rl.id DESC
        LIMIT 5
      `,
      prisma.$queryRaw`
        SELECT *
        FROM (
          SELECT DISTINCT ON (ls.id)
          ls.id::text AS id,
          ls.title,
          COALESCE(sub.name, 'Unassigned') AS subject_name,
          COALESCE(tu.full_name, 'Unknown teacher') AS teacher_name,
          COALESCE(NULLIF(c.class_level, ''), NULLIF(c.title, ''), 'Unassigned') AS class_name,
          ls.scheduled_start::text AS scheduled_start,
          ls.scheduled_end::text AS scheduled_end,
          LOWER(ls.status::text) AS status,
          CASE
            WHEN LOWER(ls.status::text) = 'verified_by_coordinator' THEN 'verified'
            WHEN LOWER(ls.status::text) = 'completed_by_teacher' THEN 'completed'
            WHEN ls.scheduled_end <= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi' THEN 'ended'
            WHEN LOWER(ls.status::text) = 'scheduled' THEN 'scheduled'
            WHEN LOWER(ls.status::text) = 'upcoming' THEN 'upcoming'
            WHEN LOWER(ls.status::text) = 'live' THEN 'live'
            ELSE LOWER(ls.status::text)
          END AS display_status,
          ls.created_at
        FROM lecture_schedules ls
        LEFT JOIN subjects sub ON sub.id = ls.subject_id
        LEFT JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        LEFT JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN enrollments e ON e.id = ls.enrollment_id
        LEFT JOIN courses c ON c.id = e.course_id
        WHERE ls.scheduled_start <= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'
          AND ls.scheduled_start >= ${range.start}
          ORDER BY ls.id, ls.scheduled_end DESC NULLS LAST, ls.created_at DESC NULLS LAST
        ) recent_lectures
        ORDER BY scheduled_end DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
        LIMIT 5
      `,
    ]);

    return json("Coordinator reports fetched.", 200, {
      readOnly: true,
      role: String(session?.user?.role || "").toLowerCase(),
      range: {
        days: range.days,
        from: range.start.toISOString(),
        to: new Date().toISOString(),
      },
      summary: {
        registrationPipeline,
        feeVerification,
        teacherClassReport,
        studentActivity,
      },
      recentLeads,
      recentLectures,
    });
  } catch (error) {
    console.error("COORDINATOR_REPORTS_ERROR:", error);
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch coordinator reports.",
      500
    );
  }
}
