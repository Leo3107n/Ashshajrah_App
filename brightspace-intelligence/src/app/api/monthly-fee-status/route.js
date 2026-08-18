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

async function getLatestMonthlyFee(studentIds) {
  if (!studentIds.length) return null;

  const [row] = await prisma.$queryRaw`
    SELECT
      fv.voucher_no,
      fv.status::text AS voucher_status,
      item.due_date,
      item.student_name,
      item.parent_name,
      item.base_amount::float8 AS base_amount,
      item.late_fee_amount::float8 AS late_fee_amount,
      item.voucher_id::text AS voucher_id,
      COALESCE(fs.status::text, 'not_submitted') AS payment_status,
      COALESCE(fs.status::text, fv.status::text, 'unpaid') AS effective_status,
      c.title AS class_title
    FROM regular_monthly_fee_voucher_items item
    INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
    LEFT JOIN fee_submissions fs ON fs.voucher_id = fv.id
    LEFT JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
    LEFT JOIN courses c ON c.id = b.class_id
    WHERE item.student_id = ANY(${studentIds}::uuid[])
    ORDER BY
      CASE
        WHEN item.due_date IS NOT NULL
          AND item.due_date < CURRENT_DATE
          AND COALESCE(fs.status::text, fv.status::text, 'unpaid') NOT IN ('verified', 'approved', 'paid')
        THEN 0
        ELSE 1
      END,
      item.due_date ASC NULLS LAST,
      item.created_at DESC
    LIMIT 1
  `;

  return row || null;
}

async function getMonthlyFeesForStudents(studentIds) {
  if (!studentIds.length) return [];

  const rows = await prisma.$queryRaw`
    SELECT DISTINCT ON (item.student_id)
      item.student_id::text AS student_id,
      fv.voucher_no,
      item.due_date,
      item.student_name,
      item.parent_name,
      item.base_amount::float8 AS base_amount,
      item.late_fee_amount::float8 AS late_fee_amount,
      COALESCE(fs.status::text, fv.status::text, 'unpaid') AS effective_status,
      COALESCE(fs.status::text, 'not_submitted') AS payment_status,
      fv.status::text AS voucher_status,
      c.title AS class_title
    FROM regular_monthly_fee_voucher_items item
    INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
    LEFT JOIN fee_submissions fs ON fs.voucher_id = fv.id
    LEFT JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
    LEFT JOIN courses c ON c.id = b.class_id
    WHERE (
      item.student_id = ANY(${studentIds}::uuid[])
      OR fv.registration_lead_id IN (
         SELECT e.registration_id
         FROM enrollments e
         WHERE e.student_id = ANY(${studentIds}::uuid[])
           AND e.registration_id IS NOT NULL
       )
    )
    ORDER BY
      item.student_id,
      CASE
        WHEN item.due_date IS NOT NULL
          AND item.due_date < CURRENT_DATE
          AND COALESCE(fs.status::text, fv.status::text, 'unpaid') NOT IN ('verified', 'approved', 'paid')
        THEN 0
        ELSE 1
      END,
      item.due_date ASC NULLS LAST,
      item.created_at DESC
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

    const latest = await getLatestMonthlyFee(studentIds);
    const childFees = await getMonthlyFeesForStudents(studentIds);
    if (!latest?.voucher_no) {
      return json("Monthly fee status fetched.", 200, { available: false });
    }

    const daysLeft = daysUntil(latest.due_date);
    const isPaid = ["verified"].includes(String(latest.effective_status || "").toLowerCase());
    const isSubmitted = ["submitted"].includes(String(latest.effective_status || "").toLowerCase());
    const overdue = typeof daysLeft === "number" && daysLeft < 0 && !isPaid;
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
      due_soon: dueSoon,
      overdue,
      is_paid: isPaid,
      is_submitted: isSubmitted,
      children: childFees.map((item) => {
        const itemDaysLeft = daysUntil(item.due_date);
        const itemPaid = ["verified"].includes(String(item.effective_status || "").toLowerCase());
        return {
          ...item,
          days_left: itemDaysLeft,
          overdue: typeof itemDaysLeft === "number" && itemDaysLeft < 0 && !itemPaid,
          due_soon: typeof itemDaysLeft === "number" && itemDaysLeft <= 3 && itemDaysLeft >= 0 && !itemPaid,
          is_paid: itemPaid,
        };
      }),
      message: overdue
        ? "Monthly fee is overdue. Please submit payment to continue LMS access."
        : dueSoon
          ? "Monthly fee is due soon. Please submit payment to continue LMS access."
          : "Monthly fee voucher is not submitted yet. Please submit to continue LMS access.",
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to load monthly fee status.", 500);
  }
}
