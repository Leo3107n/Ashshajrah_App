import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { getActiveHeadlines } from "@/lib/headlines";
import { buildParentStudentScope, getScopedParentChildren, normalizeChildId } from "@/lib/parentScope";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const childId = normalizeChildId(searchParams.get("childId"));
    const children = await getScopedParentChildren(session);
    const selectedChildId = childId;
    const scope = buildParentStudentScope(session, selectedChildId);

    const [stats, headlines] = await Promise.all([
      prisma.$queryRawUnsafe(
      `
      WITH allowed_students AS (
        SELECT sp.id, u.full_name
        FROM student_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        ${scope.joins}
        ${scope.where}
      )
      SELECT
        (SELECT COUNT(DISTINCT ls.id)::int
         FROM lecture_schedules ls
         INNER JOIN enrollments e ON e.id = ls.enrollment_id
         INNER JOIN course_subjects cs ON cs.course_id = e.course_id AND cs.subject_id = ls.subject_id
         INNER JOIN allowed_students a ON (
           a.id = e.student_id
           OR e.course_id IN (
             SELECT course_id FROM enrollments
             WHERE student_id = a.id
               AND LOWER(status) = 'active'
           )
         )
         WHERE ls.scheduled_start >= NOW()
           AND ls.status::text NOT IN ('cancelled','rescheduled')) AS upcoming_classes,
        (SELECT COUNT(DISTINCT ls.id)::int
         FROM lecture_schedules ls
         INNER JOIN enrollments e ON e.id = ls.enrollment_id
         INNER JOIN course_subjects cs ON cs.course_id = e.course_id AND cs.subject_id = ls.subject_id
         INNER JOIN allowed_students a ON (
           a.id = e.student_id
           OR e.course_id IN (
             SELECT course_id FROM enrollments
             WHERE student_id = a.id
               AND LOWER(status) = 'active'
           )
         )
         WHERE ls.status::text = 'verified_by_coordinator') AS attended_lectures,
        (SELECT COUNT(*)::int
         FROM lecture_attendance la
         INNER JOIN student_profiles sp ON sp.user_id = la.user_id
         INNER JOIN allowed_students a ON a.id = sp.id
         WHERE LOWER(la.status::text) = 'present') AS present_lectures,
        (SELECT COUNT(*)::int FROM homework h INNER JOIN allowed_students a ON a.id = h.student_id WHERE COALESCE(h.status::text, 'pending') = 'pending') AS pending_homework,
        COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE la.status::text = 'present') / NULLIF(COUNT(*), 0))::int FROM lecture_attendance la INNER JOIN student_profiles sp ON sp.user_id = la.user_id INNER JOIN allowed_students a ON a.id = sp.id INNER JOIN lecture_schedules ls ON ls.id = la.lecture_id AND ls.status::text = 'verified_by_coordinator'), 0) AS attendance_percentage,
        COALESCE((
          SELECT COALESCE(fs.status::text, fv.status::text, 'not_available')
          FROM allowed_students a
          LEFT JOIN registration_leads rl ON LOWER(rl.student_name) = LOWER(a.full_name)
          LEFT JOIN fee_vouchers fv ON fv.student_id = a.id OR (fv.student_id IS NULL AND fv.registration_id = rl.id)
          LEFT JOIN fee_submissions fs ON fs.voucher_id = fv.id
          ORDER BY fv.created_at DESC NULLS LAST, fs.created_at DESC NULLS LAST
          LIMIT 1
        ), 'not_available') AS fee_status
      `,
      ...scope.values
      ),
      getActiveHeadlines(),
    ]);

    const upcoming = await prisma.$queryRawUnsafe(
      `
      WITH allowed_students AS (
        SELECT sp.id, u.full_name
        FROM student_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        ${scope.joins}
        ${scope.where}
      )
      SELECT DISTINCT ON (ls.id)
        ls.id::text AS id,
        ls.title,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        ls.google_meet_link,
        ls.status::text AS status,
        sub.name AS subject_name,
        tu.full_name AS teacher_name
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN course_subjects cs ON cs.course_id = e.course_id AND cs.subject_id = ls.subject_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN allowed_students a ON (
        ls.student_id = a.id
        OR e.student_id = a.id
        OR e.course_id IN (
          SELECT course_id
          FROM enrollments
          WHERE student_id = a.id
            AND LOWER(status) = 'active'
        )
      )
      WHERE ls.scheduled_end >= NOW()
      ORDER BY ls.id ASC, ls.scheduled_start ASC
      LIMIT 5
      `,
      ...scope.values
    );

    const childCards = await prisma.$queryRawUnsafe(
      `
      WITH allowed_children AS (
        SELECT
          sp.id,
          u.full_name,
          COALESCE(c.title, sp.grade_level, '') AS course_title,
          COALESCE(sp.grade_level, c.title, '') AS class_level,
          e.course_id
        FROM student_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
        LEFT JOIN courses c ON c.id = e.course_id
        ${scope.joins}
        ${scope.where}
      ),
      homework_summary AS (
        SELECT
          h.student_id,
          COUNT(*) FILTER (WHERE COALESCE(h.status::text, 'pending') = 'pending')::int AS pending_homeworks
        FROM homework h
        INNER JOIN allowed_children ac ON ac.id = h.student_id
        GROUP BY h.student_id
      ),
      attendance_summary AS (
        SELECT
          sp.id AS student_id,
          COALESCE(
            ROUND(
              100.0 * COUNT(*) FILTER (WHERE LOWER(la.status::text) = 'present')
              / NULLIF(COUNT(*), 0)
            )::int,
            0
          ) AS attendance_percentage
        FROM allowed_children ac
        INNER JOIN student_profiles sp ON sp.id = ac.id
        LEFT JOIN lecture_attendance la ON la.user_id = sp.user_id
        LEFT JOIN lecture_schedules ls ON ls.id = la.lecture_id
        WHERE ls.id IS NULL OR COALESCE(ls.status::text, '') = 'verified_by_coordinator'
        GROUP BY sp.id
      ),
      subject_summary AS (
        SELECT
          ac.id AS student_id,
          COUNT(DISTINCT cs.subject_id)::int AS total_subjects
        FROM allowed_children ac
        LEFT JOIN course_subjects cs ON cs.course_id = ac.course_id
        GROUP BY ac.id
      ),
      fee_summary AS (
        SELECT DISTINCT ON (fee_sources.student_id)
          fee_sources.student_id,
          COALESCE(fs.status::text, fee_sources.voucher_status, 'not_available') AS fee_status,
          fee_sources.due_date AS fee_due_date,
          CASE
            WHEN fee_sources.due_date IS NOT NULL
              AND fee_sources.due_date < CURRENT_DATE
              AND COALESCE(fs.status::text, fee_sources.voucher_status, 'not_available') NOT IN ('verified', 'approved', 'paid')
            THEN TRUE
            ELSE FALSE
          END AS fee_deadline_missed
        FROM (
          SELECT
            ac.id AS student_id,
            fv.id AS voucher_id,
            fv.status::text AS voucher_status,
            fv.due_date,
            fv.created_at
          FROM allowed_children ac
          LEFT JOIN registration_leads rl ON LOWER(rl.student_name) = LOWER(ac.full_name)
          INNER JOIN fee_vouchers fv ON fv.student_id = ac.id OR (fv.student_id IS NULL AND fv.registration_id = rl.id)

          UNION ALL

          SELECT
            ac.id AS student_id,
            fv.id AS voucher_id,
            fv.status::text AS voucher_status,
            fv.due_date,
            fv.created_at
          FROM allowed_children ac
          INNER JOIN regular_monthly_fee_voucher_items item ON item.student_id = ac.id
          INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
        ) fee_sources
        LEFT JOIN LATERAL (
          SELECT fs.status::text AS status
          FROM fee_submissions fs
          WHERE fs.voucher_id = fee_sources.voucher_id
          ORDER BY fs.created_at DESC
          LIMIT 1
        ) fs ON TRUE
        ORDER BY
          fee_sources.student_id,
          CASE
            WHEN fee_sources.due_date IS NOT NULL
              AND fee_sources.due_date < CURRENT_DATE
              AND COALESCE(fs.status::text, fee_sources.voucher_status, 'not_available') NOT IN ('verified', 'approved', 'paid')
            THEN 0
            ELSE 1
          END,
          fee_sources.due_date ASC NULLS LAST,
          fee_sources.created_at DESC NULLS LAST
      ),
      today_lectures AS (
        SELECT
          ac.id AS student_id,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', ls.id::text,
                'title', ls.title,
                'subject_name', sub.name,
                'scheduled_start', ls.scheduled_start::text,
                'scheduled_end', ls.scheduled_end::text,
                'teacher_name', tu.full_name,
                'status', ls.status::text,
                'display_status',
                CASE
                  WHEN COALESCE(ls.status::text, '') IN ('cancelled', 'rescheduled') THEN ls.status::text
                  WHEN ls.scheduled_start <= NOW() AND COALESCE(ls.scheduled_end, ls.scheduled_start) >= NOW() THEN 'live'
                  WHEN ls.scheduled_start > NOW() THEN 'upcoming'
                  WHEN COALESCE(ls.status::text, '') IN ('verified_by_coordinator', 'completed_by_teacher') THEN 'completed'
                  ELSE ls.status::text
                END
              )
              ORDER BY ls.scheduled_start ASC
            ) FILTER (WHERE ls.id IS NOT NULL),
            '[]'::json
          ) AS today_lectures
        FROM allowed_children ac
        LEFT JOIN lecture_schedules ls ON (
          ls.student_id = ac.id
          OR ls.enrollment_id IN (
            SELECT e2.id
            FROM enrollments e2
            WHERE e2.student_id = ac.id
              AND LOWER(e2.status) = 'active'
          )
        )
          AND ls.scheduled_start::date = CURRENT_DATE
          AND COALESCE(ls.status::text, '') NOT IN ('cancelled', 'rescheduled')
        LEFT JOIN subjects sub ON sub.id = ls.subject_id
        LEFT JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        LEFT JOIN users tu ON tu.id = tp.user_id
        GROUP BY ac.id
      )
      SELECT
        ac.id::text AS id,
        ac.full_name,
        ac.course_title,
        ac.class_level,
        COALESCE(att.attendance_percentage, 0) AS attendance_percentage,
        COALESCE(hw.pending_homeworks, 0) AS pending_homeworks,
        COALESCE(subj.total_subjects, 0) AS total_subjects,
        COALESCE(fee.fee_status, 'not_available') AS fee_status,
        INITCAP(REPLACE(COALESCE(fee.fee_status, 'not_available'), '_', ' ')) AS fee_status_label,
        fee.fee_due_date,
        COALESCE(fee.fee_deadline_missed, FALSE) AS fee_deadline_missed,
        COALESCE(lect.today_lectures, '[]'::json) AS today_lectures
      FROM allowed_children ac
      LEFT JOIN homework_summary hw ON hw.student_id = ac.id
      LEFT JOIN attendance_summary att ON att.student_id = ac.id
      LEFT JOIN subject_summary subj ON subj.student_id = ac.id
      LEFT JOIN fee_summary fee ON fee.student_id = ac.id
      LEFT JOIN today_lectures lect ON lect.student_id = ac.id
      ORDER BY ac.full_name ASC
      `,
      ...scope.values
    );

    return json("Parent dashboard fetched.", 200, {
      children: childCards,
      selectedChildId,
      headlines,
      stats: {
        ...(stats?.[0] || {}),
        total_children: children.length,
      },
      upcoming,
      nextClass: upcoming[0] || null,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load parent dashboard.", 500);
  }
}
