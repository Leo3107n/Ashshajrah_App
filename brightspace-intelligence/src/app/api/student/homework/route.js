import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createSignedHomeworkSubmissionUrl } from "@/lib/supabaseStorage";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const items = await prisma.$queryRaw`
      SELECT
        h.id::text AS id,
        h.title,
        h.description,
        h.due_date,
        h.status::text AS status,
        h.created_at,
        h.submission_note,
        h.submission_attachment_path,
        h.submission_attachment_name,
        h.submitted_at,
        ls.title AS lecture_title,
        sub.name AS subject_name,
        tu.full_name AS teacher_name,
        latest_review.action AS review_action,
        latest_review.remarks AS teacher_remarks
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      INNER JOIN subjects sub ON sub.id = h.subject_id
      INNER JOIN teacher_profiles tp ON tp.id = h.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      LEFT JOIN lecture_schedules ls ON ls.id = h.lecture_id
      LEFT JOIN LATERAL (
        SELECT
          al.action,
          al.new_data->>'remarks' AS remarks
        FROM audit_logs al
        WHERE al.entity_type = 'homework'
          AND al.entity_id = h.id
          AND al.action IN ('homework_approved', 'homework_rejected')
          AND al.created_at > COALESCE(
            (
              SELECT MAX(submitted.created_at)
              FROM audit_logs submitted
              WHERE submitted.entity_type = 'homework'
                AND submitted.entity_id = h.id
                AND submitted.action = 'homework_submitted'
            ),
            '-infinity'::timestamp
          )
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT 1
      ) latest_review ON true
      WHERE sp.user_id = ${session.user.id}::uuid
      ORDER BY h.created_at DESC
    `;
    const normalizedItems = await Promise.all(
      items.map(async (item) => ({
        ...item,
        submission_attachment_url: item.submission_attachment_path
          ? await createSignedHomeworkSubmissionUrl(
              item.submission_attachment_path
            )
          : "",
        submission_attachment_path: undefined,
      }))
    );
    return json("Homework fetched.", 200, { items: normalizedItems });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load homework.", 500);
  }
}
