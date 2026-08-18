import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { themedEmailShell, sendEmail } from "@/lib/email";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["superadmin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizePhoneNumber(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0092")) return digits.slice(2);
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
}

export async function POST(request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const { id } = await params;
    const lookupId = String(id || "").trim();
    let paymentPayload = {};
    try {
      paymentPayload = await request.json();
    } catch {
      paymentPayload = {};
    }
    const [row] = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        COALESCE(NULLIF(TRIM(student_name), ''), NULLIF(TRIM(child_name), '')) AS student_name,
        COALESCE(NULLIF(TRIM(parent_name), ''), NULLIF(TRIM(parent_name), '')) AS parent_name,
        email,
        phone,
        NULLIF(TRIM(class_level), '') AS class_level,
        child_dob,
        CASE
          WHEN child_dob IS NULL THEN NULL
          ELSE CONCAT(FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, child_dob)))::int, ' years')
        END AS child_age,
        NULLIF(TRIM(city), '') AS city,
        NULLIF(TRIM(country), '') AS country,
        CASE
          WHEN NULLIF(TRIM(city), '') IS NOT NULL AND NULLIF(TRIM(country), '') IS NOT NULL
            THEN CONCAT(TRIM(city), ', ', TRIM(country))
          ELSE COALESCE(NULLIF(TRIM(city), ''), NULLIF(TRIM(country), ''))
        END AS city_country,
        COALESCE(NULLIF(TRIM(message), ''), NULLIF(TRIM(why_interested), ''), NULLIF(TRIM(questions_comments), '')) AS message,
        registration_token,
        registration_lead_id::text AS registration_lead_id,
        LOWER(status::text) AS status
      FROM interested_students
      WHERE id::text = ${lookupId}
        OR registration_lead_id::text = ${lookupId}
        OR registration_token = ${lookupId}
      LIMIT 1
    `;

    if (!row?.id) return json("Interested student not found.", 404);

    const token = row.registration_token || crypto.randomUUID().replace(/-/g, "");
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      request.nextUrl.origin;
    const baseRegistrationLink = `${appUrl.replace(/\/+$/, "")}/admission-form?leadToken=${encodeURIComponent(token)}`;
    const registrationUrl = new URL(baseRegistrationLink);
    if (paymentPayload?.admissionFeeId) registrationUrl.searchParams.set("admissionFeeId", String(paymentPayload.admissionFeeId));
    if (paymentPayload?.admissionFeeAmount) registrationUrl.searchParams.set("admissionFeeAmount", String(paymentPayload.admissionFeeAmount));
    if (paymentPayload?.discountId) registrationUrl.searchParams.set("discountId", String(paymentPayload.discountId));
    if (paymentPayload?.discountPercent) registrationUrl.searchParams.set("discountPercent", String(paymentPayload.discountPercent));
    if (paymentPayload?.paymentMethodId) registrationUrl.searchParams.set("paymentMethodId", String(paymentPayload.paymentMethodId));
    if (paymentPayload?.paymentMethodName) registrationUrl.searchParams.set("paymentMethodName", String(paymentPayload.paymentMethodName));
    if (paymentPayload?.paymentInstructions) registrationUrl.searchParams.set("paymentInstructions", String(paymentPayload.paymentInstructions));
    const registrationLink = registrationUrl.toString();
    const generatedAt = new Date();
    const dueAt = new Date(generatedAt.getTime() + 10 * 24 * 60 * 60 * 1000);
    const generatedBy = session?.user?.id || null;
    const alreadyGenerated = Boolean(row.registration_token);

    if (!alreadyGenerated) {
      await prisma.$executeRaw`
        UPDATE interested_students
        SET
          registration_token = ${token},
          status = ${"link_generated"},
          registration_link_generated_at = ${generatedAt},
          admission_form_sent_at = ${generatedAt},
          admission_form_due_at = ${dueAt},
          admission_form_last_reminder_at = NULL,
          admission_form_reminder_count = 0,
          admission_form_status = ${"sent"},
          admission_form_submitted_at = NULL,
          admission_form_last_channel = ${"email_whatsapp"},
          admission_form_last_error = NULL,
          registration_link_generated_by = CAST(${generatedBy || null} AS uuid),
          updated_at = NOW()
        WHERE id = ${id}::uuid
           OR registration_lead_id::text = ${lookupId}
           OR registration_token = ${lookupId}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE interested_students
        SET
          admission_form_sent_at = COALESCE(admission_form_sent_at, ${generatedAt}),
          admission_form_due_at = COALESCE(admission_form_due_at, ${dueAt}),
          admission_form_status = COALESCE(NULLIF(admission_form_status, ''), ${"sent"}),
          admission_form_last_channel = COALESCE(admission_form_last_channel, ${"email_whatsapp"}),
          admission_form_last_error = NULL,
          updated_at = NOW()
        WHERE id::text = ${lookupId}
           OR registration_lead_id::text = ${lookupId}
           OR registration_token = ${lookupId}
      `;
    }

    if (row?.id && row?.email) {
      const studentName = row.student_name || "Student";
      const parentName = row.parent_name || "Parent";
      const subject = `Your Ash-Shajrah Learning Hub (ALH) admission form for ${studentName}`;
      const previewLink = registrationLink;
      const registrationDetails = [
        `Student: ${studentName}`,
        `Parent: ${parentName}`,
        `Email: ${row.email || "-"}`,
        `Phone: ${row.phone || "-"}`,
        `Class: ${row.class_level || "-"}`,
        `Child age: ${row.child_age || "-"}`,
        `City / Country: ${row.city_country || "-"}`,
        `Message: ${row.message || "-"}`,
      ];
      const html = themedEmailShell({
        eyebrow: "Admission Form",
        title: "Your registration form is ready",
        intro: `Assalamualaikum ${parentName}, your prefilled admission form is ready. Please open the form link below and complete the next steps.`,
        rows: [
          ["Student", studentName],
          ["Parent", parentName],
          ["Email", row.email || "-"],
        ["Phone", row.phone || "-"],
        ["Class", row.class_level || "-"],
        ["Child age", row.child_age || "-"],
        ["City / Country", row.city_country || "-"],
        ["Message", row.message || "-"],
      ],
      buttonLabel: "Open Admission Form",
      buttonUrl: registrationLink,
      footerNote: `If the button does not work, open this link directly: ${registrationLink}`,
      });

      await sendEmail({
        to: row.email,
        subject,
        html,
        text: `Assalamualaikum ${parentName}, your prefilled admission form is ready.\n\n${registrationDetails.join("\n")}\n\nOpen this link:\n${registrationLink}`,
      });

    }

      return json("Registration link generated.", 200, {
      success: true,
      already_generated: alreadyGenerated,
      registration_link: registrationLink,
      admission_form_due_at: dueAt.toISOString(),
      whatsapp_url: row.phone
        ? `https://wa.me/${normalizePhoneNumber(row.phone)}?text=${encodeURIComponent(
            `Assalamualaikum ${row.parent_name || "Parent"}, your Ash-Shajrah Learning Hub (ALH) admission form is ready.\n\nStudent: ${row.student_name || "Student"}\nParent: ${row.parent_name || "Parent"}\nEmail: ${row.email || "-"}\nPhone: ${row.phone || "-"}\nClass: ${row.class_level || "-"}\nChild age: ${row.child_age || "-"}\nCity / Country: ${row.city_country || "-"}\nMessage: ${row.message || "-"}\n\nOpen form: ${registrationLink}`
          )}`
        : "",
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to generate registration link.", 500);
  }
}
