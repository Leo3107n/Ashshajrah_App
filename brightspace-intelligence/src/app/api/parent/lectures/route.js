import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { getCurrentWeekRange, getDayRange, getMonthRange, getNextWeekRange } from "@/lib/dateTime";
import { buildParentStudentScope, getScopedParentChildren } from "@/lib/parentScope";

const ALLOWED_ROLES = ["parent", "admin"];
const LOCAL_NOW_SQL = "CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'";
const LECTURE_STATUS_SQL = `
  LOWER(
    CASE
      WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN ls.status::text
      WHEN ls.scheduled_start > ${LOCAL_NOW_SQL} THEN 'upcoming'
      WHEN ls.scheduled_start <= ${LOCAL_NOW_SQL} AND ls.scheduled_end >= ${LOCAL_NOW_SQL} THEN 'live'
      ELSE 'ended'
    END
  )
`;

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isoDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const childId = normalizeText(searchParams.get("childId"));
    const scope = buildParentStudentScope(session, childId);
    const range = normalizeText(searchParams.get("range") || searchParams.get("period")).toLowerCase();
    const selectedDate = isoDate(searchParams.get("date"));
    const subjectId = normalizeText(searchParams.get("subjectId"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const values = [...scope.values];
    const conditions = [
      "(\n" +
      "  ls.student_id = a.id\n" +
      "  OR e.student_id = a.id\n" +
      "  OR e.course_id IN (\n" +
      "    SELECT course_id\n" +
      "    FROM enrollments\n" +
      "    WHERE student_id = a.id\n" +
      "      AND LOWER(status) = 'active'\n" +
      "  )\n" +
      ")",
    ];
    let extra = "";
    if (range === "all") {
      extra = "";
    } else if (range === "today") {
      const dayRange = getDayRange(new Date());
      if (dayRange?.start && dayRange?.end) {
        const placeholderStart = values.length + 1;
        const placeholderEnd = values.length + 2;
        values.push(dayRange.start, dayRange.end);
        extra = `AND ls.scheduled_start >= $${placeholderStart}::timestamp AND ls.scheduled_start <= $${placeholderEnd}::timestamp`;
      }
    } else if (range === "current_week") {
      const weekRange = getCurrentWeekRange(new Date());
      if (weekRange?.start && weekRange?.end) {
        const placeholderStart = values.length + 1;
        const placeholderEnd = values.length + 2;
        values.push(weekRange.start, weekRange.end);
        extra = `AND ls.scheduled_start >= $${placeholderStart}::timestamp AND ls.scheduled_start <= $${placeholderEnd}::timestamp`;
      }
    } else if (range === "next_week") {
      const nextWeekRange = getNextWeekRange(new Date());
      if (nextWeekRange?.start && nextWeekRange?.end) {
        const placeholderStart = values.length + 1;
        const placeholderEnd = values.length + 2;
        values.push(nextWeekRange.start, nextWeekRange.end);
        extra = `AND ls.scheduled_start >= $${placeholderStart}::timestamp AND ls.scheduled_start <= $${placeholderEnd}::timestamp`;
      }
    } else if (range === "selected_week") {
      const weekRange = getCurrentWeekRange(selectedDate);
      if (weekRange?.start && weekRange?.end) {
        const placeholderStart = values.length + 1;
        const placeholderEnd = values.length + 2;
        values.push(weekRange.start, weekRange.end);
        extra = `AND ls.scheduled_start >= $${placeholderStart}::timestamp AND ls.scheduled_start <= $${placeholderEnd}::timestamp`;
      }
    } else if (range === "selected_month") {
      const monthRange = getMonthRange(selectedDate);
      if (monthRange?.start && monthRange?.end) {
        const placeholderStart = values.length + 1;
        const placeholderEnd = values.length + 2;
        values.push(monthRange.start, monthRange.end);
        extra = `AND ls.scheduled_start >= $${placeholderStart}::timestamp AND ls.scheduled_start <= $${placeholderEnd}::timestamp`;
      }
    } else if (range === "upcoming") {
      extra = `AND ls.scheduled_start >= ${LOCAL_NOW_SQL} AND LOWER(ls.status::text) IN ('scheduled', 'upcoming', 'live')`;
    } else if (range === "completed") {
      extra = `AND LOWER(ls.status::text) IN ('completed_by_teacher', 'verified_by_coordinator')`;
    } else {
      const dayRange = getDayRange(selectedDate);
      if (dayRange?.start && dayRange?.end) {
        const placeholderStart = values.length + 1;
        const placeholderEnd = values.length + 2;
        values.push(dayRange.start, dayRange.end);
        extra = `AND ls.scheduled_start >= $${placeholderStart}::timestamp AND ls.scheduled_start <= $${placeholderEnd}::timestamp`;
      }
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

    const where = `WHERE ${conditions.join(" AND ")} ${extra ? extra.replace(/^AND\s+/i, "AND ") : ""}`;

    const items = await prisma.$queryRawUnsafe(
      `
      WITH allowed_students AS (
        SELECT sp.id, u.full_name, sp.grade_level
        FROM student_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        ${scope.joins}
        ${scope.where}
      )
      SELECT DISTINCT ON (ls.id)
        ls.id::text AS id,
        a.id::text AS student_id,
        ls.subject_id::text AS subject_id,
        ls.title,
        ls.description,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        ls.status::text AS status,
        ${LECTURE_STATUS_SQL} AS display_status,
        ls.google_meet_link,
        COALESCE(ls.google_meet_sync_meta->'recording'->>'url', ls.recording_drive_url) AS recording_drive_url,
        sub.name AS subject_name,
        tu.full_name AS teacher_name,
        a.full_name AS student_name,
        COALESCE(NULLIF(a.grade_level, ''), NULLIF(rl.class_level, ''), NULLIF(c.class_level, ''), NULLIF(c.title, ''), '') AS class_level,
        c.title AS course_title
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN allowed_students a ON (
        ls.student_id = a.id
        OR e.student_id = a.id
        OR e.course_id IN (
          SELECT course_id
          FROM enrollments
          WHERE student_id = a.id
            AND LOWER(status) = 'active'
        )
      )
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      INNER JOIN courses c ON c.id = e.course_id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      ${where}
      ORDER BY ls.id ASC, ls.scheduled_start ASC
      `,
      ...values
    );

    const linkedChildren = await getScopedParentChildren(session);

    const childrenMap = new Map(
      linkedChildren
        .filter((child) => child?.id && child?.full_name)
        .map((child) => [child.id, { id: child.id, full_name: child.full_name }])
    );
    for (const item of items) {
      if (!item?.student_id || !item?.student_name || childrenMap.has(item.student_id)) continue;
      childrenMap.set(item.student_id, {
        id: item.student_id,
        full_name: item.student_name,
      });
    }
    const children = [...childrenMap.values()];

    // Calendar filters must represent the enrolled curriculum, not merely the
    // lectures scheduled inside the currently selected day/week/month. This
    // keeps subjects with zero scheduled classes available in the dropdown.
    const subjectStudentIds = linkedChildren
      .filter((child) => childId ? child.id === childId : true)
      .map((child) => child.id)
      .filter(Boolean);
    const subjects = subjectStudentIds.length
      ? await prisma.$queryRaw`
          SELECT DISTINCT sub.id::text AS id, sub.name
          FROM enrollments e
          INNER JOIN course_subjects cs ON cs.course_id = e.course_id
          INNER JOIN subjects sub ON sub.id = cs.subject_id
          WHERE e.student_id = ANY(${subjectStudentIds}::uuid[])
            AND LOWER(e.status) = 'active'
            AND COALESCE(sub.status, 'active'::user_status) = 'active'::user_status
          ORDER BY sub.name ASC
        `
      : [];

    const markedDates = [
      ...new Set(
        items
          .map((item) => {
            if (!item.scheduled_start) return "";
            const date = new Date(item.scheduled_start);
            if (Number.isNaN(date.getTime())) return "";
            return date.toISOString().slice(0, 10);
          })
          .filter(Boolean)
      ),
    ].map((date) => ({ date }));

    return json("Lecture fetched.", 200, { items, children, subjects, markedDates });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load lectures.", 500);
  }
}
