import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import { getDayRange } from "@/lib/dateTime";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    await requireRole(ALLOWED_ROLES);

    const todayRange = getDayRange(new Date());

    const [
      totalRegistrationRows,
      parentInterviewStatsRows,
      pendingVoucherRows,
      pendingPaymentRows,
      activeStudentRows,
      classDistributionRows,
      lectureApprovalRows,
      recentLectures,
      recentLeads,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM interested_students
        WHERE LOWER(COALESCE(status::text, '')) <> 'archived'
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (
            WHERE istd.parent_interview_link_sent_at IS NOT NULL
              AND (
                COALESCE(interview.parent_interview_status, 'pending') IN ('pending', 'sent')
              )
          )::int AS not_submitted_total,
          COUNT(*) FILTER (
            WHERE istd.parent_interview_link_sent_at IS NOT NULL
              AND (
                COALESCE(interview.parent_interview_status, 'pending') IN ('pending', 'sent')
              )
          )::int AS sent_total,
          COUNT(*) FILTER (
            WHERE interview.parent_interview_status IN ('submitted', 'reviewed')
          )::int AS submitted_total
        FROM interested_students istd
        LEFT JOIN LATERAL (
          SELECT
            LOWER(
              COALESCE(
                NULLIF(TRIM(pif_inner.status::text), ''),
                CASE
                  WHEN pif_inner.submitted_at IS NOT NULL THEN 'submitted'
                  ELSE 'pending'
                END
              )
            ) AS parent_interview_status
          FROM parent_interview_forms pif_inner
          WHERE (
            NULLIF(TRIM(pif_inner.registration_id), '') = COALESCE(
              NULLIF(TRIM(istd.registration_code), ''),
              istd.registration_lead_id::text,
              istd.id::text
            )
            OR NULLIF(TRIM(pif_inner.registration_id), '') = istd.registration_lead_id::text
            OR NULLIF(TRIM(pif_inner.registration_id), '') = istd.id::text
            OR (
              NULLIF(TRIM(pif_inner.registration_id), '') IS NULL
              AND LOWER(NULLIF(TRIM(pif_inner.parent_email), '')) = LOWER(NULLIF(TRIM(istd.email), ''))
              AND LOWER(NULLIF(TRIM(pif_inner.child_name), '')) = LOWER(
                COALESCE(
                  NULLIF(TRIM(istd.child_name), ''),
                  NULLIF(TRIM(istd.student_name), '')
                )
              )
            )
          )
          ORDER BY pif_inner.created_at DESC
          LIMIT 1
        ) interview ON TRUE
        WHERE LOWER(COALESCE(istd.status::text, '')) <> 'archived'
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM interested_students
        WHERE admission_form_sent_at IS NOT NULL
          AND admission_form_submitted_at IS NULL
          AND LOWER(COALESCE(status::text, '')) <> 'archived'
          AND LOWER(COALESCE(admission_form_status::text, '')) IN ('sent', 'reminded', 'overdue', 'not_submitted', 'pending')
      `,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE status = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM student_profiles WHERE status = 'active'`,
      prisma.$queryRaw`
        SELECT
          COALESCE(NULLIF(TRIM(sp.grade_level), ''), 'Unassigned') AS class_level,
          COUNT(*)::int AS total
        FROM student_profiles sp
        WHERE LOWER(COALESCE(sp.status::text, '')) = 'active'
        GROUP BY COALESCE(NULLIF(TRIM(sp.grade_level), ''), 'Unassigned')
        ORDER BY total DESC, class_level ASC
      `,
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT ls.id)::int AS lectures_needing_approval
        FROM lecture_schedules ls
        LEFT JOIN lecture_verifications lv ON lv.lecture_id = ls.id
        WHERE ls.status::text = 'completed_by_teacher'
          AND (
            lv.id IS NULL
            OR LOWER(lv.decision::text) IN ('needs_review', 'reschedule')
          )
      `,
      prisma.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.title,
          ls.status,
          ls.scheduled_start,
          sub.name AS subject_name,
          t.full_name AS teacher_name,
          c.title AS class_name
        FROM lecture_schedules ls
        LEFT JOIN subjects sub ON sub.id = ls.subject_id
        LEFT JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        LEFT JOIN users t ON t.id = tp.user_id
        LEFT JOIN enrollments e ON e.id = ls.enrollment_id
        LEFT JOIN courses c ON c.id = e.course_id
        ORDER BY ls.scheduled_start DESC
        LIMIT 6
      `,
      prisma.$queryRaw`
        SELECT
          id::text AS id,
          student_name,
          parent_name,
          status,
          created_at
        FROM registration_leads
        ORDER BY created_at DESC
        LIMIT 6
      `,
    ]);

    return json("Coordinator dashboard fetched.", 200, {
      stats: {
        totalRegistrations: Number(totalRegistrationRows?.[0]?.total || 0),
        newLeads: Number(parentInterviewStatsRows?.[0]?.not_submitted_total || 0),
        parentInterviewSent: Number(parentInterviewStatsRows?.[0]?.sent_total || 0),
        parentInterviewSubmitted: Number(parentInterviewStatsRows?.[0]?.submitted_total || 0),
        pendingVouchers: Number(pendingVoucherRows?.[0]?.total || 0),
        pendingPaymentVerifications: Number(pendingPaymentRows?.[0]?.total || 0),
        activeStudents: Number(activeStudentRows?.[0]?.total || 0),
        lectureNeedsApproval: Number(lectureApprovalRows?.[0]?.lectures_needing_approval || 0),
      },
      classDistribution: Array.isArray(classDistributionRows)
        ? classDistributionRows.map((item) => ({
            classLevel: String(item.class_level || "Unassigned"),
            total: Number(item.total || 0),
          }))
        : [],
      recentLectures,
      recentLeads,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch coordinator dashboard.",
      500
    );
  }
}
