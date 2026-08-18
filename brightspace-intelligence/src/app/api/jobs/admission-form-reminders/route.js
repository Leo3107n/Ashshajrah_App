import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail, themedEmailShell } from "@/lib/email";
import { sendWhatsAppText } from "@/lib/whatsapp";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
}

function isValidDate(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function addDays(dateValue, days) {
  const date = new Date(dateValue);
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getReminderBucket(daysSinceDue) {
  if (daysSinceDue >= 30) return "30";
  if (daysSinceDue >= 20) return "20";
  if (daysSinceDue >= 10) return "10";
  return "";
}

export async function GET(request) {
  const secret = String(request.nextUrl.searchParams.get("secret") || "");
  const expectedSecret = process.env.ADMISSION_FORM_REMINDER_SECRET || process.env.MONTHLY_REMINDER_SECRET || "";

  if (!expectedSecret || secret !== expectedSecret) {
    return json("Forbidden.", 403);
  }

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        istd.id::text AS id,
        COALESCE(NULLIF(TRIM(istd.student_name), ''), NULLIF(TRIM(istd.child_name), '')) AS student_name,
        COALESCE(NULLIF(TRIM(istd.parent_name), ''), '') AS parent_name,
        COALESCE(NULLIF(TRIM(istd.email), ''), '') AS email,
        COALESCE(NULLIF(TRIM(istd.phone), ''), '') AS phone,
        COALESCE(NULLIF(TRIM(istd.class_level), ''), '') AS class_level,
        COALESCE(NULLIF(TRIM(istd.message), ''), NULLIF(TRIM(istd.why_interested), ''), NULLIF(TRIM(istd.questions_comments), '')) AS message,
        istd.registration_token,
        istd.admission_form_sent_at,
        istd.admission_form_due_at,
        istd.admission_form_last_reminder_at,
        COALESCE(istd.admission_form_reminder_count, 0)::int AS admission_form_reminder_count,
        LOWER(COALESCE(istd.admission_form_status::text, 'pending')) AS admission_form_status
      FROM interested_students istd
      WHERE LOWER(COALESCE(istd.admission_form_status::text, 'pending')) IN ('sent', 'reminded', 'overdue', 'pending')
      ORDER BY istd.created_at ASC NULLS LAST, istd.id ASC
    `;

    const now = new Date();
    let scanned = 0;
    let sent = 0;
    let marked = 0;

    for (const row of rows) {
      scanned += 1;
      const sentAt = isValidDate(row.admission_form_sent_at) ? new Date(row.admission_form_sent_at) : null;
      const dueAt = isValidDate(row.admission_form_due_at)
        ? new Date(row.admission_form_due_at)
        : sentAt
          ? addDays(sentAt, 10)
          : null;

      if (!dueAt || now < dueAt) continue;
      if (String(row.admission_form_status || "") === "submitted") continue;

      const reminderCount = Number(row.admission_form_reminder_count || 0);
      const daysSinceDue = Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / (24 * 60 * 60 * 1000)));
      const reminderBucket = getReminderBucket(daysSinceDue);

      if (!reminderBucket) continue;

      const targetReminderCount = reminderBucket === "10" ? 1 : reminderBucket === "20" ? 2 : 3;
      if (reminderCount >= targetReminderCount) {
        if (reminderBucket === "30" && reminderCount >= 3) {
          await prisma.$executeRaw`
            UPDATE interested_students
            SET
              admission_form_status = ${"not_submitted"},
              admission_form_last_channel = COALESCE(admission_form_last_channel, ${row.phone ? "email_whatsapp" : "email"}),
              updated_at = NOW()
            WHERE id = ${row.id}::uuid
          `;
        }
        continue;
      }

      const nextReminderCount = reminderCount + 1;
      const isFinalReminder = nextReminderCount >= 3;
      const nextStatus = isFinalReminder ? "not_submitted" : "overdue";
      const studentName = row.student_name || "Student";
      const parentName = row.parent_name || "Parent";
      const formLink = row.registration_token
        ? `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ""}/admission-form?leadToken=${encodeURIComponent(row.registration_token)}`
        : `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ""}/admission-form`;

      const subject = `Admission form reminder for ${studentName}`;
      const text = `Assalamualaikum ${parentName},\n\nThis is a reminder to complete the Ash-Shajrah Learning Hub (ALH) admission form for ${studentName}.\n\nClass: ${row.class_level || "-"}\nMessage: ${row.message || "-"}\n\nOpen the form:\n${formLink}`;
      const html = themedEmailShell({
        eyebrow: "Admission Form Reminder",
        title: "Please complete the admission form",
        intro: `Assalamualaikum ${parentName}. This is a reminder to complete the Ash-Shajrah Learning Hub (ALH) admission form for ${studentName}.`,
        rows: [
          ["Student", studentName],
          ["Class", row.class_level || "-"],
          ["Message", row.message || "-"],
        ],
        bodyBlocks: [
          `<div style="padding:16px;border:1px solid #2D8A6A;border-radius:18px;background:#fffaf0;"><p style="margin:0;line-height:1.8;color:#245C4F;font-size:15px;">Please complete the admission form as soon as possible to avoid delays in processing.</p></div>`,
        ],
        buttonLabel: "Open Admission Form",
        buttonUrl: formLink,
        footerNote: `If the button does not work, open this link in your browser: ${formLink}`,
      });

      try {
        if (isValidEmail(row.email)) {
          await sendEmail({
            to: row.email,
            subject,
            text,
            html,
          });
        }

        if (row.phone) {
          await sendWhatsAppText({
            to: row.phone,
            message: `Assalamualaikum ${parentName}, please complete the Ash-Shajrah Learning Hub (ALH) admission form for ${studentName}.\n\nOpen form: ${formLink}`,
          });
        }

        await prisma.$executeRaw`
          UPDATE interested_students
          SET
            admission_form_last_reminder_at = NOW(),
            admission_form_reminder_count = ${nextReminderCount},
            admission_form_status = ${nextStatus},
            admission_form_last_channel = ${row.phone ? "email_whatsapp" : "email"},
            admission_form_last_error = NULL,
            updated_at = NOW()
          WHERE id = ${row.id}::uuid
        `;

        await prisma.$executeRaw`
          INSERT INTO interested_student_reminder_logs (
            interested_student_id,
            reminder_no,
            channel,
            status,
            sent_at,
            meta,
            created_at,
            updated_at
          ) VALUES (
            ${row.id}::uuid,
            ${nextReminderCount},
            ${row.phone ? "both" : "email"},
            ${"sent"},
            NOW(),
            ${JSON.stringify({
              status: nextStatus,
              sent_at: now.toISOString(),
              due_at: dueAt.toISOString(),
              form_link: formLink,
            })}::jsonb,
            NOW(),
            NOW()
          )
        `;

        sent += 1;
        if (isFinalReminder) marked += 1;
      } catch (error) {
        await prisma.$executeRaw`
          UPDATE interested_students
          SET
            admission_form_last_error = ${error instanceof Error ? error.message : "Unable to send reminder."},
            admission_form_last_channel = ${row.phone ? "email_whatsapp" : "email"},
            updated_at = NOW()
          WHERE id = ${row.id}::uuid
        `;
      }
    }

    return json("Admission form reminders processed.", 200, { scanned, sent, marked });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to process admission form reminders.", 500);
  }
}
