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
        ca.id::text AS id,
        ca.full_name,
        ca.email,
        ca.whatsapp,
        ca.interested_role,
        ca.message,
        ca.resume_file_name,
        ca.resume_mime_type,
        ca.resume_size_bytes,
        ca.source,
        LOWER(ca.status::text) AS status,
        ca.admin_notes,
        ca.submitted_at,
        ca.updated_at
      FROM career_applications ca
      ORDER BY ca.submitted_at DESC NULLS LAST, ca.id DESC
    `;

    return json("Career applications fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch career applications.", 500);
  }
}
