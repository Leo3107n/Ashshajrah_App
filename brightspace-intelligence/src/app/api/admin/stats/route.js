import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function isDatabaseConnectionError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("Can't reach database server") ||
    message.includes("pooler.supabase.com") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("P1001")
  );
}

function emptyAdminStats() {
  return {
    overview: {
      totalUsers: 0,
      activeUsers: 0,
      suspendedUsers: 0,
      totalStudents: 0,
      totalParents: 0,
      totalTeachers: 0,
      totalCoordinators: 0,
      totalRegistrationLeads: 0,
      newRegistrationLeads: 0,
      totalFeeVouchers: 0,
      totalFeeSubmissions: 0,
    },
    roles: [],
    system: {
      subjectsEnabled: false,
      coursesEnabled: false,
      feeSettingsEnabled: false,
      schedulesEnabled: false,
      auditLogsEnabled: false,
      subjectCount: 0,
      courseCount: 0,
      feeSettingCount: 0,
      lectureScheduleCount: 0,
    },
    recent: {
      registrationLeads: [],
      feeVouchers: [],
      feeSubmissions: [],
      auditLogs: [],
    },
  };
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

async function safeCount(tableName, condition = "") {
  if (!(await tableExists(tableName))) {
    return 0;
  }

  const [row] = condition
    ? await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS total FROM "${tableName}" WHERE ${condition}`
      )
    : await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS total FROM "${tableName}"`
      );

  return Number(row?.total || 0);
}

export async function GET() {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const runOrEmpty = async (fn, fallback) => {
      try {
        return await fn();
      } catch (error) {
        if (isDatabaseConnectionError(error)) {
          return fallback;
        }
        throw error;
      }
    };

    const [
      usersTableExists,
      rolesTableExists,
      registrationLeadsExists,
      feeVouchersExists,
      feeSubmissionsExists,
      subjectsExists,
      coursesExists,
      schedulesExists,
      auditLogsExists,
      feeSettingsExists,
    ] = await Promise.all([
      runOrEmpty(() => tableExists("users"), false),
      runOrEmpty(() => tableExists("roles"), false),
      runOrEmpty(() => tableExists("registration_leads"), false),
      runOrEmpty(() => tableExists("fee_vouchers"), false),
      runOrEmpty(() => tableExists("fee_submissions"), false),
      runOrEmpty(() => tableExists("subjects"), false),
      runOrEmpty(() => tableExists("courses"), false),
      runOrEmpty(() => tableExists("lecture_schedules"), false),
      runOrEmpty(() => tableExists("audit_logs"), false),
      runOrEmpty(() => tableExists("fee_settings"), false),
    ]);

    const roleBreakdown =
      usersTableExists && rolesTableExists
        ? await runOrEmpty(
            () =>
              prisma.$queryRaw`
            SELECT
              LOWER(r.name) AS role,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE LOWER(u.status::text) = 'active')::int AS active_total
            FROM users u
            INNER JOIN roles r ON r.id = u.role_id
            GROUP BY LOWER(r.name)
            ORDER BY LOWER(r.name)
          `,
            []
          )
        : [];

    // FIXED: database schema ke exact format ke sath sync kiya
    const recentLeads =
      registrationLeadsExists
        ? await runOrEmpty(
            () =>
              prisma.$queryRaw`
            SELECT
              id::text AS id,
              student_name,
              parent_name,
              class_level,
              email,
              phone,
              LOWER(status::text) AS status
            FROM registration_leads
            ORDER BY created_at DESC NULLS LAST, id DESC
            LIMIT 6
          `,
            []
          )
        : [];

    // FIXED: registration_lead_id -> registration_id column match
    const recentVouchers =
      feeVouchersExists && registrationLeadsExists
        ? await runOrEmpty(
            () =>
              prisma.$queryRaw`
            SELECT
              fv.id::text AS id,
              fv.voucher_no,
              fv.amount,
              LOWER(fv.status::text) AS status,
              rl.student_name
            FROM fee_vouchers fv
            INNER JOIN registration_leads rl ON rl.id = fv.registration_id
            ORDER BY fv.created_at DESC NULLS LAST, fv.id DESC
            LIMIT 6
          `,
            []
          )
        : [];

    // FIXED: fee_voucher_id -> voucher_id aur foreign relation map parameters correct kiya
    const recentSubmissions =
      feeSubmissionsExists && feeVouchersExists && registrationLeadsExists
        ? await runOrEmpty(
            () =>
              prisma.$queryRaw`
            SELECT
              fs.id::text AS id,
              fs.transaction_id,
              fs.paid_amount,
              LOWER(fs.status::text) AS status,
              fv.voucher_no,
              rl.student_name
            FROM fee_submissions fs
            INNER JOIN fee_vouchers fv ON fv.id = fs.voucher_id
            INNER JOIN registration_leads rl ON rl.id = fv.registration_id
            ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
            LIMIT 6
          `,
            []
          )
        : [];

    const recentAuditLogs =
      auditLogsExists
        ? await runOrEmpty(
            () =>
              prisma.$queryRaw`
            SELECT
              id::text AS id,
              action,
              entity_type,
              created_at
            FROM audit_logs
            ORDER BY created_at DESC NULLS LAST, id DESC
            LIMIT 6
          `,
            []
          )
        : [];

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalRegistrationLeads,
      newRegistrationLeads,
      totalFeeVouchers,
      totalFeeSubmissions,
      subjectCount,
      courseCount,
      lectureScheduleCount,
      feeSettingCount,
    ] = await Promise.all([
      safeCount("users"),
      safeCount("users", "LOWER(status::text) = 'active'"),
      safeCount("users", "LOWER(status::text) = 'suspended'"),
      safeCount("registration_leads"),
      safeCount("registration_leads", "LOWER(status::text) = 'new_lead'"),
      safeCount("fee_vouchers"),
      safeCount("fee_submissions"),
      safeCount("subjects"),
      safeCount("courses"),
      safeCount("lecture_schedules"),
      safeCount("fee_settings"),
    ]);

    const overview = {
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalStudents:
        Number(
          roleBreakdown.find((item) => item.role === "student")?.total || 0
        ),
      totalParents:
        Number(roleBreakdown.find((item) => item.role === "parent")?.total || 0),
      totalTeachers:
        Number(roleBreakdown.find((item) => item.role === "teacher")?.total || 0),
      totalCoordinators:
        Number(
          roleBreakdown.find((item) => item.role === "coordinator")?.total || 0
        ),
      totalRegistrationLeads,
      newRegistrationLeads,
      totalFeeVouchers,
      totalFeeSubmissions,
    };

    return json("Admin stats fetched.", 200, {
      overview,
      roles: roleBreakdown.map((item) => ({
        role: item.role,
        total: Number(item.total || 0),
        activeTotal: Number(item.active_total || 0),
      })),
      system: {
        subjectsEnabled: subjectsExists,
        coursesEnabled: coursesExists,
        feeSettingsEnabled: feeSettingsExists,
        schedulesEnabled: schedulesExists,
        auditLogsEnabled: auditLogsExists,
        subjectCount,
        courseCount,
        feeSettingCount,
        lectureScheduleCount,
      },
      recent: {
        registrationLeads: recentLeads,
        feeVouchers: recentVouchers,
        feeSubmissions: recentSubmissions,
        auditLogs: recentAuditLogs,
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return json("Database is temporarily unavailable.", 503, emptyAdminStats());
    }
    return json(
      error instanceof Error ? error.message : "Unable to fetch admin stats.",
      500
    );
  }
}
