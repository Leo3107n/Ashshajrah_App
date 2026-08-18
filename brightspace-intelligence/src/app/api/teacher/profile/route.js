import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];
const PROTECTED_FIELDS = new Set(["role", "roleId", "role_id", "status", "email", "username", "permissions", "password", "passwordHash", "password_hash"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const [profile] = await prisma.$queryRaw`
      SELECT
        u.id::text AS user_id,
        u.full_name,
        u.email,
        u.phone,
        u.status::text AS status,
        tp.id::text AS teacher_profile_id,
        tp.qualification,
        tp.experience
      FROM users u
      LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
      WHERE u.id = ${session.user.id}::uuid
      LIMIT 1
    `;
    return json("Profile fetched.", 200, { profile });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load profile.", 500);
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request) {
  try {
    const session = await requireRole(["teacher"]);
    const body = await request.json().catch(() => ({}));
    if (Object.keys(body || {}).some((key) => PROTECTED_FIELDS.has(key))) {
      return json("Protected account fields cannot be changed.", 400);
    }

    const fullName = clean(body?.fullName ?? body?.full_name);
    const phone = clean(body?.phone);
    const qualification = clean(body?.qualification);
    const experience = clean(body?.experience);
    if (!fullName) return json("Full name is required.", 400);
    if (fullName.length > 150) return json("Full name is too long.", 400);
    if (phone.length > 50 || qualification.length > 255 || experience.length > 255) {
      return json("One or more profile fields are too long.", 400);
    }

    if (phone) {
      const [duplicate] = await prisma.$queryRaw`
        SELECT id::text AS id FROM users
        WHERE phone = ${phone} AND id <> ${session.user.id}::uuid
        LIMIT 1
      `;
      if (duplicate?.id) return json("This phone number is already in use.", 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE users
        SET full_name = ${fullName}, phone = ${phone || null}, updated_at = NOW()
        WHERE id = ${session.user.id}::uuid
      `;
      await tx.$executeRaw`
        UPDATE teacher_profiles
        SET qualification = ${qualification || null},
            experience = ${experience || null},
            updated_at = NOW()
        WHERE user_id = ${session.user.id}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
        VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'teacher_profile_updated', 'users', ${session.user.id}::uuid, NOW())
      `;
    });
    return json("Profile updated.");
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update profile.", 500);
  }
}
