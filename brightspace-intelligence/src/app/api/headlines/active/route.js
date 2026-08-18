import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import { getActiveHeadlines } from "@/lib/headlines";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    await requireRole(["admin", "teacher", "parent", "student"]);
    const headlines = await getActiveHeadlines();

    return json("Active headlines fetched.", 200, { headlines });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load headlines.", 500);
  }
}
