import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["superadmin", "admin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const items = await prisma.$queryRaw`
      SELECT
        pif.id::text AS id,
        pif.registration_id,
        pif.parent_name,
        pif.parent_email,
        pif.child_name,
        pif.child_age,
        pif.interested_programme,
        LOWER(pif.status::text) AS status,
        pif.responses,
        pif.submitted_at,
        pif.reviewed_at,
        pif.form_version,
        pif.created_at,
        pif.updated_at
      FROM parent_interview_forms pif
      ORDER BY pif.created_at DESC NULLS LAST, pif.id DESC
    `;

    return json("Parent interview forms fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch parent interview forms.", 500);
  }
}
