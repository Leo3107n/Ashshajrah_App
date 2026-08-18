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
    if (!(await tableExists("payment_methods"))) {
      return json("Payment methods table is not available yet.", 200, {
        available: false,
        items: [],
      });
    }

    const columns = await getColumns("payment_methods");
    const items = await prisma.$queryRaw`
      SELECT
        pm.id::text AS id,
        ${columns.name ? Prisma.sql`pm.name,` : Prisma.sql`NULL AS name,`}
        ${columns.method_key ? Prisma.sql`pm.method_key,` : Prisma.sql`NULL AS method_key,`}
        ${columns.account_title ? Prisma.sql`pm.account_title,` : Prisma.sql`NULL AS account_title,`}
        ${columns.account_number ? Prisma.sql`pm.account_number,` : Prisma.sql`NULL AS account_number,`}
        ${columns.iban ? Prisma.sql`pm.iban,` : Prisma.sql`NULL AS iban,`}
        ${columns.bank_name ? Prisma.sql`pm.bank_name,` : Prisma.sql`NULL AS bank_name,`}
        ${columns.branch_code ? Prisma.sql`pm.branch_code,` : Prisma.sql`NULL AS branch_code,`}
        ${columns.instructions ? Prisma.sql`pm.instructions,` : Prisma.sql`NULL AS instructions,`}
        ${columns.status ? Prisma.sql`LOWER(pm.status::text) AS status` : Prisma.sql`'active' AS status`}
      FROM payment_methods pm
      ORDER BY pm.id DESC
    `;

    return json("Payment methods fetched.", 200, { available: true, items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch payment methods.", 500);
  }
}

export async function POST(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;
  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can create payment methods.", 403);
  }
  try {
    if (!(await tableExists("payment_methods"))) {
      return json("Payment methods table is not available yet.", 400);
    }

    const body = await request.json();
    const name = normalizeText(body?.name);
    const methodKey = normalizeText(body?.method_key || body?.methodKey);
    const accountTitle = normalizeText(body?.account_title || body?.accountTitle);
    const accountNumber = normalizeText(body?.account_number || body?.accountNumber);
    const iban = normalizeText(body?.iban);
    const bankName = normalizeText(body?.bank_name || body?.bankName);
    const branchCode = normalizeText(body?.branch_code || body?.branchCode);
    const instructions = normalizeText(body?.instructions);
    const status = normalizeText(body?.status).toLowerCase() || "active";

    if (!name) return json("Name is required.", 400);
    if (!methodKey) return json("Method key is required.", 400);

    const columns = await getColumns("payment_methods");
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
    push("method_key", methodKey);
    push("account_title", accountTitle || null);
    push("account_number", accountNumber || null);
    push("iban", iban || null);
    push("bank_name", bankName || null);
    push("branch_code", branchCode || null);
    push("instructions", instructions || null);
    push("status", status);
    push("created_at", new Date());

    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO payment_methods (${Prisma.join(insertColumns, ", ")}) VALUES (${Prisma.join(insertValues, ", ")})`
    );

    return json("Payment method created.", 201);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to create payment method.", 500);
  }
}

export async function PATCH(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;
  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can update payment methods.", 403);
  }
  try {
    if (!(await tableExists("payment_methods"))) {
      return json("Payment methods table is not available yet.", 400);
    }

    const body = await request.json();
    const id = normalizeText(body?.id);
    const name = normalizeText(body?.name);
    const methodKey = normalizeText(body?.method_key || body?.methodKey);
    const accountTitle = normalizeText(body?.account_title || body?.accountTitle);
    const accountNumber = normalizeText(body?.account_number || body?.accountNumber);
    const iban = normalizeText(body?.iban);
    const bankName = normalizeText(body?.bank_name || body?.bankName);
    const branchCode = normalizeText(body?.branch_code || body?.branchCode);
    const instructions = normalizeText(body?.instructions);
    const status = normalizeText(body?.status).toLowerCase();

    if (!id) return json("Payment method id is required.", 400);
    if (!name) return json("Name is required.", 400);
    if (!methodKey) return json("Method key is required.", 400);
    if (!["active", "inactive"].includes(status)) {
      return json("Status must be active or inactive.", 400);
    }

    await prisma.$executeRaw`
      UPDATE payment_methods
      SET
        name = ${name},
        method_key = ${methodKey},
        account_title = ${accountTitle || null},
        account_number = ${accountNumber || null},
        iban = ${iban || null},
        bank_name = ${bankName || null},
        branch_code = ${branchCode || null},
        instructions = ${instructions || null},
        status = ${status},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return json("Payment method updated.");
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to update payment method.", 500);
  }
}

export async function DELETE(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;
  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can delete payment methods.", 403);
  }

  try {
    if (!(await tableExists("payment_methods"))) {
      return json("Payment method table is not available yet.", 400);
    }

    const { searchParams } = new URL(request.url);
    const id = normalizeText(searchParams.get("id"));

    if (!id) {
      return json("Payment method id is required.", 400);
    }

    await prisma.$executeRaw`
      DELETE FROM payment_methods
      WHERE id = ${id}::uuid
    `;

    return json("Payment method deleted.");
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to delete payment method.", 500);
  }
}
