import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function blockedScreen(voucherNo, dueDate) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F0] px-4">
      <div className="w-full max-w-xl rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)]">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-700">LMS access paused</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Monthly fee due date has passed
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Voucher {voucherNo} is overdue. Please submit the payment to continue LMS access.
        </p>
        {dueDate ? <p className="mt-3 text-sm font-medium text-slate-700">Due date: {String(dueDate)}</p> : null}
      </div>
    </div>
  );
}

async function getStudentProfile(userId) {
  const [row] = await prisma.$queryRaw`
    SELECT
      sp.id::text AS id,
      u.full_name AS full_name,
      u.email AS email
    FROM student_profiles sp
    INNER JOIN users u ON u.id = sp.user_id
    WHERE sp.user_id = ${userId}::uuid
    LIMIT 1
  `;
  return row || null;
}

async function getBlockedMonthlyFeeForStudent(studentProfile) {
  const studentId = String(studentProfile?.id || "").trim();

  if (!studentId) return null;

  const [row] = await prisma.$queryRaw`
    SELECT
      fv.voucher_no,
      fv.due_date
    FROM fee_vouchers fv
    WHERE (
      fv.student_id = ${studentId}::uuid
      OR fv.registration_id IN (
        SELECT e.registration_id
        FROM enrollments e
        WHERE e.student_id = ${studentId}::uuid
          AND e.registration_id IS NOT NULL
      )
    )
      AND LOWER(fv.status::text) IN ('unpaid', 'rejected', 'submitted')
      AND fv.due_date <= timezone('Asia/Karachi', now())::date
    ORDER BY fv.due_date ASC NULLS LAST, fv.created_at DESC
    LIMIT 1
  `;
  if (row?.voucher_no) return row;

  const [monthlyRow] = await prisma.$queryRaw`
    SELECT
      fv.voucher_no,
      item.due_date
    FROM regular_monthly_fee_voucher_items item
    INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
    LEFT JOIN fee_submissions fs ON fs.voucher_id = fv.id
    WHERE (
      item.student_id = ${studentId}::uuid
      OR fv.registration_id IN (
        SELECT e.registration_id
        FROM enrollments e
        WHERE e.student_id = ${studentId}::uuid
          AND e.registration_id IS NOT NULL
      )
    )
      AND COALESCE(fs.status::text, fv.status::text) IN ('unpaid', 'rejected', 'submitted')
      AND item.due_date <= timezone('Asia/Karachi', now())::date
    ORDER BY item.due_date ASC NULLS LAST, item.created_at DESC
    LIMIT 1
  `;

  return monthlyRow || null;
}

export default async function StudentLayout({ children }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = String(session.user.role || "").toLowerCase();
  if (role !== "student") {
    return children;
  }

  const blockedRecord = await getBlockedMonthlyFeeForStudent(await getStudentProfile(session.user.id));
  if (blockedRecord?.voucher_no) {
    return blockedScreen(blockedRecord.voucher_no, blockedRecord.due_date);
  }

  return children;
}
