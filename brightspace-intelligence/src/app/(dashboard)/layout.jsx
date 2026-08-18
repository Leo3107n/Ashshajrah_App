import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import DashboardShell from "@/components/layout/DashboardShell";

export const dynamic = "force-dynamic";

function isValidPhone(value) {
  return typeof value === "string" && value.trim().replace(/\D/g, "").length >= 7;
}

async function getStudentProfileId(userId) {
  const [row] = await prisma.$queryRaw`
    SELECT sp.id::text AS id
    FROM student_profiles sp
    WHERE sp.user_id = ${userId}::uuid
    LIMIT 1
  `;
  return row?.id || "";
}

async function getBlockedMonthlyFeeForStudent(studentId) {
  if (!studentId) return null;

  const [voucherRow] = await prisma.$queryRaw`
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
  if (voucherRow?.voucher_no) return voucherRow;

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

async function getBlockedMonthlyFeeForParent(sessionUser) {
  const parentIdRows = await prisma.$queryRaw`
    SELECT pp.id::text AS id
    FROM parent_profiles pp
    WHERE pp.user_id = ${sessionUser.id}::uuid
    LIMIT 1
  `;
  const parentId = parentIdRows?.[0]?.id || "";
  if (!parentId) return null;

  const childRows = await prisma.$queryRaw`
    SELECT spp.student_id::text AS student_id
    FROM student_parents spp
    WHERE spp.parent_id = ${parentId}::uuid
  `;
  const studentIds = childRows.map((row) => row.student_id).filter(Boolean);
  if (!studentIds.length) return null;

  const rows = await Promise.all(studentIds.map((studentId) => getBlockedMonthlyFeeForStudent(studentId)));
  return rows.find(Boolean) || null;
}

export default async function DashboardLayout({ children }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = String(session.user.role || "").toLowerCase();
  let blockedRecord = null;
  if (role === "student") {
    try {
      blockedRecord = await getBlockedMonthlyFeeForStudent(await getStudentProfileId(session.user.id));
    } catch {
      blockedRecord = { error: true };
    }
  }

  if (blockedRecord?.voucher_no) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F0] px-4">
        <div className="w-full max-w-xl rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-700">LMS access paused</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Monthly fee due date has passed
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Voucher {blockedRecord.voucher_no} is overdue. Please submit the payment to continue LMS access.
          </p>
          {blockedRecord.due_date ? (
            <p className="mt-3 text-sm font-medium text-slate-700">
              Due date: {String(blockedRecord.due_date)}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (blockedRecord?.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F0] px-4">
        <div className="w-full max-w-xl rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-700">LMS access paused</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Payment status could not be verified
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Please contact administration so we can confirm your monthly fee status.
          </p>
        </div>
      </div>
    );
  }

  return <DashboardShell session={session}>{children}</DashboardShell>;
}
