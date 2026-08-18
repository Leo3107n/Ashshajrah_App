import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CLASS_SUBJECTS, normalizeClassLevel } from "@/lib/academicCatalog";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeClassInput(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTextCandidate(value) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = normalizeTextCandidate(item);
      if (text) return text;
    }
    return "";
  }

  const candidates = [
    value.classMode,
    value.class_mode,
    value.name,
    value.title,
    value.label,
    value.value,
    value.text,
    value.description,
    value.status,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean") {
      const text = String(candidate).trim();
      if (text) {
        return text;
      }
    }
  }

  for (const nested of Object.values(value)) {
    const text = normalizeTextCandidate(nested);
    if (text) {
      return text;
    }
  }

  return "";
}

function normalizeCourseStatus(value) {
  const status = normalizeText(value).toLowerCase();
  return ["active", "pending", "suspended", "archived"].includes(status)
    ? status
    : "active";
}

async function requireAdminSession() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return { error: json("Unauthorized.", 401) };
  }

  if (role !== "admin" && role !== "superadmin") {
    return { error: json("Forbidden.", 403) };
  }

  return { session };
}

async function tableExists(tableName) {
  const [row] = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `;

  return Boolean(row?.exists);
}

async function getTableColumns(tableName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      dataType: row.data_type,
      udtName: row.udt_name,
    };
    return accumulator;
  }, {});
}

function getValueSql(columnMeta, value) {
  if (!columnMeta || value === null || typeof value === "undefined") {
    return Prisma.sql`${value ?? null}`;
  }

  if (columnMeta.udtName === "uuid") {
    return Prisma.sql`${value}::uuid`;
  }

  if (columnMeta.dataType === "USER-DEFINED" && columnMeta.udtName) {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.udtName)}`;
  }

  return Prisma.sql`${value}`;
}

function addColumn(columns, values, columnMap, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  values.push(getValueSql(columnMap[name], value));
}

async function syncCourseSubjects(tx, courseId, classLevel) {
  const subjects = CLASS_SUBJECTS[classLevel] || [];

  if (!subjects.length) {
    return;
  }

  await tx.$executeRaw`
    DELETE FROM course_subjects
    WHERE course_id = ${courseId}::uuid
  `;

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO course_subjects (course_id, subject_id)
      SELECT ${courseId}::uuid, s.id
      FROM subjects s
      WHERE s.name IN (${Prisma.join(subjects)})
      ON CONFLICT (course_id, subject_id) DO NOTHING
    `
  );
}

async function insertAuditLog(actorUserId, targetId, action, description, metadata = {}, tx = prisma) {
  await tx.$executeRaw`
    INSERT INTO audit_logs (id, actor_user_id, entity_type, entity_id, action)
    VALUES (
      ${crypto.randomUUID()}::uuid,
      ${actorUserId}::uuid,
      ${"courses"},
      ${targetId}::uuid,
      ${action}
    )
  `;
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const coursesExists = await tableExists("courses");
    const subjectsExists = await tableExists("subjects");
    const courseSubjectsExists = await tableExists("course_subjects");
    const schedulesExists = await tableExists("lecture_schedules");

    if (!coursesExists) {
      return json("Courses table is not available yet.", 200, {
        available: false,
        items: [],
        subjects: [],
        schedules: [],
        summary: { total: 0, active: 0, draft: 0, schedules: 0 },
      });
    }

    const columns = await getTableColumns("courses");
    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const subjectId = normalizeText(searchParams.get("subjectId"));
    const conditions = [];
    const values = [];

    if (status && columns.status) {
      values.push(status);
      conditions.push(`LOWER(c.status::text) = $${values.length}`);
    }

    if (subjectId && courseSubjectsExists) {
      values.push(subjectId);
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM course_subjects cs_filter
          WHERE cs_filter.course_id = c.id
            AND cs_filter.subject_id = $${values.length}::uuid
        )
      `);
    }

    if (search) {
      const term = `%${search}%`;
      const searchConditions = [];

      if (columns.name) {
        values.push(term);
        searchConditions.push(`c.name ILIKE $${values.length}`);
      }
      if (columns.title) {
        values.push(term);
        searchConditions.push(`c.title ILIKE $${values.length}`);
      }
      if (columns.code) {
        values.push(term);
        searchConditions.push(`c.code ILIKE $${values.length}`);
      }
      if (columns.description) {
        values.push(term);
        searchConditions.push(`c.description ILIKE $${values.length}`);
      }

      if (searchConditions.length) {
        conditions.push(`(${searchConditions.join(" OR ")})`);
      }
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const nameSelect = columns.title ? "c.title AS name" : "NULL AS name";
    const descriptionSelect = columns.description
      ? "c.description"
      : "NULL AS description";
    const classModeSelect = columns.class_level
      ? "c.class_level AS class_mode"
      : "c.title AS class_mode";
    const statusSelect = columns.status
      ? "LOWER(c.status::text) AS status"
      : "'pending' AS status";
    const createdAtSelect = columns.created_at
      ? "c.created_at::text AS created_at"
      : "NULL AS created_at";
    const subjectJoin =
      subjectsExists && courseSubjectsExists
        ? `
            LEFT JOIN course_subjects cs ON cs.course_id = c.id
            LEFT JOIN subjects s ON s.id = cs.subject_id
          `
        : "";
    const assignedSubjectsSelect =
      subjectsExists && courseSubjectsExists
        ? "STRING_AGG(s.name, ', ' ORDER BY s.name) AS assigned_subjects"
        : "NULL AS assigned_subjects";

    const items = await prisma.$queryRawUnsafe(
      `
        SELECT
          c.id::text AS id,
          ${nameSelect},
          NULL AS code,
          ${descriptionSelect},
          ${classModeSelect},
          NULL AS capacity,
          NULL AS subject_id,
          ${statusSelect},
          ${createdAtSelect},
          ${assignedSubjectsSelect},
          NULL AS subject_name
        FROM courses c
        ${subjectJoin}
        ${whereClause}
        GROUP BY c.id
        ORDER BY ${columns.created_at ? "c.created_at DESC NULLS LAST" : "c.id DESC"}
      `,
      ...values
    );

    const subjects =
      subjectsExists
        ? await prisma.$queryRaw`
            SELECT id::text AS id, name
            FROM subjects
            ORDER BY name ASC
          `
        : [];

    const schedules =
      schedulesExists
        ? await prisma.$queryRaw`
            SELECT
              id::text AS id,
              COALESCE(title, 'Lecture schedule') AS title,
              COALESCE(scheduled_start::text, '') AS schedule_time,
              COALESCE(status::text, 'scheduled') AS status
            FROM lecture_schedules
            ORDER BY created_at DESC NULLS LAST, id DESC
            LIMIT 8
          `
        : [];

    return json("Classes fetched.", 200, {
      available: true,
      items,
      subjects,
      schedules,
      summary: {
        total: items.length,
        active: items.filter((item) => item.status === "active").length,
        draft: items.filter((item) => item.status === "pending").length,
        schedules: schedules.length,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch classes.",
      500
    );
  }
}

export async function POST(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can create classes.", 403);
  }

  try {
    if (!(await tableExists("courses"))) {
      return json("Courses table is not available yet.", 400);
    }

    const body = await request.json();
    const rawClassValue =
      normalizeClassInput(body?.classMode) ||
      normalizeClassInput(body?.name) ||
      normalizeTextCandidate(body?.classMode) ||
      normalizeTextCandidate(body?.name);
    const classLevel = normalizeClassLevel(rawClassValue) || rawClassValue;
    const description = normalizeTextCandidate(body?.description);
    const status = normalizeCourseStatus(normalizeTextCandidate(body?.status));

    if (!classLevel) {
      return json("Class name is required.", 400);
    }

    const [existing] = await prisma.$queryRaw`
      SELECT id::text
      FROM courses
      WHERE class_level = ${classLevel}
         OR title = ${classLevel}
      LIMIT 1
    `;

    if (existing?.id) {
      return json("This class already exists.", 409);
    }

    const id = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO courses (
          id,
          title,
          class_level,
          description,
          status
        )
        VALUES (
          ${id}::uuid,
          ${classLevel},
          ${classLevel},
          ${description || null},
          ${status}::user_status
        )
      `;

      await syncCourseSubjects(tx, id, classLevel);

      await insertAuditLog(
        authState.session.user.id,
        id,
        "course_created",
        `Class ${classLevel} created by admin.`,
        { status },
        tx
      );
    });

    return json("Class created.", 201, {
      item: {
        id,
        name: classLevel,
        code: null,
        subject_id: null,
        description,
        class_mode: classLevel,
        capacity: null,
        assigned_subjects: (CLASS_SUBJECTS[classLevel] || []).join(", "),
        status,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create class.",
      500
    );
  }
}
