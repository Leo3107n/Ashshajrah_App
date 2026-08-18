import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request, context) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await context.params;
    const body = await request.json();
    const status = normalizeText(body?.status).toLowerCase();

    if (!["active", "suspended", "archived"].includes(status)) {
      return json("Valid assignment status is required.", 400);
    }

    const [existing] = await prisma.$queryRaw`
      SELECT id::text AS id, status::text AS status
      FROM teacher_assignments
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (!existing?.id) {
      return json("Teacher assignment not found.", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE teacher_assignments
        SET status = ${status}::user_status,
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      await createAuditLog(
        {
          actorUserId: session.user.id,
          action: "teacher_assignment_updated",
          entityType: "teacher_assignments",
          entityId: id,
          oldData: { status: existing.status },
          newData: { status },
        },
        tx
      );
    });

    return json("Teacher assignment updated.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to update teacher assignment.",
      500
    );
  }
}
