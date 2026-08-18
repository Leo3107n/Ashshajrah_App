import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["superadmin", "admin", "coordinator", "teacher", "parent", "student"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const items = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        title,
        message,
        type::text AS type,
        COALESCE(is_read, false) AS is_read,
        created_at::text AS created_at
      FROM notifications
      WHERE user_id = ${session.user.id}::uuid
        AND (${unreadOnly}::boolean = false OR COALESCE(is_read, false) = false)
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
    const [summary] = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE COALESCE(is_read, false) = false)::int AS unread
      FROM notifications
      WHERE user_id = ${session.user.id}::uuid
    `;
    return json("Notifications fetched.", 200, { items, summary: summary || { total: 0, unread: 0 } });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load notifications.", 500);
  }
}

export async function PATCH(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const all = body?.all === true;
    if (!id && !all) return json("Notification id or all is required.", 400);

    if (all) {
      const count = await prisma.$executeRaw`
        UPDATE notifications
        SET is_read = true
        WHERE user_id = ${session.user.id}::uuid
          AND COALESCE(is_read, false) = false
      `;
      return json("All notifications marked read.", 200, { updatedCount: count });
    }

    const count = await prisma.$executeRaw`
      UPDATE notifications
      SET is_read = true
      WHERE id = ${id}::uuid
        AND user_id = ${session.user.id}::uuid
    `;
    if (!count) return json("Notification not found.", 404);
    return json("Notification marked read.", 200, { updatedCount: count });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update notification.", 500);
  }
}
