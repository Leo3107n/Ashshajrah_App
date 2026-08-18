import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail, themedEmailShell } from "@/lib/email";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
}

export async function GET(request) {
  const secret = String(request.nextUrl.searchParams.get("secret") || "");
  if (!process.env.MONTHLY_REMINDER_SECRET || secret !== process.env.MONTHLY_REMINDER_SECRET) {
    return json("Forbidden.", 403);
  }

  try {
    const reminders = await prisma.$queryRaw`
      SELECT
        item.id::text AS item_id,
        item.voucher_id::text AS voucher_id,
        item.voucher_no,
        item.student_name,
        item.student_email,
        item.parent_name,
        item.parent_email,
        item.due_date,
        item.base_amount::float8 AS base_amount,
        item.late_fee_amount::float8 AS late_fee_amount,
        c.title AS class_title
      FROM regular_monthly_fee_voucher_items item
      INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
      INNER JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
      INNER JOIN courses c ON c.id = b.class_id
      LEFT JOIN fee_submissions fs ON fs.voucher_id = fv.id
      WHERE item.due_date = CURRENT_DATE + INTERVAL '3 days'
        AND COALESCE(fs.status::text, fv.status::text, 'unpaid') IN ('unpaid', 'rejected', 'submitted')
      ORDER BY item.due_date ASC, item.created_at ASC
    `;

    const portalBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
    let sent = 0;

    for (const item of reminders) {
      const to = isValidEmail(item.parent_email)
        ? String(item.parent_email).trim().toLowerCase()
        : isValidEmail(item.student_email)
          ? String(item.student_email).trim().toLowerCase()
          : "";

      if (!to) continue;

      const voucherUrl = `${portalBase}/payment/${encodeURIComponent(item.voucher_no)}`;
      const reminderHtml = themedEmailShell({
        eyebrow: "Monthly Fee Reminder",
        title: "Your monthly fee is due soon",
        intro: `Assalamualaikum ${item.parent_name || item.student_name || "Parent"}, your monthly fee voucher will be due on ${formatDate(item.due_date)}.`,
        rows: [
          ["Voucher No", item.voucher_no],
          ["Class", item.class_title || "-"],
          ["Amount", `PKR ${Number(item.base_amount || 0).toLocaleString("en-PK")}`],
          ...(Number(item.late_fee_amount || 0) > 0
            ? [["Late Fee", `PKR ${Number(item.late_fee_amount || 0).toLocaleString("en-PK")}`]]
            : []),
        ],
        bodyBlocks: [
          `<div style="padding:16px;border:1px solid #2D8A6A;border-radius:18px;background:#fffaf0;"><p style="margin:0;line-height:1.8;color:#245C4F;font-size:15px;">Please submit payment to continue LMS access.</p></div>`,
        ],
        buttonLabel: "Open Voucher",
        buttonUrl: voucherUrl,
        footerNote: `If the button does not work, open this link in your browser: ${voucherUrl}`,
      });

      await sendEmail({
        to,
        subject: `Monthly fee reminder for ${item.class_title || "your class"}`,
        html: reminderHtml,
        text: `Monthly fee reminder\n\nVoucher No: ${item.voucher_no}\nDue Date: ${formatDate(item.due_date)}\nAmount: PKR ${Number(item.base_amount || 0).toLocaleString("en-PK")}\n${Number(item.late_fee_amount || 0) > 0 ? `Late Fee: PKR ${Number(item.late_fee_amount || 0).toLocaleString("en-PK")}\n` : ""}Please submit payment to continue LMS access.\n\nOpen Voucher: ${voucherUrl}`,
      });
      sent += 1;
    }

    return json("Monthly fee reminders processed.", 200, { reminders: reminders.length, sent });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to process monthly fee reminders.", 500);
  }
}
