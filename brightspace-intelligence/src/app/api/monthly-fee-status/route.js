import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(value) {
  const date = normalizeDate(value);
  if (!date) return null;
  const diff = date.getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86400000);
}

async function getStudentId(userId) {
  const [row] = await prisma.$queryRaw`
    SELECT sp.id::text AS id
    FROM student_profiles sp
    WHERE sp.user_id = ${userId}::uuid
    LIMIT 1
  `;
  return row?.id || "";
}

async function getParentStudentIds(userId) {
  const rows = await prisma.$queryRaw`
    SELECT sp.id::text AS id
    FROM student_parents spp
    INNER JOIN parent_profiles pp ON pp.id = spp.parent_id
    INNER JOIN users u ON u.id = pp.user_id
    INNER JOIN student_profiles sp ON sp.id = spp.student_id
    WHERE u.id = ${userId}::uuid
  `;
  return rows.map((row) => row.id).filter(Boolean);
}

async function getMonthlyFeesForStudents(studentIds) {
  if (!studentIds.length) return [];

  const rows = await prisma.$queryRaw`
    WITH student_context AS (
      SELECT sp.id, su.full_name AS student_name
      FROM student_profiles sp
      INNER JOIN users su ON su.id = sp.user_id
      WHERE sp.id = ANY(${studentIds}::uuid[])
    ),
    fee_sources AS (
      SELECT
        sc.id AS student_id,
        fv.id AS voucher_id,
        fv.voucher_no,
        fv.due_date,
        sc.student_name,
        ''::text AS parent_name,
        fv.amount::float8 AS base_amount,
        0::float8 AS late_fee_amount,
        fv.status::text AS voucher_status,
        fv.created_at,
        ''::text AS class_title,
        FALSE AS is_monthly_voucher
      FROM student_context sc
      INNER JOIN fee_vouchers fv ON (
        fv.student_id = sc.id
        OR (
          fv.student_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM enrollments e
            WHERE e.student_id = sc.id
              AND e.registration_id IS NOT NULL
              AND (fv.registration_id = e.registration_id OR fv.registration_lead_id = e.registration_id)
          )
        )
      )

      UNION ALL

      SELECT
        item.student_id,
        fv.id AS voucher_id,
        fv.voucher_no,
        -- The generated challan is authoritative. Batch item dates may retain
        -- an older deadline after the voucher itself has been corrected.
        fv.due_date,
        item.student_name,
        COALESCE(item.parent_name, '') AS parent_name,
        item.base_amount::float8 AS base_amount,
        item.late_fee_amount::float8 AS late_fee_amount,
        fv.status::text AS voucher_status,
        fv.created_at,
        COALESCE(c.title, '') AS class_title,
        TRUE AS is_monthly_voucher
      FROM regular_monthly_fee_voucher_items item
      INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
      LEFT JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
      LEFT JOIN courses c ON c.id = b.class_id
      WHERE item.student_id = ANY(${studentIds}::uuid[])
    ),
    deduped_sources AS (
      SELECT DISTINCT ON (student_id, voucher_id) *
      FROM fee_sources
      ORDER BY student_id, voucher_id, is_monthly_voucher DESC
    )
    SELECT DISTINCT ON (source.student_id)
      source.student_id::text AS student_id,
      source.voucher_id::text AS voucher_id,
      source.voucher_no,
      source.due_date,
      source.student_name,
      source.parent_name,
      source.base_amount,
      source.late_fee_amount,
      COALESCE(fs.status::text, source.voucher_status, 'unpaid') AS effective_status,
      COALESCE(fs.status::text, 'not_submitted') AS payment_status,
      source.voucher_status,
      source.class_title,
      source.created_at
    FROM deduped_sources source
    LEFT JOIN LATERAL (
      SELECT fs.status
      FROM fee_submissions fs
      WHERE fs.voucher_id = source.voucher_id
      ORDER BY fs.created_at DESC
      LIMIT 1
    ) fs ON TRUE
    ORDER BY
      source.student_id,
      source.created_at DESC NULLS LAST,
      source.due_date DESC NULLS LAST,
      source.voucher_id DESC
  `;

  return rows;
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user || !["student", "parent"].includes(role)) {
    return json("Unauthorized.", 401);
  }

  try {
    const studentIds =
      role === "student"
        ? [await getStudentId(session.user.id)].filter(Boolean)
        : await getParentStudentIds(session.user.id);

    const childFees = await getMonthlyFeesForStudents(studentIds);
    const latest = [...childFees].sort((left, right) => {
      const leftCreated = normalizeDate(left.created_at)?.getTime() || 0;
      const rightCreated = normalizeDate(right.created_at)?.getTime() || 0;
      if (leftCreated !== rightCreated) return rightCreated - leftCreated;
      return (normalizeDate(right.due_date)?.getTime() || 0) - (normalizeDate(left.due_date)?.getTime() || 0);
    })[0];
    if (!latest?.voucher_no) {
      return json("Monthly fee status fetched.", 200, { available: false, children: [] });
    }

    const daysLeft = daysUntil(latest.due_date);
    const isPaid = ["verified", "approved", "paid"].includes(String(latest.effective_status || "").toLowerCase());
    const isSubmitted = ["submitted"].includes(String(latest.effective_status || "").toLowerCase());
    const overdue = typeof daysLeft === "number" && daysLeft < 0 && !isPaid;
    const deadlinePending = typeof daysLeft === "number" && daysLeft >= 0 && !isPaid;
    const dueSoon = typeof daysLeft === "number" && daysLeft <= 3 && daysLeft >= 0 && !isPaid;

    return json("Monthly fee status fetched.", 200, {
      available: true,
      role,
      voucher_no: latest.voucher_no,
      due_date: latest.due_date,
      class_title: latest.class_title || "",
      student_name: latest.student_name || "",
      parent_name: latest.parent_name || "",
      base_amount: latest.base_amount || 0,
      late_fee_amount: latest.late_fee_amount || 0,
      payment_status: latest.payment_status || "not_submitted",
      voucher_status: latest.voucher_status || "unpaid",
      days_left: daysLeft,
      deadline_pending: deadlinePending,
      due_soon: dueSoon,
      overdue,
      is_paid: isPaid,
      is_submitted: isSubmitted,
      children: childFees.map((item) => {
        const itemDaysLeft = daysUntil(item.due_date);
        const itemPaid = ["verified", "approved", "paid"].includes(String(item.effective_status || "").toLowerCase());
        return {
          ...item,
          days_left: itemDaysLeft,
          overdue: typeof itemDaysLeft === "number" && itemDaysLeft < 0 && !itemPaid,
          deadline_pending: typeof itemDaysLeft === "number" && itemDaysLeft >= 0 && !itemPaid,
          due_soon: typeof itemDaysLeft === "number" && itemDaysLeft <= 3 && itemDaysLeft >= 0 && !itemPaid,
          is_paid: itemPaid,
        };
      }),
      message: overdue
        ? "Monthly fee is overdue. Please submit payment to continue LMS access."
        : deadlinePending
          ? "Monthly fee deadline is still pending. Please submit payment before the due date."
          : "Monthly fee voucher is not submitted yet. Please submit to continue LMS access.",
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to load monthly fee status.", 500);
  }
}
