import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildRegistrationLeadPayload(input = {}) {
  const requestedClassLevel = normalizeText(input.class_level ?? input.classLevel);
  return {
    studentName: normalizeText(input.student_name ?? input.studentName),
    parentName: normalizeText(input.parent_name ?? input.parentName),
    parentRelation: normalizeText(input.parent_relation ?? input.parentRelation),
    email: normalizeText(input.email ?? input.parentEmail).toLowerCase(),
    phone: normalizeText(input.phone),
    age: Number(normalizeText(input.age ?? input.student_age ?? input.studentAge)),
    classLevel: requestedClassLevel,
    address: normalizeText(input.address),
    city: normalizeText(input.city),
    notes: normalizeText(input.notes),
    source: normalizeText(input.source) || "website_registration",
  };
}

export function validateRegistrationLead(lead) {
  if (!lead.studentName) return "Student name is required.";
  if (!lead.parentName) return "Parent name is required.";
  if (!lead.parentRelation) return "Parent relation is required.";
  if (!lead.email) return "Parent email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return "A valid parent email is required.";
  if (!lead.phone) return "Phone is required.";
  if (!Number.isFinite(lead.age) || lead.age <= 0) return "Student age must be a valid number.";
  if (!lead.classLevel) return "Class level is required.";
  return "";
}

export async function upsertRegistrationLead(lead, tx = prisma) {
  const [record] = await tx.$queryRaw`
    INSERT INTO registration_leads (
      student_name,
      parent_name,
      parent_relation,
      email,
      phone,
      age,
      class_level,
      address,
      city,
      notes,
      source,
      status,
      created_at
    )
    VALUES (
      ${lead.studentName},
      ${lead.parentName},
      ${lead.parentRelation},
      ${lead.email},
      ${lead.phone},
      ${lead.age},
      ${lead.classLevel},
      ${lead.address || null},
      ${lead.city || null},
      ${lead.notes || null},
      ${lead.source},
      ${"new_lead"},
      NOW()
    )
    RETURNING id::text AS id, status::text AS status
  `;

  return record;
}

export async function resetFalseVoucherCreatedLeads(tx = prisma) {
  await tx.$executeRaw`
    UPDATE registration_leads rl
    SET status = CAST('new_lead' AS registration_status)
    WHERE rl.status::text = 'voucher_created'
      AND NOT EXISTS (
        SELECT 1
        FROM fee_vouchers fv
        WHERE fv.registration_id = rl.id
      )
  `;
}
