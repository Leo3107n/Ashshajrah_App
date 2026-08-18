import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["superadmin", "admin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function DELETE(_request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  const { id } = await params;

  try {
    const result = await prisma.$executeRaw`
      DELETE FROM career_applications
      WHERE id = ${id}
    `;

    if (!result) {
      return json("Career application not found.", 404);
    }

    return json("Career application deleted.", 200);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to delete career application.", 500);
  }
}
