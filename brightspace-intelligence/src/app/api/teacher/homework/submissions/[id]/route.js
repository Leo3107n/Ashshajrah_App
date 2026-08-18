import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getSubmission(session, id) {
  if (String(session.user.role).toLowerCase() === "admin") {
    return prisma.$queryRaw`
      SELECT h.id::text AS id, h.teacher_id::text AS teacher_id
      FROM homework h
      WHERE h.id = ${id}::uuid
      LIMIT 1
    `;
  }

  return prisma.$queryRaw`
    SELECT h.id::text AS id, h.teacher_id::text AS teacher_id
    FROM homework h
    INNER JOIN teacher_profiles tp ON tp.id = h.teacher_id
    WHERE h.id = ${id}::uuid
      AND tp.user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = clean(body?.action).toLowerCase();
    const remarks = clean(body?.remarks);

    if (!["approve", "reject"].includes(action)) {
      return json("Invalid homework action.", 400);
    }

    const [submission] = await getSubmission(session, id);
    if (!submission?.id) {
      return json("Homework submission not found.", 404);
    }

    await prisma.$transaction(async (tx) => {
      if (action === "approve") {
        await tx.$executeRaw`
          UPDATE homework
          SET status = 'submitted'::homework_status,
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;
      } else {
        await tx.$executeRaw`
          UPDATE homework
          SET status = 'pending'::homework_status,
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;
      }

      if (remarks) {
        await tx.$executeRaw`
          INSERT INTO audit_logs (
            id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            created_at,
            new_data
          )
          VALUES (
            gen_random_uuid(),
            ${session.user.id}::uuid,
            ${action === "approve" ? "homework_approved" : "homework_rejected"},
            'homework',
            ${id}::uuid,
            NOW(),
            jsonb_build_object('remarks', ${remarks}::text)
          )
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO audit_logs (
            id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            created_at,
            new_data
          )
          VALUES (
            gen_random_uuid(),
            ${session.user.id}::uuid,
            ${action === "approve" ? "homework_approved" : "homework_rejected"},
            'homework',
            ${id}::uuid,
            NOW(),
            jsonb_build_object('remarks', NULL::text)
          )
        `;
      }
    });

    return json(action === "approve" ? "Homework approved." : "Homework rejected.");
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update homework submission.", 500);
  }
}
