import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["superadmin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function DELETE(_request, context) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  const params = await context?.params;
  const id = String(params?.id || "").trim();
  if (!id) return json("Interested student id is required.", 400);

  try {
    const [lead] = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        COALESCE(NULLIF(TRIM(admission_form_status), ''), 'pending') AS admission_form_status,
        COALESCE(NULLIF(TRIM(status), ''), 'new') AS status
      FROM interested_students
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (!lead?.id) {
      return json("Interested student not found.", 404);
    }

    const leadStatus = String(lead.admission_form_status || lead.status || "new").toLowerCase();
    const canDelete = !["sent", "submitted", "reminded", "overdue", "not_submitted"].includes(leadStatus);

    if (!canDelete) {
      return json("This record can no longer be deleted.", 400);
    }

    const archivedAt = await prisma.$queryRaw`
      UPDATE interested_students
      SET status = 'archived',
          admission_form_status = 'failed',
          updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id::text AS id, status, admission_form_status
    `;

    if (!Array.isArray(archivedAt) || !archivedAt.length) {
      return json("Interested student not found.", 404);
    }

    return json("Interested student hidden.", 200, { success: true, archived: true, item: archivedAt[0] });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to hide interested student.", 500);
  }
}

export async function PATCH(request, context) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  const params = await context?.params;
  const id = String(params?.id || "").trim();
  if (!id) return json("Interested student id is required.", 400);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parentFormSentStatus = String(body?.parentFormSentStatus || "").trim().toLowerCase();
  const allowedStatuses = new Set(["no", "checking issue", "resolved", "yes"]);

  if (!allowedStatuses.has(parentFormSentStatus)) {
    return json("Parent form sent status is required.", 400);
  }

  try {
    const [updated] = await prisma.$queryRaw`
      UPDATE interested_students
      SET parent_form_sent_status = ${parentFormSentStatus},
          updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id::text AS id, parent_form_sent_status
    `;

    if (!updated?.id) {
      return json("Interested student not found.", 404);
    }

    return json("Parent form sent status updated.", 200, {
      success: true,
      item: updated,
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to update parent form sent status.", 500);
  }
}
