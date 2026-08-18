import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["teacher", "admin"];
const VALID_STATUS = new Set(["present", "absent", "leave"]);
function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
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

async function ensureLeaveEnumValue() {
  await prisma.$executeRaw`
    ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'leave'
  `;
}

async function ensurePendingAttendanceColumn() {
  await prisma.$executeRaw`
    ALTER TABLE lecture_schedules
    ADD COLUMN IF NOT EXISTS pending_student_attendance JSONB
  `;
}

function baseLectureConditions(teacherId, classLevel, subjectId) {
  const conditions = [
    `(
      ls.scheduled_start::timestamp <= timezone('Asia/Karachi', now())
      AND LOWER(COALESCE(ls.status::text, 'scheduled')) NOT IN ('scheduled', 'upcoming', 'cancelled')
    )`,
  ];
  const values = [];

  if (teacherId) {
    values.push(teacherId);
    conditions.push(`ls.teacher_id = $${values.length}::uuid`);
  }

  if (classLevel) {
    values.push(classLevel);
    conditions.push(`LOWER(TRIM(COALESCE(c.class_level, ''))) = LOWER(TRIM($${values.length}::text))`);
  }

  if (subjectId) {
    values.push(subjectId);
    conditions.push(`ls.subject_id = $${values.length}::uuid`);
  }

  return { conditions, values };
}

function baseSubjectConditions(teacherId, classLevel) {
  const conditions = [];
  const values = [];

  if (teacherId) {
    values.push(teacherId);
    conditions.push(`tp.id = $${values.length}::uuid`);
  }

  if (classLevel) {
    values.push(classLevel);
    conditions.push(`LOWER(TRIM(COALESCE(c.class_level, ''))) = LOWER(TRIM($${values.length}::text))`);
  }

  return { conditions, values };
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const teacherId = await getTeacherId(session);
    await ensurePendingAttendanceColumn();
    const { searchParams } = new URL(request.url);
    const classLevel = String(searchParams.get("classLevel") || "").trim();
    const subjectId = String(searchParams.get("subjectId") || "").trim();
    const lectureId = String(searchParams.get("lectureId") || "").trim();
    const { conditions, values } = baseLectureConditions(teacherId, classLevel, subjectId);
    const { conditions: subjectConditions, values: subjectValues } = baseSubjectConditions(teacherId, classLevel);
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const subjectWhereClause = subjectConditions.length ? `WHERE ${subjectConditions.join(" AND ")}` : "";
    const shouldLoadLectures = Boolean(classLevel && subjectId);

    const [classes, subjects, lectures] = await Promise.all([
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
        SELECT DISTINCT
          sub.id::text AS id,
          sub.name,
          c.class_level
        FROM teacher_assignments ta
        INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
        INNER JOIN courses c ON c.id = ta.course_id
        INNER JOIN subjects sub ON sub.id = ta.subject_id
        ${subjectWhereClause}
          AND ta.student_id IS NULL
          AND ta.status = 'active'::user_status
          AND COALESCE(sub.status, 'active'::user_status) = 'active'::user_status
        ORDER BY sub.name ASC
        `,
        ...subjectValues
      ),
      shouldLoadLectures
        ? prisma.$queryRawUnsafe(
            `
            SELECT
              ls.id::text AS id,
              ls.title,
              ls.scheduled_start::text AS scheduled_start,
              ls.scheduled_end::text AS scheduled_end,
              ls.status::text AS status,
              ls.pending_student_attendance,
              sub.name AS subject_name,
              c.class_level
            FROM lecture_schedules ls
            INNER JOIN enrollments e ON e.id = ls.enrollment_id
            INNER JOIN courses c ON c.id = e.course_id
            INNER JOIN subjects sub ON sub.id = ls.subject_id
            ${whereClause}
            ORDER BY ls.scheduled_start DESC, ls.id DESC
            `,
            ...values
          )
        : Promise.resolve([]),
    ]);

    let selectedLecture = null;
    let students = [];

    if (lectureId) {
      const selectedValues = [];
      const selectedConditions = [];
      if (teacherId) {
        selectedValues.push(teacherId);
        selectedConditions.push(`ls.teacher_id = $${selectedValues.length}::uuid`);
      }
      selectedValues.push(lectureId);
      selectedConditions.push(`ls.id = $${selectedValues.length}::uuid`);
      const selectedWhere = `WHERE ${selectedConditions.join(" AND ")}`;

      const [lecture] = await prisma.$queryRawUnsafe(
        `
        SELECT
          ls.id::text AS id,
          ls.title,
          ls.scheduled_start::text AS scheduled_start,
          ls.scheduled_end::text AS scheduled_end,
          ls.status::text AS status,
          ls.enrollment_id::text AS enrollment_id,
          ls.pending_student_attendance,
          e.course_id::text AS course_id,
          c.class_level,
          sub.id::text AS subject_id,
          sub.name AS subject_name
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        ${teacherId ? "INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id" : ""}
        ${selectedWhere}
        LIMIT 1
        `,
        ...selectedValues
      );

      selectedLecture = lecture || null;

      if (selectedLecture?.course_id) {
        const pendingRows = Array.isArray(selectedLecture.pending_student_attendance)
          ? selectedLecture.pending_student_attendance
          : [];
        const pendingMap = new Map(
          pendingRows
            .map((row) => [String(row?.studentUserId || row?.student_user_id || "").trim(), row])
            .filter(([key]) => key)
        );
        students = await prisma.$queryRaw`
          SELECT DISTINCT
            sp.id::text AS student_id,
            su.id::text AS user_id,
            su.full_name,
            su.username,
            su.email,
            su.phone,
            COALESCE(NULLIF(LOWER(TRIM(su.username)), ''), LOWER(TRIM(su.full_name))) AS sort_key,
            COALESCE(la.status::text, 'absent') AS status,
            la.source::text AS source,
            la.joined_at,
            la.left_at
          FROM enrollments e2
          INNER JOIN student_profiles sp ON sp.id = e2.student_id
          INNER JOIN users su ON su.id = sp.user_id
          LEFT JOIN lecture_attendance la ON la.lecture_id = ${selectedLecture.id}::uuid AND la.user_id = su.id
          WHERE e2.course_id = ${selectedLecture.course_id}::uuid
            AND LOWER(e2.status) = 'active'
          ORDER BY sort_key ASC, su.full_name ASC
        `;

        students = students.map((row) => {
          const pending = pendingMap.get(String(row.user_id || "").trim());
          if (!pending) return row;
          return {
            ...row,
            status: String(pending.status || row.status || "absent").toLowerCase(),
            source: "manual",
          };
        });
      }
    }

    return json("Attendance options fetched.", 200, {
      classes,
      subjects,
      lectures,
      selectedLecture,
      students,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load attendance options.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    await ensureLeaveEnumValue();
    await ensurePendingAttendanceColumn();
    const body = await request.json();
    const lectureId = String(body?.lectureId || "").trim();
    const records = Array.isArray(body?.students) ? body.students : [];

    if (!lectureId) return json("Lecture is required.", 400);
    if (!records.length) return json("Attendance rows are required.", 400);

    const teacherId = String(session.user.role).toLowerCase() === "admin" ? "" : await getTeacherId(session);
    const [lecture] = teacherId
      ? await prisma.$queryRaw`
        SELECT ls.id::text AS id
        FROM lecture_schedules ls
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        WHERE ls.id = ${lectureId}::uuid
            AND tp.user_id = ${session.user.id}::uuid
            AND (
              LOWER(ls.status::text) = 'live'
              OR LOWER(ls.status::text) = 'completed_by_teacher'
              OR (
                ls.scheduled_start::timestamp <= timezone('Asia/Karachi', now())
                AND ls.scheduled_end::timestamp >= timezone('Asia/Karachi', now())
              )
            )
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT ls.id::text AS id
          FROM lecture_schedules ls
          WHERE ls.id = ${lectureId}::uuid
            AND (
              LOWER(ls.status::text) = 'live'
              OR LOWER(ls.status::text) = 'completed_by_teacher'
              OR (
                ls.scheduled_start::timestamp <= timezone('Asia/Karachi', now())
                AND ls.scheduled_end::timestamp >= timezone('Asia/Karachi', now())
              )
            )
          LIMIT 1
        `;

    if (!lecture?.id) return json("Lecture not found.", 404);

    const pendingAttendance = records
      .map((row) => {
        const studentUserId = String(row?.studentUserId || "").trim();
        const status = String(row?.status || "").trim().toLowerCase();
        if (!studentUserId || !VALID_STATUS.has(status)) return null;
        return {
          studentUserId,
          status,
          roleType: "student",
          source: "manual",
        };
      })
      .filter(Boolean);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE lecture_schedules
        SET pending_student_attendance = ${JSON.stringify(pendingAttendance)}::jsonb,
            updated_at = NOW()
        WHERE id = ${lectureId}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
        VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'manual_attendance_saved', 'lecture_schedules', ${lectureId}::uuid, NOW())
      `;
    });

    return json("Attendance saved for coordinator approval.", 200, { pending_count: pendingAttendance.length });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to save attendance.", 500);
  }
}
