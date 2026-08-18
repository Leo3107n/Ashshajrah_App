import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import {
  cancelCalendarLectureEvent,
  createCalendarLectureEvent,
  extractMeetCodeFromLink,
  updateCalendarLectureEvent,
} from "@/lib/googleCalendar";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import {
  findTeacherScheduleConflict,
  teacherConflictMessage,
} from "@/lib/teacherScheduleConflict";

const ALLOWED_ROLES = ["admin", "coordinator", "superadmin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidGoogleMeetLink(link) {
  const value = String(link || "").trim();
  return Boolean(value) && value.startsWith("https://meet.google.com/");
}

async function getLecture(id) {
  const [lecture] = await prisma.$queryRaw`
    SELECT
      ls.id::text AS id,
      ls.enrollment_id::text AS enrollment_id,
      ls.student_id::text AS student_id,
      ls.teacher_id::text AS teacher_id,
      ls.subject_id::text AS subject_id,
      ls.title,
      ls.description,
      ls.scheduled_start,
      ls.scheduled_end,
      ls.status::text AS status,
      ls.google_calendar_event_id,
      ls.scheduled_by::text AS coordinator_user_id,
      cu.email AS coordinator_email,
      su.id::text AS student_user_id,
      su.email AS student_email,
      su.full_name AS student_name,
      pu.id::text AS parent_user_id,
      pu.email AS parent_email,
      pu.full_name AS parent_name,
      tu.id::text AS teacher_user_id,
      tu.email AS teacher_email,
      tu.full_name AS teacher_name
    FROM lecture_schedules ls
    INNER JOIN student_profiles sp ON sp.id = ls.student_id
    INNER JOIN users su ON su.id = sp.user_id
    LEFT JOIN users cu ON cu.id = ls.scheduled_by
    INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
    INNER JOIN users tu ON tu.id = tp.user_id
    LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
    LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
    LEFT JOIN users pu ON pu.id = pp.user_id
    WHERE ls.id = ${id}::uuid
    LIMIT 1
  `;

  return lecture;
}

async function createNotifications(tx, userIds, title, message, type = "class") {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];

  for (const userId of uniqueIds) {
    await tx.$executeRaw`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
      VALUES (${crypto.randomUUID()}::uuid, ${userId}::uuid, ${title}, ${message}, ${type}::notification_type, FALSE, NOW())
    `;
  }
}

export async function PATCH(request, context) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await context.params;
    const body = await request.json();
    const action = normalizeText(body?.action).toLowerCase();
    const title = normalizeText(body?.title);
    const description = normalizeText(body?.description);
    const scheduledStart = normalizeText(body?.scheduledStart);
    const scheduledEnd = normalizeText(body?.scheduledEnd);
    const manualMeetLink = normalizeText(body?.googleMeetLink || body?.google_meet_link);

    const lecture = await getLecture(id);
    if (!lecture?.id) {
      return json("Lecture schedule not found.", 404);
    }

    if (!["update", "reschedule", "cancel"].includes(action)) {
      return json("Invalid lecture schedule action.", 400);
    }

    if (manualMeetLink && !isValidGoogleMeetLink(manualMeetLink)) {
      return json("Google Meet link must start with https://meet.google.com/.", 400);
    }

    if (action === "cancel") {
      try {
        await cancelCalendarLectureEvent(lecture.google_calendar_event_id, lecture.coordinator_email || session.user.email || "");
      } catch {}

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE lecture_schedules
          SET status = 'cancelled'::lecture_status,
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        await createNotifications(
          tx,
          [lecture.teacher_user_id, lecture.student_user_id, lecture.parent_user_id],
          "Lecture cancelled",
          `${lecture.title} has been cancelled.`
        );

        await createAuditLog(
          {
            actorUserId: session.user.id,
            action: "lecture_cancelled",
            entityType: "lecture_schedules",
            entityId: id,
            oldData: { status: lecture.status },
            newData: { status: "cancelled" },
          },
          tx
        );
      });

      return json("Lecture cancelled.", 200);
    }

    if (!scheduledStart || !scheduledEnd) {
      return json("Scheduled start and end are required.", 400);
    }

    const conflict = await findTeacherScheduleConflict({
      teacherId: lecture.teacher_id,
      scheduledStart,
      scheduledEnd,
      excludeLectureId: lecture.id,
    });

    if (conflict) {
      return json(teacherConflictMessage(conflict), 409, {
        code: "TEACHER_SCHEDULE_CONFLICT",
        conflict,
      });
    }

    if (action === "update") {
      let calendarData = {
        eventId: lecture.google_calendar_event_id || "",
        meetLink: manualMeetLink || "",
        meetSpaceId: extractMeetCodeFromLink(manualMeetLink),
      };
      let resolvedMeetLink = manualMeetLink || "";
      let resolvedMeetSource = manualMeetLink ? "manual" : "google_workspace";

      try {
        calendarData = await updateCalendarLectureEvent(lecture.google_calendar_event_id, {
          organizerEmail: lecture.coordinator_email || session.user.email || "",
          title: title || lecture.title,
          description: description || lecture.description,
          start: scheduledStart,
          end: scheduledEnd,
          attendees: [
            lecture.teacher_email ? { email: lecture.teacher_email, name: lecture.teacher_name } : null,
            lecture.student_email ? { email: lecture.student_email, name: lecture.student_name } : null,
            lecture.parent_email ? { email: lecture.parent_email, name: lecture.parent_name } : null,
          ].filter(Boolean),
        });
        if (calendarData.meetLink) {
          resolvedMeetLink = calendarData.meetLink;
          resolvedMeetSource = "google_workspace";
        }
      } catch {
        calendarData = {
          eventId: lecture.google_calendar_event_id || "",
          meetLink: manualMeetLink || "",
          meetSpaceId: extractMeetCodeFromLink(manualMeetLink),
        };
      }

      if (!resolvedMeetLink || !isValidGoogleMeetLink(resolvedMeetLink)) {
        return json("Unable to create a valid Google Meet link. Provide a fallback Google Meet link or complete Google Workspace organizer setup.", 400);
      }

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE lecture_schedules
          SET title = ${title || lecture.title},
              description = ${description || lecture.description || null},
              scheduled_start = ${scheduledStart}::timestamp,
              scheduled_end = ${scheduledEnd}::timestamp,
              google_calendar_event_id = ${calendarData.eventId || lecture.google_calendar_event_id || null},
              google_meet_link = ${resolvedMeetLink},
              meet_link_source = ${resolvedMeetSource},
              google_meet_space_id = COALESCE(${calendarData.meetSpaceId || extractMeetCodeFromLink(manualMeetLink) || null}, google_meet_space_id),
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        await createAuditLog(
          {
            actorUserId: session.user.id,
            action: "lecture_schedule_updated",
            entityType: "lecture_schedules",
            entityId: id,
            oldData: {
              title: lecture.title,
              description: lecture.description,
              scheduledStart: lecture.scheduled_start,
              scheduledEnd: lecture.scheduled_end,
            },
            newData: {
              title: title || lecture.title,
              description: description || lecture.description,
              scheduledStart,
              scheduledEnd,
            },
          },
          tx
        );
      });

      return json("Lecture schedule updated.", 200);
    }

    let calendarData = {
      eventId: lecture.google_calendar_event_id || "",
      meetLink: manualMeetLink,
      meetSpaceId: extractMeetCodeFromLink(manualMeetLink),
    };
    let resolvedMeetLink = manualMeetLink;
    let resolvedMeetSource = manualMeetLink ? "manual" : "google_workspace";

    try {
      calendarData = await createCalendarLectureEvent({
        organizerEmail: session.user.email || lecture.coordinator_email || "",
        title: title || lecture.title,
        description: description || lecture.description,
        start: scheduledStart,
        end: scheduledEnd,
        attendees: [
          lecture.teacher_email ? { email: lecture.teacher_email, name: lecture.teacher_name } : null,
          lecture.student_email ? { email: lecture.student_email, name: lecture.student_name } : null,
          lecture.parent_email ? { email: lecture.parent_email, name: lecture.parent_name } : null,
        ].filter(Boolean),
      });
      if (calendarData.meetLink) {
        resolvedMeetLink = calendarData.meetLink;
        resolvedMeetSource = "google_workspace";
      }
    } catch (error) {
      if (!manualMeetLink) {
        throw error;
      }
    }

    if (!resolvedMeetLink || !isValidGoogleMeetLink(resolvedMeetLink)) {
      return json("Unable to create a valid Google Meet link. Provide a fallback Google Meet link or complete Google Workspace organizer setup.", 400);
    }

    const [newLecture] = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE lecture_schedules
        SET status = 'rescheduled'::lecture_status,
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      const rows = await tx.$queryRaw`
        INSERT INTO lecture_schedules (
          id,
          enrollment_id,
          student_id,
          teacher_id,
          subject_id,
          scheduled_by,
          title,
          description,
          scheduled_start,
          scheduled_end,
          google_calendar_event_id,
          google_meet_link,
          meet_link_source,
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
          ${title || lecture.title},
          ${description || lecture.description || null},
          ${scheduledStart}::timestamp,
          ${scheduledEnd}::timestamp,
          ${calendarData.eventId || null},
          ${resolvedMeetLink || null},
          ${resolvedMeetSource},
          ${calendarData.meetSpaceId || null},
          'scheduled'::lecture_status,
          ${id}::uuid,
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `;

      await createNotifications(
        tx,
        [lecture.teacher_user_id, lecture.student_user_id, lecture.parent_user_id],
        "Lecture rescheduled",
        `${lecture.title} has been moved to a new time.`
      );

      await createAuditLog(
        {
          actorUserId: session.user.id,
          action: "lecture_rescheduled",
          entityType: "lecture_schedules",
          entityId: rows[0].id,
          oldData: { previousLectureId: id, status: lecture.status },
          newData: { rescheduledFromId: id, scheduledStart, scheduledEnd },
        },
        tx
      );

      return tx.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.enrollment_id::text AS enrollment_id,
          ls.student_id::text AS student_id,
          ls.teacher_id::text AS teacher_id,
          ls.subject_id::text AS subject_id,
          ls.title,
          ls.description,
          ls.scheduled_start,
          ls.scheduled_end,
          ls.status::text AS status,
          ls.google_calendar_event_id,
          ls.google_meet_link,
          ls.meet_link_source,
          ls.google_meet_space_id,
          ls.rescheduled_from_id::text AS rescheduled_from_id
        FROM lecture_schedules ls
        WHERE ls.id = ${rows[0].id}::uuid
      `;
    });

    return json("Lecture rescheduled.", 200, { item: newLecture });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to update lecture schedule.",
      500
    );
  }
}
