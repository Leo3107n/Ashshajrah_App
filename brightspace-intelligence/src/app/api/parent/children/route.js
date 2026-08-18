import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import { getScopedParentChildren } from "@/lib/parentScope";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const children = await getScopedParentChildren(session, { includeDetails: true });
    return json("Children fetched.", 200, { children });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load children.", 500);
  }
}
