import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export class RoleGuardError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "RoleGuardError";
    this.status = status;
  }
}

export function normalizeRole(value) {
  return String(value || "").toLowerCase();
}

export async function requireRole(allowedRoles = []) {
  const session = await auth();
  const role = normalizeRole(session?.user?.role);

  if (!session?.user) {
    throw new RoleGuardError("Unauthorized.", 401);
  }

  if (!allowedRoles.map(normalizeRole).includes(role)) {
    throw new RoleGuardError("Forbidden.", 403);
  }

  return session;
}

export function roleGuardResponse(error) {
  if (error instanceof RoleGuardError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  return null;
}

