import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headlinesTableExists } from "@/lib/headlines";

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
  pushColumn("entity_type", "headlines");
  pushColumn("entity_id", targetId);
  pushColumn("action", action);
  pushColumn("description", description);
  pushColumn("metadata", JSON.stringify(metadata));
  pushColumn("meta", JSON.stringify(metadata));

  if (!insertColumns.length) {
    return;
  }

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO audit_logs (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

function validateHeadline({ headline, startDate, endDate }) {
  if (!headline) {
    return "Headline text is required.";
  }

  if (!startDate || !endDate) {
    return "Start date and end date are required.";
  }

  if (Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate))) {
    return "Please provide valid dates.";
  }

  if (endDate < startDate) {
    return "End date must be on or after the start date.";
  }

  return "";
}

export async function PATCH(request, { params }) {
  try {
    const authState = await requireAdminSession();

    if (authState.error) {
      return authState.error;
    }

    if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
      return json("Only Super Admin can update headlines.", 403);
    }

    if (!(await headlinesTableExists())) {
      return json("Headlines table is not available yet.", 400);
    }

    const { id } = await params;
    const body = await request.json();
    const headline = normalizeText(body?.headline);
    const startDate = normalizeText(body?.startDate);
    const endDate = normalizeText(body?.endDate);
    const validationMessage = validateHeadline({ headline, startDate, endDate });

    if (validationMessage) {
      return json(validationMessage, 400);
    }

    const columns = await getTableColumns("headlines");
    const updates = [];

    if (columns.headline) {
      updates.push(Prisma.sql`headline = ${headline}`);
    }
    if (columns.start_date) {
      updates.push(Prisma.sql`start_date = ${startDate}::date`);
    }
    if (columns.end_date) {
      updates.push(Prisma.sql`end_date = ${endDate}::date`);
    }
    if (columns.updated_at) {
      updates.push(Prisma.sql`updated_at = ${new Date()}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE headlines
          SET ${Prisma.join(updates, ", ")}
          WHERE id = ${id}::uuid
        `
      );

      await insertAuditLog(
        authState.session.user.id,
        id,
        "headline_updated",
        `Headline updated by admin.`,
        { headline, startDate, endDate },
        tx
      );
    });

    return json("Headline updated.", 200);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to update headline.", 500);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const authState = await requireAdminSession();

    if (authState.error) {
      return authState.error;
    }

    if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
      return json("Only Super Admin can delete headlines.", 403);
    }

    if (!(await headlinesTableExists())) {
      return json("Headlines table is not available yet.", 400);
    }

    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM headlines
        WHERE id = ${id}::uuid
      `;

      await insertAuditLog(
        authState.session.user.id,
        id,
        "headline_deleted",
        `Headline deleted by admin.`,
        {},
        tx
      );
    });

    return json("Headline deleted.", 200);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to delete headline.", 500);
  }
}
