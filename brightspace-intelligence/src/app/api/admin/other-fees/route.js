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

function normalizeMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

async function requireAdminSession() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();
  if (!session?.user) return { error: json("Unauthorized.", 401) };
  if (role !== "admin" && role !== "superadmin") return { error: json("Forbidden.", 403) };
  return { session };
}

async function tableExists(tableName) {
  const [row] = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `;
  return Boolean(row?.exists);
}

async function getColumns(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
  `;
  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = { dataType: row.data_type, udtName: row.udt_name };
    return accumulator;
  }, {});
}

function valueSql(columnMeta, value) {
  if (!columnMeta || value === null || typeof value === "undefined") {
    return Prisma.sql`${value ?? null}`;
  }
  if (columnMeta.udtName === "uuid") return Prisma.sql`${value}::uuid`;
  if (columnMeta.dataType === "USER-DEFINED" && columnMeta.udtName) {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.udtName)}`;
  }
  return Prisma.sql`${value}`;
}

export async function GET() {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;
  try {
    if (!(await tableExists("other_fee"))) {
      return json("Other fee table is not available yet.", 200, { available: false, items: [] });
    }
    const columns = await getColumns("other_fee");
    const items = await prisma.$queryRaw`
      SELECT
        of.id::text AS id,
        ${columns.title ? Prisma.sql`of.title AS name,` : Prisma.sql`NULL AS name,`}
        ${columns.title ? Prisma.sql`of.title,` : Prisma.sql`NULL AS title,`}
        ${columns.fee_type ? Prisma.sql`of.fee_type,` : Prisma.sql`NULL AS fee_type,`}
        ${columns.class_level ? Prisma.sql`of.class_level,` : Prisma.sql`NULL AS class_level,`}
        ${columns.amount ? Prisma.sql`of.amount::float8 AS amount,` : Prisma.sql`0::float8 AS amount,`}
        ${columns.discount_id ? Prisma.sql`of.discount_id::text AS discount_id,` : Prisma.sql`NULL AS discount_id,`}
        ${columns.discount_percent ? Prisma.sql`of.discount_percent::float8 AS discount_percent,` : Prisma.sql`NULL AS discount_percent,`}
        ${columns.discount_amount ? Prisma.sql`of.discount_amount::float8 AS discount_amount,` : Prisma.sql`NULL AS discount_amount,`}
        ${columns.net_amount ? Prisma.sql`of.net_amount::float8 AS net_amount,` : Prisma.sql`NULL AS net_amount,`}
        ${columns.description ? Prisma.sql`of.description,` : Prisma.sql`NULL AS description,`}
        ${columns.status ? Prisma.sql`LOWER(of.status::text) AS status` : Prisma.sql`'active' AS status`}
      FROM other_fee of
      ORDER BY of.created_at DESC NULLS LAST, of.id DESC
    `;
    return json("Other fees fetched.", 200, { available: true, items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch other fees.", 500);
  }
}

export async function POST(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;
  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can create other fees.", 403);
  }
  try {
    if (!(await tableExists("other_fee"))) {
      return json("Other fee table is not available yet.", 400);
    }
    const body = await request.json();
    const name = normalizeText(body?.name || body?.title);
    const feeType = normalizeText(body?.fee_type || body?.feeType);
    const classLevel = normalizeText(body?.class_level || body?.classLevel);
    const description = normalizeText(body?.description);
    const amount = normalizeMoney(body?.amount);
    const discountId = normalizeText(body?.discount_id || body?.discountId);
    const discountPercent = normalizeMoney(body?.discount_percent || body?.discountPercent);
    const discountAmount = normalizeMoney(body?.discount_amount || body?.discountAmount);
    const netAmount = normalizeMoney(body?.net_amount || body?.netAmount);
    const status = normalizeText(body?.status).toLowerCase() || "active";

    if (!name) return json("Fee name is required.", 400);
    if (!feeType) return json("Fee type is required.", 400);
    if (amount === null) return json("Amount must be zero or greater.", 400);

    const columns = await getColumns("other_fee");
    const insertColumns = [];
    const insertValues = [];
    const push = (columnName, value) => {
      if (columns[columnName]) {
        insertColumns.push(Prisma.raw(`"${columnName}"`));
        insertValues.push(valueSql(columns[columnName], value));
      }
    };

    push("id", crypto.randomUUID());
    push("name", name);
    push("title", name);
    push("fee_type", feeType);
    push("class_level", classLevel || null);
    push("amount", amount);
    push("discount_id", discountId || null);
    push("discount_percent", discountPercent ?? null);
    push("discount_amount", discountAmount ?? null);
    push("net_amount", netAmount ?? null);
    push("description", description || null);
    push("status", status);
    push("created_at", new Date());

    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO other_fee (${Prisma.join(insertColumns, ", ")}) VALUES (${Prisma.join(insertValues, ", ")})`
    );

    return json("Other fee created.", 201);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to create other fee.", 500);
  }
}

export async function PATCH(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;
  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can update other fees.", 403);
  }
  try {
    if (!(await tableExists("other_fee"))) {
      return json("Other fee table is not available yet.", 400);
    }
    const body = await request.json();
    const id = normalizeText(body?.id);
    const name = normalizeText(body?.name || body?.title);
    const feeType = normalizeText(body?.fee_type || body?.feeType);
    const classLevel = normalizeText(body?.class_level || body?.classLevel);
    const description = normalizeText(body?.description);
    const amount = normalizeMoney(body?.amount);
    const discountId = normalizeText(body?.discount_id || body?.discountId);
    const discountPercent = normalizeMoney(body?.discount_percent || body?.discountPercent);
    const discountAmount = normalizeMoney(body?.discount_amount || body?.discountAmount);
    const netAmount = normalizeMoney(body?.net_amount || body?.netAmount);
    const status = normalizeText(body?.status).toLowerCase();

    if (!id) return json("Other fee id is required.", 400);
    if (!name) return json("Fee name is required.", 400);
    if (!feeType) return json("Fee type is required.", 400);
    if (amount === null) return json("Amount must be zero or greater.", 400);
    if (!["active", "inactive"].includes(status)) {
      return json("Status must be active or inactive.", 400);
    }

    const columns = await getColumns("other_fee");
    const updates = [
      Prisma.sql`name = ${name}`,
      Prisma.sql`title = ${name}`,
      Prisma.sql`fee_type = ${feeType}`,
      Prisma.sql`class_level = ${classLevel || null}`,
      Prisma.sql`amount = ${amount}`,
      Prisma.sql`description = ${description || null}`,
      Prisma.sql`status = ${status}`,
      Prisma.sql`updated_at = NOW()`,
    ];

    if (columns.discount_id) {
      updates.splice(5, 0, Prisma.sql`discount_id = ${discountId || null}::uuid`);
    }
    if (columns.discount_percent) {
      updates.splice(columns.discount_id ? 6 : 5, 0, Prisma.sql`discount_percent = ${discountPercent ?? null}`);
    }
    if (columns.discount_amount) {
      updates.splice(columns.discount_id ? 7 : columns.discount_percent ? 6 : 5, 0, Prisma.sql`discount_amount = ${discountAmount ?? null}`);
    }
    if (columns.net_amount) {
      updates.splice(
        columns.discount_id ? 8 : columns.discount_percent ? 7 : columns.discount_amount ? 6 : 5,
        0,
        Prisma.sql`net_amount = ${netAmount ?? null}`
      );
    }

    await prisma.$executeRaw`
      UPDATE other_fee
      SET ${Prisma.join(updates, ", ")}
      WHERE id = ${id}::uuid
    `;

    return json("Other fee updated.");
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to update other fee.", 500);
  }
}

export async function DELETE(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;
  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can delete other fees.", 403);
  }

  try {
    if (!(await tableExists("other_fee"))) {
      return json("Other fee table is not available yet.", 400);
    }

    const { searchParams } = new URL(request.url);
    const id = normalizeText(searchParams.get("id"));

    if (!id) {
      return json("Other fee id is required.", 400);
    }

    await prisma.$executeRaw`
      DELETE FROM other_fee
      WHERE id = ${id}::uuid
    `;

    return json("Other fee deleted.");
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to delete other fee.", 500);
  }
}
