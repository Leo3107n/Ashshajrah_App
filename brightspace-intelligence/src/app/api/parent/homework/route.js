import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";
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

    const itemsRaw = await prisma.$queryRawUnsafe(
      `
      SELECT
        h.id::text AS id,
        h.title,
        h.description,
        h.due_date,
        h.status::text AS status,
        h.submission_note,
        h.submission_attachment_path,
        h.submission_attachment_name,
        ls.title AS lecture_title,
        sub.name AS subject_name,
        tu.full_name AS teacher_name,
        su.full_name AS student_name,
        COALESCE(h.submission_note, latest_submission.note) AS submission_note
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = h.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN subjects sub ON sub.id = h.subject_id
      LEFT JOIN lecture_schedules ls ON ls.id = h.lecture_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(al.new_data->>'note', '') AS note,
          al.created_at
        FROM audit_logs al
        WHERE al.entity_type = 'homework'
          AND al.entity_id = h.id::uuid
          AND al.action = 'homework_submitted'
        ORDER BY al.created_at DESC
        LIMIT 1
      ) latest_submission ON TRUE
      ${scope.joins}
      ${scope.where}
      ORDER BY h.due_date ASC NULLS LAST, h.created_at DESC
      `,
      ...scope.values
    );

    const items = await Promise.all(
      itemsRaw.map(async (item) => ({
        ...item,
        submission_attachment_url: item.submission_attachment_path
          ? await createSignedAdmissionDocumentUrl(item.submission_attachment_path).catch(() => "")
          : "",
      }))
    );

    const children = scope.isAdmin ? [] : await getScopedParentChildren(session);

    return json("Homework fetched.", 200, { items, children });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load homework.", 500);
  }
}
