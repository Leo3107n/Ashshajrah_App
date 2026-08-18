import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMeetAttendanceRecords, shareDriveFileWithUsers } from "@/lib/googleMeet";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin", "teacher"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function buildRecordingUrl(recording) {
  if (recording?.driveFileId) return `https://drive.google.com/file/d/${recording.driveFileId}/preview`;
  if (recording?.driveExportUri) return recording.driveExportUri;
  return "";
}

function extractDriveFileId(url) {
  const text = String(url || "").trim();
  const match = text.match(/\/file\/d\/([^/]+)/i);
  return match?.[1] || "";
}

export async function POST(_request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();
  const { id } = await params;

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const [event] = await prisma.$queryRaw`
      SELECT
        ie.id::text AS id,
        ie.title,
        ie.scheduled_start,
        ie.scheduled_end,
        ie.google_calendar_event_id,
        ie.google_meet_link,
        ie.google_meet_space_id,
        ie.recording_drive_url,
        host.email AS host_email,
        attendee.id::text AS attendee_user_id
      FROM internal_events ie
      LEFT JOIN users host ON host.id = ie.host_user_id
      LEFT JOIN users attendee ON attendee.id = ie.attendee_user_id
      WHERE ie.id = ${id}::uuid
      LIMIT 1
    `;

    if (!event?.id) return json("Internal event not found.", 404);
    if (role === "teacher" && event.attendee_user_id !== session.user.id) {
      return json("Forbidden.", 403);
    }

    if (event.recording_drive_url) {
      const existingFileId = extractDriveFileId(event.recording_drive_url);
      if (existingFileId) {
        await shareDriveFileWithUsers({
          fileId: existingFileId,
          emails: [],
          impersonateUserEmail: event.host_email || session.user.email || "",
        });
      }
      return json("Recording already available.", 200, {
        recording_drive_url: event.recording_drive_url,
      });
    }

    const meetSpaceId = event.google_meet_space_id || event.google_meet_link || "";
    if (!meetSpaceId) {
      return json("No Google Meet link is available for this event yet.", 200, {
        recording_drive_url: "",
      });
    }

    const syncResult = await getMeetAttendanceRecords({
      meetSpaceId,
      scheduledStart: event.scheduled_start,
      scheduledEnd: event.scheduled_end,
      impersonateUserEmail: event.host_email || session.user.email || "",
      lectureIdentifiers: {
        storedMeetLink: event.google_meet_link || "",
        calendarEventId: event.google_calendar_event_id || "",
        organizerEmail: event.host_email || "",
      },
    });

    const recording = Array.isArray(syncResult.recordings) ? syncResult.recordings[0] : null;
    if (recording?.driveFileId) {
      await shareDriveFileWithUsers({
        fileId: recording.driveFileId,
        emails: [],
        impersonateUserEmail: event.host_email || session.user.email || "",
      });
    }
    const recordingUrl = buildRecordingUrl(recording);

    if (!recordingUrl) {
      await prisma.$executeRaw`
        UPDATE internal_events
        SET recording_synced_at = NOW(),
            updated_at = NOW()
        WHERE id = ${event.id}::uuid
      `;
      return json("Recording is not available yet.", 200, {
        recording_drive_url: "",
      });
    }

    await prisma.$executeRaw`
      UPDATE internal_events
      SET recording_drive_url = ${recordingUrl},
          recording_synced_at = NOW(),
          updated_at = NOW()
      WHERE id = ${event.id}::uuid
    `;

    return json("Recording synced successfully.", 200, {
      recording_drive_url: recordingUrl,
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to sync recording.", 500);
  }
}
