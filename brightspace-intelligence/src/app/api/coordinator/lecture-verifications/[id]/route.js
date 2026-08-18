import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { createCalendarLectureEvent } from "@/lib/googleCalendar";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureLectureVerificationColumns() {
  await prisma.$executeRaw`
    ALTER TABLE lecture_schedules
    ADD COLUMN IF NOT EXISTS google_meet_sync_meta JSONB
  `;
  await prisma.$executeRaw`
    ALTER TABLE lecture_schedules
    ADD COLUMN IF NOT EXISTS pending_student_attendance JSONB
  `;
}

async function getLectureDetails(id) {
  const [lecture] = await prisma.$queryRaw`
    SELECT
      ls.id::text AS id,
      ls.id::text AS lecture_id,
      ls.enrollment_id::text AS enrollment_id,
      e.course_id::text AS course_id,
      ls.student_id::text AS student_id,
      ls.teacher_id::text AS teacher_id,
      ls.subject_id::text AS subject_id,
      ls.title,
      ls.description,
      ls.scheduled_start::text AS scheduled_start,
      ls.scheduled_end::text AS scheduled_end,
      ls.status::text AS status,
      ls.google_meet_link,
      ls.recording_drive_url,
      ls.google_meet_sync_meta,
      ls.pending_student_attendance,
      COALESCE(NULLIF(c.class_level, ''), NULLIF(c.title, ''), 'Class') AS course_title,
      sub.name AS subject_name,
      cu.id::text AS coordinator_user_id,
      cu.full_name AS coordinator_name,
      cu.email AS coordinator_email,
      tu.id::text AS teacher_user_id,
      tu.full_name AS teacher_name,
      tu.email AS teacher_email,
      su.id::text AS student_user_id,
      su.full_name AS student_name,
      su.email AS student_email,
      su.phone AS student_phone,
      COALESCE(lcr.id::text, '') AS completion_report_id,
      lcr.topic_covered,
      lcr.summary,
      lcr.homework_given,
      lcr.student_performance,
      lv.id::text AS verification_id,
      lv.decision::text AS verification_decision,
      lv.remarks AS verification_remarks,
      lv.verified_at,
      teacher_att.joined_at AS teacher_joined_at,
      teacher_att.left_at AS teacher_left_at,
      COALESCE(teacher_att.duration_minutes, 0) AS teacher_duration_minutes,
      COALESCE(teacher_att.status::text, 'absent') AS teacher_attendance_status,
      coordinator_att.joined_at AS coordinator_joined_at,
      coordinator_att.left_at AS coordinator_left_at,
      COALESCE(coordinator_att.duration_minutes, 0) AS coordinator_duration_minutes,
      COALESCE(coordinator_att.status::text, 'absent') AS coordinator_attendance_status,
      student_att.joined_at AS student_joined_at,
      student_att.left_at AS student_left_at,
      COALESCE(student_att.duration_minutes, 0) AS student_duration_minutes,
      COALESCE(student_att.status::text, 'absent') AS student_attendance_status,
      CASE WHEN teacher_att.joined_at IS NOT NULL THEN TRUE ELSE FALSE END AS teacher_joined,
      CASE WHEN student_att.joined_at IS NOT NULL THEN TRUE ELSE FALSE END AS student_joined
    FROM lecture_schedules ls
    INNER JOIN enrollments e ON e.id = ls.enrollment_id
    INNER JOIN courses c ON c.id = e.course_id
    INNER JOIN subjects sub ON sub.id = ls.subject_id
    LEFT JOIN users cu ON cu.id = ls.scheduled_by
    INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
    INNER JOIN users tu ON tu.id = tp.user_id
    INNER JOIN student_profiles sp ON sp.id = ls.student_id
    INNER JOIN users su ON su.id = sp.user_id
    LEFT JOIN lecture_completion_reports lcr ON lcr.lecture_id = ls.id
    LEFT JOIN lecture_verifications lv ON lv.lecture_id = ls.id
    LEFT JOIN lecture_attendance teacher_att ON teacher_att.lecture_id = ls.id AND teacher_att.user_id = tu.id
    LEFT JOIN lecture_attendance coordinator_att ON coordinator_att.lecture_id = ls.id AND coordinator_att.user_id = cu.id
    LEFT JOIN lecture_attendance student_att ON student_att.lecture_id = ls.id AND student_att.user_id = su.id
    WHERE ls.id = ${id}::uuid
    LIMIT 1
  `;

  if (!lecture?.id) return null;

  const roster = await prisma.$queryRaw`
    SELECT
      sp.id::text AS student_id,
      su.id::text AS user_id,
      su.full_name AS student_name,
      su.username,
      su.email AS student_email,
      su.phone AS student_phone,
      COALESCE(la.status::text, 'absent') AS status,
      la.source::text AS source,
      la.joined_at,
      la.left_at,
      COALESCE(la.duration_minutes, 0) AS duration_minutes,
      COALESCE(NULLIF(LOWER(TRIM(su.username)), ''), LOWER(TRIM(su.full_name))) AS student_sort_name,
      la.updated_at,
      la.created_at
    FROM enrollments e2
    INNER JOIN student_profiles sp ON sp.id = e2.student_id
    INNER JOIN users su ON su.id = sp.user_id
    LEFT JOIN lecture_attendance la
      ON la.lecture_id = ${id}::uuid
     AND la.user_id = su.id
     AND la.role_type = 'student'
    WHERE e2.course_id = ${lecture.course_id}::uuid
      AND LOWER(e2.status::text) = 'active'
    ORDER BY COALESCE(NULLIF(LOWER(TRIM(su.username)), ''), LOWER(TRIM(su.full_name))), su.full_name ASC
  `;
  const pendingRows = Array.isArray(lecture.pending_student_attendance) ? lecture.pending_student_attendance : [];
  const pendingMap = new Map(
    pendingRows
      .map((row) => [String(row?.studentUserId || row?.student_user_id || "").trim(), row])
      .filter(([key]) => key)
  );
  const mergedRoster = roster.map((row) => {
    const pending = pendingMap.get(String(row.user_id || "").trim());
    if (!pending) return row;
    return {
      ...row,
      status: String(pending.status || row.status || "absent").toLowerCase(),
      source: "manual",
    };
  });

  const [teacherRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        la.id::text AS id,
        la.user_id::text AS user_id,
        su.full_name AS teacher_name,
        su.username,
        su.email AS teacher_email,
        su.phone AS teacher_phone,
        COALESCE(la.status::text, 'absent') AS status,
        la.joined_at,
        la.left_at,
        COALESCE(la.duration_minutes, 0) AS duration_minutes
      FROM lecture_attendance la
      INNER JOIN users su ON su.id = la.user_id
      WHERE la.lecture_id = ${id}::uuid
        AND la.role_type = 'teacher'
      ORDER BY la.updated_at DESC, la.id DESC
      LIMIT 1
    `,
  ]);

  return {
    ...lecture,
    teacher_attendance: {
      joined_at: teacherRows?.[0]?.joined_at || lecture.teacher_joined_at,
      left_at: teacherRows?.[0]?.left_at || lecture.teacher_left_at,
      duration_minutes: teacherRows?.[0]?.duration_minutes || lecture.teacher_duration_minutes,
      status: teacherRows?.[0]?.status || lecture.teacher_attendance_status,
    },
    coordinator_attendance: {
      joined_at: lecture.coordinator_joined_at,
      left_at: lecture.coordinator_left_at,
      duration_minutes: lecture.coordinator_duration_minutes,
      status: lecture.coordinator_attendance_status,
    },
    student_attendance_rows: mergedRoster || [],
    total_students_count: mergedRoster.length || 0,
    joined_students_count: mergedRoster.filter((row) => ["present", "partial"].includes(String(row.status || "").toLowerCase())).length,
    absent_students_count: mergedRoster.filter((row) => String(row.status || "").toLowerCase() === "absent").length,
    attendance_rows: mergedRoster || [],
    unmatched_participants: [],
  };
}

async function upsertVerification(tx, payload) {
  const [existing] = await tx.$queryRaw`
    SELECT id::text AS id
    FROM lecture_verifications
    WHERE lecture_id = ${payload.lectureId}::uuid
    LIMIT 1
  `;

  if (existing?.id) {
    await tx.$executeRaw`
      UPDATE lecture_verifications
      SET verified_by = ${payload.verifiedBy}::uuid,
          teacher_joined = ${Boolean(payload.teacherJoined)},
          student_joined = ${Boolean(payload.studentJoined)},
          minimum_duration_met = ${Boolean(payload.minimumDurationMet)},
          teacher_duration_minutes = ${payload.teacherDurationMinutes || 0},
          student_duration_minutes = ${payload.studentDurationMinutes || 0},
          decision = ${payload.decision}::verification_decision,
          remarks = ${payload.remarks || null},
          verified_at = NOW()
      WHERE id = ${existing.id}::uuid
    `;
    return existing.id;
  }

  const id = crypto.randomUUID();
  await tx.$executeRaw`
    INSERT INTO lecture_verifications (
      id,
      lecture_id,
      verified_by,
      teacher_joined,
      student_joined,
      minimum_duration_met,
      teacher_duration_minutes,
      student_duration_minutes,
      decision,
      remarks,
      verified_at
    )
    VALUES (
      ${id}::uuid,
      ${payload.lectureId}::uuid,
      ${payload.verifiedBy}::uuid,
      ${Boolean(payload.teacherJoined)},
      ${Boolean(payload.studentJoined)},
      ${Boolean(payload.minimumDurationMet)},
      ${payload.teacherDurationMinutes || 0},
      ${payload.studentDurationMinutes || 0},
      ${payload.decision}::verification_decision,
      ${payload.remarks || null},
      NOW()
    )
  `;

  return id;
}

export async function PATCH(request, context) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    await ensureLectureVerificationColumns();
    const { id } = await context.params;
    const body = await request.json();
    const action = normalizeText(body?.action).toLowerCase();
    const remarks = normalizeText(body?.remarks);
    const scheduledStart = normalizeText(body?.scheduledStart);
    const scheduledEnd = normalizeText(body?.scheduledEnd);

    const lecture = await getLectureDetails(id);

    if (!lecture?.id) {
      return json("Lecture not found.", 404);
    }

    if (!["approve", "reject", "mark_missed", "reschedule"].includes(action)) {
      return json("Invalid verification action.", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      if (action === "approve") {
        if (!lecture.completion_report_id && body?.manualConfirm !== true) {
          throw new Error("Teacher completion report is required before approval, unless coordinator confirms manually.");
        }

        const verificationId = await upsertVerification(tx, {
          lectureId: id,
          verifiedBy: session.user.id,
          decision: "approved",
          remarks,
          teacherJoined: lecture.teacher_joined,
          studentJoined: lecture.student_joined,
          minimumDurationMet: Number(lecture.teacher_duration_minutes || 0) >= Number(process.env.LECTURE_PRESENT_THRESHOLD_MINUTES || 20),
          teacherDurationMinutes: Number(lecture.teacher_duration_minutes || 0),
          studentDurationMinutes: Number(lecture.student_duration_minutes || 0),
        });

        const pendingAttendance = Array.isArray(lecture.pending_student_attendance) ? lecture.pending_student_attendance : [];
        for (const row of pendingAttendance) {
          const studentUserId = String(row?.studentUserId || row?.student_user_id || "").trim();
          const status = String(row?.status || "").trim().toLowerCase();
          if (!studentUserId || !["present", "absent", "leave"].includes(status)) continue;
          await tx.$executeRaw`
            INSERT INTO lecture_attendance (
              id,
              lecture_id,
              user_id,
              role_type,
              source,
              status,
              created_at,
              updated_at
            )
            VALUES (
              gen_random_uuid(),
              ${id}::uuid,
              ${studentUserId}::uuid,
              'student',
              'manual'::attendance_source,
              ${status}::attendance_status,
              NOW(),
              NOW()
            )
            ON CONFLICT (lecture_id, user_id)
            DO UPDATE SET
              status = EXCLUDED.status,
              source = 'manual'::attendance_source,
              updated_at = NOW()
          `;
        }

        await tx.$executeRaw`
          UPDATE lecture_schedules
          SET status = 'verified_by_coordinator'::lecture_status,
              pending_student_attendance = NULL,
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        await createAuditLog(
          {
            actorUserId: session.user.id,
            action: "lecture_verified",
            entityType: "lecture_verifications",
            entityId: verificationId,
            newData: { lectureId: id, decision: "approved", remarks },
          },
          tx
        );

        return { status: "verified_by_coordinator" };
      }

      if (action === "reject") {
        const verificationId = await upsertVerification(tx, {
          lectureId: id,
          verifiedBy: session.user.id,
          decision: "rejected",
          remarks,
        });

        await tx.$executeRaw`
          UPDATE lecture_schedules
          SET status = 'disputed'::lecture_status,
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        await createAuditLog(
          {
            actorUserId: session.user.id,
            action: "lecture_verified",
            entityType: "lecture_verifications",
            entityId: verificationId,
            newData: { lectureId: id, decision: "rejected", remarks },
          },
          tx
        );

        return { status: "disputed" };
      }

      if (action === "mark_missed") {
        const verificationId = await upsertVerification(tx, {
          lectureId: id,
          verifiedBy: session.user.id,
          decision: "needs_review",
          remarks: remarks || "Marked as missed.",
        });

        await tx.$executeRaw`
          UPDATE lecture_schedules
          SET status = 'missed'::lecture_status,
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        await createAuditLog(
          {
            actorUserId: session.user.id,
            action: "lecture_verified",
            entityType: "lecture_verifications",
            entityId: verificationId,
            newData: { lectureId: id, decision: "missed", remarks },
          },
          tx
        );

        return { status: "missed" };
      }

      if (!scheduledStart || !scheduledEnd) {
        throw new Error("New schedule start and end are required for rescheduling.");
      }

      let calendarData = { eventId: "", meetLink: "", meetSpaceId: "" };
      try {
        calendarData = await createCalendarLectureEvent({
          title: lecture.title,
          description: lecture.description,
          start: scheduledStart,
          end: scheduledEnd,
        });
      } catch {}

      const [newLecture] = await tx.$queryRaw`
        INSERT INTO lecture_schedules (
          id,
          enrollment_id,
          student_id,
          teacher_id,
          subject_id,
          scheduled_by,
          title,
          description,
          scheduled_start::text AS scheduled_start,
          scheduled_end::text AS scheduled_end,
          google_calendar_event_id,
          google_meet_link,
          google_meet_space_id,
          status,
          rescheduled_from_id,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${lecture.enrollment_id}::uuid,
          ${lecture.student_id}::uuid,
          ${lecture.teacher_id}::uuid,
          ${lecture.subject_id}::uuid,
          ${session.user.id}::uuid,
          ${lecture.title},
          ${lecture.description || null},
          ${scheduledStart}::timestamp,
          ${scheduledEnd}::timestamp,
          ${calendarData.eventId || null},
          ${calendarData.meetLink || null},
          ${calendarData.meetSpaceId || null},
          'scheduled'::lecture_status,
          ${id}::uuid,
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `;

      await tx.$executeRaw`
        UPDATE lecture_schedules
        SET status = 'rescheduled'::lecture_status,
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      await upsertVerification(tx, {
        lectureId: id,
        verifiedBy: session.user.id,
        decision: "reschedule",
        remarks,
      });

      await createAuditLog(
        {
          actorUserId: session.user.id,
          action: "lecture_rescheduled",
          entityType: "lecture_schedules",
          entityId: newLecture.id,
          oldData: { lectureId: id },
          newData: { rescheduledFromId: id, scheduledStart, scheduledEnd },
        },
        tx
      );

      return { status: "rescheduled", newLectureId: newLecture.id };
    });

    return json("Lecture verification updated.", 200, result);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to update lecture verification.",
      500
    );
  }
}

export async function GET(_request, context) {
  try {
    await requireRole(ALLOWED_ROLES);
    await ensureLectureVerificationColumns();
    const { id } = await context.params;
    const lecture = await getLectureDetails(id);

    if (!lecture?.id) {
      return json("Lecture not found.", 404);
    }

    return json("Lecture verification details fetched.", 200, { item: lecture });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch lecture verification details.",
      500
    );
  }
}
