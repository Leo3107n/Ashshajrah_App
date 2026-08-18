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
  pushColumn("entity_type", "fee_settings");
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

export async function GET() {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const feeSettingsExists = await tableExists("fee_settings");
    const vouchersExists = await tableExists("fee_vouchers");
    const submissionsExists = await tableExists("fee_submissions");
    const registrationLeadsExists = await tableExists("registration_leads");

    const settings =
      feeSettingsExists
        ? await prisma.$queryRaw`
            SELECT
              id::text AS id,
              key,
              COALESCE(label, name, key, 'Setting') AS label,
              COALESCE(name, label, key, 'Setting') AS name,
              COALESCE(key, name, label, id::text) AS setting_key,
              COALESCE(value::text, '') AS value,
              COALESCE(description, '') AS description,
              COALESCE(status::text, 'active') AS status,
              updated_at
            FROM fee_settings
            ORDER BY created_at DESC NULLS LAST, id DESC
          `
        : [];

    const voucherSummary =
      vouchersExists
        ? await prisma.$queryRaw`
            SELECT LOWER(status::text) AS status, COUNT(*)::int AS total
            FROM fee_vouchers
            GROUP BY LOWER(status::text)
          `
        : [];

    const submissionSummary =
      submissionsExists
        ? await prisma.$queryRaw`
            SELECT LOWER(status::text) AS status, COUNT(*)::int AS total
            FROM fee_submissions
            GROUP BY LOWER(status::text)
          `
        : [];

    const recentVouchers =
      vouchersExists && registrationLeadsExists
        ? await prisma.$queryRaw`
            SELECT
              fv.id::text AS id,
              fv.voucher_no,
              fv.amount,
              LOWER(fv.status::text) AS status,
              rl.student_name,
              rl.parent_name
            FROM fee_vouchers fv
            LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
            ORDER BY fv.created_at DESC NULLS LAST, fv.id DESC
            LIMIT 8
          `
        : [];

    const recentSubmissions =
      submissionsExists && vouchersExists && registrationLeadsExists
        ? await prisma.$queryRaw`
            SELECT
              fs.id::text AS id,
              fs.transaction_id,
              fs.paid_amount,
              LOWER(fs.status::text) AS status,
              fv.voucher_no,
              rl.student_name
            FROM fee_submissions fs
            INNER JOIN fee_vouchers fv ON fv.id = fs.voucher_id
            LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
            ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
            LIMIT 8
          `
        : [];

    return json("Fee settings fetched.", 200, {
      available: feeSettingsExists,
      settings,
      finance: {
        totalSettings: settings.length,
        voucherCreated: Number(
          voucherSummary.find((item) => item.status === "unpaid")?.total || 0
        ),
        vouchersSubmitted: Number(
          voucherSummary.find((item) => item.status === "submitted")?.total || 0
        ),
        paymentsVerified: Number(
          submissionSummary.find((item) => item.status === "verified")?.total || 0
        ),
      },
      recentVouchers,
      recentSubmissions,
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch fee settings.",
      500
    );
  }
}

export async function PATCH(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  if (String(authState.session.user.role || "").toLowerCase() !== "superadmin") {
    return json("Only Super Admin can update fee settings.", 403);
  }

  try {
    if (!(await tableExists("fee_settings"))) {
      return json("Fee settings table is not available yet.", 400);
    }

    const body = await request.json();
    const id = normalizeText(body?.id);
    const value = normalizeText(body?.value);
    const description = normalizeText(body?.description);
    const status = normalizeText(body?.status).toLowerCase();

    if (!id) {
      return json("Setting id is required.", 400);
    }

    const columns = await getTableColumns("fee_settings");
    const updates = [];

    if (columns.value) {
      updates.push(Prisma.sql`value = ${value}`);
    }
    if (columns.description) {
      updates.push(Prisma.sql`description = ${description || null}`);
    }
    if (columns.status && status) {
      updates.push(Prisma.sql`status = ${status}`);
    }

    await prisma.$transaction(async (tx) => {
      if (updates.length) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE fee_settings
            SET ${Prisma.join(updates, ", ")}
            WHERE id = ${id}::uuid
          `
        );
      }

      await insertAuditLog(
        authState.session.user.id,
        id,
        "fee_setting_updated",
        `Fee setting ${id} updated by admin.`,
        { status },
        tx
      );
    });

    return json("Fee setting updated.", 200);
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to update fee setting.",
      500
    );
  }
}
