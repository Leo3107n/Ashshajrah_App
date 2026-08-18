import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function createAuditLog(payload, tx = prisma) {
  const action = String(payload?.action || "").trim();
  const entityType = String(payload?.entityType || "").trim();

  if (!action || !entityType) {
    return;
  }

  const entityId = payload?.entityId ? String(payload.entityId) : null;
  const actorUserId = payload?.actorUserId ? String(payload.actorUserId) : null;
  const oldData =
    typeof payload?.oldData === "undefined" ? null : JSON.stringify(payload.oldData);
  const newData =
    typeof payload?.newData === "undefined" ? null : JSON.stringify(payload.newData);

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO audit_logs (
        id,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${actorUserId}::uuid,
        ${action},
        ${entityType},
        ${entityId}::uuid,
        ${oldData}::jsonb,
        ${newData}::jsonb,
        NOW()
      )
    `
  );
}

