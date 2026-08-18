import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { getCurrentWeekRange, getDayRange, getMonthRange, getNextWeekRange } from "@/lib/dateTime";

const RANGES = new Set(["all", "today", "current_week", "next_week", "selected_date", "selected_week", "selected_month", "upcoming", "completed"]);
const LOCAL_NOW_SQL = "CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'";
const LECTURE_STATUS_SQL = `
  LOWER(
    CASE
      WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN ls.status::text
      WHEN ls.scheduled_start > CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi' THEN 'upcoming'
      WHEN ls.scheduled_start <= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi' AND ls.scheduled_end >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi' THEN 'live'
      ELSE 'ended'
    END
  )
`;

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

async function getStudentId(session) {
  const [student] = await prisma.$queryRaw`
    SELECT id::text AS id FROM student_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
  `;
  if (!student?.id) throw new Error("Student profile not found.");
  return student.id;
}

export async function GET(request) {
  try {
    const session = await requireRole(["student"]);
    const studentId = await getStudentId(session);
    const { searchParams } = new URL(request.url);
    const range = RANGES.has(clean(searchParams.get("range"))) ? clean(searchParams.get("range")) : "selected_date";
    const selectedDate = isoDate(searchParams.get("date"));
    const subjectId = clean(searchParams.get("subjectId"));
    const status = clean(searchParams.get("status")).toLowerCase();
    const values = [studentId];
    const conditions = [
      "(\n" +
      "  ls.student_id = $1::uuid\n" +
      "  OR e.student_id = $1::uuid\n" +
      "  OR e.course_id IN (\n" +
      "    SELECT course_id FROM enrollments\n" +
      "    WHERE student_id = $1::uuid\n" +
      "      AND LOWER(status) = 'active'\n" +
      "  )\n" +
      ")"
    ];

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
    } else if (range === "selected_week") {
      const weekRange = getCurrentWeekRange(selectedDate);
      rangeStart = weekRange?.start;
      rangeEnd = weekRange?.end;
    } else if (range === "selected_month") {
      const monthRange = getMonthRange(selectedDate);
      rangeStart = monthRange?.start;
      rangeEnd = monthRange?.end;
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
    if (status) {
      values.push(status);
      conditions.push(`(
        CASE
          WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN LOWER(ls.status::text)
          WHEN ls.scheduled_start > ${LOCAL_NOW_SQL} THEN 'upcoming'
          WHEN ls.scheduled_start <= ${LOCAL_NOW_SQL} AND ls.scheduled_end >= ${LOCAL_NOW_SQL} THEN 'live'
          ELSE 'ended'
        END
      ) = $${values.length}`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const [items, subjects, markedDates] = await Promise.all([
      prisma.$queryRawUnsafe(
        `
        SELECT
          ls.id::text AS id,
          ls.title,
          ls.description,
          ls.scheduled_start::text AS scheduled_start,
          ls.scheduled_end::text AS scheduled_end,
          ls.google_meet_link,
          COALESCE(ls.google_meet_sync_meta->'recording'->>'url', ls.recording_drive_url) AS recording_drive_url,
          ls.status::text AS status,
          ${LECTURE_STATUS_SQL} AS display_status,
          sub.id::text AS subject_id,
          sub.name AS subject_name,
          COALESCE(NULLIF(sp.grade_level, ''), NULLIF(rl.class_level, ''), NULLIF(c.class_level, ''), NULLIF(c.title, ''), '') AS class_level,
          c.title AS course_title,
          tu.full_name AS teacher_name,
          lcr.summary AS completion_summary
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        LEFT JOIN student_profiles sp ON sp.id = COALESCE(ls.student_id, e.student_id)
        LEFT JOIN registration_leads rl ON rl.id = e.registration_id
        LEFT JOIN courses c ON c.id = e.course_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN lecture_completion_reports lcr ON lcr.lecture_id = ls.id
        ${where}
        ORDER BY ls.scheduled_start ASC
        `,
        ...values
      ),
      prisma.$queryRaw`
        SELECT DISTINCT sub.id::text AS id, sub.name
        FROM enrollments e
        INNER JOIN course_subjects cs ON cs.course_id = e.course_id
        INNER JOIN subjects sub ON sub.id = cs.subject_id
        WHERE e.student_id = ${studentId}::uuid
          AND LOWER(e.status) = 'active'
          AND COALESCE(sub.status, 'active'::user_status) = 'active'::user_status
        ORDER BY sub.name ASC
      `,
      prisma.$queryRaw`
        SELECT DISTINCT TO_CHAR(ls.scheduled_start, 'YYYY-MM-DD') AS date
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        WHERE (
          ls.student_id = ${studentId}::uuid
          OR e.student_id = ${studentId}::uuid
          OR e.course_id IN (
            SELECT course_id FROM enrollments
            WHERE student_id = ${studentId}::uuid
              AND LOWER(status) = 'active'
          )
        )
        ORDER BY date ASC
      `,
    ]);

    return json("Student calendar lectures fetched.", 200, {
      items,
      subjects,
      markedDates,
      selectedDate,
      range,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load student lectures.", 500);
  }
}
