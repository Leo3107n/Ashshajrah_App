import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureRecipientThreadSchema() {
  await prisma.$executeRaw`
    ALTER TABLE note_threads
    ADD COLUMN IF NOT EXISTS recipient_student_id UUID NULL
  `;

  await prisma.$executeRaw`
    UPDATE note_threads nt
    SET recipient_student_id = sp.id
    FROM note_thread_messages nm
    INNER JOIN student_profiles sp ON sp.user_id = nm.sender_user_id
    WHERE nt.id = nm.thread_id
      AND nt.recipient_student_id IS NULL
      AND LOWER(COALESCE(nm.sender_role, '')) = 'student'
  `;

  await prisma.$executeRaw`
    UPDATE note_threads nt
    SET recipient_student_id = ls.student_id
    FROM lecture_schedules ls
    WHERE nt.lecture_id = ls.id
      AND nt.recipient_student_id IS NULL
      AND ls.student_id IS NOT NULL
  `;
}

async function canManageThread(session, id) {
  const role = String(session.user.role || "").toLowerCase();
  if (role === "admin" || role === "superadmin") {
    return prisma.$queryRaw`
      SELECT nt.id::text AS id
      FROM note_threads nt
      WHERE nt.id = ${id}::uuid
      LIMIT 1
    `;
  }
  return prisma.$queryRaw`
    SELECT nt.id::text AS id
    FROM note_threads nt
    INNER JOIN teacher_profiles tp ON tp.id = nt.teacher_id
    WHERE nt.id = ${id}::uuid
      AND tp.user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
}

export async function PATCH(request, { params }) {
  try {
    await ensureRecipientThreadSchema();
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const note = clean(body?.message || body?.note);
    const visibility = clean(body?.visibility).toLowerCase();

    const [row] = await canManageThread(session, id);
    if (!row?.id) return json("Thread not found.", 404);

    if (!note && !visibility) return json("No fields to update.", 400);

    if (note) {
      const [latest] = await prisma.$queryRaw`
        SELECT id::text AS id
        FROM note_thread_messages
        WHERE thread_id = ${id}::uuid
          AND sender_user_id = ${session.user.id}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!latest?.id) return json("No editable note found.", 404);
      await prisma.$executeRaw`
        UPDATE note_thread_messages
        SET message = ${note},
            updated_at = NOW()
        WHERE id = ${latest.id}::uuid
      `;
    }

    if (visibility) {
      await prisma.$executeRaw`
        UPDATE note_threads
        SET visibility = ${visibility},
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }

    return json("Thread updated.");
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update thread.", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureRecipientThreadSchema();
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const [row] = await canManageThread(session, id);
    if (!row?.id) return json("Thread not found.", 404);
    await prisma.$executeRaw`DELETE FROM note_threads WHERE id = ${id}::uuid`;
    return json("Thread deleted.");
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to delete thread.", 500);
  }
}
