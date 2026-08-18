import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { getCurrentWeekRange, getDayRange, getNextWeekRange } from "@/lib/dateTime";

const ALLOWED_ROLES = ["teacher", "admin"];
const VALID_RANGES = new Set(["all", "today", "current_week", "next_week", "selected_date", "upcoming", "completed"]);
const LOCAL_NOW_SQL = "CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isoDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

async function getTeacherId(session) {
  if (String(session.user.role).toLowerCase() === "admin") return "";

  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id
    FROM teacher_profiles
    WHERE user_id = ${session.user.id}::uuid
    LIMIT 1
  `;

  if (!teacher?.id) throw new Error("Teacher profile not found.");
  return teacher.id;
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const teacherId = await getTeacherId(session);
    const { searchParams } = new URL(request.url);
    const range = VALID_RANGES.has(clean(searchParams.get("range"))) ? clean(searchParams.get("range")) : "selected_date";
    const selectedDate = isoDate(searchParams.get("date"));
    const classLevel = clean(searchParams.get("classLevel"));
    const subjectId = clean(searchParams.get("subjectId"));
    const status = clean(searchParams.get("status")).toLowerCase();

    const conditions = [];
    const values = [];

    if (teacherId) {
      values.push(teacherId);
      conditions.push(`ls.teacher_id = $${values.length}::uuid`);
    }

    let rangeStart = null;
    let rangeEnd = null;

    if (range === "all") {
      conditions.push("TRUE");
    } else if (range === "today") {
      const rangeValues = getDayRange(new Date());
      rangeStart = rangeValues?.start;
      rangeEnd = rangeValues?.end;
    } else if (range === "current_week") {
      const weekRange = getCurrentWeekRange(new Date());
      rangeStart = weekRange?.start;
      rangeEnd = weekRange?.end;
    } else if (range === "next_week") {
      const nextWeekRange = getNextWeekRange(new Date());
      rangeStart = nextWeekRange?.start;
      rangeEnd = nextWeekRange?.end;
    } else if (range === "upcoming") {
      conditions.push(`ls.scheduled_start >= ${LOCAL_NOW_SQL}`);
      conditions.push("ls.status::text IN ('scheduled','upcoming','live')");
    } else if (range === "completed") {
      conditions.push("ls.status::text IN ('completed_by_teacher','verified_by_coordinator')");
    } else {
      const dayRange = getDayRange(selectedDate);
      rangeStart = dayRange?.start;
      rangeEnd = dayRange?.end;
    }

    if (rangeStart && rangeEnd) {
      values.push(rangeStart, rangeEnd);
      conditions.push(`ls.scheduled_start >= $${values.length - 1}::timestamp`);
      conditions.push(`ls.scheduled_start <= $${values.length}::timestamp`);
    }

    if (subjectId) {
      values.push(subjectId);
      conditions.push(`ls.subject_id = $${values.length}::uuid`);
    }

    if (classLevel) {
      values.push(classLevel);
      conditions.push(`LOWER(TRIM(COALESCE(c.class_level, ''))) = LOWER(TRIM($${values.length}::text))`);
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

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [lectures, classes, subjects, markedDates] = await Promise.all([
      prisma.$queryRawUnsafe(
        `
        SELECT
          ls.id::text AS id,
          ls.google_calendar_event_id,
          ls.google_meet_link,
          ls.meet_link_source,
          COALESCE(ls.google_meet_sync_meta->'recording'->>'url', ls.recording_drive_url) AS recording_drive_url,
          ls.title,
          ls.description,
          ls.teacher_id::text AS teacher_id,
          ls.subject_id::text AS subject_id,
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
          sub.name AS subject_name,
          tu.full_name AS teacher_name,
          COALESCE(NULLIF(sp.grade_level, ''), NULLIF(rl.class_level, ''), NULLIF(c.class_level, ''), NULLIF(c.title, ''), '') AS class_level,
          c.title AS course_title
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        LEFT JOIN student_profiles sp ON sp.id = COALESCE(ls.student_id, e.student_id)
        LEFT JOIN registration_leads rl ON rl.id = e.registration_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        ${where}
        ORDER BY ls.scheduled_start ASC, ls.id ASC
        `,
        ...values
      ),
      prisma.$queryRawUnsafe(
        `
        SELECT DISTINCT
          c.class_level,
          c.title AS course_title
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        ${teacherId ? "WHERE ls.teacher_id = $1::uuid" : ""}
        ORDER BY c.class_level ASC, c.title ASC
        `,
        ...(teacherId ? [teacherId] : [])
      ),
      prisma.$queryRawUnsafe(
        `
        SELECT DISTINCT sub.id::text AS id, sub.name
        FROM lecture_schedules ls
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        ${teacherId ? "WHERE ls.teacher_id = $1::uuid" : ""}
        ORDER BY sub.name ASC
        `,
        ...(teacherId ? [teacherId] : [])
      ),
      prisma.$queryRawUnsafe(
        `
        SELECT DISTINCT TO_CHAR(ls.scheduled_start, 'YYYY-MM-DD') AS date
        FROM lecture_schedules ls
        ${teacherId ? "WHERE ls.teacher_id = $1::uuid" : ""}
        ORDER BY date ASC
        `,
        ...(teacherId ? [teacherId] : [])
      ),
    ]);

    return json("Calendar lectures fetched.", 200, {
      items: lectures,
      classes,
      subjects,
      markedDates,
      selectedDate,
      range,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load calendar lectures.", 500);
  }
}
