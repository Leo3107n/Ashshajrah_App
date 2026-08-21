import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const INTERNAL_ROLES = new Set(["admin", "coordinator", "superadmin", "teacher", "parent", "student"]);
const PUBLIC_ROLES = new Set(["admin", "coordinator", "superadmin", "teacher", "parent", "student"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function dateOnly(value) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
}

function rangeBounds(range, dateValue) {
  const anchor = new Date(`${dateOnly(dateValue)}T12:00:00+05:00`);
  const start = new Date(anchor);
  const end = new Date(anchor);

  if (range === "selected_date") {
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 1);
  } else if (range === "selected_month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(start.getMonth() + 1, 1);
    end.setHours(0, 0, 0, 0);
  } else {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 7);
  }

  return { start, end };
}

function normalizeEvent(row, type) {
  return {
    id: `${type}:${row.id}`,
    raw_id: row.id,
    type,
    title: row.title || "Untitled event",
    description: row.description || "",
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status || "scheduled",
    meet_link: row.meet_link || "",
    calendar_link: row.calendar_link || "",
    recording_drive_url: row.recording_drive_url || "",
    host_name: row.host_name || "",
  };
}

function sortEvents(items) {
  return items.sort((a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime());
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `;
  return Boolean(rows?.[0]?.exists);
}

export async function GET(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);

  const { searchParams } = new URL(request.url);
  const type = clean(searchParams.get("type")).toLowerCase() === "internal" ? "internal" : "public";
  const requestedRange = clean(searchParams.get("range"));
  const range = ["selected_date", "selected_week", "selected_month"].includes(requestedRange)
    ? requestedRange
    : "selected_week";
  const { start, end } = rangeBounds(range, searchParams.get("date"));

  try {
    if (type === "internal") {
      if (!INTERNAL_ROLES.has(role)) return json("Forbidden.", 403);

      const hasAttendeesTable = await tableExists("internal_event_attendees");
      const rows = hasAttendeesTable
        ? await prisma.$queryRaw(
          Prisma.sql`
          SELECT DISTINCT ON (ie.id)
            ie.id::text AS id,
            ie.title,
            ie.description,
            ie.scheduled_start AS starts_at,
            ie.scheduled_end AS ends_at,
            LOWER(ie.status::text) AS status,
            ie.google_meet_link AS meet_link,
            ie.calendar_html_link AS calendar_link,
            ie.recording_drive_url,
            host.full_name AS host_name
          FROM internal_events ie
          LEFT JOIN users host ON host.id = ie.host_user_id
          LEFT JOIN internal_event_attendees iea ON iea.event_id = ie.id
          WHERE ie.scheduled_start < ${end}
            AND ie.scheduled_end >= ${start}
            AND (
              ie.attendee_user_id = ${session.user.id}::uuid
              OR iea.attendee_user_id = ${session.user.id}::uuid
            )
          ORDER BY ie.id, ie.scheduled_start ASC NULLS LAST
        `
        )
        : await prisma.$queryRaw(
          Prisma.sql`
          SELECT DISTINCT ON (ie.id)
            ie.id::text AS id,
            ie.title,
            ie.description,
            ie.scheduled_start AS starts_at,
            ie.scheduled_end AS ends_at,
            LOWER(ie.status::text) AS status,
            ie.google_meet_link AS meet_link,
            ie.calendar_html_link AS calendar_link,
            ie.recording_drive_url,
            host.full_name AS host_name
          FROM internal_events ie
          LEFT JOIN users host ON host.id = ie.host_user_id
          WHERE ie.scheduled_start < ${end}
            AND ie.scheduled_end >= ${start}
            AND ie.attendee_user_id = ${session.user.id}::uuid
          ORDER BY ie.id, ie.scheduled_start ASC NULLS LAST
        `
        );

      return json("Internal calendar events fetched.", 200, {
        items: sortEvents(rows.map((row) => normalizeEvent(row, "internal"))),
      });
    }

    if (!PUBLIC_ROLES.has(role)) return json("Forbidden.", 403);

    const rows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT DISTINCT ON (pe.id)
          pe.id::text AS id,
          pe.title,
          pe.description,
          pe.start_at AS starts_at,
          pe.end_at AS ends_at,
          LOWER(pe.publication_status::text) AS status,
          pe.meet_link,
          pe.google_calendar_event_html_link AS calendar_link,
          pe.recording_drive_url,
          creator.full_name AS host_name
        FROM public_events pe
        LEFT JOIN users creator ON creator.id = pe.created_by
        WHERE LOWER(pe.publication_status::text) = 'published'
          AND pe.start_at < ${end}
          AND pe.end_at >= ${start}
        ORDER BY pe.id, pe.start_at ASC NULLS LAST
      `
    );

    return json("Public calendar events fetched.", 200, {
      items: sortEvents(rows.map((row) => normalizeEvent(row, "public"))),
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to load calendar events.", 500);
  }
}
