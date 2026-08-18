import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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
      is_nullable,
      column_default,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
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

function subjectStatusSummary(items) {
  return {
    total: items.length,
    active: items.filter((item) => item.status === "active").length,
    inactive: items.filter((item) => item.status === "inactive").length,
  };
}

async function getAvailableClasses(tx = prisma) {
  if (!(await tableExists("courses"))) {
    return [];
  }

  return tx.$queryRaw`
    SELECT
      id::text AS id,
      title,
      class_level
    FROM courses
    WHERE class_level IS NOT NULL
      AND TRIM(class_level) <> ''
      AND LOWER(status::text) = 'active'
    ORDER BY class_level ASC
  `;
}

async function syncSubjectCourses(tx, subjectId, courseIds) {
  if (!(await tableExists("course_subjects"))) {
    return;
  }

  await tx.$executeRaw`
    DELETE FROM course_subjects
    WHERE subject_id = ${subjectId}::uuid
  `;

  const uniqueCourseIds = Array.from(
    new Set((Array.isArray(courseIds) ? courseIds : []).filter(Boolean))
  );

  if (!uniqueCourseIds.length) {
    return;
  }

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO course_subjects (id, course_id, subject_id)
      SELECT gen_random_uuid(), c.id::uuid, ${subjectId}::uuid
      FROM courses c
      WHERE c.id IN (${Prisma.join(uniqueCourseIds.map((item) => Prisma.sql`${item}::uuid`))})
      ON CONFLICT (course_id, subject_id) DO NOTHING
    `
  );
}

async function insertAuditLog(actorUserId, targetId, action, description, metadata = {}, tx = prisma) {
  const columns = await getTableColumns("audit_logs", tx);

  if (!Object.keys(columns).length) {
    return;
  }

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();

  if (columns.id) {
    addColumn(insertColumns, insertValues, columns, "id", crypto.randomUUID());
    supportedColumns.add("id");
  }
  if (columns.actor_user_id) {
    addColumn(insertColumns, insertValues, columns, "actor_user_id", actorUserId);
    supportedColumns.add("actor_user_id");
  }
  if (columns.entity_type) {
    addColumn(insertColumns, insertValues, columns, "entity_type", "subjects");
    supportedColumns.add("entity_type");
  }
  if (columns.entity_id) {
    addColumn(insertColumns, insertValues, columns, "entity_id", targetId);
    supportedColumns.add("entity_id");
  }
  if (columns.action) {
    addColumn(insertColumns, insertValues, columns, "action", action);
    supportedColumns.add("action");
  }
  if (columns.description) {
    addColumn(insertColumns, insertValues, columns, "description", description);
    supportedColumns.add("description");
  }
  if (columns.metadata) {
    addColumn(insertColumns, insertValues, columns, "metadata", JSON.stringify(metadata));
    supportedColumns.add("metadata");
  }
  if (columns.meta) {
    addColumn(insertColumns, insertValues, columns, "meta", JSON.stringify(metadata));
    supportedColumns.add("meta");
  }

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO audit_logs (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    if (!(await tableExists("subjects"))) {
      return json("Subjects table is not available yet.", 200, {
        available: false,
        items: [],
        summary: { total: 0, active: 0, inactive: 0 },
      });
    }

    const columns = await getTableColumns("subjects");
    const courseSubjectsExists = await tableExists("course_subjects");
    const coursesExists = await tableExists("courses");
    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const courseId = normalizeText(searchParams.get("courseId"));
    const conditions = [];
    const values = [];

    if (status && columns.status) {
      values.push(status);
      conditions.push(`LOWER(subjects.status::text) = $${values.length}`);
    }

    if (courseId && courseSubjectsExists) {
      values.push(courseId);
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM course_subjects cs_filter
          WHERE cs_filter.subject_id = subjects.id
            AND cs_filter.course_id = $${values.length}::uuid
        )
      `);
    }

    if (search) {
      const term = `%${search}%`;
      const searchConditions = [];

      if (columns.name) {
        values.push(term);
        searchConditions.push(`subjects.name ILIKE $${values.length}`);
      }
      if (columns.code) {
        values.push(term);
        searchConditions.push(`subjects.code ILIKE $${values.length}`);
      }
      if (columns.description) {
        values.push(term);
        searchConditions.push(`subjects.description ILIKE $${values.length}`);
      }

      if (searchConditions.length) {
        conditions.push(`(${searchConditions.join(" OR ")})`);
      }
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const nameSelect = columns.name ? "subjects.name" : "NULL AS name";
    const descriptionSelect = columns.description
      ? "subjects.description"
      : "NULL AS description";
    const statusSelect = columns.status
      ? "LOWER(subjects.status::text) AS status"
      : "'active' AS status";
    const classFields =
      courseSubjectsExists && coursesExists
        ? `
            COALESCE(STRING_AGG(DISTINCT c.id::text, ','), '') AS course_ids_csv,
            COALESCE(STRING_AGG(DISTINCT COALESCE(c.class_level, c.title, ''), ', '), '') AS class_level
          `
        : `'' AS course_ids_csv, '' AS class_level`;
    const joins =
      courseSubjectsExists && coursesExists
        ? `
            LEFT JOIN course_subjects cs ON cs.subject_id = subjects.id
            LEFT JOIN courses c ON c.id = cs.course_id
          `
        : "";

    const items = await prisma.$queryRawUnsafe(
      `
        SELECT
          subjects.id::text AS id,
          ${nameSelect},
          ${descriptionSelect},
          ${statusSelect},
          ${classFields}
        FROM subjects
        ${joins}
        ${whereClause}
        GROUP BY subjects.id
        ORDER BY ${columns.created_at ? "subjects.created_at DESC NULLS LAST" : "subjects.id DESC"}
      `,
      ...values
    );

    const classOptions = await getAvailableClasses();
    const normalizedItems = items.map((item) => ({
      ...item,
      course_ids: String(item.course_ids_csv || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    }));

    return json("Subjects fetched.", 200, {
      available: true,
      items: normalizedItems,
      classOptions,
      summary: subjectStatusSummary(normalizedItems),
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch subjects.",
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
    return json("Only Super Admin can create subjects.", 403);
  }

  try {
    if (!(await tableExists("subjects"))) {
      return json("Subjects table is not available yet.", 400);
    }

    const body = await request.json();
    const name = normalizeText(body?.name);
    const description = normalizeText(body?.description);
    const status = normalizeText(body?.status).toLowerCase() || "active";
    const courseIds = Array.isArray(body?.courseIds)
      ? body.courseIds.map((item) => normalizeText(item)).filter(Boolean)
      : [];

    if (!name) {
      return json("Subject name is required.", 400);
    }
    if (!courseIds.length) {
      return json("At least one class is required.", 400);
    }

    const columns = await getTableColumns("subjects");
    const id = crypto.randomUUID();
    const insertColumns = [];
    const insertValues = [];

    if (columns.id) {
      addColumn(insertColumns, insertValues, columns, "id", id);
    }
    if (columns.name) {
      addColumn(insertColumns, insertValues, columns, "name", name);
    }
    if (columns.description) {
      addColumn(
        insertColumns,
        insertValues,
        columns,
        "description",
        description || null
      );
    }
    if (columns.status) {
      addColumn(insertColumns, insertValues, columns, "status", status);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO subjects (${Prisma.join(insertColumns, ", ")})
          VALUES (${Prisma.join(insertValues, ", ")})
        `
      );

      await syncSubjectCourses(tx, id, courseIds);

      await insertAuditLog(
        authState.session.user.id,
        id,
        "subject_created",
        `Subject ${name} created by admin.`,
        { status, courseIds },
        tx
      );
    });

    return json("Subject created.", 201, {
      item: { id, name, description, status, course_ids: courseIds, class_level: "" },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create subject.",
      500
    );
  }
}
