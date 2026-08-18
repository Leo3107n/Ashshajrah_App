import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    await requireRole(ALLOWED_ROLES);

    const items = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          id::text AS id,
          COALESCE(NULLIF(class_level, ''), title) AS title
        FROM courses
        WHERE COALESCE(status, 'active'::user_status) = 'active'::user_status
        ORDER BY
          COALESCE(NULLIF(class_level, ''), title) ASC
      `
    );

    return json("Classes fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;

    return json(error instanceof Error ? error.message : "Unable to fetch classes.", 500);
  }
}
