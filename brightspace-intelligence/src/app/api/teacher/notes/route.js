import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];
const VISIBILITY = new Set(["parent", "student", "teacher_only"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value) {
  return clean(value).toLowerCase();
}

async function ensureOwnerOnlyNoteSchema() {
  // Keeps existing environments compatible while the matching SQL migration
  // is applied through the normal deployment process.
  await prisma.$executeRaw`
    ALTER TABLE teacher_notes
    ALTER COLUMN student_id DROP NOT NULL
  `;
}

async function getTeacherId(session) {
  if (String(session.user.role).toLowerCase() === "admin") return null;
  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id
    FROM teacher_profiles
    WHERE user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
  if (!teacher?.id) throw new Error("Teacher profile not found.");
  return teacher.id;
}

async function getLectureForNote(session, body) {
  const classLevel = clean(body?.classLevel || body?.class_level);
  const subjectId = clean(body?.subjectId || body?.subject_id);
  const lectureId = clean(body?.lectureId || body?.lecture_id);
  const teacherId = await getTeacherId(session);

  if (lectureId) {
    const [lecture] = teacherId
      ? await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            ls.teacher_id::text AS teacher_id,
            ls.student_id::text AS student_id,
            e.course_id::text AS course_id,
            c.class_level AS class_level,
            sub.id::text AS subject_id,
            sub.name AS subject_name
          FROM lecture_schedules ls
          INNER JOIN enrollments e ON e.id = ls.enrollment_id
          INNER JOIN courses c ON c.id = e.course_id
          INNER JOIN subjects sub ON sub.id = ls.subject_id
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          WHERE ls.id = ${lectureId}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            ls.teacher_id::text AS teacher_id,
            ls.student_id::text AS student_id,
            e.course_id::text AS course_id,
            c.class_level AS class_level,
            sub.id::text AS subject_id,
            sub.name AS subject_name
          FROM lecture_schedules ls
          INNER JOIN enrollments e ON e.id = ls.enrollment_id
          INNER JOIN courses c ON c.id = e.course_id
          INNER JOIN subjects sub ON sub.id = ls.subject_id
          WHERE ls.id = ${lectureId}::uuid
          LIMIT 1
        `;
    return lecture || null;
  }

  if (!classLevel || !subjectId) return null;

  const [lecture] = teacherId
    ? await prisma.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.teacher_id::text AS teacher_id,
          ls.student_id::text AS student_id,
          e.course_id::text AS course_id,
          c.class_level AS class_level,
          sub.id::text AS subject_id,
          sub.name AS subject_name
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        WHERE LOWER(COALESCE(c.class_level, c.title)) = LOWER(${classLevel})
          AND ls.subject_id = ${subjectId}::uuid
          AND tp.user_id = ${session.user.id}::uuid
        ORDER BY ls.scheduled_start DESC, ls.id DESC
        LIMIT 1
      `
    : await prisma.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.teacher_id::text AS teacher_id,
          ls.student_id::text AS student_id,
          e.course_id::text AS course_id,
          c.class_level AS class_level,
          sub.id::text AS subject_id,
          sub.name AS subject_name
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        WHERE LOWER(COALESCE(c.class_level, c.title)) = LOWER(${classLevel})
          AND ls.subject_id = ${subjectId}::uuid
        ORDER BY ls.scheduled_start DESC, ls.id DESC
        LIMIT 1
      `;

  return lecture || null;
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    // Owner-only notes are deliberately omitted even from the Admin listing.
    // They remain available solely through the owning teacher's scoped query.
    const where = isAdmin
      ? "WHERE LOWER(COALESCE(tn.visibility, 'parent')) <> 'teacher_only'"
      : "WHERE tp.user_id = $1::uuid";
    const values = isAdmin ? [] : [session.user.id];
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        tn.id::text AS id,
        tn.note,
        tn.visibility,
        tn.created_at,
        ls.title AS lecture_title,
        c.class_level AS class_level,
        sub.name AS subject_name,
        su.full_name AS student_name,
        u.full_name AS teacher_name
      FROM teacher_notes tn
      INNER JOIN teacher_profiles tp ON tp.id = tn.teacher_id
      LEFT JOIN student_profiles sp ON sp.id = tn.student_id
      LEFT JOIN users su ON su.id = sp.user_id
      INNER JOIN users u ON u.id = tp.user_id
      LEFT JOIN lecture_schedules ls ON ls.id = tn.lecture_id
      LEFT JOIN enrollments e ON e.id = ls.enrollment_id
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN subjects sub ON sub.id = ls.subject_id
      ${where}
      ORDER BY tn.created_at DESC
      `,
      ...values
    );
    return json("Notes fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load notes.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json().catch(() => ({}));
    const note = clean(body?.note);
    const requestedStudentIds = [
      ...(Array.isArray(body?.studentIds) ? body.studentIds : []),
      body?.studentId || body?.student_id,
    ].map(clean).filter(Boolean);
    const targetAll = body?.targetAll === true;
    const requestedVisibility = normalizeKey(body?.visibility);
    const visibility = VISIBILITY.has(requestedVisibility) ? requestedVisibility : "parent";
    if (visibility === "teacher_only" && String(session.user.role).toLowerCase() !== "teacher") {
      return json("Only a teacher can create an owner-only note.", 403);
    }
    const lecture = await getLectureForNote(session, body);

    if (!lecture?.id) {
      return json("Class and subject are required.", 400);
    }
    if (!note) return json("Note is required.", 400);

    await ensureOwnerOnlyNoteSchema();
    let recipientIds = [];
    if (visibility !== "teacher_only") {
      const assignedStudents = await prisma.$queryRaw`
        SELECT DISTINCT sp.id::text AS id
        FROM enrollments e
        INNER JOIN student_profiles sp ON sp.id = e.student_id
        INNER JOIN users su ON su.id = sp.user_id
        WHERE e.course_id = ${lecture.course_id}::uuid
          AND LOWER(COALESCE(e.status::text, 'active')) = 'active'
          AND LOWER(COALESCE(su.status::text, 'active')) = 'active'
        ORDER BY 1
      `;
      const assignedIds = new Set(assignedStudents.map((student) => student.id));
      recipientIds = targetAll ? [...assignedIds] : [...new Set(requestedStudentIds)];
      if (!recipientIds.length) return json("Select one student or all students.", 400);
      if (recipientIds.some((id) => !assignedIds.has(id))) {
        return json("One or more selected students are not assigned to this class.", 404);
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const targets = visibility === "teacher_only" ? [null] : recipientIds;
      const rows = [];
      for (const studentId of targets) {
        const [row] = await tx.$queryRaw`
          INSERT INTO teacher_notes (id, lecture_id, teacher_id, student_id, note, visibility, created_at)
          VALUES (gen_random_uuid(), ${lecture.id}::uuid, ${lecture.teacher_id}::uuid, ${studentId}::uuid, ${note}, ${visibility}, NOW())
          RETURNING id::text AS id
        `;
        rows.push(row);
      }
      await tx.$executeRaw`
        INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at, new_data)
        VALUES (
          gen_random_uuid(),
          ${session.user.id}::uuid,
          'teacher_note_added',
          'teacher_notes',
          ${rows[0].id}::uuid,
          NOW(),
          jsonb_build_object('visibility', ${visibility}::text, 'recipient_count', ${rows.length}::int)
        )
      `;
      return rows;
    });
    return json(
      visibility === "teacher_only" ? "Private note saved." : `Note sent to ${created.length} recipient${created.length === 1 ? "" : "s"}.`,
      201,
      { items: created, recipientCount: created.length }
    );
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to add note.", 500);
  }
}
