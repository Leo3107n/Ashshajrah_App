import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator", "superadmin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getOptions() {
  const [teachers, students, courses, subjects, courseSubjects] = await Promise.all([
    prisma.$queryRaw`
      SELECT tp.id::text AS id, u.full_name
      FROM teacher_profiles tp
      INNER JOIN users u ON u.id = tp.user_id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `,
    prisma.$queryRaw`
      SELECT sp.id::text AS id, u.full_name
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `,
    prisma.$queryRaw`
      SELECT id::text AS id, COALESCE(NULLIF(class_level, ''), title) AS title
      FROM courses
      WHERE status = 'active'
      ORDER BY title ASC
    `,
    prisma.$queryRaw`
      SELECT id::text AS id, name
      FROM subjects
      WHERE status = 'active'
      ORDER BY name ASC
    `,
    prisma.$queryRaw`
      SELECT
        cs.course_id::text AS course_id,
        s.id::text AS id,
        s.name
      FROM course_subjects cs
      INNER JOIN subjects s ON s.id = cs.subject_id
      INNER JOIN courses c ON c.id = cs.course_id
      WHERE COALESCE(s.status, 'active'::user_status) = 'active'::user_status
        AND COALESCE(c.status, 'active'::user_status) = 'active'::user_status
      ORDER BY s.name ASC
    `,
  ]);

  return { teachers, students, courses, subjects, courseSubjects };
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
          tu.full_name ILIKE $${values.length}
          OR su.full_name ILIKE $${values.length}
          OR c.title ILIKE $${values.length}
          OR s.name ILIKE $${values.length}
        )`);
    }

    if (status) {
      values.push(status);
      conditions.push(`LOWER(ta.status::text) = $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [items, options] = await Promise.all([
      prisma.$queryRawUnsafe(
        `
        SELECT
          ta.id::text AS id,
          ta.teacher_id::text AS teacher_id,
          ta.student_id::text AS student_id,
          ta.course_id::text AS course_id,
          ta.subject_id::text AS subject_id,
          ta.status::text AS status,
          tu.full_name AS teacher_name,
          su.full_name AS student_name,
          COALESCE(NULLIF(c.class_level, ''), c.title) AS course_title,
          s.name AS subject_name,
          ta.created_at
        FROM teacher_assignments ta
        INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN student_profiles sp ON sp.id = ta.student_id
        LEFT JOIN users su ON su.id = sp.user_id
        LEFT JOIN courses c ON c.id = ta.course_id
        INNER JOIN subjects s ON s.id = ta.subject_id
        ${whereClause}
        ORDER BY ta.created_at DESC
        `,
        ...values
      ),
      getOptions(),
    ]);

    return json("Teacher assignments fetched.", 200, { items, ...options });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch teacher assignments.",
      500
    );
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const teacherId = normalizeText(body?.teacherId);
    const courseId = normalizeText(body?.courseId);
    const subjectId = normalizeText(body?.subjectId);

    if (!teacherId || !courseId || !subjectId) {
      return json("Teacher, class, and subject are required.", 400);
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
      return json("Selected subject is not available for this class.", 400);
    }

    const [existing] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM teacher_assignments
      WHERE teacher_id = ${teacherId}::uuid
        AND course_id = ${courseId}::uuid
        AND subject_id = ${subjectId}::uuid
        AND student_id IS NULL
        AND status = 'active'::user_status
      LIMIT 1
    `;

    if (existing?.id) {
      return json("This teacher is already assigned to this class subject.", 409);
    }

    const [created] = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        INSERT INTO teacher_assignments (
          id,
          teacher_id,
          student_id,
          course_id,
          subject_id,
          assigned_by,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${teacherId}::uuid,
          NULL,
          ${courseId}::uuid,
          ${subjectId}::uuid,
          ${session.user.id}::uuid,
          'active'::user_status,
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `;

      if (rows[0]?.id) {
        await createAuditLog(
          {
            actorUserId: session.user.id,
            action: "teacher_assigned",
            entityType: "teacher_assignments",
            entityId: rows[0].id,
            newData: {
              teacherId,
              courseId,
              subjectId,
              status: "active",
            },
          },
          tx
        );
      }

      return tx.$queryRaw`
        SELECT
          ta.id::text AS id,
          ta.teacher_id::text AS teacher_id,
          ta.student_id::text AS student_id,
          ta.course_id::text AS course_id,
          ta.subject_id::text AS subject_id,
          ta.status::text AS status,
          tu.full_name AS teacher_name,
          su.full_name AS student_name,
          COALESCE(NULLIF(c.class_level, ''), c.title) AS course_title,
          s.name AS subject_name,
          ta.created_at
        FROM teacher_assignments ta
        INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN student_profiles sp ON sp.id = ta.student_id
        LEFT JOIN users su ON su.id = sp.user_id
        LEFT JOIN courses c ON c.id = ta.course_id
        INNER JOIN subjects s ON s.id = ta.subject_id
        WHERE ta.id = ${rows[0].id}::uuid
      `;
    });

    return json("Teacher assigned to class subject.", 201, { item: created });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to create teacher assignment.",
      500
    );
  }
}
