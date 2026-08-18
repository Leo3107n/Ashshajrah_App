import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "superadmin"];
const LOCAL_NOW_SQL = "CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { searchParams } = new URL(request.url);
    const search = clean(searchParams.get("search"));
    const status = clean(searchParams.get("status")).toLowerCase();
    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(
        ls.title ILIKE $${values.length}
        OR COALESCE(ls.description, '') ILIKE $${values.length}
        OR COALESCE(sub.name, '') ILIKE $${values.length}
        OR COALESCE(tu.full_name, '') ILIKE $${values.length}
        OR COALESCE(sp.grade_level, '') ILIKE $${values.length}
        OR COALESCE(rl.class_level, '') ILIKE $${values.length}
        OR COALESCE(c.class_level, '') ILIKE $${values.length}
        OR COALESCE(c.title, '') ILIKE $${values.length}
      )`);
    }

    if (status) {
      values.push(status);
      conditions.push(`LOWER(
        CASE
          WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN ls.status::text
          WHEN ls.scheduled_start > ${LOCAL_NOW_SQL} THEN 'upcoming'
          WHEN ls.scheduled_start <= ${LOCAL_NOW_SQL} AND ls.scheduled_end >= ${LOCAL_NOW_SQL} THEN 'live'
          ELSE 'ended'
        END
      ) = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        ls.id::text AS id,
        ls.title,
        ls.description,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        ls.status::text AS status,
        LOWER(
          CASE
            WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN ls.status::text
            WHEN ls.scheduled_start > ${LOCAL_NOW_SQL} THEN 'upcoming'
            WHEN ls.scheduled_start <= ${LOCAL_NOW_SQL} AND ls.scheduled_end >= ${LOCAL_NOW_SQL} THEN 'live'
            ELSE 'ended'
          END
        ) AS display_status,
        ls.google_meet_link,
        COALESCE(ls.google_meet_sync_meta->'recording'->>'url', ls.recording_drive_url) AS recording_drive_url,
        sub.id::text AS subject_id,
        sub.name AS subject_name,
        tu.full_name AS teacher_name,
        COALESCE(NULLIF(sp.grade_level, ''), NULLIF(rl.class_level, ''), NULLIF(c.class_level, ''), NULLIF(c.title, ''), '') AS class_level,
        c.title AS course_title
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      LEFT JOIN student_profiles sp ON sp.id = COALESCE(ls.student_id, e.student_id)
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN courses c ON c.id = e.course_id
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      ${whereClause}
      ORDER BY ls.scheduled_start ASC, ls.id ASC
      `,
      ...values
    );

    return json("Admin lectures fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load lectures.", 500);
  }
}
