import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

const INITIAL_SCHOLARSHIP_STATUS = "submitted";

export async function POST(request) {
  try {
    const body = await request.json();
    const registrationId = clean(body?.registrationId);
    const leadToken = clean(body?.leadToken);
    const dependentsCount = clean(body?.dependentsCount);
    const schoolGoingChildrenCount = clean(body?.schoolGoingChildrenCount);
    const residenceType = clean(body?.residenceType);
    const requestedAmount = clean(body?.requestedAmount);
    const scholarshipReason = clean(body?.scholarshipReason);

    if (!registrationId) {
      return json("Registration id is required.", 400);
    }
    if (!dependentsCount || !/^\d+$/.test(dependentsCount)) {
      return json("Dependents count is required.", 400);
    }
    if (!schoolGoingChildrenCount || !/^\d+$/.test(schoolGoingChildrenCount)) {
      return json("School-going children count is required.", 400);
    }
    if (!residenceType) {
      return json("Residence type is required.", 400);
    }
    if (!requestedAmount || !Number.isFinite(Number(requestedAmount)) || Number(requestedAmount) <= 0) {
      return json("Requested amount is required.", 400);
    }
    if (!scholarshipReason) {
      return json("Scholarship reason is required.", 400);
    }

    const [lead] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM registration_leads
      WHERE id = ${registrationId}::uuid
      LIMIT 1
    `;

    if (!lead?.id) {
      return json("Admission record not found.", 404);
    }

    const [voucher] = await prisma.$queryRaw`
      SELECT LOWER(status::text) AS status
      FROM fee_vouchers
      WHERE registration_id = ${registrationId}::uuid
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    `;

    if (["submitted", "verified"].includes(String(voucher?.status || "").toLowerCase())) {
      return json("Need based scholarship is no longer available because payment has already been submitted.", 400);
    }

    const [interestedStudent] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM interested_students
      WHERE registration_lead_id = ${registrationId}::uuid
      LIMIT 1
    `;

    const [existing] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM need_based_scholarship_forms
      WHERE registration_id = ${registrationId}::uuid
      LIMIT 1
    `;

    if (existing?.id) {
      await prisma.$executeRaw`
        UPDATE need_based_scholarship_forms
        SET
          interested_student_id = ${interestedStudent?.id || null}::uuid,
          lead_token = ${leadToken || null},
          dependents_count = ${Number(dependentsCount)},
          school_going_children_count = ${Number(schoolGoingChildrenCount)},
          residence_type = ${residenceType},
          requested_amount = ${Number(requestedAmount)},
          scholarship_reason = ${scholarshipReason},
          status = ${INITIAL_SCHOLARSHIP_STATUS},
          updated_at = NOW()
        WHERE id = ${existing.id}::uuid
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO need_based_scholarship_forms (
          id,
          registration_id,
          interested_student_id,
          lead_token,
          dependents_count,
          school_going_children_count,
          residence_type,
          requested_amount,
          scholarship_reason,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${registrationId}::uuid,
          ${interestedStudent?.id || null}::uuid,
          ${leadToken || null},
          ${Number(dependentsCount)},
          ${Number(schoolGoingChildrenCount)},
          ${residenceType},
          ${Number(requestedAmount)},
          ${scholarshipReason},
          ${INITIAL_SCHOLARSHIP_STATUS},
          NOW(),
          NOW()
        )
      `;
    }

    return json("Need based scholarship submitted successfully.", 200);
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to submit need based scholarship form.",
      500
    );
  }
}
