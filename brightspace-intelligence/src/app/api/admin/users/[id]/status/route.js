import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_STATUSES = new Set(["active", "suspended"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getTableColumns(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT
      column_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
    };
    return accumulator;
  }, {});
}

async function insertAuditLog(actorUserId, targetUserId, action, description, metadata = {}) {
  const columns = await getTableColumns("audit_logs");

  if (!Object.keys(columns).length) {
    return;
  }

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();

  const addColumn = (name, value) => {
    insertColumns.push(Prisma.raw(name));
    insertValues.push(Prisma.sql`${value}`);
    supportedColumns.add(name);
  };

  if (columns.id) {
    addColumn("id", crypto.randomUUID());
  }
  if (columns.actor_user_id) {
    addColumn("actor_user_id", actorUserId);
  }
  if (columns.target_user_id) {
    addColumn("target_user_id", targetUserId);
  }
  if (columns.action) {
    addColumn("action", action);
  }
  if (columns.description) {
    addColumn("description", description);
  }
  if (columns.metadata) {
    addColumn("metadata", JSON.stringify(metadata));
  }
  if (columns.meta) {
    addColumn("meta", JSON.stringify(metadata));
  }

  const requiredUnsupported = Object.entries(columns)
    .filter(
      ([columnName, meta]) =>
        !meta.nullable && !meta.defaultValue && !supportedColumns.has(columnName)
    )
    .map(([columnName]) => columnName);

  if (requiredUnsupported.length) {
    return;
  }

  if (!insertColumns.length) {
    return;
  }

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO audit_logs (${Prisma.join(insertColumns, Prisma.sql`, `)})
      VALUES (${Prisma.join(insertValues, Prisma.sql`, `)})
    `
  );
}

export async function PATCH(request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (role !== "admin" && role !== "superadmin") {
    return json("Forbidden.", 403);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const nextStatus = normalizeText(body?.status).toLowerCase();

    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return json("Invalid status.", 400);
    }

    const [target] = await prisma.$queryRaw`
      SELECT u.id::text AS id, LOWER(r.name) AS role
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = ${id}::uuid
      LIMIT 1
    `;

    if (!target?.id) {
      return json("User not found.", 404);
    }

    if (
      role === "admin" &&
      ["superadmin", "admin"].includes(String(target.role || "").toLowerCase())
    ) {
      return json("Admins cannot change administrator account status.", 403);
    }

    const [updated] = await prisma.$queryRaw`
      UPDATE users
      SET status = ${nextStatus}::user_status
      WHERE id = ${id}::uuid
      RETURNING id::text AS id, status::text AS status
    `;

    if (!updated?.id) {
      return json("User not found.", 404);
    }

    await insertAuditLog(
      session.user.id,
      updated.id,
      nextStatus === "active" ? "user_activated" : "user_suspended",
      `User status changed to ${nextStatus}.`,
      { status: nextStatus }
    );

    return json("User status updated.", 200, { item: updated });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to update user status.",
      500
    );
  }
}
