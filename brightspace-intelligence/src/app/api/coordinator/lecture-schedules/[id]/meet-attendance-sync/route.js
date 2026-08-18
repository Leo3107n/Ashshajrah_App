import crypto from "crypto";
import { NextResponse } from "next/server";
import { getMeetAttendanceRecords, shareDriveFileWithUsers } from "@/lib/googleMeet";
import { extractMeetCodeFromLink, getCalendarLectureEvent } from "@/lib/googleCalendar";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];
const PRESENT_THRESHOLD_MINUTES = Number(process.env.LECTURE_PRESENT_THRESHOLD_MINUTES || 20);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function ensureAttendanceColumns() {
  await prisma.$executeRaw`
    ALTER TABLE lecture_attendance
    ADD COLUMN IF NOT EXISTS participant_email TEXT,
    ADD COLUMN IF NOT EXISTS participant_name TEXT,
    ADD COLUMN IF NOT EXISTS google_participant_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS google_session_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS meet_raw JSONB
  `;

  await prisma.$executeRaw`
    ALTER TABLE lecture_schedules
    ADD COLUMN IF NOT EXISTS google_meet_sync_meta JSONB
  `;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeName(value) {
  return normalizeText(value);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isMaskedEmail(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || !text.includes("@")) return false;
  return text.includes("*") || text.includes("…") || text.includes("...");
}

function normalizeMeetCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/meet\.google\.com\//, "")
    .replace(/^meet\.google\.com\//, "")
    .replace(/[^a-z0-9]/g, "");
}

function durationStatus(durationMinutes) {
  return Number(durationMinutes || 0) >= PRESENT_THRESHOLD_MINUTES ? "present" : "absent";
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeNameVariants(values = []) {
  return uniqueValues(values.map(normalizeText).filter(Boolean));
}

function normalizeEmailVariants(values = []) {
  return uniqueValues(values.map(normalizeEmail).filter(Boolean));
}

function createIdentityMaps() {
  return {
    byEmail: new Map(),
    byName: new Map(),
    aliases: [],
  };
}

function addIdentityAlias(store, { email = "", name = "", role = "participant", source = "" }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(name);
  const payload = {
    email: normalizedEmail,
    name,
    role,
    source,
  };

  if (normalizedEmail) {
    const existing = store.byEmail.get(normalizedEmail) || {};
    store.byEmail.set(normalizedEmail, {
      ...existing,
      email: normalizedEmail,
      name: existing.name || name || "",
      role: existing.role || role,
      source: existing.source || source,
    });
  }

  if (normalizedName) {
    const existing = store.byName.get(normalizedName) || {};
    const resolvedEmail = normalizedEmail || existing.email || "";
    store.byName.set(normalizedName, {
      ...existing,
      email: resolvedEmail,
      name: existing.name || name || "",
      role: existing.role || role,
      source: existing.source || source,
    });
  }

  if (normalizedEmail || normalizedName) {
    store.aliases.push({
      email: normalizedEmail,
      name: name || "",
      role,
      source,
    });
  }
}

function emailLocalPart(value) {
  const normalized = normalizeEmail(value);
  return normalized.includes("@") ? normalized.split("@")[0] : "";
}

function maskedEmailLooksLike(masked, actual) {
  const maskedLocal = emailLocalPart(masked);
  const actualLocal = emailLocalPart(actual);
  if (!maskedLocal || !actualLocal) return false;
  if (!isMaskedEmail(masked)) return false;
  return actualLocal.startsWith(maskedLocal) || maskedLocal.startsWith(actualLocal.slice(0, Math.max(4, Math.min(actualLocal.length, 8))));
}

function resolveParticipantIdentity(store, { name = "", email = "", endpointId = "" }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(name);
  const normalizedEndpointId = normalizeName(endpointId);

  if (normalizedEmail && store.byEmail.has(normalizedEmail)) {
    return store.byEmail.get(normalizedEmail);
  }

  if (normalizedName && store.byName.has(normalizedName)) {
    return store.byName.get(normalizedName);
  }

  if (normalizedEndpointId && store.byName.has(normalizedEndpointId)) {
    return store.byName.get(normalizedEndpointId);
  }

  for (const [aliasEmail, alias] of store.byEmail.entries()) {
    if (normalizedEmail && maskedEmailLooksLike(normalizedEmail, aliasEmail)) {
      return alias;
    }
  }

  for (const [aliasName, alias] of store.byName.entries()) {
    if (!normalizedName) continue;
    if (aliasName === normalizedName || aliasName.includes(normalizedName) || normalizedName.includes(aliasName)) {
      return alias;
    }
  }

  return null;
}

function pickImpersonationEmail(lecture) {
  return (
    lecture?.google_organizer_email ||
    lecture?.coordinator_email ||
    process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL ||
    ""
  );
}

function buildExpectedParticipants(lecture, calendarEvent) {
  const organizer = calendarEvent?.organizer || {};
  const creator = calendarEvent?.creator || {};
  const attendees = Array.isArray(calendarEvent?.attendees) ? calendarEvent.attendees : [];
  const teacherAttendee =
    attendees.find((item) => normalizeEmail(item.email) === normalizeEmail(lecture.teacher_email)) ||
    attendees[0] ||
    null;
  const hostName = lecture.coordinator_name || organizer.displayName || creator.displayName || lecture.coordinator_email || "Coordinator";
  const teacherName = lecture.teacher_name || teacherAttendee?.displayName || lecture.teacher_email || "Teacher";

  return [
    {
      roleType: "coordinator",
      name: hostName,
      email: lecture.google_organizer_email || lecture.coordinator_email || "admissions@ashshajrah.com",
      nameVariants: uniqueValues([hostName, organizer.displayName, creator.displayName]),
      emailVariants: uniqueValues([
        lecture.google_organizer_email,
        lecture.coordinator_email,
        organizer.email,
        creator.email,
        "admissions@ashshajrah.com",
      ]),
      userId: lecture.coordinator_user_id,
    },
    {
      roleType: "teacher",
      name: teacherName,
      email: lecture.google_teacher_email || lecture.teacher_email || "",
      nameVariants: uniqueValues([teacherName, teacherAttendee?.displayName]),
      emailVariants: uniqueValues([lecture.google_teacher_email, lecture.teacher_email, teacherAttendee?.email]),
      userId: lecture.teacher_user_id,
    },
  ];
}

function buildIdentityMaps({ lecture, calendarEvent, reportsIdentities = [] }) {
  const store = createIdentityMaps();
  const organizer = calendarEvent?.organizer || {};
  const creator = calendarEvent?.creator || {};
  const attendees = Array.isArray(calendarEvent?.attendees) ? calendarEvent.attendees : [];
  const teacherAttendee = attendees.find((item) => normalizeEmail(item.email) === normalizeEmail(lecture.teacher_email)) || null;

  for (const name of uniqueValues([lecture.coordinator_name, organizer.displayName, creator.displayName])) {
    addIdentityAlias(store, {
      email: lecture.google_organizer_email || lecture.coordinator_email || organizer.email || creator.email || "",
      name,
      role: "host",
      source: "calendar_or_lms_host",
    });
  }

  for (const email of uniqueValues([lecture.google_organizer_email, lecture.coordinator_email, organizer.email, creator.email])) {
    addIdentityAlias(store, {
      email,
      name: lecture.coordinator_name || organizer.displayName || creator.displayName || "",
      role: "host",
      source: "calendar_or_lms_host",
    });
  }

  for (const name of uniqueValues([lecture.teacher_name, teacherAttendee?.displayName])) {
    addIdentityAlias(store, {
      email: lecture.google_teacher_email || lecture.teacher_email || teacherAttendee?.email || "",
      name,
      role: "cohost",
      source: "calendar_or_lms_teacher",
    });
  }

  for (const email of uniqueValues([lecture.google_teacher_email, lecture.teacher_email, teacherAttendee?.email])) {
    addIdentityAlias(store, {
      email,
      name: lecture.teacher_name || teacherAttendee?.displayName || "",
      role: "cohost",
      source: "calendar_or_lms_teacher",
    });
  }

  for (const attendee of attendees) {
    addIdentityAlias(store, {
      email: attendee.email,
      name: attendee.displayName,
      role: normalizeEmail(attendee.email) === normalizeEmail(lecture.teacher_email) ? "cohost" : "participant",
      source: "calendar_attendee",
    });
  }

  for (const identity of reportsIdentities) {
    if (!normalizeEmail(identity.email)) continue;
    addIdentityAlias(store, {
      email: identity.email,
      name: identity.name,
      role: identity.role || "participant",
      source: identity.source || "admin_reports",
    });
  }

  return store;
}

function enrichParticipants(records, identityStore) {
  return records.map((record) => {
    const resolved = resolveParticipantIdentity(identityStore, {
      name: record.participantName,
      email: record.participantEmail,
      endpointId: record.googleParticipantId,
    });
    const resolvedEmail = normalizeEmail(
      record.participantEmail && !isMaskedEmail(record.participantEmail)
        ? record.participantEmail
        : resolved?.email || ""
    );
    const resolvedName =
      record.participantName && !/^\d+$/.test(String(record.participantName).trim())
        ? record.participantName
        : resolved?.name || "";

    return {
      ...record,
      participantEmail: resolvedEmail,
      participantName: resolvedName || record.displayName || "",
      resolvedRole: resolved?.role || "",
      resolvedSource: resolved?.source || "",
    };
  });
}

function pickBestMatch(records, expectedEmails = [], expectedRole = "", expectedNames = []) {
  const normalizedEmails = normalizeEmailVariants(expectedEmails);
  const normalizedNames = normalizeNameVariants(expectedNames);
  const exactRoleMatches = records.filter((record) => record.resolvedRole === expectedRole);
  const emailMatches = records.filter((record) => normalizedEmails.includes(normalizeEmail(record.participantEmail)));
  const nameMatches = records.filter((record) => {
    const recordName = normalizeName(record.participantName || "");
    if (!recordName) return false;
    return normalizedNames.some(
      (expectedName) =>
        expectedName &&
        (recordName === expectedName || recordName.includes(expectedName) || expectedName.includes(recordName))
    );
  });
  const ranked = [...new Set([...emailMatches, ...exactRoleMatches, ...nameMatches])].sort(
    (left, right) => Number(right.durationMinutes || 0) - Number(left.durationMinutes || 0)
  );
  return ranked[0] || null;
}

function pickLongestRecord(records, predicate = () => true) {
  return [...records.filter(predicate)].sort((left, right) => Number(right.durationMinutes || 0) - Number(left.durationMinutes || 0))[0] || null;
}

function dedupeParticipantRecords(records = []) {
  const grouped = new Map();

  for (const record of records) {
    const emailKey = normalizeEmail(record?.participantEmail || "");
    const nameKey = normalizeName(record?.participantName || "");
    const key = emailKey || nameKey;
    if (!key) continue;

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...record });
      continue;
    }

    const existingDuration = Number(existing.durationMinutes || 0);
    const nextDuration = Number(record.durationMinutes || 0);
    if (nextDuration > existingDuration) {
      grouped.set(key, {
        ...existing,
        ...record,
        participantEmail: record.participantEmail || existing.participantEmail || "",
        participantName: record.participantName || existing.participantName || "",
      });
      continue;
    }

    grouped.set(key, {
      ...existing,
      participantEmail: existing.participantEmail || record.participantEmail || "",
      participantName: existing.participantName || record.participantName || "",
    });
  }

  return [...grouped.values()];
}

function classifyParticipants(records, lecture, calendarEvent) {
  const expected = buildExpectedParticipants(lecture, calendarEvent);
  const hostEmailVariants = normalizeEmailVariants(expected[0].emailVariants);
  const cohostEmailVariants = normalizeEmailVariants(expected[1].emailVariants);
  const hostCandidates = records.filter((record) => {
    const recordEmail = normalizeEmail(record.participantEmail || "");
    const recordName = normalizeName(record.participantName || "");
    return (
      record.resolvedRole === "host" ||
      (recordEmail && hostEmailVariants.includes(recordEmail)) ||
      (recordName && normalizeNameVariants(expected[0].nameVariants).some((expectedName) => recordName === expectedName || recordName.includes(expectedName) || expectedName.includes(recordName)))
    );
  });
  const host = pickLongestRecord(hostCandidates) || pickBestMatch(records, expected[0].emailVariants, "host", expected[0].nameVariants);
  const cohostCandidates = records.filter((record) => {
    if (record === host) return false;
    const recordEmail = normalizeEmail(record.participantEmail || "");
    const recordName = normalizeName(record.participantName || "");
    return (
      record.resolvedRole === "cohost" ||
      (recordEmail && cohostEmailVariants.includes(recordEmail)) ||
      (recordName && normalizeNameVariants(expected[1].nameVariants).some((expectedName) => recordName === expectedName || recordName.includes(expectedName) || expectedName.includes(recordName)))
    );
  });
  const cohost =
    pickLongestRecord(cohostCandidates) ||
    pickBestMatch(
      records.filter((record) => record !== host),
      expected[1].emailVariants,
      "cohost",
      expected[1].nameVariants
    );
  const fallbackCohost =
    cohost ||
    pickLongestRecord(
      records.filter((record) => record !== host),
      (record) => {
        const name = normalizeName(record.participantName || "");
        return Boolean(name) && !/^\d+$/.test(String(record.participantName || "").trim());
      }
    );
  const reservedEmails = new Set(
    normalizeEmailVariants([
      ...(expected[0]?.emailVariants || []),
      ...(expected[1]?.emailVariants || []),
      host?.participantEmail || "",
      fallbackCohost?.participantEmail || "",
    ])
  );
  const others = records.filter((record) => {
    if (record === host || record === fallbackCohost) return false;
    const recordEmail = normalizeEmail(record.participantEmail || "");
    if (recordEmail && reservedEmails.has(recordEmail)) return false;
    if (record.resolvedRole === "host" && host) return false;
    if (record.resolvedRole === "cohost" && fallbackCohost) return false;
    if (record.resolvedRole === "host" || record.resolvedRole === "cohost") return false;
    return true;
  });
  const dedupedOthers = dedupeParticipantRecords(others).filter((record) => {
    if (host && normalizeName(record.participantName || "") === normalizeName(host.participantName || "")) return false;
    if (fallbackCohost && normalizeName(record.participantName || "") === normalizeName(fallbackCohost.participantName || "")) return false;
    return true;
  });

  return {
    host: host
      ? {
          ...host,
          roleType: "coordinator",
          userId: expected[0].userId || "",
        }
      : null,
    cohost: fallbackCohost
      ? {
          ...fallbackCohost,
          roleType: "teacher",
          userId: expected[1].userId || "",
        }
      : null,
    others: dedupedOthers,
  };
}

function toLectureMetaRecord(record, roleType = "participant", fallbackEmail = "", conferenceEndTime = null) {
  const joinedAt = record.joinedAt || null;
  const conferenceEnd = conferenceEndTime ? new Date(conferenceEndTime) : null;
  const joinedAtDate = joinedAt ? new Date(joinedAt) : null;
  const conferenceEndTimeValue = conferenceEnd && !Number.isNaN(conferenceEnd.getTime()) ? conferenceEnd.getTime() : null;
  const joinedAtTime = joinedAtDate && !Number.isNaN(joinedAtDate.getTime()) ? joinedAtDate.getTime() : null;
  const effectiveDurationMinutes =
    joinedAtTime && conferenceEndTimeValue
      ? Math.max(0, Math.round((conferenceEndTimeValue - joinedAtTime) / 60000))
      : Number(record.durationMinutes || 0);
  const durationLeftAt =
    joinedAtTime && effectiveDurationMinutes > 0
      ? new Date(joinedAtTime + effectiveDurationMinutes * 60000).toISOString()
      : record.leftAt || null;
  const roleKey = String(roleType || "").toLowerCase();
  const isStaffRole = roleKey === "coordinator" || roleKey === "teacher";
  const joined = Boolean(effectiveDurationMinutes > 0 || joinedAt);
  const status = isStaffRole ? (joined ? "present" : "absent") : durationStatus(effectiveDurationMinutes);
  const leftAtValue = durationLeftAt;
  const durationValue = effectiveDurationMinutes;

  return {
    name: record.participantName || "",
    email: record.participantEmail || fallbackEmail || "",
    joined,
    status,
    joined_at: joinedAt,
    left_at: leftAtValue,
    duration_minutes: durationValue,
    role_type: roleType,
  };
}

function isMeaningfulParticipant(record) {
  const name = String(record?.participantName || "").trim();
  const email = normalizeEmail(record?.participantEmail || "");
  if (email) return true;
  if (!name) return false;
  return !/^\d+$/.test(name);
}

export async function POST(_request, { params }) {
  try {
    await requireRole(ALLOWED_ROLES);
    await ensureAttendanceColumns();

    const { id } = await params;
    const [lecture] = await prisma.$queryRaw`
      SELECT
        ls.id::text AS id,
        ls.google_meet_link,
        ls.google_meet_space_id,
        ls.google_calendar_event_id,
        ls.google_meet_sync_meta,
        ls.recording_drive_url,
        ls.scheduled_start,
        ls.scheduled_end,
        ls.scheduled_by::text AS coordinator_user_id,
        cu.email AS coordinator_email,
        cu.full_name AS coordinator_name,
        tu.id::text AS teacher_user_id,
        tu.email AS teacher_email,
        tu.full_name AS teacher_name,
        su.email AS student_email,
        pu.email AS parent_email
      FROM lecture_schedules ls
      INNER JOIN student_profiles sp ON sp.id = ls.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      LEFT JOIN users cu ON cu.id = ls.scheduled_by
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE ls.id = ${id}::uuid
      LIMIT 1
    `;

    if (!lecture?.id) {
      return json("Lecture schedule not found.", 404);
    }

    const impersonatedEmail = pickImpersonationEmail(lecture);
    const meetCodeSearch = normalizeMeetCode(lecture.google_meet_space_id || extractMeetCodeFromLink(lecture.google_meet_link));

    console.log("[meet-sync] lecture", {
      lectureId: lecture.id,
      meetCodeSearch,
      impersonatedEmail,
    });

    const calendarEvent = lecture.google_calendar_event_id
      ? await getCalendarLectureEvent(lecture.google_calendar_event_id, impersonatedEmail).catch(() => null)
      : null;

    const meetSpaceId = lecture.google_meet_space_id || extractMeetCodeFromLink(lecture.google_meet_link);
    const meetData = await getMeetAttendanceRecords({
      meetSpaceId,
      scheduledStart: lecture.scheduled_start,
      scheduledEnd: lecture.scheduled_end,
      impersonateUserEmail: impersonatedEmail,
      lectureIdentifiers: {
        meetingCode: meetCodeSearch,
        conferenceId: lecture.google_calendar_event_id || "",
        calendarEventId: lecture.google_calendar_event_id || "",
        organizerEmail: impersonatedEmail,
        storedMeetLink: lecture.google_meet_link || "",
      },
    });

    if (!meetData.available) {
      const pendingMessage =
        meetData.reason === "no_matching_reports_data"
          ? "No matching Google Meet audit data found yet for this lecture."
          : lecture.recording_drive_url
            ? "Recording is available, but Google Meet attendance is still being processed. Please try syncing again shortly."
            : "Meet attendance may be available only after Google finishes processing the conference record.";
      return json(pendingMessage, 200, {
        synced: 0,
        unmatched_participants: [],
        available: false,
        reports_api_called: Boolean(meetData.reports_api_called),
        reports_impersonated_email: meetData.reports_impersonated_email || impersonatedEmail || "",
        reports_start_time: meetData.reports_start_time || null,
        reports_end_time: meetData.reports_end_time || null,
        conference_record_start_time: meetData.conference_record_start_time || null,
        conference_record_end_time: meetData.conference_record_end_time || null,
        scheduled_start: lecture.scheduled_start || null,
        scheduled_end: lecture.scheduled_end || null,
        eventsReturned: Number(meetData.eventsReturned || 0),
        reports_identity_count: Number(meetData.reportsIdentityCount || 0),
        sampleAuditParameters: meetData.sampleAuditParameters || [],
        sampleEvents: meetData.sampleEvents || [],
      });
    }

    if (Number(meetData.eventsReturned || 0) === 0) {
      return json(
        "Admin Reports API returned zero Meet audit events. Check Reports API access, admin privileges, or audit log availability.",
        200,
        {
          synced: 0,
          available: true,
          partial: true,
          emails_available: false,
          reason: "admin_reports_zero_events",
          meet_session_count: Number(meetData.meetSessionCount || meetData.records.length || 0),
          reports_api_called: true,
          reports_impersonated_email: meetData.reports_impersonated_email || impersonatedEmail || "",
          reports_start_time: meetData.reports_start_time || null,
          reports_end_time: meetData.reports_end_time || null,
          conference_record_start_time: meetData.conference_record_start_time || meetData.conferenceRecord?.startTime || null,
          conference_record_end_time: meetData.conference_record_end_time || meetData.conferenceRecord?.endTime || null,
          scheduled_start: lecture.scheduled_start || null,
          scheduled_end: lecture.scheduled_end || null,
          eventsReturned: 0,
          reports_identity_count: 0,
          sampleAuditParameters: meetData.sampleAuditParameters || [],
          sampleEvents: meetData.sampleEvents || [],
          recording:
            [...(meetData.recordings || [])]
              .sort((left, right) => {
                const leftTime = new Date(left.endTime || left.startTime || 0).getTime();
                const rightTime = new Date(right.endTime || right.startTime || 0).getTime();
                return rightTime - leftTime;
              })
              .map((item) => ({
                status: item.state || "available",
                file_id: item.driveFileId || "",
                url: item.driveExportUri || "",
                start_time: item.startTime || null,
                end_time: item.endTime || null,
              }))[0] || null,
        }
      );
    }

    console.log("[meet-sync] audit events", {
      lectureId: lecture.id,
      records: meetData.records.length,
    });

    const identityStore = buildIdentityMaps({
      lecture,
      calendarEvent,
      reportsIdentities: meetData.reportsIdentities || [],
    });
    const enrichedRecords = enrichParticipants(meetData.records, identityStore);
    const classification = classifyParticipants(enrichedRecords, lecture, calendarEvent);
    const hostMeta = classification.host
      ? toLectureMetaRecord(classification.host, "coordinator", lecture.coordinator_email || "", meetData.conference_record_end_time || meetData.conferenceRecord?.endTime || null)
      : null;
    const teacherMeta = classification.cohost
      ? toLectureMetaRecord(classification.cohost, "teacher", lecture.teacher_email || "", meetData.conference_record_end_time || meetData.conferenceRecord?.endTime || null)
      : null;
    const normalizedCoordinatorEmail = normalizeEmail(lecture.coordinator_email || lecture.google_organizer_email || "");
    const normalizedTeacherEmail = normalizeEmail(lecture.teacher_email || lecture.google_teacher_email || "");
    const normalizedCoordinatorName = lecture.coordinator_name || "";
    const normalizedTeacherName = lecture.teacher_name || "";
    const othersMeta = classification.others
      .filter(isMeaningfulParticipant)
      .map((record) => toLectureMetaRecord(record, "participant", "", meetData.conference_record_end_time || meetData.conferenceRecord?.endTime || null))
      .filter((item) => {
        const itemEmail = normalizeEmail(item.email || "");
        const itemName = normalizeName(item.name || "");
        if (itemEmail && (itemEmail === normalizedCoordinatorEmail || itemEmail === normalizedTeacherEmail)) return false;
        if (itemName && normalizeName(normalizedCoordinatorName) === itemName) return false;
        if (itemName && normalizeName(normalizedTeacherName) === itemName) return false;
        return true;
      });

    const hostRecord = hostMeta
      ? {
          ...hostMeta,
          name: lecture.coordinator_name || hostMeta.name || "",
          email: lecture.coordinator_email || lecture.google_organizer_email || hostMeta.email || "",
        }
      : null;
    const teacherRecord = teacherMeta
      ? {
          ...teacherMeta,
          name: lecture.teacher_name || teacherMeta.name || "",
          email: lecture.teacher_email || lecture.google_teacher_email || teacherMeta.email || "",
        }
      : null;

    console.log("[meet-sync] classification", {
      host: hostRecord
        ? {
            email: hostRecord.email,
            name: hostRecord.name,
            duration_minutes: hostRecord.duration_minutes,
          }
        : null,
      cohost: teacherRecord
        ? {
            email: teacherRecord.email,
            name: teacherRecord.name,
            duration_minutes: teacherRecord.duration_minutes,
          }
        : null,
      others: othersMeta.map((item) => ({
        email: item.email,
        name: item.name,
        duration_minutes: item.duration_minutes,
      })),
    });

    if (!hostRecord && !teacherRecord && !othersMeta.length) {
      return json("No matching Google Meet audit data found yet for this lecture.", 200, {
        synced: 0,
        unmatched_participants: [],
        available: false,
      });
    }

    if (classification.host?.userId) {
      await prisma.$executeRaw`
        INSERT INTO lecture_attendance (
          id,
          lecture_id,
          user_id,
          role_type,
          joined_at,
          left_at,
          duration_minutes,
          source,
          status,
          participant_email,
          participant_name,
          google_participant_id,
          google_session_id,
          meet_raw
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${id}::uuid,
          ${classification.host.userId}::uuid,
          'coordinator',
          ${classification.host.joinedAt ? new Date(classification.host.joinedAt) : null}::timestamp,
          ${classification.host.leftAt ? new Date(classification.host.leftAt) : null}::timestamp,
          ${classification.host.durationMinutes || 0},
          'google_meet'::attendance_source,
          ${classification.host.durationMinutes > 0 || classification.host.joinedAt ? 'present' : 'absent'}::attendance_status,
          ${hostRecord?.email || classification.host.participantEmail || null},
          ${hostRecord?.name || classification.host.participantName || null},
          ${classification.host.googleParticipantId || null},
          ${classification.host.googleSessionId || null},
          ${JSON.stringify(classification.host.raw || {})}::jsonb
        )
        ON CONFLICT (lecture_id, user_id)
        DO UPDATE SET
          joined_at = EXCLUDED.joined_at,
          left_at = EXCLUDED.left_at,
          duration_minutes = EXCLUDED.duration_minutes,
          source = EXCLUDED.source,
          status = EXCLUDED.status,
          participant_email = EXCLUDED.participant_email,
          participant_name = EXCLUDED.participant_name,
          google_participant_id = EXCLUDED.google_participant_id,
          google_session_id = EXCLUDED.google_session_id,
          meet_raw = EXCLUDED.meet_raw,
          updated_at = NOW()
      `;
    }

    if (classification.cohost?.userId) {
      await prisma.$executeRaw`
        INSERT INTO lecture_attendance (
          id,
          lecture_id,
          user_id,
          role_type,
          joined_at,
          left_at,
          duration_minutes,
          source,
          status,
          participant_email,
          participant_name,
          google_participant_id,
          google_session_id,
          meet_raw
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${id}::uuid,
          ${classification.cohost.userId}::uuid,
          'teacher',
          ${classification.cohost.joinedAt ? new Date(classification.cohost.joinedAt) : null}::timestamp,
          ${classification.cohost.leftAt ? new Date(classification.cohost.leftAt) : null}::timestamp,
          ${classification.cohost.durationMinutes || 0},
          'google_meet'::attendance_source,
          ${classification.cohost.durationMinutes > 0 || classification.cohost.joinedAt ? 'present' : 'absent'}::attendance_status,
          ${teacherRecord?.email || classification.cohost.participantEmail || null},
          ${teacherRecord?.name || classification.cohost.participantName || null},
          ${classification.cohost.googleParticipantId || null},
          ${classification.cohost.googleSessionId || null},
          ${JSON.stringify(classification.cohost.raw || {})}::jsonb
        )
        ON CONFLICT (lecture_id, user_id)
        DO UPDATE SET
          joined_at = EXCLUDED.joined_at,
          left_at = EXCLUDED.left_at,
          duration_minutes = EXCLUDED.duration_minutes,
          source = EXCLUDED.source,
          status = EXCLUDED.status,
          participant_email = EXCLUDED.participant_email,
          participant_name = EXCLUDED.participant_name,
          google_participant_id = EXCLUDED.google_participant_id,
          google_session_id = EXCLUDED.google_session_id,
          meet_raw = EXCLUDED.meet_raw,
          updated_at = NOW()
      `;
    }

    const latestRecording =
      [...(meetData.recordings || [])]
        .sort((left, right) => {
          const leftTime = new Date(left.endTime || left.startTime || 0).getTime();
          const rightTime = new Date(right.endTime || right.startTime || 0).getTime();
          return rightTime - leftTime;
        })[0] || null;

    const recordingShare = latestRecording?.driveFileId
      ? await shareDriveFileWithUsers({
          fileId: latestRecording.driveFileId,
          impersonateUserEmail: impersonatedEmail,
          emails: [
            lecture.coordinator_email,
            lecture.teacher_email,
            lecture.student_email,
            lecture.parent_email,
          ],
        })
      : { sharedWith: [] };
    const recordingPreviewUrl = latestRecording?.driveFileId
      ? `https://drive.google.com/file/d/${latestRecording.driveFileId}/preview`
      : "";
    const recordingDriveViewUrl = latestRecording?.driveFileId
      ? `https://drive.google.com/file/d/${latestRecording.driveFileId}/view`
      : latestRecording?.driveExportUri || "";

    const existingSyncMeta =
      lecture?.google_meet_sync_meta && typeof lecture.google_meet_sync_meta === "object"
        ? lecture.google_meet_sync_meta
        : null;
    const preservedHost =
      !hostMeta && existingSyncMeta?.host?.joined
        ? existingSyncMeta.host
        : null;
    const preservedCohost =
      !teacherMeta && existingSyncMeta?.cohost?.joined
        ? existingSyncMeta.cohost
        : null;

    const syncMeta = {
      synced_at: new Date().toISOString(),
      meet_space_id: meetSpaceId || "",
      conference_record_name: meetData.conferenceRecord?.name || "",
      host: hostRecord
        ? {
            role: "coordinator",
            name: hostRecord.name || lecture.coordinator_name || "",
            email: hostRecord.email || lecture.coordinator_email || lecture.google_organizer_email || "",
            joined: hostRecord.joined,
            status: hostRecord.status,
            joined_at: hostRecord.joined_at,
            left_at: hostRecord.left_at,
            duration_minutes: hostRecord.duration_minutes,
          }
        : preservedHost
          ? preservedHost
        : {
            role: "coordinator",
            name: lecture.coordinator_name || "",
            email: lecture.coordinator_email || "",
            joined: false,
            status: "absent",
            joined_at: null,
            left_at: null,
            duration_minutes: 0,
          },
      cohost: teacherRecord
        ? {
            role: "teacher",
            name: teacherRecord.name || lecture.teacher_name || "",
            email: teacherRecord.email || lecture.teacher_email || lecture.google_teacher_email || "",
            joined: teacherRecord.joined,
            status: teacherRecord.status,
            joined_at: teacherRecord.joined_at,
            left_at: teacherRecord.left_at,
            duration_minutes: teacherRecord.duration_minutes,
          }
        : preservedCohost
          ? preservedCohost
        : {
            role: "teacher",
            name: lecture.teacher_name || "",
            email: lecture.teacher_email || "",
            joined: false,
            status: "absent",
            joined_at: null,
            left_at: null,
            duration_minutes: 0,
          },
      others: [],
      recording: latestRecording
        ? {
            status: latestRecording.state || "available",
            file_id: latestRecording.driveFileId || "",
            url: recordingPreviewUrl || latestRecording.driveExportUri || "",
            drive_view_url: recordingDriveViewUrl,
            start_time: latestRecording.startTime || null,
            end_time: latestRecording.endTime || null,
            shared_with: recordingShare.sharedWith || [],
            public_link_enabled: Boolean(recordingShare.publicLinkEnabled),
            share_errors: recordingShare.shareErrors || [],
          }
        : null,
    };

    await prisma.$executeRaw`
      UPDATE lecture_schedules
      SET google_meet_space_id = COALESCE(${meetSpaceId || null}, google_meet_space_id),
          recording_drive_file_id = COALESCE(${latestRecording?.driveFileId || null}, recording_drive_file_id),
          recording_drive_url = COALESCE(${latestRecording?.driveExportUri || null}, recording_drive_url),
          google_meet_sync_meta = ${JSON.stringify(syncMeta)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    const syncMessage =
      syncMeta.recording?.share_errors?.length
        ? "Recording found, but Drive sharing failed. Check Workspace Drive sharing policy."
        : "Meet attendance synced.";

    return json(syncMessage, 200, {
      synced: (classification.host ? 1 : 0) + (classification.cohost ? 1 : 0),
      unmatched_participants: [],
      available: true,
      reports_api_called: true,
      eventsReturned: Number(meetData.eventsReturned || 0),
      reports_impersonated_email: meetData.reports_impersonated_email || impersonatedEmail || "",
      reports_start_time: meetData.reports_start_time || null,
      reports_end_time: meetData.reports_end_time || null,
      conference_record_start_time: meetData.conference_record_start_time || meetData.conferenceRecord?.startTime || null,
      conference_record_end_time: meetData.conference_record_end_time || meetData.conferenceRecord?.endTime || null,
      scheduled_start: lecture.scheduled_start || null,
      scheduled_end: lecture.scheduled_end || null,
      identity_aliases: identityStore.aliases,
      calendar_event_identity_loaded: Boolean(calendarEvent),
      reports_identity_count: Number(meetData.reportsIdentityCount || 0),
      reportsIdentities: meetData.reportsIdentities || [],
      sampleAuditParameters: meetData.sampleAuditParameters || [],
      sampleEvents: meetData.sampleEvents || [],
      meet_session_count: Number(meetData.meetSessionCount || meetData.records.length || 0),
      enriched_participants: enrichedRecords.map((record) => ({
        name: record.participantName || "",
        email: record.participantEmail || "",
        endpoint_id: record.googleParticipantId || "",
        duration_minutes: Number(record.durationMinutes || 0),
        joined_at: record.joinedAt || null,
        left_at: record.leftAt || null,
        resolved_role: record.resolvedRole || "",
        resolved_source: record.resolvedSource || "",
      })),
      classification: {
        host: hostRecord,
        cohost: teacherRecord,
        others: [],
      },
      host: syncMeta.host,
      cohost: syncMeta.cohost,
      others: syncMeta.others,
      recording: syncMeta.recording,
      recording_file_id: syncMeta.recording?.file_id || "",
      recording_url: syncMeta.recording?.url || "",
      shared_with: syncMeta.recording?.shared_with || [],
      public_link_enabled: Boolean(syncMeta.recording?.public_link_enabled),
      share_errors: syncMeta.recording?.share_errors || [],
      google_meet_sync_meta: syncMeta,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;

    return json(error instanceof Error ? error.message : "Unable to sync Meet attendance.", 500);
  }
}
