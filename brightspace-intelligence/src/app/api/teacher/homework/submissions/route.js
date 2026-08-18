import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function teacherFilter(session) {
  if (String(session.user.role).toLowerCase() === "admin") return { where: "", values: [] };
  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id FROM teacher_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
  `;
  if (!teacher?.id) throw new Error("Teacher profile not found.");
  return { where: "WHERE h.teacher_id = $1::uuid", values: [teacher.id] };
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const filter = await teacherFilter(session);
    const whereClause = filter.where ? `${filter.where} AND` : "WHERE";
    const itemsRaw = await prisma.$queryRawUnsafe(
      `
      SELECT
        h.id::text AS id,
        h.lecture_id::text AS lecture_id,
        h.title,
        h.description,
        h.due_date,
        h.status::text AS status,
        h.submission_note,
        h.submission_attachment_path,
        h.submission_attachment_name,
        h.created_at,
        h.updated_at,
        h.teacher_id::text AS teacher_id,
        h.subject_id::text AS subject_id,
        su.full_name AS student_name,
        su.username AS student_username,
        su.email AS student_email,
        su.phone AS student_phone,
        sp.grade_level,
        sub.name AS subject_name,
        c.title AS course_title,
        COALESCE(NULLIF(c.class_level, ''), c.title) AS class_level,
        teacher.full_name AS teacher_name,
        latest_submission.action AS latest_submission_action,
        COALESCE(h.submission_note, latest_submission.note) AS submission_note
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN subjects sub ON sub.id = h.subject_id
      INNER JOIN teacher_profiles tp ON tp.id = h.teacher_id
      INNER JOIN users teacher ON teacher.id = tp.user_id
      INNER JOIN lecture_schedules ls ON ls.id = h.lecture_id
      INNER JOIN enrollments lecture_enrollment ON lecture_enrollment.id = ls.enrollment_id
      INNER JOIN enrollments e ON e.course_id = lecture_enrollment.course_id AND e.student_id = sp.id
      INNER JOIN courses c ON c.id = e.course_id
      LEFT JOIN LATERAL (
        SELECT
          al.action::text AS action,
          COALESCE(al.new_data->>'note', '') AS note,
          al.created_at
        FROM audit_logs al
        WHERE al.entity_type = 'homework'
          AND al.entity_id = h.id::uuid
          AND al.action IN ('homework_submitted', 'homework_approved', 'homework_rejected')
        ORDER BY al.created_at DESC
        LIMIT 1
      ) latest_submission ON TRUE
      ${whereClause}
        LOWER(h.status::text) = 'submitted'
        AND COALESCE(latest_submission.action, '') = 'homework_submitted'
      ORDER BY h.created_at DESC
      `,
      ...filter.values
    );

    const items = await Promise.all(
      itemsRaw.map(async (item) => ({
        ...item,
        submission_attachment_url: item.submission_attachment_path
          ? await createSignedAdmissionDocumentUrl(item.submission_attachment_path)
          : "",
      }))
    );

    return json("Homework submissions fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load homework submissions.", 500);
  }
}
