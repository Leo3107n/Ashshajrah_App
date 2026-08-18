import crypto from "crypto";
import { NextResponse } from "next/server";
import { sendEmail, themedEmailShell } from "@/lib/email";
import { sendWhatsAppText } from "@/lib/whatsapp";
import prisma from "@/lib/prisma";
import { uploadPaymentProof } from "@/lib/supabaseStorage";

const SUBMITTABLE_VOUCHER_STATUSES = new Set(["unpaid", "rejected"]);
const NAME_PATTERN = /^[A-Za-zÀ-ÿ'’.-]{2,}(?:\s+[A-Za-zÀ-ÿ'’.-]{2,})+$/;
const TRANSACTION_PATTERN = /^[A-Za-z0-9_-]{3,150}$/;
const PHONE_PATTERN = /^(?:\+92|0)?[0-9]{10,12}$/;

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePaidAt(value) {
  const trimmed = normalizeText(value);

  if (!trimmed) {
    return "";
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatDateTime(value) {
  const trimmed = normalizeText(value);
  if (!trimmed) return "";
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isStorageConfigError(error) {
  return error instanceof Error && /Missing environment variable:\s*SUPABASE_/i.test(error.message);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const voucherNo = normalizeText(formData.get("voucherNo"));
    const payerName = normalizeText(formData.get("payerName"));
    const transactionId = normalizeText(formData.get("transactionId"));
    const paidAmount = Number(formData.get("paidAmount"));
    const paidAt = normalizePaidAt(formData.get("paidAt"));
    const proofFile = formData.get("proofFile");

    if (!voucherNo) {
      return json("Voucher number is required.", 400);
    }

    if (!payerName) {
      return json("Payer name is required.", 400);
    }

    if (!NAME_PATTERN.test(payerName)) {
      return json("Please enter a valid payer name with at least two name parts.", 400);
    }

    if (!transactionId) {
      return json("Transaction ID is required.", 400);
    }

    if (!TRANSACTION_PATTERN.test(transactionId)) {
      return json("Please enter a valid transaction ID.", 400);
    }

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return json("Paid amount must be greater than zero.", 400);
    }

    if (!paidAt) {
      return json("Valid paid date is required.", 400);
    }

    const payerPhone = normalizeText(formData.get("payerPhone"));
    if (payerPhone && !PHONE_PATTERN.test(payerPhone)) {
      return json("Please enter a valid payer phone number.", 400);
    }

    if (!(proofFile instanceof File) || !proofFile.size) {
      return json("Payment proof file is required.", 400);
    }

    const [voucher] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        LOWER(fv.status::text) AS status,
        rl.id::text AS registration_lead_id,
        COALESCE(su.full_name, rl.student_name, item.student_name, '') AS student_name,
        COALESCE(rl.parent_name, item.parent_name, '') AS parent_name,
        COALESCE(rl.email, item.student_email, item.parent_email, '') AS email,
        COALESCE(rl.phone, item.student_phone, item.parent_phone, '') AS phone,
        COALESCE(rl.class_level, c.class_level, c.title, '') AS class_level
      FROM fee_vouchers fv
      LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
      LEFT JOIN regular_monthly_fee_voucher_items item ON item.voucher_id = fv.id
      LEFT JOIN student_profiles sp ON sp.id = item.student_id
      LEFT JOIN users su ON su.id = sp.user_id
      LEFT JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
      LEFT JOIN courses c ON c.id = b.class_id
      WHERE fv.voucher_no = ${voucherNo}
      LIMIT 1
    `;

    if (!voucher?.id) {
      return json("Voucher not found.", 404);
    }

    if (!SUBMITTABLE_VOUCHER_STATUSES.has(String(voucher.status || "").toLowerCase())) {
      return json("This voucher is not accepting payment submissions.", 400);
    }

    const upload = await uploadPaymentProof({
      voucherNo,
      file: proofFile,
    });

    const item = await prisma.$transaction(async (tx) => {
      const submissionId = crypto.randomUUID();

      await tx.$executeRaw`
        INSERT INTO fee_submissions (
          id,
          voucher_id,
          payer_name,
          transaction_id,
          paid_amount,
          paid_at,
          proof_file_path,
          status
        )
        VALUES (
          ${submissionId}::uuid,
          ${voucher.id}::uuid,
          ${payerName},
          ${transactionId},
          ${paidAmount},
          ${paidAt}::timestamp,
          ${upload.storedPath},
          'pending'::fee_submission_status
        )
      `;

      await tx.$executeRaw`
        UPDATE fee_vouchers
        SET status = ${"submitted"}::voucher_status
        WHERE id = ${voucher.id}::uuid
      `;

      if (voucher.registration_lead_id) {
        await tx.$executeRaw`
          UPDATE registration_leads
          SET status = ${"fee_submitted"}::registration_status
          WHERE id = ${voucher.registration_lead_id}::uuid
        `;
      }

      const [created] = await tx.$queryRaw`
        SELECT
          v.status::text AS voucher_status,
          fs.id,
          fs.payer_name,
          fs.paid_amount,
          fs.proof_file_path
        FROM fee_vouchers v
        LEFT JOIN fee_submissions fs ON fs.voucher_id = v.id
        WHERE v.id = ${voucher.id}::uuid
        LIMIT 1
      `;

      return created;
    });

    const [coordinator] = await prisma.$queryRaw`
      SELECT
        u.email,
        u.full_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE LOWER(r.name) = 'coordinator'
        AND LOWER(u.status::text) = 'active'
        AND COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
      ORDER BY u.created_at ASC NULLS LAST, u.id ASC
      LIMIT 1
    `;

    const [lead] = await prisma.$queryRaw`
      SELECT
        COALESCE(su.full_name, rl.student_name, item.student_name, '') AS student_name,
        COALESCE(rl.parent_name, item.parent_name, '') AS parent_name,
        COALESCE(rl.email, item.student_email, item.parent_email, '') AS email,
        COALESCE(rl.phone, item.student_phone, item.parent_phone, '') AS phone,
        COALESCE(rl.class_level, c.class_level, c.title, '') AS class_level
      FROM fee_vouchers fv
      LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
      LEFT JOIN regular_monthly_fee_voucher_items item ON item.voucher_id = fv.id
      LEFT JOIN student_profiles sp ON sp.id = item.student_id
      LEFT JOIN users su ON su.id = sp.user_id
      LEFT JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
      LEFT JOIN courses c ON c.id = b.class_id
      WHERE fv.voucher_no = ${voucherNo}
      LIMIT 1
    `;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      request.nextUrl.origin;
    const portalUrl = `${String(appUrl || "").replace(/\/+$/, "")}/login`;

    const parentSubject = `Payment submitted for voucher ${voucherNo}`;
    const formattedPaidAt = formatDateTime(paidAt);
    const parentText = `Assalamualaikum ${lead?.parent_name || payerName || "Parent"},

Your payment submission has been received and is waiting for approval.

Student: ${lead?.student_name || "-"}
Parent: ${lead?.parent_name || "-"}
Email: ${lead?.email || "-"}
Phone: ${lead?.phone || "-"}
Class Level: ${lead?.class_level || "-"}
Voucher No: ${voucherNo}
Transaction ID: ${transactionId}
Paid Amount: ${paidAmount}
Paid At: ${formattedPaidAt}

Please wait for coordinator approval.

Login: ${portalUrl}`;
    const parentHtml = themedEmailShell({
      eyebrow: "Payment Submitted",
      title: "Your payment submission has been received",
      intro: `Assalamualaikum ${lead?.parent_name || payerName || "Parent"}, your payment submission has been received and is waiting for approval.`,
      rows: [
        ["Student", lead?.student_name || "-"],
        ["Parent", lead?.parent_name || "-"],
        ["Email", lead?.email || "-"],
        ["Phone", lead?.phone || "-"],
        ["Class Level", lead?.class_level || "-"],
        ["Voucher No", voucherNo],
        ["Transaction ID", transactionId],
        ["Paid Amount", paidAmount],
        ["Paid At", formattedPaidAt],
      ],
      footerNote: "Please wait for coordinator approval.",
    });

    const coordinatorSubject = `Payment submitted: ${voucherNo}`;
    const coordinatorText = `Assalamualaikum ${coordinator?.full_name || "Coordinator"},

Payment has been submitted and is waiting for approval.

Student: ${lead?.student_name || "-"}
Parent: ${lead?.parent_name || "-"}
Email: ${lead?.email || "-"}
Phone: ${lead?.phone || "-"}
Class Level: ${lead?.class_level || "-"}
Voucher No: ${voucherNo}
Transaction ID: ${transactionId}
Paid Amount: ${paidAmount}
Paid At: ${formattedPaidAt}`;
    const coordinatorHtml = themedEmailShell({
      eyebrow: "Payment Submitted by User",
      title: "A payment submission is waiting for approval",
      intro: `Assalamualaikum ${coordinator?.full_name || "Coordinator"}, payment has been submitted and is waiting for approval.`,
      rows: [
        ["Student", lead?.student_name || "-"],
        ["Parent", lead?.parent_name || "-"],
        ["Email", lead?.email || "-"],
        ["Phone", lead?.phone || "-"],
        ["Class Level", lead?.class_level || "-"],
        ["Voucher No", voucherNo],
        ["Transaction ID", transactionId],
        ["Paid Amount", paidAmount],
        ["Paid At", formattedPaidAt],
      ],
    });

    try {
      if (lead?.email) {
        await sendEmail({
          to: lead.email,
          subject: parentSubject,
          html: parentHtml,
          text: parentText,
        });
      }
      if (coordinator?.email) {
        await sendEmail({
          to: coordinator.email,
          subject: coordinatorSubject,
          html: coordinatorHtml,
          text: coordinatorText,
        });
      }
    } catch (emailError) {
      console.error("PAYMENT_SUBMIT_EMAIL_ERROR:", emailError);
    }

    try {
      const coordinatorPhone = process.env.WHATSAPP_NOTIFY_TO || "";
      if (coordinatorPhone) {
        await sendWhatsAppText({
          to: coordinatorPhone,
          message: `Payment submitted for voucher ${voucherNo}\n\nStudent: ${lead?.student_name || "-"}\nParent: ${lead?.parent_name || "-"}\nPhone: ${lead?.phone || "-"}\nAmount: ${paidAmount}\nPaid At: ${formattedPaidAt}\nTransaction ID: ${transactionId}`,
        });
      }
    } catch (whatsAppError) {
      console.error("PAYMENT_SUBMIT_WHATSAPP_ERROR:", whatsAppError);
    }

    return json("Payment proof submitted.", 201, { item });
  } catch (error) {
    if (isStorageConfigError(error)) {
      return json(
        "Payment proof uploads are not configured on this environment yet. Add the Supabase storage environment variables before testing receipt uploads on a device.",
        503
      );
    }

    return json(
      error instanceof Error ? error.message : "Unable to submit payment proof.",
      500
    );
  }
}
