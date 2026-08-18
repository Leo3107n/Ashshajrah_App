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

async function teacherFilter(session) {
  if (String(session.user.role).toLowerCase() === "admin") return { id: "", where: "", values: [] };
  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id FROM teacher_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
  `;
  if (!teacher?.id) throw new Error("Teacher profile not found.");
  return { id: teacher.id, where: "WHERE h.teacher_id = $1::uuid", values: [teacher.id] };
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const filter = await teacherFilter(session);
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        h.lecture_id::text AS lecture_id,
        ls.title AS lecture_title,
        ls.scheduled_start::text AS scheduled_start,
        h.title,
        h.description,
        h.due_date,
        MAX(h.created_at) AS created_at,
        MAX(h.updated_at) AS updated_at,
        h.teacher_id::text AS teacher_id,
        h.subject_id::text AS subject_id,
        COUNT(*)::int AS total_students_count,
        COUNT(*) FILTER (WHERE LOWER(h.status::text) = 'submitted')::int AS submitted_count,
        COUNT(*) FILTER (WHERE LOWER(h.status::text) IN ('pending', 'not_submitted', 'not submitted'))::int AS pending_count,
        COUNT(*) FILTER (WHERE LOWER(h.status::text) = 'graded')::int AS graded_count,
        COUNT(*) FILTER (WHERE LOWER(h.status::text) = 'submitted')::int AS submitted_students_count,
        COUNT(*) FILTER (WHERE LOWER(h.status::text) <> 'submitted')::int AS not_submitted_students_count,
        jsonb_agg(
          jsonb_build_object(
            'id', h.id::text,
            'student_id', h.student_id::text,
            'student_name', su.full_name,
            'student_username', su.username,
            'student_email', su.email,
            'status', h.status::text,
            'submitted_at', h.updated_at,
            'grade_level', sp.grade_level
          )
          ORDER BY su.full_name ASC
        ) AS student_rows,
        su2.full_name AS teacher_name,
        sub.name AS subject_name,
        c.title AS course_title,
        COALESCE(NULLIF(c.class_level, ''), c.title) AS class_level
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN subjects sub ON sub.id = h.subject_id
      INNER JOIN lecture_schedules ls ON ls.id = h.lecture_id
      INNER JOIN enrollments lecture_enrollment ON lecture_enrollment.id = ls.enrollment_id
      INNER JOIN teacher_profiles tp2 ON tp2.id = h.teacher_id
      INNER JOIN users su2 ON su2.id = tp2.user_id
      INNER JOIN enrollments e ON e.course_id = lecture_enrollment.course_id AND e.student_id = sp.id
      INNER JOIN courses c ON c.id = e.course_id
      ${filter.where}
      GROUP BY h.lecture_id, ls.title, ls.scheduled_start, h.title, h.description, h.due_date, h.teacher_id, h.subject_id, su2.full_name, sub.name, c.title, c.class_level
      ORDER BY MAX(h.created_at) DESC
      `,
      ...filter.values
    );
    return json("Homework fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load homework.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const lectureId = clean(body?.lectureId);
    const title = clean(body?.title);
    const description = clean(body?.description);
    const dueDate = clean(body?.dueDate);
    if (!lectureId || !title) return json("Lecture and homework title are required.", 400);

    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const [lecture] = isAdmin
      ? await prisma.$queryRaw`
          SELECT ls.id::text AS id, ls.teacher_id::text AS teacher_id, ls.subject_id::text AS subject_id, e.course_id::text AS course_id
          FROM lecture_schedules ls
          INNER JOIN enrollments e ON e.id = ls.enrollment_id
          WHERE ls.id = ${lectureId}::uuid
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT ls.id::text AS id, ls.teacher_id::text AS teacher_id, ls.subject_id::text AS subject_id, e.course_id::text AS course_id
          FROM lecture_schedules ls
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          INNER JOIN enrollments e ON e.id = ls.enrollment_id
          WHERE ls.id = ${lectureId}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `;
    if (!lecture?.id) return json("Assigned lecture not found.", 404);

    const students = await prisma.$queryRaw`
      SELECT
        sp.id::text AS student_id
      FROM enrollments e
      INNER JOIN student_profiles sp ON sp.id = e.student_id
      INNER JOIN users su ON su.id = sp.user_id
      WHERE e.course_id = ${lecture.course_id}::uuid
        AND LOWER(e.status::text) = 'active'
        AND LOWER(su.status::text) = 'active'
      GROUP BY sp.id, su.full_name
      ORDER BY su.full_name ASC
    `;

    if (!students.length) return json("No active students found for this class.", 404);

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const student of students) {
        const [row] = await tx.$queryRaw`
          INSERT INTO homework (
            id,
            lecture_id,
            student_id,
            teacher_id,
            subject_id,
            title,
            description,
            due_date,
            status,
            created_at,
            updated_at
          )
          VALUES (
            gen_random_uuid(),
            ${lectureId}::uuid,
            ${student.student_id}::uuid,
            ${lecture.teacher_id}::uuid,
            ${lecture.subject_id}::uuid,
            ${title},
            ${description || null},
            ${dueDate || null}::date,
            'pending'::homework_status,
            NOW(),
            NOW()
          )
          RETURNING id::text AS id
        `;
        if (row?.id) rows.push(row);
      }
      return rows;
    });

    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'homework_created', 'homework', ${lectureId}::uuid, NOW())
    `;
    return json("Homework created.", 201, { items: created });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to create homework.", 500);
  }
}

export async function PATCH(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const lectureId = clean(body?.lectureId);
    const title = clean(body?.title);
    const originalTitle = clean(body?.originalTitle);
    const description = clean(body?.description);
    const dueDate = clean(body?.dueDate);
    if (!lectureId || !title) return json("Lecture and homework title are required.", 400);

    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const lectureQuery = isAdmin
      ? prisma.$queryRaw`
          SELECT ls.id::text AS id, ls.teacher_id::text AS teacher_id, ls.subject_id::text AS subject_id
          FROM lecture_schedules ls
          WHERE ls.id = ${lectureId}::uuid
          LIMIT 1
        `
      : prisma.$queryRaw`
          SELECT ls.id::text AS id, ls.teacher_id::text AS teacher_id, ls.subject_id::text AS subject_id
          FROM lecture_schedules ls
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          WHERE ls.id = ${lectureId}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `;
    const [lecture] = await lectureQuery;
    if (!lecture?.id) return json("Assigned lecture not found.", 404);

    // A lecture may have more than one homework assignment. When the client
    // supplies the original title, constrain the batch update to that exact
    // assignment instead of modifying every homework row for the lecture.
    if (originalTitle) {
      await prisma.$executeRaw`
        UPDATE homework
        SET title = ${title},
            description = ${description || null},
            due_date = ${dueDate || null}::date,
            updated_at = NOW()
        WHERE lecture_id = ${lectureId}::uuid
          AND teacher_id = ${lecture.teacher_id}::uuid
          AND title = ${originalTitle}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE homework
        SET title = ${title},
            description = ${description || null},
            due_date = ${dueDate || null}::date,
            updated_at = NOW()
        WHERE lecture_id = ${lectureId}::uuid
          AND teacher_id = ${lecture.teacher_id}::uuid
      `;
    }

    return json("Homework updated.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to create homework.", 500);
  }
}
