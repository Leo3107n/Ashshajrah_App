import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const EDITABLE_ROLES = new Set(["admin", "coordinator", "teacher"]);

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

  if (columnMeta.dataType === "json" || columnMeta.dataType === "jsonb") {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.dataType)}`;
  }

  return Prisma.sql`${value}`;
}

function addColumn(columns, values, columnMap, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  values.push(getValueSql(columnMap[name], value));
}

function ensureSupportedRequiredColumns(tableName, columns, supportedColumns) {
  const missing = Object.entries(columns)
    .filter(
      ([columnName, meta]) =>
        !meta.nullable && !meta.defaultValue && !supportedColumns.has(columnName)
    )
    .map(([columnName]) => columnName);

  if (missing.length) {
    throw new Error(
      `${tableName} requires unsupported columns: ${missing.join(", ")}.`
    );
  }
}

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

async function getRoleId(roleName, tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT id::text AS id
    FROM roles
    WHERE LOWER(name) = ${roleName}
    LIMIT 1
  `;

  if (!row?.id) {
    throw new Error(`Role not found: ${roleName}`);
  }

  return row.id;
}

async function ensureUniqueUser(email, phone) {
  let row;

  if (email && phone) {
    [row] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM users
      WHERE LOWER(email) = ${email.toLowerCase()}
         OR phone = ${phone}
      LIMIT 1
    `;
  } else if (email) {
    [row] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM users
      WHERE LOWER(email) = ${email.toLowerCase()}
      LIMIT 1
    `;
  } else if (phone) {
    [row] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM users
      WHERE phone = ${phone}
      LIMIT 1
    `;
  } else {
    return;
  }

  if (row?.id) {
    throw new Error("A user with this email or phone number already exists.");
  }
}

async function insertAuditLog(actorUserId, targetId, action, description, metadata = {}, tx = prisma) {
  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO audit_logs (id, actor_user_id, entity_type, entity_id, action)
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${actorUserId}::uuid,
        ${"users"},
        ${targetId}::uuid,
        ${action}
      )
    `
  );
}

async function insertCredentialsMessage({
  relatedEntityId,
  recipientEmail,
  subject,
  body,
  bodyText,
  createdBy,
  tx,
}) {
  const messageId = crypto.randomUUID();

  await tx.$executeRaw`
    INSERT INTO outbound_messages (
      id,
      message_type,
      related_entity_type,
      related_entity_id,
      recipient_email,
      subject,
      body,
      body_text,
      sent_status,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      ${messageId}::uuid,
      'payment_credentials',
      'user',
      ${relatedEntityId}::uuid,
      ${recipientEmail},
      ${subject},
      ${body},
      ${bodyText},
      'sent',
      ${createdBy}::uuid,
      NOW(),
      NOW()
    )
  `;

  return messageId;
}

async function syncProfile(tableName, payload, tx) {
  const profileId = crypto.randomUUID();

  if (tableName === "coordinator_profiles") {
    await tx.$executeRaw`
      INSERT INTO coordinator_profiles (id, user_id, status)
      VALUES (${profileId}::uuid, ${payload.userId}::uuid, ${payload.status || "active"}::user_status)
    `;
    return;
  }

  if (tableName === "teacher_profiles") {
    await tx.$executeRaw`
      INSERT INTO teacher_profiles (id, user_id, status)
      VALUES (${profileId}::uuid, ${payload.userId}::uuid, ${payload.status || "active"}::user_status)
    `;
  }
}

function getDisplayNameSql(userColumns) {
  if (userColumns.full_name) {
    return Prisma.sql`COALESCE(NULLIF(u.full_name, ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
  }

  if (userColumns.name) {
    return Prisma.sql`COALESCE(NULLIF(u.name, ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
  }

  if (userColumns.first_name && userColumns.last_name) {
    return Prisma.sql`COALESCE(NULLIF(CONCAT_WS(' ', u.first_name, u.last_name), ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
  }

  return Prisma.sql`COALESCE(NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const userColumns = await getTableColumns("users");
    const displayNameSql = getDisplayNameSql(userColumns);
    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const role = normalizeText(searchParams.get("role")).toLowerCase();
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];

    if (role) {
      conditions.push(Prisma.sql`LOWER(r.name) = ${role}`);
    }

    if (status) {
      conditions.push(Prisma.sql`LOWER(u.status::text) = ${status}`);
    }

    if (search) {
      const term = `%${search}%`;
      const searchConditions = [
        Prisma.sql`u.email ILIKE ${term}`,
        Prisma.sql`u.phone ILIKE ${term}`,
      ];

      if (userColumns.full_name) {
        searchConditions.push(Prisma.sql`u.full_name ILIKE ${term}`);
      } else if (userColumns.name) {
        searchConditions.push(Prisma.sql`u.name ILIKE ${term}`);
      } else if (userColumns.first_name && userColumns.last_name) {
        searchConditions.push(
          Prisma.sql`CONCAT_WS(' ', u.first_name, u.last_name) ILIKE ${term}`
        );
      }

      conditions.push(
        Prisma.sql`(${Prisma.join(searchConditions, Prisma.sql` OR `)})`
      );
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.empty;

    const items = await prisma.$queryRaw`
      SELECT
        u.id::text AS id,
        ${displayNameSql} AS name,
        u.email,
        u.phone,
        LOWER(u.status::text) AS status,
        LOWER(r.name) AS role
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      ${whereClause}
      ORDER BY u.created_at DESC NULLS LAST, u.id DESC
    `;

    const summaryRows = await prisma.$queryRaw`
      SELECT
        LOWER(r.name) AS role,
        COUNT(*)::int AS total
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      GROUP BY LOWER(r.name)
    `;

    return json("Staff records fetched.", 200, {
      items: items.map((item) => ({
        ...item,
        editable: EDITABLE_ROLES.has(item.role),
      })),
      summary: {
        totalUsers: items.length,
        coordinators: Number(
          summaryRows.find((item) => item.role === "coordinator")?.total || 0
        ),
        teachers: Number(
          summaryRows.find((item) => item.role === "teacher")?.total || 0
        ),
        active: items.filter((item) => item.status === "active").length,
        suspended: items.filter((item) => item.status === "suspended").length,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch staff records.",
      500
    );
  }
}

export async function POST(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const body = await request.json();
    const fullName = normalizeText(body?.fullName);
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);
    const role = normalizeText(body?.role).toLowerCase();
    const password =
      typeof body?.password === "string" ? body.password.trim() : "";

    if (!EDITABLE_ROLES.has(role)) {
      return json("Only admin, coordinator, and teacher can be created here.", 400);
    }

    if (
      String(authState.session.user.role || "").toLowerCase() === "admin" &&
      role === "admin"
    ) {
      return json("Admins cannot create other administrator accounts.", 403);
    }

    if (!fullName) {
      return json("Full name is required.", 400);
    }

    if (!email && !phone) {
      return json("Email is required.", 400);
    }

    if (password.length < 8) {
      return json("Password must be at least 8 characters.", 400);
    }

    await ensureUniqueUser(email, phone);

    const roleId = await getRoleId(role);
    const hashedPassword = await password;
    const userId = crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO users (
          id,
          role_id,
          full_name,
          email,
          phone,
          password_hash,
          status,
          must_change_password
        )
        VALUES (
          ${userId}::uuid,
          ${roleId}::uuid,
          ${fullName},
          ${email || null},
          ${phone || null},
          ${hashedPassword},
          ${"active"}::user_status,
          ${true}
        )
      `;

      if (role === "coordinator" || role === "teacher") {
        await syncProfile(
          role === "coordinator" ? "coordinator_profiles" : "teacher_profiles",
          {
            userId,
            fullName,
            email,
            phone,
            status: "active",
          },
          tx
        );
      }

      await insertAuditLog(
        authState.session.user.id,
        userId,
        "user_created",
        `${role} account created by admin.`,
        { role },
        tx
      );

      if (email) {
        await insertCredentialsMessage({
          relatedEntityId: userId,
          recipientEmail: email,
          subject: "Your LMS access credentials",
          body: `Login Credentials Created\n\nStaff Login\nName: ${fullName}\nEmail: ${email || "-"}\nPhone: ${phone || "-"}\nTemporary Password: ${password}\n\nLogin Page:\n${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`,
          bodyText: `Login Credentials Created\n\nStaff Login\nName: ${fullName}\nEmail: ${email || "-"}\nPhone: ${phone || "-"}\nTemporary Password: ${password}\n\nLogin Page:\n${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`,
          createdBy: authState.session.user.id,
          tx,
        });
      }
    });

    return json("Staff user created.", 201, {
      item: {
        id: userId,
        name: fullName,
        email,
        phone,
        role,
        status: "active",
        editable: true,
        temporary_password: password,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create staff user.",
      500
    );
  }
}
