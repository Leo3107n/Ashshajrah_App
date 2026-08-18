import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeClassLevel as normalizeAcademicClassLevel } from "@/lib/academicCatalog";
import { sendEmail, themedEmailShell } from "@/lib/email";
import prisma from "@/lib/prisma";
import { generateVoucherNumber } from "@/lib/voucherNumber";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);
const ELIGIBLE_LEAD_STATUSES = new Set(["new_lead", "pending_clarification", "pending"]);
const VALID_VOUCHER_STATUSES = new Set([
  "unpaid",
  "submitted",
  "verified",
  "rejected",
  "expired",
]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatEmailDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function toMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

async function getTableColumns(tableName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT
      column_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
    };
    return accumulator;
  }, {});
}

function normalizeEnumValue(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeClassLevel(value) {
  const incoming = String(value || "").trim();
  const normalized = incoming.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = {
    prenursery: "Pre-Nursery",
    prenurserry: "Pre-Nursery",
    prepi: "Pre-Nursery",
    prep1: "Pre-Nursery",
    prepnursery: "Pre-Nursery",
    nursery: "Nursery",
    kg1: "KG-1",
    kg2: "KG-2",
  };

  return normalizeAcademicClassLevel(aliases[normalized] || incoming) || aliases[normalized] || incoming;
}

async function getEnumLabels(typeName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = ${typeName}
  `;

  return new Set(rows.map((row) => String(row.enumlabel)));
}

const PAYMENT_METHOD_ALIASES = {
  "bank transfer": ["Bank transfer", "bank"],
  bank: ["bank", "Bank transfer"],
  jazzcash: ["JazzCash", "jazzcash"],
  easypaisa: ["EasyPaisa", "easypaisa"],
  "easy paisa": ["EasyPaisa", "easypaisa"],
  "cash deposit": ["Cash deposit", "cash"],
  cash: ["cash", "Cash deposit"],
  other: ["Other", "other"],
};

async function resolvePaymentMethod(value, tx = prisma) {
  const normalized = normalizeEnumValue(value);

  if (!normalized) {
    return "";
  }

  const aliases = PAYMENT_METHOD_ALIASES[normalized] || [value];
  const labels = await getEnumLabels("payment_method", tx);

  for (const candidate of aliases) {
    if (labels.has(candidate)) {
      return candidate;
    }
  }

  return "";
}

async function getCoordinatorMaxDiscountPercent(tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT value::text AS value
    FROM fee_settings
    WHERE key = 'coordinator_max_discount_percent'
    LIMIT 1
  `;

  const parsed = Number(row?.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

async function getRegularFeeAmount(classLevel, tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT amount::float8 AS amount
    FROM other_fee
    WHERE LOWER(fee_type::text) = 'regular_fee'
      AND LOWER(COALESCE(class_level, '')) = LOWER(${classLevel})
      AND LOWER(status::text) = 'active'
    ORDER BY created_at DESC NULLS LAST, id DESC
    LIMIT 1
  `;

  return Number(row?.amount || 0);
}

async function getRegularFeeById(regularFeeId, tx = prisma) {
  if (!regularFeeId) {
    return null;
  }

  const [row] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      class_level,
      name,
      amount::text AS amount,
      status
    FROM regular_fee
    WHERE id = ${regularFeeId}::uuid
    LIMIT 1
  `;

  return row || null;
}

async function getDiscountById(discountId, tx = prisma) {
  if (!discountId) {
    return null;
  }

  const [row] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      label,
      percent::float8 AS percent
    FROM discounts
    WHERE id = ${discountId}::uuid
      AND LOWER(status::text) = 'active'
    LIMIT 1
  `;

  return row || null;
}

async function getOtherFeeById(otherFeeId, tx = prisma) {
  if (!otherFeeId) {
    return null;
  }

  const [row] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      COALESCE(name, title) AS name,
      fee_type,
      class_level,
      amount::float8 AS amount,
      LOWER(status::text) AS status
    FROM other_fee
    WHERE id = ${otherFeeId}::uuid
      AND LOWER(status::text) = 'active'
    LIMIT 1
  `;

  return row || null;
}

async function getPaymentMethodById(paymentMethodId, tx = prisma) {
  if (!paymentMethodId) {
    return null;
  }

  const [row] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      name,
      method_key,
      account_title,
      account_number,
      iban,
      bank_name,
      branch_code,
      instructions,
      LOWER(status::text) AS status
    FROM payment_methods
    WHERE id = ${paymentMethodId}::uuid
      AND LOWER(status::text) = 'active'
    LIMIT 1
  `;

  return row || null;
}

async function getActivePaymentMethods(tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT
      pm.id::text AS id,
      pm.name,
      pm.method_key,
      pm.account_title,
      pm.account_number,
      pm.iban,
      pm.bank_name,
      pm.branch_code,
      pm.instructions,
      LOWER(pm.status::text) AS status
    FROM payment_methods pm
    WHERE LOWER(pm.status::text) = 'active'
    ORDER BY pm.name ASC
  `;

  return rows || [];
}

function addColumn(columns, values, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  values.push(value);
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

async function insertAuditLog(actorUserId, entityId, action, description, metadata = {}, tx = prisma) {
  const columns = await getTableColumns("audit_logs", tx);

  if (!Object.keys(columns).length) {
    return;
  }

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();

  if (columns.id) {
    addColumn(insertColumns, insertValues, "id", crypto.randomUUID());
    supportedColumns.add("id");
  }
  if (columns.actor_user_id) {
    addColumn(insertColumns, insertValues, "actor_user_id", actorUserId);
    supportedColumns.add("actor_user_id");
  }
  if (columns.entity_type) {
    addColumn(insertColumns, insertValues, "entity_type", "fee_vouchers");
    supportedColumns.add("entity_type");
  }
  if (columns.entity_id) {
    addColumn(insertColumns, insertValues, "entity_id", entityId);
    supportedColumns.add("entity_id");
  }
  if (columns.action) {
    addColumn(insertColumns, insertValues, "action", action);
    supportedColumns.add("action");
  }
  if (columns.description) {
    addColumn(insertColumns, insertValues, "description", description);
    supportedColumns.add("description");
  }
  if (columns.metadata) {
    addColumn(insertColumns, insertValues, "metadata", JSON.stringify(metadata));
    supportedColumns.add("metadata");
  }
  if (columns.meta) {
    addColumn(insertColumns, insertValues, "meta", JSON.stringify(metadata));
    supportedColumns.add("meta");
  }

  ensureSupportedRequiredColumns("audit_logs", columns, supportedColumns);

  if (!insertColumns.length) {
    return;
  }

  await tx.$executeRaw`
    INSERT INTO audit_logs (${Prisma.join(insertColumns, ", ")})
    VALUES (${Prisma.join(
      insertValues.map((v) =>
        typeof v === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
          ? Prisma.sql`${v}::uuid`
          : Prisma.sql`${v}`
      ),
      ", "
    )})
  `;
}

async function insertOutboundMessage({
  voucherId,
  recipientEmail,
  recipientPhone,
  subject,
  body,
  bodyText,
  paymentSubmitUrl,
  createdBy,
  tx,
}) {
  const columns = await getTableColumns("outbound_messages", tx);
  if (!Object.keys(columns).length) {
    return null;
  }

  const insertColumns = [];
  const insertValues = [];
  const push = (name, value) => {
    if (!columns[name]) {
      return;
    }
    insertColumns.push(Prisma.raw(`"${name}"`));
    if (name === "id" || name.endsWith("_id") || name === "created_by") {
      insertValues.push({ value: value ?? null, castType: "uuid" });
      return;
    }
    insertValues.push(Prisma.sql`${value}`);
  };

  const messageId = crypto.randomUUID();
  push("id", messageId);
  push("message_type", "voucher_created");
  push("related_entity_type", "fee_voucher");
  push("related_entity_id", voucherId);
  push("recipient_email", recipientEmail);
  push("recipient_phone", recipientPhone || "");
  push("subject", subject);
  push("body", body);
  push("body_text", bodyText || "");
  push("payment_submit_url", paymentSubmitUrl || "");
  if (columns.created_by) {
    push("created_by", createdBy ?? null);
  }
  push("sent_status", "pending");
  push("created_at", new Date());
  push("updated_at", new Date());

  if (!insertColumns.length) {
    return null;
  }

  await tx.$executeRaw`
    INSERT INTO outbound_messages (${Prisma.join(insertColumns, ", ")})
    VALUES (${Prisma.join(
      insertValues.map((item) => {
        if (item && typeof item === "object" && item.castType === "uuid") {
          return Prisma.sql`${item.value ?? null}::uuid`;
        }
        return Prisma.sql`${item}`;
      }),
      ", "
    )})
  `;

  return {
    id: messageId,
    recipient_email: recipientEmail,
    recipient_phone: recipientPhone || "",
    subject,
    body,
    body_text: bodyText || "",
    payment_submit_url: paymentSubmitUrl || "",
    sent_status: "pending",
  };
}

function buildVoucherEmailContent({
  studentName,
  parentName,
  classLevel,
  voucherNo,
  regularFeeAmount,
  otherFeeAmount,
  scholarshipAmount = 0,
  discountPercent,
  discountAmount,
  totalAmount,
  dueDate,
  paymentMethod,
  paymentInstructions,
  supportEmail,
  supportPhone,
  paymentSubmitUrl,
  paymentMethodName,
  availablePaymentMethods = [],
}) {
  const formattedDueDate = formatEmailDate(dueDate);

  const html = themedEmailShell({
    eyebrow: "Fee Voucher Ready",
    title: "Your fee voucher is available",
    intro: `Hello ${studentName || "there"}, your fee voucher has been created. Please review the details and use any of the available payment methods below to submit payment.`,
    rows: [
      ["Student", studentName || "-"],
      ["Parent", parentName || "-"],
      ["Class", classLevel || "-"],
      ["Voucher No", voucherNo || "-"],
      ["Regular Fee", regularFeeAmount > 0 ? regularFeeAmount.toFixed(2) : "0.00"],
      ["Other Fee", otherFeeAmount > 0 ? otherFeeAmount.toFixed(2) : "0.00"],
      ["Subtotal", Number(regularFeeAmount + otherFeeAmount).toFixed(2)],
      ["Discount on Regular Fee", `${discountPercent}% (${discountAmount.toFixed(2)})`],
      ["Need-based Scholarship", scholarshipAmount > 0 ? Number(scholarshipAmount).toFixed(2) : "0.00"],
      ["Total Payable", totalAmount.toFixed(2)],
      ["Due Date", formattedDueDate],
      ["Payment Method", paymentMethod?.name || paymentMethodName || "-"],
      ["Account Title", paymentMethod?.account_title || "-"],
      ["Account Number", paymentMethod?.account_number || "-"],
      ["IBAN", paymentMethod?.iban || "-"],
      ["Branch Code", paymentMethod?.branch_code || "-"],
      ["Instructions", paymentInstructions || paymentMethod?.instructions || "-"],
      ["Support Email", supportEmail || "-"],
      ["Support Phone", supportPhone || "-"],
    ],
    bodyBlocks: availablePaymentMethods?.length
      ? [
          `<div style="margin-top:18px;">
            <h3 style="margin:0 0 10px;color:#063F32;font-size:16px;">Available payment methods</h3>
            <div style="border:1px solid #2D8A6A;border-radius:18px;padding:14px;background:#fffaf0;">
              ${availablePaymentMethods
                .map(
                  (method) => `
                    <div style="border:1px solid rgba(45,138,106,0.18);border-radius:16px;background:#ffffff;padding:14px 16px;margin-bottom:12px;">
                      <div style="font-weight:700;color:#0D5C48;font-size:15px;margin-bottom:8px;">${method?.name || "-"}</div>
                      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px;">
                        ${method?.bank_name ? `<tr><td style="padding:4px 0;color:#245C4F;width:36%;vertical-align:top;">Bank</td><td style="padding:4px 0;color:#063F32;">${method.bank_name}</td></tr>` : ""}
                        ${method?.account_title ? `<tr><td style="padding:4px 0;color:#245C4F;vertical-align:top;">Account title</td><td style="padding:4px 0;color:#063F32;">${method.account_title}</td></tr>` : ""}
                        ${method?.account_number ? `<tr><td style="padding:4px 0;color:#245C4F;vertical-align:top;">Account number</td><td style="padding:4px 0;color:#063F32;">${method.account_number}</td></tr>` : ""}
                        ${method?.iban ? `<tr><td style="padding:4px 0;color:#245C4F;vertical-align:top;">IBAN</td><td style="padding:4px 0;color:#063F32;">${method.iban}</td></tr>` : ""}
                        ${method?.branch_code ? `<tr><td style="padding:4px 0;color:#245C4F;vertical-align:top;">Branch code</td><td style="padding:4px 0;color:#063F32;">${method.branch_code}</td></tr>` : ""}
                        ${method?.instructions ? `<tr><td style="padding:4px 0;color:#245C4F;vertical-align:top;">Instructions</td><td style="padding:4px 0;color:#063F32;white-space:pre-line;">${method.instructions}</td></tr>` : ""}
                      </table>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>`,
        ]
      : [],
    buttonLabel: "Submit Payment",
    buttonUrl: paymentSubmitUrl,
    footerNote: `If the button does not work, open this link in your browser: ${paymentSubmitUrl}`,
  });

  const text = `
Fee Voucher Created

Student: ${studentName || "-"}
Parent: ${parentName || "-"}
Class: ${classLevel || "-"}
Voucher No: ${voucherNo}

Regular Fee: ${regularFeeAmount > 0 ? regularFeeAmount.toFixed(2) : "0.00"}
Other Fee: ${otherFeeAmount > 0 ? otherFeeAmount.toFixed(2) : "0.00"}
Subtotal: ${Number(regularFeeAmount + otherFeeAmount).toFixed(2)}
Discount on Regular Fee: ${discountPercent}% (${discountAmount.toFixed(2)})
Need-based Scholarship: ${scholarshipAmount > 0 ? Number(scholarshipAmount).toFixed(2) : "0.00"}
Total Payable: ${totalAmount.toFixed(2)}
Due Date: ${formattedDueDate}

Payment Method: ${paymentMethod?.name || paymentMethodName || "-"}
Account Title: ${paymentMethod?.account_title || "-"}
Account Number: ${paymentMethod?.account_number || "-"}
IBAN: ${paymentMethod?.iban || "-"}
Branch Code: ${paymentMethod?.branch_code || "-"}
Instructions: ${paymentInstructions || paymentMethod?.instructions || "-"}

Available payment methods:
${(availablePaymentMethods || []).map((method) => `- ${method?.name || "-"}`).join("\n")}

Submit Payment:
${paymentSubmitUrl}

Support Email: ${supportEmail || "-"}
Support Phone: ${supportPhone || "-"}
`.trim();

  return { html, text };
}

function normalizeDueDate(value) {
  const trimmed = normalizeText(value);

  if (!trimmed) {
    return "";
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function getLeadById(id, tx = prisma) {
  const [lead] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      student_name,
      parent_name,
      class_level,
      email,
      phone,
      LOWER(status::text) AS status
    FROM registration_leads
    WHERE id = ${id}::uuid
    LIMIT 1
  `;

  if (lead?.id) {
    return lead;
  }

  const [linkedStudent] = await tx.$queryRaw`
    SELECT
      istd.id::text AS id,
      istd.registration_lead_id::text AS registration_lead_id,
      COALESCE(
        NULLIF(TRIM(istd.student_name), ''),
        NULLIF(TRIM(istd.child_name), '')
      ) AS student_name,
      COALESCE(
        NULLIF(TRIM(istd.parent_name), ''),
        NULLIF(TRIM(istd.notes), '')
      ) AS parent_name,
      COALESCE(
        NULLIF(TRIM(istd.class_level), ''),
        NULLIF(TRIM(istd.class_applying_for), '')
      ) AS class_level,
      COALESCE(
        NULLIF(TRIM(istd.email), ''),
        NULLIF(TRIM(istd.phone), '')
      ) AS contact_value,
      LOWER(istd.status::text) AS status
    FROM interested_students istd
    WHERE istd.id = ${id}::uuid
    LIMIT 1
  `;

  const linkedLeadId = linkedStudent?.registration_lead_id || "";
  if (linkedLeadId) {
    const [leadByLink] = await tx.$queryRaw`
      SELECT
        id::text AS id,
        student_name,
        parent_name,
        class_level,
        email,
        phone,
        LOWER(status::text) AS status
      FROM registration_leads
      WHERE id = ${linkedLeadId}::uuid
      LIMIT 1
    `;

    if (leadByLink?.id) {
      return leadByLink;
    }
  }

  if (!linkedStudent?.id) {
    return null;
  }

  const [matchedLead] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      student_name,
      parent_name,
      class_level,
      email,
      phone,
      LOWER(status::text) AS status
    FROM registration_leads
    WHERE
      (
        NULLIF(TRIM(student_name), '') IS NOT NULL
        AND LOWER(TRIM(student_name)) = LOWER(${linkedStudent.student_name || ""})
      )
      OR (
        NULLIF(TRIM(email), '') IS NOT NULL
        AND LOWER(TRIM(email)) = LOWER(${linkedStudent.contact_value || ""})
      )
      OR (
        NULLIF(TRIM(phone), '') IS NOT NULL
        AND TRIM(phone) = TRIM(${linkedStudent.contact_value || ""})
      )
      OR (
        NULLIF(TRIM(class_level), '') IS NOT NULL
        AND LOWER(TRIM(class_level)) = LOWER(${linkedStudent.class_level || ""})
      )
    ORDER BY created_at DESC NULLS LAST, id DESC
    LIMIT 1
  `;

  return matchedLead || null;
}

function buildPaymentSubmitUrl(voucherNo) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "";
  const base = appUrl || "";
  return `${base.replace(/\/+$/, "")}/payment/${encodeURIComponent(voucherNo)}`;
}

async function buildVoucherInsertPayload(voucherNo, payload, tx) {
  const columns = await getTableColumns("fee_vouchers", tx);
  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();
  const voucherId = crypto.randomUUID();

  if (columns.id) {
    insertColumns.push(Prisma.raw(`"id"`));
    insertValues.push({ value: voucherId, castType: "uuid" });
    supportedColumns.add("id");
  }
  
  // SECURE RELATIONAL BINDING: Ensuring student/lead target connection payload maps perfectly
  if (columns.registration_id) {
    insertColumns.push(Prisma.raw(`"registration_id"`));
    insertValues.push({ value: payload.registrationLeadId, castType: "uuid" });
    supportedColumns.add("registration_id");
  }
  if (columns.voucher_no) {
    addColumn(insertColumns, insertValues, "voucher_no", voucherNo);
    supportedColumns.add("voucher_no");
  }
  if (columns.amount) {
    addColumn(insertColumns, insertValues, "amount", payload.amount);
    supportedColumns.add("amount");
  }
  if (columns.regular_fee_applied) {
    addColumn(insertColumns, insertValues, "regular_fee_applied", payload.regularFeeApplied ? true : false);
    supportedColumns.add("regular_fee_applied");
  }
  if (columns.regular_fee_amount) {
    addColumn(insertColumns, insertValues, "regular_fee_amount", payload.regularFeeAmount);
    supportedColumns.add("regular_fee_amount");
  }
  if (columns.admission_fee_amount) {
    addColumn(insertColumns, insertValues, "admission_fee_amount", payload.admissionFeeAmount);
    supportedColumns.add("admission_fee_amount");
  }
  if (columns.scholarship_amount) {
    addColumn(insertColumns, insertValues, "scholarship_amount", payload.scholarshipAmount || 0);
    supportedColumns.add("scholarship_amount");
  }
  if (columns.scholarship_form_id && payload.scholarshipFormId) {
    insertColumns.push(Prisma.raw(`"scholarship_form_id"`));
    insertValues.push({ value: payload.scholarshipFormId, castType: "uuid" });
    supportedColumns.add("scholarship_form_id");
  }
  if (columns.other_fee_id && payload.otherFeeId) {
    insertColumns.push(Prisma.raw(`"other_fee_id"`));
    insertValues.push({ value: payload.otherFeeId, castType: "uuid" });
    supportedColumns.add("other_fee_id");
  }
  if (columns.discount_id) {
    insertColumns.push(Prisma.raw(`"discount_id"`));
    insertValues.push({ value: payload.discountId || null, castType: "uuid" });
    supportedColumns.add("discount_id");
  }
  if (columns.discount_percent) {
    addColumn(insertColumns, insertValues, "discount_percent", payload.discountPercent);
    supportedColumns.add("discount_percent");
  }
  if (columns.subtotal_amount) {
    addColumn(insertColumns, insertValues, "subtotal_amount", payload.subtotalAmount);
    supportedColumns.add("subtotal_amount");
  }
  if (columns.discount_amount) {
    addColumn(insertColumns, insertValues, "discount_amount", payload.discountAmount);
    supportedColumns.add("discount_amount");
  }
  if (columns.total_amount) {
    addColumn(insertColumns, insertValues, "total_amount", payload.totalAmount);
    supportedColumns.add("total_amount");
  }
  if (columns.due_date) {
    addColumn(insertColumns, insertValues, "due_date", new Date(payload.dueDate));
    supportedColumns.add("due_date");
  }
  if (columns.payment_method_id && payload.paymentMethodId) {
    insertColumns.push(Prisma.raw(`"payment_method_id"`));
    insertValues.push({ value: payload.paymentMethodId, castType: "uuid" });
    supportedColumns.add("payment_method_id");
  } else if (columns.payment_method) {
    insertColumns.push(Prisma.raw(`"payment_method"`));
    insertValues.push({ value: payload.paymentMethod, castType: "payment_method" });
    supportedColumns.add("payment_method");
  }
  if (columns.payment_instructions) {
    addColumn(
      insertColumns,
      insertValues,
      "payment_instructions",
      payload.paymentInstructions || null
    );
    supportedColumns.add("payment_instructions");
  }
  if (columns.status) {
    insertColumns.push(Prisma.raw(`"status"`));
    insertValues.push({ value: "unpaid", castType: "voucher_status" });
    supportedColumns.add("status");
  }
  if (columns.created_by_user_id) {
    insertColumns.push(Prisma.raw(`"created_by_user_id"`));
    insertValues.push({ value: payload.createdByUserId, castType: "uuid" });
    supportedColumns.add("created_by_user_id");
  }

  ensureSupportedRequiredColumns("fee_vouchers", columns, supportedColumns);

  return { voucherId, insertColumns, insertValues };
}

export async function GET(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json("Forbidden.", 403);
  }

  const { searchParams } = new URL(request.url);
  const status = normalizeText(searchParams.get("status")).toLowerCase();
  const search = normalizeText(searchParams.get("search"));
  const conditions = [];
  const values = [];

  if (status && VALID_VOUCHER_STATUSES.has(status)) {
    values.push(status);
    conditions.push(`LOWER(fv.status::text) = $${values.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    values.push(term);
    conditions.push(`(
        COALESCE(fv.voucher_no, '') ILIKE $${values.length}
        OR COALESCE(rl.student_name, '') ILIKE $${values.length}
        OR COALESCE(rl.parent_name, '') ILIKE $${values.length}
        OR COALESCE(rl.phone, '') ILIKE $${values.length}
        OR COALESCE(rl.email, '') ILIKE $${values.length}
        OR fv.amount::text ILIKE $${values.length}
      )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount,
        fv.due_date,
        fv.payment_method,
        pm.name AS payment_method_name,
        pm.bank_name,
        pm.account_title,
        pm.account_number,
        pm.iban,
        pm.branch_code,
        pm.instructions AS payment_method_instructions,
        fv.payment_instructions,
        LOWER(rl.status::text) AS lead_status,
        LOWER(fv.status::text) AS voucher_status,
        LOWER(fv.status::text) AS status,
        rl.id::text AS registration_lead_id,
        rl.student_name,
        rl.parent_name,
        rl.class_level,
        rl.email,
        rl.phone,
        fv.regular_fee_applied,
        fv.regular_fee_amount,
        fv.admission_fee_amount,
        fv.discount_percent,
        fv.discount_amount,
        fv.subtotal_amount,
        fv.total_amount
      FROM fee_vouchers fv
      INNER JOIN registration_leads rl ON rl.id = fv.registration_id
      LEFT JOIN payment_methods pm ON pm.id = fv.payment_method_id
      ${whereClause}
      ORDER BY fv.created_at DESC NULLS LAST, fv.id DESC
      `,
      ...values
    );

    return json("Fee vouchers fetched.", 200, {
      items: items.map((item) => ({
        ...item,
        payment_method_details: {
          name: item.payment_method_name || item.payment_method || "",
          bank_name: item.bank_name || "",
          account_title: item.account_title || "",
          account_number: item.account_number || "",
          iban: item.iban || "",
          branch_code: item.branch_code || "",
          instructions: item.payment_method_instructions || item.payment_instructions || "",
        },
      })),
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch fee vouchers.",
      500
    );
  }
}

export async function POST(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json("Forbidden.", 403);
  }

  try {
    const body = await request.json();
    const registrationLeadId = normalizeText(body?.registration_lead_id || body?.registrationLeadId);
    const regularFeeApplied = normalizeBoolean(body?.regular_fee_applied ?? body?.regularFeeApplied);
    const regularFeeId = normalizeText(body?.regular_fee_id ?? body?.regularFeeId);
    const otherFeeId = normalizeText(body?.other_fee_id ?? body?.otherFeeId);
    const admissionFeeAmountInput = toMoney(body?.admission_fee_amount ?? body?.admissionFeeAmount);
    const scholarshipAmountInput = toMoney(body?.scholarship_amount ?? body?.scholarshipAmount);
    const scholarshipFormId = normalizeText(body?.scholarship_form_id ?? body?.scholarshipFormId);
    const discountId = normalizeText(body?.discount_id ?? body?.discountId);
    const discountPercentInput = Number((body?.discount_percent ?? body?.discountPercent) || 0);
    const dueDate = normalizeDueDate(body?.dueDate);
    const paymentMethod = normalizeText(body?.paymentMethod);
    const paymentMethodId = normalizeText(body?.paymentMethodId || body?.payment_method_id);
    const paymentInstructions = normalizeText(body?.paymentInstructions);

    if (!registrationLeadId) {
      return json("Registration lead is required.", 400);
    }

    if (!dueDate) {
      return json("Valid due date is required.", 400);
    }

    if (!paymentMethod && !paymentMethodId) {
      return json("Payment method is required.", 400);
    }

    const [existingVoucher] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount,
        fv.due_date,
        fv.payment_method,
        pm.name AS payment_method_name,
        pm.bank_name,
        pm.account_title,
        pm.account_number,
        pm.iban,
        pm.branch_code,
        pm.instructions AS payment_method_instructions,
        fv.payment_instructions,
        LOWER(rl.status::text) AS lead_status,
        LOWER(fv.status::text) AS voucher_status,
        LOWER(fv.status::text) AS status,
        rl.id::text AS registration_lead_id,
        rl.student_name,
        rl.parent_name,
        rl.class_level,
        rl.email,
        rl.phone,
        fv.regular_fee_applied,
        fv.regular_fee_amount,
        fv.admission_fee_amount,
        fv.discount_percent,
        fv.discount_amount,
        fv.subtotal_amount,
        fv.total_amount
      FROM fee_vouchers fv
      INNER JOIN registration_leads rl ON rl.id = fv.registration_id
      LEFT JOIN payment_methods pm ON pm.id = fv.payment_method_id
      WHERE fv.registration_id = ${registrationLeadId}::uuid
      ORDER BY fv.created_at DESC NULLS LAST, fv.id DESC
      LIMIT 1
    `;

    if (existingVoucher?.id) {
      if (scholarshipFormId || scholarshipAmountInput > 0) {
        const updatedExistingVoucherResult = await prisma.$transaction(async (tx) => {
          const selectedPaymentMethod = await getPaymentMethodById(paymentMethodId, tx);
          const resolvedPaymentMethod = selectedPaymentMethod
            ? selectedPaymentMethod.name || selectedPaymentMethod.method_key
            : await resolvePaymentMethod(paymentMethod, tx);

          if (!resolvedPaymentMethod) {
            throw new Error("Invalid payment method.");
          }

          const existingSubtotalAmount = Number(
            existingVoucher.subtotal_amount ||
              (Number(existingVoucher.regular_fee_amount || 0) + Number(existingVoucher.admission_fee_amount || 0))
          );
          const existingDiscountAmount = Number(existingVoucher.discount_amount || 0);
          const recalculatedTotalAmount = Number(
            (existingSubtotalAmount - existingDiscountAmount - scholarshipAmountInput).toFixed(2)
          );

          if (recalculatedTotalAmount <= 0) {
            throw new Error("Voucher total must be greater than zero.");
          }

          const voucherColumns = await getTableColumns("fee_vouchers", tx);
          const setClauses = [];
          const setValues = [];
          const pushUpdate = (sql, value) => {
            setClauses.push(sql.replace("__INDEX__", String(setValues.length + 1)));
            setValues.push(value);
          };

          if (voucherColumns.scholarship_amount) {
            pushUpdate(`scholarship_amount = $__INDEX__`, scholarshipAmountInput);
          }
          if (voucherColumns.amount) {
            pushUpdate(`amount = $__INDEX__`, recalculatedTotalAmount);
          }
          if (voucherColumns.total_amount) {
            pushUpdate(`total_amount = $__INDEX__`, recalculatedTotalAmount);
          }
          if (voucherColumns.due_date && dueDate) {
            pushUpdate(`due_date = $__INDEX__`, new Date(dueDate));
          }
          if (voucherColumns.payment_method_id && selectedPaymentMethod?.id) {
            pushUpdate(`payment_method_id = $__INDEX__::uuid`, selectedPaymentMethod.id);
          } else if (voucherColumns.payment_method) {
            pushUpdate(`payment_method = $__INDEX__::payment_method`, resolvedPaymentMethod);
          }
          if (voucherColumns.payment_instructions) {
            pushUpdate(`payment_instructions = $__INDEX__`, paymentInstructions || null);
          }

          if (setClauses.length) {
            await tx.$executeRawUnsafe(
              `
                UPDATE fee_vouchers
                SET ${setClauses.join(", ")}
                WHERE id = $${setValues.length + 1}::uuid
              `,
              ...setValues,
              existingVoucher.id
            );
          }

          const updatedScholarshipRows = await tx.$queryRaw`
            UPDATE need_based_scholarship_forms
            SET
              status = 'voucher_created',
              voucher_created = TRUE,
              voucher_id = ${existingVoucher.id}::uuid,
              scholarship_amount = ${scholarshipAmountInput},
              updated_at = NOW()
            WHERE (
                ${scholarshipFormId || null}::uuid IS NOT NULL
                AND id = ${scholarshipFormId || null}::uuid
              )
               OR registration_id = ${registrationLeadId}::uuid
            RETURNING id::text AS id
          `;

          if (!Array.isArray(updatedScholarshipRows) || !updatedScholarshipRows.length) {
            throw new Error("Need-based scholarship record was not updated with the existing voucher.");
          }

          await tx.$executeRaw`
            UPDATE registration_leads
            SET status = CAST('voucher_created' AS registration_status)
            WHERE id = ${registrationLeadId}::uuid
          `;

          const [lead] = await tx.$queryRaw`
            SELECT
              rl.id::text AS id,
              rl.student_name,
              rl.parent_name,
              rl.class_level,
              rl.email,
              rl.phone
            FROM registration_leads rl
            WHERE rl.id = ${registrationLeadId}::uuid
            LIMIT 1
          `;

          const supportEmail =
            (await tx.$queryRaw`
              SELECT value::text AS value
              FROM fee_settings
              WHERE key = 'payment_support_email'
              LIMIT 1
            `)[0]?.value || "";
          const supportPhone =
            (await tx.$queryRaw`
              SELECT value::text AS value
              FROM fee_settings
              WHERE key = 'payment_support_phone'
              LIMIT 1
            `)[0]?.value || "";

          const [updatedVoucher] = await tx.$queryRaw`
            SELECT
              fv.id::text AS id,
              fv.voucher_no,
              fv.amount,
              fv.due_date,
              fv.payment_method,
              pm.name AS payment_method_name,
              pm.bank_name,
              pm.account_title,
              pm.account_number,
              pm.iban,
              pm.branch_code,
              pm.instructions AS payment_method_instructions,
              fv.payment_instructions,
              LOWER(rl.status::text) AS lead_status,
              LOWER(fv.status::text) AS voucher_status,
              LOWER(fv.status::text) AS status,
              rl.id::text AS registration_lead_id,
              rl.student_name,
              rl.parent_name,
              rl.class_level,
              rl.email,
              rl.phone,
              fv.regular_fee_applied,
              fv.regular_fee_amount,
              fv.admission_fee_amount,
              fv.discount_percent,
              fv.discount_amount,
              fv.subtotal_amount,
              fv.total_amount
            FROM fee_vouchers fv
            INNER JOIN registration_leads rl ON rl.id = fv.registration_id
            LEFT JOIN payment_methods pm ON pm.id = fv.payment_method_id
            WHERE fv.id = ${existingVoucher.id}::uuid
            LIMIT 1
          `;

          const voucherItem = updatedVoucher || existingVoucher;
          const paymentSubmitUrl = buildPaymentSubmitUrl(voucherItem.voucher_no || existingVoucher.voucher_no);
          const availablePaymentMethods = await getActivePaymentMethods(tx);
          const { html: emailHtml, text: emailText } = buildVoucherEmailContent({
            studentName: lead?.student_name || "",
            parentName: lead?.parent_name || "",
            classLevel: lead?.class_level || "",
            voucherNo: voucherItem.voucher_no || existingVoucher.voucher_no,
            regularFeeAmount: Number(voucherItem.regular_fee_amount || 0),
            otherFeeAmount: Number(voucherItem.admission_fee_amount || 0),
            scholarshipAmount: scholarshipAmountInput,
            discountPercent: Number(voucherItem.discount_percent || 0),
            discountAmount: Number(voucherItem.discount_amount || 0),
            totalAmount: Number(voucherItem.total_amount || voucherItem.amount || 0),
            dueDate: voucherItem.due_date,
            paymentMethod: selectedPaymentMethod || { name: resolvedPaymentMethod },
            paymentInstructions,
            supportEmail,
            supportPhone,
            paymentSubmitUrl,
            paymentMethodName: resolvedPaymentMethod,
            availablePaymentMethods,
          });

          const emailMessage = lead?.email
            ? await insertOutboundMessage({
                voucherId: existingVoucher.id,
                recipientEmail: lead.email,
                recipientPhone: lead.phone || "",
                subject: `Fee voucher ${voucherItem.voucher_no || existingVoucher.voucher_no}`,
                body: emailHtml,
                bodyText: emailText,
                paymentSubmitUrl,
                createdBy: session.user.id,
                tx,
              })
            : null;

          return {
            item: voucherItem,
            lead,
            emailMessage: emailMessage ? { ...emailMessage, sent_status: "pending" } : null,
          };
        }, { timeout: 30000 });

        let existingVoucherEmailStatus = "sent";
        let existingVoucherEmailError = "";

        try {
          if (updatedExistingVoucherResult?.item?.id && updatedExistingVoucherResult?.lead?.email) {
            await sendEmail({
              to: updatedExistingVoucherResult.lead.email,
              subject:
                updatedExistingVoucherResult.emailMessage?.subject ||
                `Fee voucher ${updatedExistingVoucherResult.item.voucher_no || existingVoucher.voucher_no}`,
              html: updatedExistingVoucherResult.emailMessage?.body || "",
              text: updatedExistingVoucherResult.emailMessage?.body_text || "",
            });
          }
        } catch (emailError) {
          existingVoucherEmailStatus = "failed";
          existingVoucherEmailError =
            emailError instanceof Error ? emailError.message : "Voucher email dispatch failed.";
          if (updatedExistingVoucherResult?.emailMessage?.id) {
            await prisma.$executeRaw`
              UPDATE outbound_messages
              SET sent_status = 'failed',
                  updated_at = NOW()
              WHERE id = ${updatedExistingVoucherResult.emailMessage.id}::uuid
            `;
          }
        }

        if (existingVoucherEmailStatus === "sent" && updatedExistingVoucherResult?.emailMessage?.id) {
          await prisma.$executeRaw`
            UPDATE outbound_messages
            SET sent_status = 'sent',
                sent_at = NOW(),
                updated_at = NOW()
            WHERE id = ${updatedExistingVoucherResult.emailMessage.id}::uuid
          `;
        }

        return json(
          existingVoucherEmailStatus === "sent"
            ? "Existing voucher linked with need based scholarship and email sent successfully."
            : "Existing voucher linked with need based scholarship, but email sending failed.",
          200,
          {
            item: {
              ...updatedExistingVoucherResult.item,
              payment_method_details: {
                name:
                  updatedExistingVoucherResult.item.payment_method_name ||
                  updatedExistingVoucherResult.item.payment_method ||
                  "",
                bank_name: updatedExistingVoucherResult.item.bank_name || "",
                account_title: updatedExistingVoucherResult.item.account_title || "",
                account_number: updatedExistingVoucherResult.item.account_number || "",
                iban: updatedExistingVoucherResult.item.iban || "",
                branch_code: updatedExistingVoucherResult.item.branch_code || "",
                instructions:
                  updatedExistingVoucherResult.item.payment_method_instructions ||
                  updatedExistingVoucherResult.item.payment_instructions ||
                  "",
              },
            },
            existing: true,
            updated: true,
            email_sent: existingVoucherEmailStatus === "sent",
            email: updatedExistingVoucherResult.emailMessage
              ? {
                  ...updatedExistingVoucherResult.emailMessage,
                  body_html: updatedExistingVoucherResult.emailMessage.body,
                  body_text: updatedExistingVoucherResult.emailMessage.body_text,
                  payment_submit_url: updatedExistingVoucherResult.emailMessage.payment_submit_url,
                  recipient_phone: updatedExistingVoucherResult.emailMessage.recipient_phone,
                  sent_status: existingVoucherEmailStatus,
                }
              : null,
            ...(existingVoucherEmailStatus === "sent"
              ? {}
              : {
                  email_error: existingVoucherEmailError || "Email failed.",
                }),
          }
        );
      }

      return json("Fee voucher already exists for this registration lead.", 200, {
        item: {
          ...existingVoucher,
          payment_method_details: {
            name: existingVoucher.payment_method_name || existingVoucher.payment_method || "",
            bank_name: existingVoucher.bank_name || "",
            account_title: existingVoucher.account_title || "",
            account_number: existingVoucher.account_number || "",
            iban: existingVoucher.iban || "",
            branch_code: existingVoucher.branch_code || "",
            instructions:
              existingVoucher.payment_method_instructions ||
              existingVoucher.payment_instructions ||
              "",
          },
        },
        existing: true,
      });
    }

    const voucherNo = await generateVoucherNumber();

    const { item, lead, emailMessage } = await prisma.$transaction(async (tx) => {
      const createdBy = session?.user?.id || null;
      const lead = await getLeadById(registrationLeadId, tx);
      const availablePaymentMethods = await getActivePaymentMethods(tx);

      if (!lead?.id) {
        throw new Error("Registration lead not found.");
      }
      const resolvedRegistrationLeadId = lead.id;

      if (!ELIGIBLE_LEAD_STATUSES.has(String(lead.status || "").toLowerCase())) {
        throw new Error("Fee voucher can only be created for new or clarification-pending leads.");
      }

      const selectedPaymentMethod = await getPaymentMethodById(paymentMethodId, tx);
      const resolvedPaymentMethod = selectedPaymentMethod
        ? selectedPaymentMethod.name || selectedPaymentMethod.method_key
        : await resolvePaymentMethod(paymentMethod, tx);

      if (!resolvedPaymentMethod) {
        throw new Error("Invalid payment method.");
      }

      const selectedOtherFee = await getOtherFeeById(otherFeeId, tx);
      if (otherFeeId && !selectedOtherFee) {
        throw new Error("Selected other fee is not available.");
      }

      let regularFeeRecord = null;
      if (regularFeeApplied) {
        if (!regularFeeId) {
          throw new Error("Regular fee ID is missing.");
        }

        regularFeeRecord = await getRegularFeeById(regularFeeId, tx);
        if (!regularFeeRecord?.id) {
          console.log("REGULAR_FEE_VALIDATE_DEBUG", {
            leadId: registrationLeadId,
            leadClassLevel: lead?.class_level,
            regularFeeId,
            regularFeeClassLevel: regularFeeRecord?.class_level,
            regularFeeStatus: regularFeeRecord?.status,
            normalizedLeadClass: normalizeClassLevel(lead?.class_level),
            normalizedFeeClass: normalizeClassLevel(regularFeeRecord?.class_level),
          });
          throw new Error("Regular fee record was not found.");
        }

        if (String(regularFeeRecord.status || "").toLowerCase() !== "active") {
          throw new Error("Regular fee is inactive.");
        }

        if (
          normalizeClassLevel(regularFeeRecord.class_level) !==
          normalizeClassLevel(lead.class_level)
        ) {
          console.log("REGULAR_FEE_VALIDATE_DEBUG", {
            leadId: registrationLeadId,
            leadClassLevel: lead?.class_level,
            regularFeeId,
            regularFeeClassLevel: regularFeeRecord?.class_level,
            regularFeeStatus: regularFeeRecord?.status,
            normalizedLeadClass: normalizeClassLevel(lead?.class_level),
            normalizedFeeClass: normalizeClassLevel(regularFeeRecord?.class_level),
          });
          throw new Error("Regular fee does not match the selected lead class.");
        }
      }

      const maxDiscountPercent =
        role === "admin" ? 100 : await getCoordinatorMaxDiscountPercent(tx);
      const discount = await getDiscountById(discountId, tx);
      const regularFeeAmount = regularFeeApplied
        ? Number(regularFeeRecord?.amount || 0)
        : 0;
      const admissionFeeAmount = selectedOtherFee
        ? Number(selectedOtherFee.amount || 0)
        : admissionFeeAmountInput;
      const discountPercent = discount ? Number(discount.percent || 0) : Number(discountPercentInput || 0);

      if (role !== "admin" && discountPercent > maxDiscountPercent) {
        throw new Error(`Coordinator can only apply up to ${maxDiscountPercent}% discount.`);
      }

      if (discountPercent < 0 || regularFeeAmount < 0 || admissionFeeAmount < 0) {
        throw new Error("Fee values cannot be negative.");
      }

      const subtotalAmount = Number((regularFeeAmount + admissionFeeAmount).toFixed(2));
      const discountAmount = Number((regularFeeAmount * discountPercent / 100).toFixed(2));
      const totalAmount = Number((subtotalAmount - discountAmount - scholarshipAmountInput).toFixed(2));
      if (totalAmount <= 0) {
        throw new Error("Voucher total must be greater than zero.");
      }
      const voucherAmount = totalAmount;

      const paymentSubmitUrl = buildPaymentSubmitUrl(voucherNo);
      const payload = {
        registrationLeadId: resolvedRegistrationLeadId,
        amount: voucherAmount,
        dueDate,
        paymentMethodId: selectedPaymentMethod?.id || null,
        paymentMethod: resolvedPaymentMethod,
        paymentInstructions,
        createdByUserId: session.user.id,
        regularFeeApplied,
        regularFeeId: regularFeeRecord?.id || null,
        regularFeeAmount,
        otherFeeId: selectedOtherFee?.id || null,
        admissionFeeAmount,
        scholarshipAmount: scholarshipAmountInput,
        scholarshipFormId: scholarshipFormId || null,
        discountId: discount?.id || null,
        discountPercent,
        subtotalAmount,
        discountAmount,
        totalAmount,
      };
      
      const { voucherId, insertColumns, insertValues } = await buildVoucherInsertPayload(
        voucherNo,
        payload,
        tx
      );

      const insertColumnsJoin = Prisma.join(insertColumns, ", ");
      
      // FIXED: Dynamic cast mapper maps custom database ENUMs & explicit relational IDs safely
      await tx.$executeRaw`
        INSERT INTO fee_vouchers (${insertColumnsJoin})
        VALUES (${Prisma.join(
          insertValues.map((item) => {
            if (item && typeof item === "object" && item.castType) {
              if (item.castType === "payment_method") return Prisma.sql`${item.value}::payment_method`;
              if (item.castType === "voucher_status") return Prisma.sql`${item.value}::voucher_status`;
              if (item.castType === "uuid") return Prisma.sql`${item.value}::uuid`;
            }
            if (typeof item === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)) {
              return Prisma.sql`${item}::uuid`;
            }
            return Prisma.sql`${item}`;
          }),
          ", "
        )})
      `;

      if (regularFeeApplied && regularFeeAmount > 0 && tx.$executeRaw) {
        await tx.$executeRaw`
          INSERT INTO voucher_line_items (id, voucher_id, fee_type, title, amount, source_fee_id, created_at)
          VALUES (${crypto.randomUUID()}::uuid, ${voucherId}::uuid, 'regular_fee', ${regularFeeRecord?.name || `Regular Fee - ${regularFeeRecord?.class_level || ""}`}, ${regularFeeAmount}, ${regularFeeRecord?.id || null}::uuid, NOW())
        `;
      }

      if (admissionFeeAmount > 0) {
        await tx.$executeRaw`
          INSERT INTO voucher_line_items (id, voucher_id, fee_type, title, amount, created_at)
          VALUES (${crypto.randomUUID()}::uuid, ${voucherId}::uuid, ${selectedOtherFee?.fee_type || 'admission_fee'}, ${selectedOtherFee?.name || "Other Fee"}, ${admissionFeeAmount}, NOW())
        `;
      }

      if (scholarshipFormId || scholarshipAmountInput > 0) {
        const updatedScholarshipRows = await tx.$queryRaw`
          UPDATE need_based_scholarship_forms
          SET
            status = 'voucher_created',
            voucher_created = TRUE,
            voucher_id = ${voucherId}::uuid,
            scholarship_amount = ${scholarshipAmountInput},
            updated_at = NOW()
          WHERE (
              ${scholarshipFormId || null}::uuid IS NOT NULL
              AND id = ${scholarshipFormId || null}::uuid
            )
             OR registration_id = ${resolvedRegistrationLeadId}::uuid
          RETURNING id::text AS id, voucher_created, voucher_id::text AS voucher_id
        `;

        if (!Array.isArray(updatedScholarshipRows) || !updatedScholarshipRows.length) {
          throw new Error("Need-based scholarship record was not updated with the created voucher.");
        }
      }

      await tx.$executeRaw`
        UPDATE registration_leads
        SET status = CAST('voucher_created' AS registration_status)
        WHERE id = ${resolvedRegistrationLeadId}::uuid
      `;

      await insertAuditLog(
        session.user.id,
        voucherId,
        "fee_voucher_created",
        `Fee voucher ${voucherNo} created for registration lead ${resolvedRegistrationLeadId}.`,
        { voucherId, voucherNo, registrationLeadId: resolvedRegistrationLeadId },
        tx
      );

      const [created] = await tx.$queryRaw`
        SELECT
          fv.id::text AS id,
          fv.voucher_no,
          fv.amount,
          fv.regular_fee_applied,
          fv.regular_fee_amount,
          fv.admission_fee_amount,
          fv.discount_id::text AS discount_id,
          fv.discount_percent,
          fv.subtotal_amount,
          fv.discount_amount,
          fv.total_amount,
          fv.due_date,
          fv.payment_method,
          pm.name AS payment_method_name,
          pm.bank_name,
          pm.account_title,
          pm.account_number,
          pm.iban,
          pm.branch_code,
          pm.instructions AS payment_method_instructions,
          fv.payment_instructions,
          LOWER(rl.status::text) AS lead_status,
          LOWER(fv.status::text) AS voucher_status,
          LOWER(fv.status::text) AS status,
          rl.id::text AS registration_lead_id,
          rl.student_name,
          rl.parent_name,
          rl.class_level,
          rl.email,
          rl.phone,
          fv.regular_fee_applied,
          fv.regular_fee_amount,
          fv.admission_fee_amount,
          fv.discount_percent,
          fv.discount_amount,
          fv.subtotal_amount,
          fv.total_amount
        FROM fee_vouchers fv
        INNER JOIN registration_leads rl ON rl.id = fv.registration_id
        LEFT JOIN payment_methods pm ON pm.id = fv.payment_method_id
        WHERE fv.id = ${voucherId}::uuid
        LIMIT 1
      `;

      const supportEmail =
        (await tx.$queryRaw`
          SELECT value::text AS value
          FROM fee_settings
          WHERE key = 'payment_support_email'
          LIMIT 1
        `)[0]?.value || "";
      const supportPhone =
        (await tx.$queryRaw`
          SELECT value::text AS value
          FROM fee_settings
          WHERE key = 'payment_support_phone'
          LIMIT 1
        `)[0]?.value || "";

      const { html: emailHtml, text: emailText } = buildVoucherEmailContent({
        studentName: lead.student_name || "",
        parentName: lead.parent_name || "",
        classLevel: lead.class_level || "",
        voucherNo: created.voucher_no || voucherNo,
        regularFeeAmount,
        otherFeeAmount: admissionFeeAmount,
        scholarshipAmount: scholarshipAmountInput,
        discountPercent,
        discountAmount,
        totalAmount,
        dueDate,
        paymentMethod: selectedPaymentMethod || { name: resolvedPaymentMethod },
        paymentInstructions,
        supportEmail,
        supportPhone,
        paymentSubmitUrl,
        paymentMethodName: resolvedPaymentMethod,
        availablePaymentMethods,
      });

      const subject = `Fee voucher ${created.voucher_no || voucherNo}`;
      const emailMessage = await insertOutboundMessage({
        voucherId,
        recipientEmail: lead.email,
        recipientPhone: lead.phone || "",
        subject,
        body: emailHtml,
        bodyText: emailText,
        paymentSubmitUrl,
        createdBy,
        tx,
      });

      return {
        item: created,
        lead,
        emailMessage: emailMessage ? { ...emailMessage, sent_status: "pending" } : null,
      };
    }, { timeout: 30000 });

    let emailSendStatus = "sent";
    let emailErrorMessage = "";

    try {
      if (item?.id && lead?.email) {
        await sendEmail({
          to: lead.email,
          subject: emailMessage?.subject || `Fee voucher ${item.voucher_no || voucherNo}`,
          html: emailMessage?.body || "",
          text: emailMessage?.body_text || "",
        });
      }
    } catch (emailError) {
      emailSendStatus = "failed";
      emailErrorMessage =
        emailError instanceof Error ? emailError.message : "Voucher email dispatch failed.";
      console.error("VOUCHER_EMAIL_ERROR", {
        message: emailError?.message,
        name: emailError?.name,
        stack: emailError?.stack,
        code: emailError?.code,
        command: emailError?.command,
        response: emailError?.response?.body,
        smtpConfigured: Boolean(
          process.env.SMTP_HOST &&
            process.env.SMTP_PORT &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS &&
            (process.env.SMTP_FROM || process.env.SMTP_USER)
        ),
        smtpHost: process.env.SMTP_HOST || "",
        smtpPort: process.env.SMTP_PORT || "",
        smtpUser: process.env.SMTP_USER || "",
        smtpFrom: process.env.SMTP_FROM || "",
      });
      if (emailMessage?.id) {
        await prisma.$executeRaw`
          UPDATE outbound_messages
          SET sent_status = 'failed',
              updated_at = NOW()
          WHERE id = ${emailMessage.id}::uuid
        `;
      }
    }

    if (emailSendStatus === "sent" && emailMessage?.id) {
      await prisma.$executeRaw`
        UPDATE outbound_messages
        SET sent_status = 'sent',
            sent_at = NOW(),
            updated_at = NOW()
        WHERE id = ${emailMessage.id}::uuid
      `;
    }

      return json(
        emailSendStatus === "sent"
          ? "Voucher created and email sent successfully."
          : "Voucher created successfully, but email sending failed.",
      201,
      {
        success: true,
        email_sent: emailSendStatus === "sent",
        voucher: item,
        email: emailMessage
          ? {
              ...emailMessage,
            body_html: emailMessage.body,
            body_text: emailMessage.body_text,
            payment_submit_url: emailMessage.payment_submit_url,
            recipient_phone: emailMessage.recipient_phone,
            sent_status: emailSendStatus,
          }
          : null,
        ...(emailSendStatus === "sent"
          ? {}
          : {
              email_error: emailErrorMessage || "Email failed.",
              email_debug: {
                smtpConfigured: Boolean(
                  process.env.SMTP_HOST &&
                    process.env.SMTP_PORT &&
                    process.env.SMTP_USER &&
                    process.env.SMTP_PASS &&
                    (process.env.SMTP_FROM || process.env.SMTP_USER)
                ),
                smtpHost: process.env.SMTP_HOST || "",
                smtpPort: process.env.SMTP_PORT || "",
                smtpUser: process.env.SMTP_USER || "",
                smtpFrom: process.env.SMTP_FROM || "",
              },
            }),
      }
    );
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create fee voucher.",
      500
    );
  }
}
