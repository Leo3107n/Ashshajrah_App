import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { getActiveHeadlines } from "@/lib/headlines";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function getStudent(session) {
  const [student] = await prisma.$queryRaw`
    SELECT sp.id::text AS id, u.id::text AS user_id
    FROM student_profiles sp
    INNER JOIN users u ON u.id = sp.user_id
    WHERE sp.user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
  if (!student?.id) throw new Error("Student profile not found.");
  return student;
}

export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const student = await getStudent(session);

    const [stats, headlines] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          (
            SELECT COUNT(DISTINCT cs.subject_id)::int
            FROM enrollments e
            INNER JOIN courses c ON c.id = e.course_id
            INNER JOIN course_subjects cs ON cs.course_id = c.id
            INNER JOIN subjects sub ON sub.id = cs.subject_id
            WHERE e.student_id = ${student.id}::uuid
              AND LOWER(e.status) = 'active'
              AND COALESCE(c.status, 'active'::user_status) = 'active'::user_status
              AND COALESCE(sub.status, 'active'::user_status) = 'active'::user_status
          ) AS total_subjects,
          (
            SELECT COUNT(*)::int
            FROM homework
            WHERE student_id = ${student.id}::uuid
              AND status::text = 'pending'
          ) AS pending_homeworks,
          (
            SELECT COUNT(DISTINCT ls.id)::int
            FROM lecture_schedules ls
            INNER JOIN enrollments e ON e.id = ls.enrollment_id
            WHERE (
              ls.student_id = ${student.id}::uuid
              OR e.student_id = ${student.id}::uuid
              OR e.course_id IN (
                SELECT course_id FROM enrollments
                WHERE student_id = ${student.id}::uuid
                  AND LOWER(status) = 'active'
              )
            )
          ) AS total_lectures,
          (
            SELECT COUNT(DISTINCT ls.id)::int
            FROM lecture_schedules ls
            INNER JOIN enrollments e ON e.id = ls.enrollment_id
            WHERE (
              ls.student_id = ${student.id}::uuid
              OR e.student_id = ${student.id}::uuid
              OR e.course_id IN (
                SELECT course_id FROM enrollments
                WHERE student_id = ${student.id}::uuid
                  AND LOWER(status) = 'active'
              )
            )
              AND ls.status::text = 'verified_by_coordinator'
          ) AS conducted_lectures,
          (
            SELECT COUNT(DISTINCT ls.id)::int
            FROM lecture_schedules ls
            INNER JOIN enrollments e ON e.id = ls.enrollment_id
            LEFT JOIN lecture_attendance la ON la.lecture_id = ls.id AND la.user_id = ${student.user_id}::uuid
            WHERE (
              ls.student_id = ${student.id}::uuid
              OR e.student_id = ${student.id}::uuid
              OR e.course_id IN (
                SELECT course_id FROM enrollments
                WHERE student_id = ${student.id}::uuid
                  AND LOWER(status) = 'active'
              )
            )
              AND ls.status::text = 'verified_by_coordinator'
              AND COALESCE(la.status::text, 'absent') IN ('present','partial')
          ) AS lectures_present,
          (
            SELECT COALESCE(ROUND(
              (
                COUNT(DISTINCT ls.id) FILTER (
                  WHERE COALESCE(la.status::text, 'absent') IN ('present', 'partial')
                )::numeric
                / NULLIF(COUNT(DISTINCT ls.id), 0)
              ) * 100
            ), 0)::int
            FROM lecture_schedules ls
            INNER JOIN enrollments e ON e.id = ls.enrollment_id
            LEFT JOIN lecture_attendance la ON la.lecture_id = ls.id AND la.user_id = ${student.user_id}::uuid
            WHERE (
              ls.student_id = ${student.id}::uuid
              OR e.student_id = ${student.id}::uuid
              OR e.course_id IN (
                SELECT course_id FROM enrollments
                WHERE student_id = ${student.id}::uuid
                  AND LOWER(status) = 'active'
              )
            )
              AND ls.status::text = 'verified_by_coordinator'
          ) AS attendance_percentage,
          COALESCE(
            (
              SELECT CASE
                WHEN latest_fee_submission_status = 'verified' THEN 'Paid / Verified'
                WHEN latest_fee_submission_status = 'pending' THEN 'Payment Submitted / Pending Verification'
                WHEN latest_fee_submission_status = 'rejected' THEN 'Payment Rejected'
                WHEN latest_voucher_status IS NOT NULL THEN 'Voucher Created / Unpaid'
                ELSE 'Not Paid'
              END
              FROM (
                SELECT
                  (
                    SELECT fs.status::text
                    FROM fee_submissions fs
                    INNER JOIN fee_vouchers fv ON fv.id = fs.voucher_id
                    WHERE (
                      fv.student_id = ${student.id}::uuid
                      OR fv.registration_id IN (
                        SELECT e2.registration_id
                        FROM enrollments e2
                        WHERE e2.student_id = ${student.id}::uuid
                          AND e2.registration_id IS NOT NULL
                      )
                    )
                    ORDER BY fs.created_at DESC
                    LIMIT 1
                  ) AS latest_fee_submission_status,
                  (
                    SELECT fv.status::text
                    FROM fee_vouchers fv
                    WHERE (
                      fv.student_id = ${student.id}::uuid
                      OR fv.registration_id IN (
                        SELECT e2.registration_id
                        FROM enrollments e2
                        WHERE e2.student_id = ${student.id}::uuid
                          AND e2.registration_id IS NOT NULL
                      )
                    )
                    ORDER BY fv.created_at DESC
                    LIMIT 1
                  ) AS latest_voucher_status
              ) latest
            ),
            'Not Paid'
          ) AS fee_status_label,
          COALESCE(
            (
              SELECT latest_fee_submission_status
              FROM (
                SELECT
                  (
                    SELECT fs.status::text
                    FROM fee_submissions fs
                    INNER JOIN fee_vouchers fv ON fv.id = fs.voucher_id
                    WHERE (
                      fv.student_id = ${student.id}::uuid
                      OR fv.registration_id IN (
                        SELECT e2.registration_id
                        FROM enrollments e2
                        WHERE e2.student_id = ${student.id}::uuid
                          AND e2.registration_id IS NOT NULL
                      )
                    )
                    ORDER BY fs.created_at DESC
                    LIMIT 1
                  ) AS latest_fee_submission_status
              ) latest
            ),
            NULL
          ) AS fee_submission_status
      `,
      getActiveHeadlines(),
    ]);

    return json("Student dashboard fetched.", 200, {
      stats: stats?.[0] || {},
      headlines,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load student dashboard.", 500);
  }
}
