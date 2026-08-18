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

function extractText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
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
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `;
  return Boolean(row?.exists);
}

export async function GET() {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;

  try {
    if (!(await tableExists("regular_fee"))) {
      return json("Regular fee table is not available yet.", 200, {
        available: false,
        items: [],
      });
    }

    const items = await prisma.$queryRaw`
      SELECT
        rf.id::text AS id,
        rf.class_level,
        COALESCE(rf.name, 'Regular Fee') AS name,
        rf.amount::text AS amount,
        rf.status,
        rf.created_at,
        rf.updated_at
      FROM regular_fee rf
      ORDER BY rf.created_at DESC NULLS LAST, rf.id DESC
    `;

    return json("Regular fees fetched.", 200, { available: true, items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch regular fees.", 500);
  }
}

export async function POST(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;
  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can create regular fees.", 403);
  }

  try {
    if (!(await tableExists("regular_fee"))) {
      return json("Regular fee table is not available yet.", 400);
    }

    const body = await request.json();
    const classLevel = normalizeText(body?.class_level || body?.classLevel);
    const name = normalizeText(body?.name || body?.title);
    const amount = normalizeMoney(body?.amount);
    const status = normalizeText(body?.status).toLowerCase() || "active";

    if (!classLevel) return json("Class level is required.", 400);
    if (!name) return json("Name is required.", 400);
    if (amount === null) return json("Amount must be zero or greater.", 400);

    const insertColumns = [];
    const insertValues = [];
    insertColumns.push(
      Prisma.raw(`"id"`),
      Prisma.raw(`"class_level"`),
      Prisma.raw(`"name"`),
      Prisma.raw(`"amount"`),
      Prisma.raw(`"status"`),
      Prisma.raw(`"created_at"`),
      Prisma.raw(`"updated_at"`)
    );
    insertValues.push(
      Prisma.sql`${crypto.randomUUID()}::uuid`,
      Prisma.sql`${classLevel}`,
      Prisma.sql`${name}`,
      Prisma.sql`${amount}`,
      Prisma.sql`${status}`,
      Prisma.sql`${new Date()}`,
      Prisma.sql`${new Date()}`
    );

    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO regular_fee (${Prisma.join(insertColumns, ", ")}) VALUES (${Prisma.join(insertValues, ", ")})`
    );

    return json("Regular fee created.", 201);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to create regular fee.", 500);
  }
}

export async function PATCH(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;
  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can update regular fees.", 403);
  }

  try {
    if (!(await tableExists("regular_fee"))) {
      return json("Regular fee table is not available yet.", 400);
    }

    const body = await request.json();
    const id = normalizeText(body?.id);
    const classLevel = extractText(body?.class_level ?? body?.classLevel);
    const name = extractText(body?.name ?? body?.title);
    const amount = normalizeMoney(body?.amount);
    const status = extractText(body?.status).toLowerCase();
    const hasObjectInput =
      (body?.class_level && typeof body.class_level === "object") ||
      (body?.classLevel && typeof body.classLevel === "object") ||
      (body?.name && typeof body.name === "object") ||
      (body?.title && typeof body.title === "object") ||
      (body?.amount && typeof body.amount === "object") ||
      (body?.status && typeof body.status === "object");

    if (!id) return json("Regular fee id is required.", 400);
    if (hasObjectInput) {
      return json("Regular fee fields must be plain text or numbers, not nested objects.", 400);
    }
    if (!classLevel) return json("Class level is required.", 400);
    if (!name) return json("Name is required.", 400);
    if (amount === null) return json("Amount must be zero or greater.", 400);
    if (status && !["active", "inactive"].includes(status)) {
      return json("Status must be active or inactive.", 400);
    }

    await prisma.$executeRaw`
      UPDATE regular_fee
      SET
        class_level = ${classLevel},
        name = ${name},
        amount = ${amount},
        status = ${status},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return json("Regular fee updated.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update regular fee.";
    return json(
      message.includes('syntax error at or near "Object"')
        ? "Regular fee update failed. Please review the selected class, name, amount, and status."
        : message,
      500
    );
  }
}
