import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { buildLectureJoinEmailHtml, getAppUrl, sendEmail } from "@/lib/email";
import { createCalendarLectureEvent, extractMeetCodeFromLink } from "@/lib/googleCalendar";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import { CLASS_SUBJECTS } from "@/lib/academicCatalog";
import {
  findTeacherScheduleConflict,
  teacherConflictMessage,
} from "@/lib/teacherScheduleConflict";

const ALLOWED_ROLES = ["admin", "coordinator", "superadmin"];
const LOCAL_NOW_SQL = "CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'";
const DISPLAY_STATUS_SQL = `
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

function parseScheduleDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidGoogleMeetLink(link) {
  const value = String(link || "").trim();
  return Boolean(value) && value.startsWith("https://meet.google.com/");
}

async function createNotifications(tx, userIds, title, message, type = "class") {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];

  for (const userId of uniqueIds) {
    await tx.$executeRaw`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${userId}::uuid,
        ${title},
        ${message},
        ${type}::notification_type,
        FALSE,
        NOW()
      )
    `;
  }
}

async function sendLectureLinkEmails({ teacher, enrollmentRows, title, scheduledStart, meetLink }) {
  const baseUrl = getAppUrl();
  const recipients = [];

  if (teacher.email) {
    recipients.push({
      email: teacher.email,
      name: teacher.full_name,
      portalUrl: `${baseUrl}/teacher/dashboard`,
      studentName: enrollmentRows.length > 1 ? "Selected class students" : enrollmentRows[0]?.student_name,
      subjectName: enrollmentRows[0]?.subject_name,
    });
  }

  for (const enrollment of enrollmentRows) {
    const email = enrollment.student_email || enrollment.parent_email;
    if (!email) continue;

    recipients.push({
      email,
      name: enrollment.student_email ? enrollment.student_name : enrollment.parent_name,
      portalUrl: `${baseUrl}${enrollment.student_email ? "/student/dashboard" : "/parent/lectures"}`,
      studentName: enrollment.student_name,
      subjectName: enrollment.subject_name,
    });
  }

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: "Your lecture joining link is available in portal",
        html: buildLectureJoinEmailHtml({
          recipientName: recipient.name,
          lectureTitle: title,
          studentName: recipient.studentName,
          subjectName: recipient.subjectName,
          scheduledStart,
          portalUrl: recipient.portalUrl,
          meetLink,
        }),
      });
    } catch (error) {
      console.warn("[lecture-schedules] Lecture email failed", {
        email: recipient.email,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function ensureEnrollmentOptions() {
  // First pass: create the ideal enrollment where student grade matches a course/class.
  await prisma.$executeRaw`
    INSERT INTO enrollments (
      id,
      student_id,
      course_id,
      registration_id,
      start_date,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      sp.id,
      c.id,
      NULL,
      CURRENT_DATE,
      'active',
      NOW(),
      NOW()
    FROM student_profiles sp
    INNER JOIN users u ON u.id = sp.user_id
    INNER JOIN courses c ON (
      LOWER(NULLIF(c.class_level, '')) = LOWER(NULLIF(sp.grade_level, ''))
      OR LOWER(NULLIF(c.title, '')) = LOWER(NULLIF(sp.grade_level, ''))
    )
    WHERE u.status = 'active'::user_status
      AND COALESCE(sp.status, 'active'::user_status) = 'active'::user_status
      AND COALESCE(c.status, 'active'::user_status) = 'active'::user_status
      AND NULLIF(sp.grade_level, '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE e.student_id = sp.id
          AND e.course_id = c.id
      )
  `;

  // Fallback: if an active student still has no enrollment, attach them to the
  // first active course so coordinators can schedule classes without dead UI.
  await prisma.$executeRaw`
    INSERT INTO enrollments (
      id,
      student_id,
      course_id,
      registration_id,
      start_date,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      sp.id,
      picked_course.id,
      NULL,
      CURRENT_DATE,
      'active',
      NOW(),
      NOW()
    FROM student_profiles sp
    INNER JOIN users u ON u.id = sp.user_id
    CROSS JOIN LATERAL (
      SELECT c.id
      FROM courses c
      WHERE COALESCE(c.status, 'active'::user_status) = 'active'::user_status
      ORDER BY
        CASE
          WHEN NULLIF(sp.grade_level, '') IS NOT NULL
            AND (
              LOWER(NULLIF(c.class_level, '')) = LOWER(NULLIF(sp.grade_level, ''))
              OR LOWER(NULLIF(c.title, '')) = LOWER(NULLIF(sp.grade_level, ''))
            )
          THEN 0
          ELSE 1
        END,
        c.created_at DESC NULLS LAST,
        c.id DESC
      LIMIT 1
    ) picked_course
    WHERE u.status = 'active'::user_status
      AND COALESCE(sp.status, 'active'::user_status) = 'active'::user_status
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE e.student_id = sp.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE e.student_id = sp.id
          AND e.course_id = picked_course.id
      )
  `;
}

async function ensureCourseSubjectOptions() {
  for (const [classLevel, subjects] of Object.entries(CLASS_SUBJECTS)) {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO course_subjects (course_id, subject_id)
        SELECT c.id, s.id
        FROM courses c
        INNER JOIN subjects s ON s.name IN (${Prisma.join(subjects)})
        WHERE (
            LOWER(NULLIF(c.class_level, '')) = LOWER(${classLevel})
            OR LOWER(NULLIF(c.title, '')) = LOWER(${classLevel})
          )
          AND NOT EXISTS (
            SELECT 1
            FROM course_subjects cs
            WHERE cs.course_id = c.id
              AND cs.subject_id = s.id
          )
      `
    );
  }
}

async function getScheduleOptions() {
  await ensureEnrollmentOptions();
  await ensureCourseSubjectOptions();

  const [students, enrollments, subjects, enrollmentSubjects, teachers] = await Promise.all([
    prisma.$queryRaw`
      SELECT sp.id::text AS id, u.full_name
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `,
    prisma.$queryRaw`
      SELECT
        e.id::text AS id,
        e.student_id::text AS student_id,
        e.course_id::text AS course_id,
        u.full_name AS student_name,
        COALESCE(NULLIF(c.class_level, ''), NULLIF(c.title, ''), 'Class') AS course_title
      FROM enrollments e
      INNER JOIN student_profiles sp ON sp.id = e.student_id
      INNER JOIN users u ON u.id = sp.user_id
      INNER JOIN courses c ON c.id = e.course_id
      WHERE LOWER(e.status) = 'active'
      ORDER BY u.full_name ASC, c.title ASC
    `,
    prisma.$queryRaw`
      SELECT id::text AS id, name
      FROM subjects
      WHERE status = 'active'
      ORDER BY name ASC
    `,
    prisma.$queryRaw`
      SELECT
        e.id::text AS enrollment_id,
        s.id::text AS id,
        s.name
      FROM enrollments e
      INNER JOIN course_subjects cs ON cs.course_id = e.course_id
      INNER JOIN subjects s ON s.id = cs.subject_id
      WHERE LOWER(e.status) = 'active'
        AND COALESCE(s.status, 'active'::user_status) = 'active'::user_status
      ORDER BY s.name ASC
    `,
    prisma.$queryRaw`
      SELECT tp.id::text AS id, u.full_name
      FROM teacher_profiles tp
      INNER JOIN users u ON u.id = tp.user_id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `,
  ]);

  return { students, enrollments, subjects, enrollmentSubjects, teachers };
}

export async function GET(request) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];
    const values = [];

    if (search) {
      const term = `%${search}%`;
      values.push(term);
      conditions.push(`(
          ls.title ILIKE $${values.length}
          OR su.full_name ILIKE $${values.length}
          OR tu.full_name ILIKE $${values.length}
          OR sub.name ILIKE $${values.length}
          OR c.title ILIKE $${values.length}
        )`);
    }

    if (status) {
      values.push(status);
      conditions.push(`(${DISPLAY_STATUS_SQL}) = $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [items, options] = await Promise.all([
      prisma.$queryRawUnsafe(
        `
        SELECT
          MIN(ls.id::text) AS id,
          ls.google_calendar_event_id,
          ls.google_meet_link,
          ls.meet_link_source,
          ls.google_meet_space_id,
          COALESCE(
            MAX(ls.google_meet_sync_meta->'recording'->>'url'),
            MAX(ls.recording_drive_url)
          ) AS recording_drive_url,
          ls.teacher_id::text AS teacher_id,
          ls.subject_id::text AS subject_id,
          ls.title,
          ls.description,
          TO_CHAR(MIN(ls.scheduled_start), 'YYYY-MM-DD') AS start_date,
          TO_CHAR(MAX(ls.scheduled_end), 'YYYY-MM-DD') AS end_date,
          TO_CHAR(MIN(ls.scheduled_start), 'HH24:MI') AS start_time,
          TO_CHAR(MAX(ls.scheduled_end), 'HH24:MI') AS end_time,
          COUNT(*)::int AS occurrence_count,
          COUNT(*) FILTER (WHERE ls.status::text = 'completed_by_teacher')::int AS completed_count,
          COUNT(*) FILTER (WHERE ls.status::text = 'verified_by_coordinator')::int AS verified_count,
          (
            SELECT STRING_AGG(day_name, ', ' ORDER BY day_order)
            FROM (
              SELECT DISTINCT
                TO_CHAR(ls2.scheduled_start, 'Dy') AS day_name,
                EXTRACT(DOW FROM ls2.scheduled_start) AS day_order
              FROM lecture_schedules ls2
              INNER JOIN enrollments e2 ON e2.id = ls2.enrollment_id
              WHERE
                ls2.google_calendar_event_id IS NOT DISTINCT FROM ls.google_calendar_event_id
                AND ls2.google_meet_link IS NOT DISTINCT FROM ls.google_meet_link
                AND ls2.meet_link_source IS NOT DISTINCT FROM ls.meet_link_source
                AND ls2.google_meet_space_id IS NOT DISTINCT FROM ls.google_meet_space_id
                AND ls2.teacher_id = ls.teacher_id
                AND ls2.subject_id = ls.subject_id
                AND ls2.title = ls.title
                AND ls2.description = ls.description
                AND ls2.rescheduled_from_id IS NOT DISTINCT FROM ls.rescheduled_from_id
                AND e2.course_id = e.course_id
            ) AS day_parts
          ) AS days_active,
          MIN(ls.scheduled_start)::text AS scheduled_start,
          MAX(ls.scheduled_end)::text AS scheduled_end,
          CASE
            WHEN COUNT(*) FILTER (WHERE ls.status::text = 'verified_by_coordinator') = COUNT(*) THEN 'verified_by_coordinator'
            WHEN COUNT(*) FILTER (WHERE ls.status::text = 'completed_by_teacher') = COUNT(*) THEN 'completed_by_teacher'
            WHEN COUNT(*) FILTER (WHERE ls.status::text = 'missed') = COUNT(*) AND COUNT(*) > 0 THEN 'missed'
            WHEN COUNT(*) FILTER (WHERE ls.status::text = 'cancelled') = COUNT(*) AND COUNT(*) > 0 THEN 'cancelled'
            WHEN COUNT(*) FILTER (WHERE ls.status::text = 'rescheduled') = COUNT(*) AND COUNT(*) > 0 THEN 'rescheduled'
            WHEN COUNT(*) FILTER (WHERE ls.status::text = 'disputed') = COUNT(*) AND COUNT(*) > 0 THEN 'disputed'
            WHEN MIN(ls.scheduled_start) > ${LOCAL_NOW_SQL} THEN 'upcoming'
            WHEN MIN(ls.scheduled_start) <= ${LOCAL_NOW_SQL}
              AND MAX(ls.scheduled_end) >= ${LOCAL_NOW_SQL} THEN 'live'
            ELSE 'ended'
          END AS status,
          LOWER(
            CASE
              WHEN COUNT(*) FILTER (WHERE ls.status::text = 'verified_by_coordinator') = COUNT(*) THEN 'verified_by_coordinator'
              WHEN COUNT(*) FILTER (WHERE ls.status::text = 'completed_by_teacher') = COUNT(*) THEN 'completed_by_teacher'
              WHEN COUNT(*) FILTER (WHERE ls.status::text = 'missed') = COUNT(*) AND COUNT(*) > 0 THEN 'missed'
              WHEN COUNT(*) FILTER (WHERE ls.status::text = 'cancelled') = COUNT(*) AND COUNT(*) > 0 THEN 'cancelled'
              WHEN COUNT(*) FILTER (WHERE ls.status::text = 'rescheduled') = COUNT(*) AND COUNT(*) > 0 THEN 'rescheduled'
              WHEN COUNT(*) FILTER (WHERE ls.status::text = 'disputed') = COUNT(*) AND COUNT(*) > 0 THEN 'disputed'
              WHEN MIN(ls.scheduled_start) > ${LOCAL_NOW_SQL} THEN 'upcoming'
              WHEN MIN(ls.scheduled_start) <= ${LOCAL_NOW_SQL}
                AND MAX(ls.scheduled_end) >= ${LOCAL_NOW_SQL} THEN 'live'
              ELSE 'ended'
            END
          ) AS display_status,
          ls.rescheduled_from_id::text AS rescheduled_from_id,
          MIN(tu.full_name) AS teacher_name,
          MIN(sub.name) AS subject_name,
          MIN(c.title) AS course_title,
          (SELECT COUNT(DISTINCT e2.student_id)::int
           FROM enrollments e2
           INNER JOIN student_profiles sp2 ON sp2.id = e2.student_id
           INNER JOIN users su2 ON su2.id = sp2.user_id
           WHERE e2.course_id = e.course_id
             AND LOWER(e2.status) = 'active'
             AND su2.status = 'active'::user_status
          ) AS student_count,
          (SELECT STRING_AGG(su2.full_name, ', ' ORDER BY su2.full_name)
           FROM enrollments e2
           INNER JOIN student_profiles sp2 ON sp2.id = e2.student_id
           INNER JOIN users su2 ON su2.id = sp2.user_id
           WHERE e2.course_id = e.course_id
             AND LOWER(e2.status) = 'active'
             AND su2.status = 'active'::user_status
          ) AS student_names
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        INNER JOIN student_profiles sp ON sp.id = ls.student_id
        INNER JOIN users su ON su.id = sp.user_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        ${whereClause}
        GROUP BY
          ls.google_calendar_event_id,
          ls.google_meet_link,
          ls.meet_link_source,
          ls.google_meet_space_id,
          ls.teacher_id,
          ls.subject_id,
          ls.title,
          ls.description,
          ls.rescheduled_from_id,
          e.course_id,
          ls.status
        ORDER BY MIN(ls.scheduled_start) ASC
        `,
        ...values
      ),
      getScheduleOptions(),
    ]);

    return json("Lecture schedules fetched.", 200, { items, ...options });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch lecture schedules.",
      500
    );
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const courseId = normalizeText(body?.courseId || body?.course_id);
    const studentIds = [];
    const teacherId = normalizeText(body?.teacherId);
    const subjectId = normalizeText(body?.subjectId);
    const title = normalizeText(body?.title);
    const description = normalizeText(body?.description);
    const startDate = normalizeText(body?.startDate || body?.start_date);
    const endDate = normalizeText(body?.endDate || body?.end_date);
    const startTime = normalizeText(body?.startTime || body?.start_time);
    const endTime = normalizeText(body?.endTime || body?.end_time);
    const selectedDays = Array.isArray(body?.days)
      ? body.days.map(normalizeText).filter(Boolean)
      : Array.isArray(body?.daysSelected)
        ? body.daysSelected.map(normalizeText).filter(Boolean)
        : [];
    const manualMeetLink = normalizeText(body?.googleMeetLink || body?.google_meet_link);

    if (!courseId || !teacherId || !subjectId || !title || !startDate || !endDate || !startTime || !endTime || !selectedDays.length) {
      return json("Class, teacher, subject, title, date range, times, and lecture days are required.", 400);
    }

    if (manualMeetLink && !isValidGoogleMeetLink(manualMeetLink)) {
      return json("Google Meet link must start with https://meet.google.com/.", 400);
    }

    const startDateValue = parseScheduleDate(startDate);
    const endDateValue = parseScheduleDate(endDate);

    if (!startDateValue || !endDateValue) {
      return json("Please provide valid lecture start and end dates.", 400);
    }

    if (endDateValue < startDateValue) {
      return json("Lecture end date must be on or after the start date.", 400);
    }

    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);
    if (
      Number.isNaN(startHours) ||
      Number.isNaN(startMinutes) ||
      Number.isNaN(endHours) ||
      Number.isNaN(endMinutes) ||
      startHours < 0 ||
      startHours > 23 ||
      endHours < 0 ||
      endHours > 23 ||
      startMinutes < 0 ||
      startMinutes > 59 ||
      endMinutes < 0 ||
      endMinutes > 59
    ) {
      return json("Please provide valid lecture start and end times.", 400);
    }

    const isOvernight = startHours > endHours || (startHours === endHours && startMinutes >= endMinutes);

    const weekdayMap = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    const selectedWeekdays = selectedDays
      .map((day) => weekdayMap[day.toLowerCase()])
      .filter((value) => typeof value === "number");

    if (!selectedWeekdays.length) {
      return json("Select at least one lecture day.", 400);
    }

    const occurrenceDates = [];
    const currentDate = new Date(
      startDateValue.getFullYear(),
      startDateValue.getMonth(),
      startDateValue.getDate()
    );
    const endLimit = new Date(
      endDateValue.getFullYear(),
      endDateValue.getMonth(),
      endDateValue.getDate()
    );

    while (currentDate <= endLimit) {
      if (selectedWeekdays.includes(currentDate.getDay())) {
        occurrenceDates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (!occurrenceDates.length) {
      return json("No lecture days fall within the selected date range.", 400);
    }

    function formatScheduleDate(date, hours, minutes) {
      const scheduled = new Date(date);
      scheduled.setHours(hours, minutes, 0, 0);
      const year = scheduled.getFullYear();
      const month = String(scheduled.getMonth() + 1).padStart(2, "0");
      const day = String(scheduled.getDate()).padStart(2, "0");
      const hour = String(scheduled.getHours()).padStart(2, "0");
      const minute = String(scheduled.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}:00`;
    }

    function formatScheduleDateWithOffset(date, hours, minutes, dayOffset = 0) {
      const scheduled = new Date(date);
      scheduled.setDate(scheduled.getDate() + dayOffset);
      scheduled.setHours(hours, minutes, 0, 0);
      const year = scheduled.getFullYear();
      const month = String(scheduled.getMonth() + 1).padStart(2, "0");
      const day = String(scheduled.getDate()).padStart(2, "0");
      const hour = String(scheduled.getHours()).padStart(2, "0");
      const minute = String(scheduled.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}:00`;
    }

    const [course] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM courses
      WHERE id = ${courseId}::uuid
        AND COALESCE(status, 'active'::user_status) = 'active'::user_status
      LIMIT 1
    `;

    if (!course?.id) {
      return json("Class not found.", 404);
    }

    const [subjectAllowed] = await prisma.$queryRaw`
      SELECT s.id::text AS id
      FROM course_subjects cs
      INNER JOIN subjects s ON s.id = cs.subject_id
      WHERE cs.course_id = ${courseId}::uuid
        AND s.id = ${subjectId}::uuid
      LIMIT 1
    `;

    if (!subjectAllowed?.id) {
      return json("Selected subject is not available for this student's class.", 400);
    }

    const [teacher] = await prisma.$queryRaw`
      SELECT tp.id::text AS id, u.id::text AS user_id, u.email, u.full_name
      FROM teacher_profiles tp
      INNER JOIN users u ON u.id = tp.user_id
      WHERE tp.id = ${teacherId}::uuid
        AND u.status = 'active'::user_status
      LIMIT 1
    `;

    if (!teacher?.id) {
      return json("Teacher not found.", 404);
    }

    const [teacherAssigned] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM teacher_assignments
      WHERE teacher_id = ${teacherId}::uuid
        AND course_id = ${courseId}::uuid
        AND subject_id = ${subjectId}::uuid
        AND student_id IS NULL
        AND status = 'active'::user_status
      LIMIT 1
    `;

    if (!teacherAssigned?.id) {
      return json("Selected teacher is not assigned to this class subject.", 400);
    }

    const selectedStudentSql = studentIds.map((id) => Prisma.sql`${id}::uuid`);
    const enrollmentRows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          e.id::text AS enrollment_id,
          e.student_id::text AS student_id,
          su.id::text AS student_user_id,
          su.full_name AS student_name,
          su.email AS student_email,
          pu.id::text AS parent_user_id,
          pu.email AS parent_email,
          pu.full_name AS parent_name,
          sub.name AS subject_name
        FROM enrollments e
        INNER JOIN student_profiles sp ON sp.id = e.student_id
        INNER JOIN users su ON su.id = sp.user_id
        INNER JOIN subjects sub ON sub.id = ${subjectId}::uuid
        LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
        LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
        LEFT JOIN users pu ON pu.id = pp.user_id
        WHERE e.course_id = ${courseId}::uuid
          ${studentIds.length ? Prisma.sql`AND e.student_id IN (${Prisma.join(selectedStudentSql)})` : Prisma.sql``}
          AND LOWER(e.status) = 'active'
          AND COALESCE(sp.status, 'active'::user_status) = 'active'::user_status
          AND su.status = 'active'::user_status
        ORDER BY su.full_name ASC
      `
    );

    if (studentIds.length && enrollmentRows.length !== studentIds.length) {
      return json("One or more selected students are not enrolled in this class.", 400);
    }

    if (!enrollmentRows.length) {
      return json("No active students found for this class.", 400);
    }

    const representativeEnrollment = enrollmentRows[0];
    const lectureInsertRows = [];
    const meetingAttendees = [
      teacher.email ? { email: teacher.email, name: teacher.full_name } : null,
    ].filter(Boolean);
    const firstOccurrenceStart = formatScheduleDate(occurrenceDates[0], startHours, startMinutes);
    const firstOccurrenceEnd = isOvernight
      ? formatScheduleDateWithOffset(occurrenceDates[0], endHours, endMinutes, 1)
      : formatScheduleDate(occurrenceDates[0], endHours, endMinutes);
    let firstResolvedMeetLink = manualMeetLink;

    for (const date of occurrenceDates) {
      const scheduledStart = formatScheduleDate(date, startHours, startMinutes);
      const scheduledEnd = isOvernight
        ? formatScheduleDateWithOffset(date, endHours, endMinutes, 1)
        : formatScheduleDate(date, endHours, endMinutes);
      const conflict = await findTeacherScheduleConflict({
        teacherId,
        scheduledStart,
        scheduledEnd,
      });

      if (conflict) {
        return json(teacherConflictMessage(conflict), 409, {
          code: "TEACHER_SCHEDULE_CONFLICT",
          conflict,
        });
      }
    }

    for (const date of occurrenceDates) {
      const scheduledStart = formatScheduleDate(date, startHours, startMinutes);
      const scheduledEnd = isOvernight
        ? formatScheduleDateWithOffset(date, endHours, endMinutes, 1)
        : formatScheduleDate(date, endHours, endMinutes);

      let calendarData = {
        eventId: "",
        meetSpaceId: extractMeetCodeFromLink(manualMeetLink),
        meetLink: manualMeetLink,
      };
      let resolvedMeetLink = manualMeetLink;
      let resolvedMeetSource = manualMeetLink ? "manual" : "google_workspace";

      try {
        calendarData = await createCalendarLectureEvent({
          organizerEmail: session.user.email || "",
          title,
          description,
          start: scheduledStart,
          end: scheduledEnd,
          attendees: meetingAttendees,
        });

        if (calendarData.meetLink) {
          resolvedMeetLink = calendarData.meetLink;
          resolvedMeetSource = "google_workspace";
        }
      } catch (error) {
        if (!manualMeetLink) {
          return json(error instanceof Error ? error.message : "Unable to create the Google Meet event.", 400);
        }
      }

      if (!resolvedMeetLink || !isValidGoogleMeetLink(resolvedMeetLink)) {
        return json("Unable to create a valid Google Meet link. Provide a fallback Google Meet link or complete Google Workspace organizer setup.", 400);
      }

      if (!firstResolvedMeetLink && resolvedMeetLink) {
        firstResolvedMeetLink = resolvedMeetLink;
      }

      lectureInsertRows.push(
        Prisma.sql`
          (
            ${crypto.randomUUID()}::uuid,
            ${representativeEnrollment.enrollment_id}::uuid,
            ${representativeEnrollment.student_id}::uuid,
            ${teacherId}::uuid,
            ${subjectId}::uuid,
            ${session.user.id}::uuid,
            ${title},
            ${description || null},
            ${scheduledStart}::timestamp,
            ${scheduledEnd}::timestamp,
            ${calendarData.eventId || null},
            ${resolvedMeetLink || null},
            ${resolvedMeetSource},
            ${calendarData.meetSpaceId || null},
            'scheduled'::lecture_status,
            NOW(),
            NOW()
          )
        `
      );
    }

    const createdMeta = await prisma.$transaction(
      async (tx) => {
        if (!lectureInsertRows.length) {
          return { ids: [] };
        }

        const createdRows = await tx.$queryRaw`
          INSERT INTO lecture_schedules (
            id,
            enrollment_id,
            student_id,
            teacher_id,
            subject_id,
            scheduled_by,
            title,
            description,
            scheduled_start,
            scheduled_end,
            google_calendar_event_id,
            google_meet_link,
            meet_link_source,
            google_meet_space_id,
            status,
            created_at,
            updated_at
          )
          VALUES ${Prisma.join(lectureInsertRows)}
          RETURNING id::text AS id
        `;

        return { ids: createdRows.map((row) => row.id) };
      },
      { timeout: 15000 }
    );

    await sendLectureLinkEmails({
      teacher,
      enrollmentRows,
      title,
      scheduledStart: firstOccurrenceStart,
      meetLink: firstResolvedMeetLink || manualMeetLink,
    });

    await createAuditLog({
      actorUserId: session.user.id,
      action: "lecture_scheduled",
      entityType: "lecture_schedules",
      entityId: createdMeta.ids[0],
      newData: {
        teacherId,
        subjectId,
        courseId,
        studentIds,
        startDate,
        endDate,
        startTime,
        endTime,
        days: selectedDays,
        scheduledStart: firstOccurrenceStart,
        scheduledEnd: firstOccurrenceEnd,
      },
    });

    const created = await prisma.$queryRaw`
      SELECT
        ls.id::text AS id,
        ls.enrollment_id::text AS enrollment_id,
        ls.student_id::text AS student_id,
        ls.teacher_id::text AS teacher_id,
        ls.subject_id::text AS subject_id,
        ls.title,
        ls.description,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        ls.status::text AS status,
        ls.google_calendar_event_id,
        ls.google_meet_link,
        ls.meet_link_source,
        ls.google_meet_space_id,
        ls.rescheduled_from_id::text AS rescheduled_from_id,
        su.full_name AS student_name,
        tu.full_name AS teacher_name,
        sub.name AS subject_name,
        c.title AS course_title
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN courses c ON c.id = e.course_id
      INNER JOIN student_profiles sp ON sp.id = ls.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      WHERE ls.id IN (${Prisma.join(createdMeta.ids.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY ls.scheduled_start ASC, su.full_name ASC
    `;

    return json("Lectures scheduled.", 201, {
      item: created[0] || null,
      items: created,
      createdCount: created.length,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to schedule lecture.",
      500
    );
  }
}
