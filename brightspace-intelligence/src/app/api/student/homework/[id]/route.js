import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { uploadHomeworkSubmission } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = ["student"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";
    let note = "";
    let file = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      note = typeof formData.get("note") === "string" ? String(formData.get("note")).trim() : "";
      const maybeFile = formData.get("file");
      file = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;
    } else {
      const body = await request.json().catch(() => ({}));
      note = typeof body?.note === "string" ? body.note.trim() : "";
    }

    if (!note) {
      return json("Submission is required.", 400);
    }

    const [homework] = await prisma.$queryRaw`
      SELECT h.id::text AS id
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      WHERE h.id = ${id}::uuid
        AND sp.user_id = ${session.user.id}::uuid
      LIMIT 1
    `;

    if (!homework?.id) {
      return json("Homework not found.", 404);
    }

    let upload = null;
    if (file) {
      upload = await uploadHomeworkSubmission({ homeworkId: id, file });
    }

    await prisma.$executeRaw`
      UPDATE homework
      SET
        status = 'submitted'::homework_status,
        submission_note = ${note}::text,
        submission_attachment_bucket = ${(upload?.bucket || null)}::text,
        submission_attachment_path = ${(upload?.storedPath || null)}::text,
        submission_attachment_name = ${(file?.name || null)}::text,
        submitted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at, new_data)
      VALUES (
        gen_random_uuid(),
        ${session.user.id}::uuid,
        'homework_submitted',
        'homework',
        ${id}::uuid,
        NOW(),
        jsonb_build_object(
          'note', ${note}::text,
          'attachment_path', ${(upload?.storedPath || null)}::text,
          'attachment_name', ${(file?.name || null)}::text
        )
      )
    `;

    return json("Homework submitted.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to submit homework.", 500);
  }
}
