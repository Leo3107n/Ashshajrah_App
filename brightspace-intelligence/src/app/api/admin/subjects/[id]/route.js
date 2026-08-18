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

async function insertAuditLog(actorUserId, targetId, action, description, metadata = {}, tx = prisma) {
  const columns = await getTableColumns("audit_logs", tx);

  if (!Object.keys(columns).length) {
    return;
  }

  const insertColumns = [];
  const insertValues = [];

  const pushColumn = (name, value) => {
    if (columns[name]) {
      insertColumns.push(Prisma.raw(`"${name}"`));
      insertValues.push(getValueSql(columns[name], value));
    }
  };

  pushColumn("id", crypto.randomUUID());
  pushColumn("actor_user_id", actorUserId);
  pushColumn("entity_type", "subjects");
  pushColumn("entity_id", targetId);
  pushColumn("action", action);
  pushColumn("description", description);
  pushColumn("metadata", JSON.stringify(metadata));
  pushColumn("meta", JSON.stringify(metadata));

  if (insertColumns.length) {
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO audit_logs (${Prisma.join(insertColumns, ", ")})
        VALUES (${Prisma.join(insertValues, ", ")})
      `
    );
  }
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

export async function PATCH(request, { params }) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can update subjects.", 403);
  }

  try {
    if (!(await tableExists("subjects"))) {
      return json("Subjects table is not available yet.", 400);
    }

    const { id } = await params;
    const body = await request.json();
    const name = normalizeText(body?.name);
    const description = normalizeText(body?.description);
    const status = normalizeText(body?.status).toLowerCase();
    const courseIds = Array.isArray(body?.courseIds)
      ? body.courseIds.map((item) => normalizeText(item)).filter(Boolean)
      : [];
    const columns = await getTableColumns("subjects");
    const updates = [];

    if (columns.name) {
      updates.push(Prisma.sql`name = ${name}`);
    }
    if (columns.description) {
      updates.push(Prisma.sql`description = ${description || null}`);
    }
    if (columns.status && status) {
      updates.push(Prisma.sql`status = ${getValueSql(columns.status, status)}`);
    }

    await prisma.$transaction(async (tx) => {
      if (updates.length) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE subjects
            SET ${Prisma.join(updates, ", ")}
            WHERE id = ${id}::uuid
          `
        );
      }

      await syncSubjectCourses(tx, id, courseIds);

      await insertAuditLog(
        authState.session.user.id,
        id,
        "subject_updated",
        `Subject ${name || id} updated by admin.`,
        { status, courseIds },
        tx
      );
    });

    return json("Subject updated.", 200, {
      item: { id, name, description, status, course_ids: courseIds },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to update subject.",
      500
    );
  }
}

export async function DELETE(_request, { params }) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can delete subjects.", 403);
  }

  try {
    if (!(await tableExists("subjects"))) {
      return json("Subjects table is not available yet.", 400);
    }

    const { id } = await params;
    const subjectId = String(id || "").trim();

    if (!subjectId) {
      return json("Subject id is required.", 400);
    }

    const [existing] = await prisma.$queryRaw`
      SELECT
        s.id::text AS id,
        COALESCE(s.name, 'Subject') AS name
      FROM subjects s
      WHERE s.id = ${subjectId}::uuid
      LIMIT 1
    `;

    if (!existing?.id) {
      return json("Subject not found.", 404);
    }

    await prisma.$transaction(async (tx) => {
      if (await tableExists("course_subjects")) {
        await tx.$executeRaw`
          DELETE FROM course_subjects
          WHERE subject_id = ${subjectId}::uuid
        `;
      }

      await tx.$executeRaw`
        DELETE FROM subjects
        WHERE id = ${subjectId}::uuid
      `;

      await insertAuditLog(
        authState.session.user.id,
        subjectId,
        "subject_deleted",
        `Subject ${existing.name} deleted by admin.`,
        {},
        tx
      );
    });

    return json("Subject deleted.", 200, { id: subjectId });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to delete subject.",
      500
    );
  }
}
