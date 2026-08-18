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

async function getTableColumns(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = true;
    return accumulator;
  }, {});
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    if (!(await tableExists("audit_logs"))) {
      return json("Audit logs table is not available yet.", 200, {
        available: false,
        items: [],
        actions: [],
        entityTypes: [],
        summary: { total: 0, recent: 0 },
      });
    }

    const columns = await getTableColumns("audit_logs");
    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const action = normalizeText(searchParams.get("action")).toLowerCase();
    const entityType = normalizeText(searchParams.get("entityType")).toLowerCase();
    const days = Number(searchParams.get("days") || 30);
    if (!Number.isInteger(days) || ![7, 30, 90, 365].includes(days)) {
      return json("Audit range must be 7, 30, 90, or 365 days.", 400);
    }
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - days);
    const conditions = [];
    const values = [];

    if (columns.created_at) {
      values.push(startDate);
      conditions.push(`al.created_at >= $${values.length}`);
    }

    if (action && columns.action) {
      values.push(action);
      conditions.push(`LOWER(al.action) = $${values.length}`);
    }

    if (entityType && columns.entity_type) {
      values.push(entityType);
      conditions.push(`LOWER(al.entity_type) = $${values.length}`);
    }

    if (search) {
      const term = `%${search}%`;
      const searchConditions = [];

      if (columns.description) {
        values.push(term);
        searchConditions.push(`al.description ILIKE $${values.length}`);
      }
      if (columns.action) {
        values.push(term);
        searchConditions.push(`al.action ILIKE $${values.length}`);
      }
      if (columns.entity_type) {
        values.push(term);
        searchConditions.push(`al.entity_type ILIKE $${values.length}`);
      }
      values.push(term);
      searchConditions.push(
        `COALESCE(actor.full_name, actor.email, actor.phone, 'System') ILIKE $${values.length}`
      );

      if (searchConditions.length) {
        conditions.push(`(${searchConditions.join(" OR ")})`);
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const createdAtSelect = columns.created_at ? "al.created_at" : "NULL AS created_at";
    const descriptionSelect = columns.description ? "al.description" : "'' AS description";
    const actionSelect = columns.action ? "al.action" : "'unknown' AS action";
    const entityTypeSelect = columns.entity_type
      ? "COALESCE(al.entity_type, 'system') AS entity_type"
      : "'system' AS entity_type";
    const entityIdSelect = columns.entity_id
      ? "COALESCE(al.entity_id::text, '') AS entity_id"
      : "'' AS entity_id";
    const orderClause = columns.created_at ? "al.created_at DESC NULLS LAST" : "al.id DESC";

    const items = await prisma.$queryRawUnsafe(
      `
        SELECT
          al.id::text AS id,
          ${actionSelect},
          ${descriptionSelect},
          ${entityTypeSelect},
          ${entityIdSelect},
          ${createdAtSelect},
          COALESCE(actor.full_name, actor.email, actor.phone, 'System') AS actor_name,
          COALESCE(actor.email, '') AS actor_email
        FROM audit_logs al
        LEFT JOIN users actor ON actor.id = al.actor_user_id
        ${whereClause}
        ORDER BY ${orderClause}
        LIMIT 100
      `,
      ...values
    );

    const countRows = await prisma.$queryRawUnsafe(
      `
        SELECT COUNT(*)::int AS total
        FROM audit_logs al
        LEFT JOIN users actor ON actor.id = al.actor_user_id
        ${whereClause}
      `,
      ...values
    );

    const [actionRows, entityRows] = await Promise.all([
      columns.action
        ? prisma.$queryRaw`
            SELECT DISTINCT LOWER(action) AS value
            FROM audit_logs
            WHERE action IS NOT NULL
              AND TRIM(action) <> ''
            ORDER BY value ASC
          `
        : [],
      columns.entity_type
        ? prisma.$queryRaw`
            SELECT DISTINCT LOWER(entity_type) AS value
            FROM audit_logs
            WHERE entity_type IS NOT NULL
              AND TRIM(entity_type) <> ''
            ORDER BY value ASC
          `
        : [],
    ]);

    return json("Audit logs fetched.", 200, {
      available: true,
      items,
      actions: actionRows.map((item) => item.value).filter(Boolean),
      entityTypes: entityRows.map((item) => item.value).filter(Boolean),
      summary: {
        total: Number(countRows?.[0]?.total || 0),
        loaded: items.length,
      },
      readOnly: true,
      role: String(authState.session?.user?.role || "").toLowerCase(),
      range: {
        days,
        from: startDate.toISOString(),
        to: new Date().toISOString(),
      },
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch audit logs.", 500);
  }
}
