import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { buildParentStudentScope, getScopedParentChildren } from "@/lib/parentScope";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const childId = String(searchParams.get("childId") || "").trim();
    const scope = buildParentStudentScope(session, childId);

    const notes = await prisma.$queryRawUnsafe(
      `
      SELECT
        tn.id::text AS id,
        tn.note,
        COALESCE(tn.visibility, 'parent') AS visibility,
        tn.created_at,
        tu.full_name AS teacher_name,
        su.full_name AS student_name
      FROM teacher_notes tn
      INNER JOIN student_profiles sp ON sp.id = tn.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = tn.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      ${scope.joins}
      ${scope.where}
        ${scope.where ? "AND" : "WHERE"} COALESCE(tn.visibility, 'parent') IN ('parent', 'student')
      ORDER BY tn.created_at ASC
      LIMIT 20
      `,
      ...scope.values
    );

    const children = await getScopedParentChildren(session);

    return json("Parent notes fetched.", 200, { notes, children });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load parent notes.", 500);
  }
}
