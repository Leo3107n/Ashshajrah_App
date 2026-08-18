import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCalendarLectureEvent, extractMeetCodeFromLink } from "@/lib/googleCalendar";
import prisma from "@/lib/prisma";

const READ_ROLES = new Set(["admin", "coordinator", "superadmin", "teacher"]);
const WRITE_ROLES = new Set(["admin", "coordinator", "superadmin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateTime(value) {
  const text = clean(value);
  if (!text) return null;
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized;
  const date = new Date(hasTimezone ? normalized : `${withSeconds}+05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getFirstCoordinator(tx = prisma) {
  const [coordinator] = await tx.$queryRaw`
    SELECT u.id::text AS id, u.full_name, u.email
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    WHERE LOWER(r.name) = 'coordinator'
      AND LOWER(u.status::text) = 'active'
      AND COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
    ORDER BY u.created_at ASC NULLS LAST, u.id ASC
    LIMIT 1
  `;

  return coordinator || null;
}

async function getAttendee(userId, tx = prisma) {
  const [user] = await tx.$queryRaw`
    SELECT
      u.id::text AS id,
      u.full_name,
      u.email,
      LOWER(r.name) AS role_name
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    WHERE u.id = ${userId}::uuid
      AND LOWER(u.status::text) = 'active'
      AND LOWER(r.name) IN ('teacher', 'admin', 'superadmin', 'coordinator')
    LIMIT 1
  `;

  return user || null;
}

export async function GET(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!READ_ROLES.has(role)) return json("Forbidden.", 403);

  const { searchParams } = new URL(request.url);
  const mode = clean(searchParams.get("mode"));
  const search = clean(searchParams.get("search"));

  try {
    if (mode === "options") {
      if (!WRITE_ROLES.has(role)) return json("Forbidden.", 403);

      const attendees = await prisma.$queryRaw`
        SELECT
          u.id::text AS id,
          u.full_name,
          u.email,
          LOWER(r.name) AS role_name
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE LOWER(u.status::text) = 'active'
          AND LOWER(r.name) IN ('teacher', 'admin', 'superadmin', 'coordinator')
          AND COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
        ORDER BY r.name ASC, u.full_name ASC
      `;

      return json("Internal event options fetched.", 200, { attendees });
    }

    const values = [];
    const conditions = [];

    if (role === "teacher") {
      values.push(session.user.id);
      const teacherIdIndex = values.length;
      values.push(session.user.email || "");
      const teacherEmailIndex = values.length;
      values.push(session.user.username || "");
      const teacherUsernameIndex = values.length;
      values.push(session.user.phone || "");
      const teacherPhoneIndex = values.length;
      values.push(session.user.full_name || session.user.name || "");
      const teacherNameIndex = values.length;
      conditions.push(`(
        ie.attendee_user_id = $${teacherIdIndex}::uuid
        OR EXISTS (
          SELECT 1
          FROM internal_event_attendees iea_access
          WHERE iea_access.event_id = ie.id
            AND iea_access.attendee_user_id = $${teacherIdIndex}::uuid
        )
        OR LOWER(COALESCE(attendee.email, '')) = LOWER($${teacherEmailIndex})
        OR LOWER(COALESCE(attendee.username, '')) = LOWER($${teacherUsernameIndex})
        OR REGEXP_REPLACE(COALESCE(attendee.phone, ''), '\\D', '', 'g') = REGEXP_REPLACE($${teacherPhoneIndex}, '\\D', '', 'g')
        OR LOWER(TRIM(COALESCE(attendee.full_name, ''))) = LOWER(TRIM($${teacherNameIndex}))
      )`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(
        COALESCE(ie.title, '') ILIKE $${values.length}
        OR COALESCE(ie.description, '') ILIKE $${values.length}
        OR COALESCE(attendee.full_name, '') ILIKE $${values.length}
        OR COALESCE(host.full_name, '') ILIKE $${values.length}
      )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        ie.id::text AS id,
        ie.title,
        ie.description,
        ie.scheduled_start,
        ie.scheduled_end,
        LOWER(ie.status::text) AS status,
        ie.google_calendar_event_id,
        ie.google_meet_link,
        ie.google_meet_space_id,
        ie.calendar_html_link,
        ie.recording_drive_url,
        ie.recording_synced_at,
        ie.google_last_error,
        host.id::text AS host_user_id,
        host.full_name AS host_name,
        host.email AS host_email,
        attendee.id::text AS attendee_user_id,
        attendee.full_name AS attendee_name,
        attendee.email AS attendee_email,
        attendee_role.name AS attendee_role,
        COALESCE(
          (
            SELECT STRING_AGG(member.full_name, ', ' ORDER BY member.full_name)
            FROM internal_event_attendees iea
            INNER JOIN users member ON member.id = iea.attendee_user_id
            WHERE iea.event_id = ie.id
          ),
          attendee.full_name
        ) AS attendee_names,
        COALESCE(
          (
            SELECT COUNT(*)::int
            FROM internal_event_attendees iea
            WHERE iea.event_id = ie.id
          ),
          1
        ) AS attendee_count
      FROM internal_events ie
      LEFT JOIN users host ON host.id = ie.host_user_id
      LEFT JOIN users attendee ON attendee.id = ie.attendee_user_id
      LEFT JOIN roles attendee_role ON attendee_role.id = attendee.role_id
      ${whereClause}
      ORDER BY ie.scheduled_start DESC NULLS LAST, ie.created_at DESC NULLS LAST
      `,
      ...values
    );

    return json("Internal events fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to load internal events.", 500);
  }
}

export async function POST(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!WRITE_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const body = await request.json();
    const title = clean(body?.title);
    const description = clean(body?.description);
    const attendeeUserIds = [
      ...new Set(
        (Array.isArray(body?.attendeeUserIds)
          ? body.attendeeUserIds
          : [body?.attendeeUserId]
        )
          .map(clean)
          .filter(Boolean)
      ),
    ];
    const scheduledStart = parseDateTime(body?.scheduledStart);
    const scheduledEnd = parseDateTime(body?.scheduledEnd);

    if (!title) return json("Event title is required.", 400);
    if (!attendeeUserIds.length) return json("At least one attendee is required.", 400);
    if (attendeeUserIds.length > 50) return json("A maximum of 50 attendees can be selected.", 400);
    if (!scheduledStart || !scheduledEnd || scheduledEnd <= scheduledStart) {
      return json("Valid start and end time are required.", 400);
    }

    const attendees = await Promise.all(attendeeUserIds.map((id) => getAttendee(id)));
    if (attendees.some((attendee) => !attendee?.id)) {
      return json("One or more selected attendees are not available.", 400);
    }

    const coordinator = await getFirstCoordinator();
    const hostUserId = coordinator?.id || session.user.id;
    const hostEmail = coordinator?.email || session.user.email || "";

    const eventId = crypto.randomUUID();
    const created = await prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw`
        INSERT INTO internal_events (
          id,
          title,
          description,
          host_user_id,
          attendee_user_id,
          scheduled_start,
          scheduled_end,
          status,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          ${eventId}::uuid,
          ${title},
          ${description || null},
          ${hostUserId}::uuid,
          ${attendees[0].id}::uuid,
          ${scheduledStart},
          ${scheduledEnd},
          'scheduled',
          ${session.user.id}::uuid,
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `;
      for (const attendee of attendees) {
        await tx.$executeRaw`
          INSERT INTO internal_event_attendees (event_id, attendee_user_id)
          VALUES (${row.id}::uuid, ${attendee.id}::uuid)
          ON CONFLICT (event_id, attendee_user_id) DO NOTHING
        `;
      }
      return row;
    });

    let calendarError = "";
    try {
      const calendarData = await createCalendarLectureEvent({
        title,
        description,
        start: scheduledStart,
        end: scheduledEnd,
        organizerEmail: hostEmail,
        attendees: attendees.map((attendee) => ({
          email: attendee.email,
          name: attendee.full_name,
        })),
      });

      await prisma.$executeRaw`
        UPDATE internal_events
        SET google_calendar_event_id = ${calendarData?.eventId || null},
            google_meet_link = ${calendarData?.meetLink || null},
            google_meet_space_id = ${calendarData?.meetSpaceId || extractMeetCodeFromLink(calendarData?.meetLink || "") || null},
            calendar_html_link = ${calendarData?.eventHtmlLink || null},
            google_last_error = NULL,
            updated_at = NOW()
        WHERE id = ${created.id}::uuid
      `;
    } catch (error) {
      calendarError = error instanceof Error ? error.message : "Google Calendar event could not be created.";
      await prisma.$executeRaw`
        UPDATE internal_events
        SET google_last_error = ${calendarError},
            updated_at = NOW()
        WHERE id = ${created.id}::uuid
      `;
    }

    return json(
      calendarError
        ? "Internal event saved, but Google Calendar/Meet could not be created."
        : `Internal event created for ${attendees.length} attendee${attendees.length === 1 ? "" : "s"}.`,
      201,
      {
        item: created,
        items: [created],
        attendee_count: attendees.length,
        calendar_error: calendarError || "",
      }
    );
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to create internal event.", 500);
  }
}
