import { NextResponse } from "next/server";
import { validateUserCredentials } from "@/lib/auth";

// This lightweight pre-check lets the login page discover whether the same
// credentials unlock more than one portal before a session is created.
//
// Why this exists:
// - web and mobile should not immediately create a session for an arbitrary
//   role when one account belongs to multiple portals
// - we first validate the credentials once
// - then return the allowed roles so the client can show the selector modal
// - only after the user chooses a role do we complete the real sign-in
export async function POST(request) {
  try {
    const body = await request.json();
    const identifier = typeof body?.identifier === "string" ? body.identifier : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!identifier.trim() || !password.trim()) {
      return NextResponse.json({ error: "Missing credentials." }, { status: 400 });
    }

    const user = await validateUserCredentials(identifier, password);

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.full_name || "",
        roles: user.roles || [],
        defaultRole: user.defaultRole || "",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to inspect roles." }, { status: 500 });
  }
}
