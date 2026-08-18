import crypto from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_MEET_BASE_URL = "https://meet.googleapis.com/v2";
const GOOGLE_ADMIN_REPORTS_BASE_URL = "https://admin.googleapis.com/admin/reports/v1";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGoogleAccessToken({ impersonateUserEmail, scopes }) {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: Array.isArray(scopes) ? scopes.join(" ") : String(scopes || "").trim(),
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  if (impersonateUserEmail) {
    payload.sub = String(impersonateUserEmail).trim();
  }
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign("RSA-SHA256");

  signer.update(unsignedToken);
  signer.end();

  const signature = signer
    .sign(privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Meet auth failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getGoogleMeetAccessToken(impersonateUserEmail) {
  return getGoogleAccessToken({
    impersonateUserEmail,
    scopes: ["https://www.googleapis.com/auth/meetings.space.readonly"],
  });
}

async function getGoogleAdminReportsAccessToken(impersonateUserEmail) {
  return getGoogleAccessToken({
    impersonateUserEmail,
    scopes: ["https://www.googleapis.com/auth/admin.reports.audit.readonly"],
  });
}

async function getGoogleDriveAccessToken(impersonateUserEmail) {
  return getGoogleAccessToken({
    impersonateUserEmail,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

async function meetRequest(path, options = {}) {
  const accessToken = await getGoogleMeetAccessToken(options.impersonateUserEmail);
  const response = await fetch(`${GOOGLE_MEET_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Meet request failed: ${await response.text()}`);
  }

  return response.json();
}

async function adminReportsRequest(path, options = {}) {
  const accessToken = await getGoogleAdminReportsAccessToken(options.impersonateUserEmail);
  const response = await fetch(`${GOOGLE_ADMIN_REPORTS_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403 || response.status === 401) {
      throw new Error("Admin Reports API access failed. Check domain-wide delegation scope and coordinator/admin permission.");
    }
    throw new Error(`Google Admin Reports request failed: ${text}`);
  }

  return response.json();
}

async function driveRequest(path, options = {}) {
  const accessToken = await getGoogleDriveAccessToken(options.impersonateUserEmail);
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Drive request failed: ${await response.text()}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function getParticipantEmail(participant) {
  const candidate =
    participant?.signedinUser?.email ||
    participant?.signedInUser?.email ||
    participant?.user?.email ||
    participant?.email ||
    participant?.anonymousUser?.email ||
    participant?.participantKey?.userEmail ||
    participant?.participantKey?.email ||
    participant?.participantEmail ||
    "";

  if (String(candidate).includes("@")) {
    return String(candidate).toLowerCase();
  }

  return (
    participant?.signedinUser?.email ||
    participant?.signedInUser?.email ||
    participant?.user?.email ||
    participant?.email ||
    participant?.anonymousUser?.email ||
    participant?.participantKey?.userEmail ||
    participant?.participantKey?.email ||
    ""
  ).toLowerCase();
}

function getParticipantName(participant) {
  const candidate =
    participant?.signedinUser?.displayName ||
    participant?.signedInUser?.displayName ||
    participant?.user?.displayName ||
    participant?.displayName ||
    participant?.anonymousUser?.displayName ||
    participant?.phoneUser?.displayName ||
    "";

  if (!candidate || isNumericLike(candidate)) {
    return "";
  }

  return candidate;
}

function durationMinutes(start, end) {
  const startedAt = new Date(start);
  const endedAt = new Date(end || Date.now());

  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return 0;
  }

  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

function aggregateRecords(records) {
  const grouped = new Map();

  for (const record of records) {
    const key = record.participantKey || record.participantEmail || record.googleParticipantId || record.participantName;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...record, raw: [record.raw] });
      continue;
    }

    const existingJoined = existing.joinedAt ? new Date(existing.joinedAt).getTime() : Number.POSITIVE_INFINITY;
    const nextJoined = record.joinedAt ? new Date(record.joinedAt).getTime() : Number.POSITIVE_INFINITY;
    const existingLeft = existing.leftAt ? new Date(existing.leftAt).getTime() : 0;
    const nextLeft = record.leftAt ? new Date(record.leftAt).getTime() : 0;

    existing.joinedAt = nextJoined < existingJoined ? record.joinedAt : existing.joinedAt;
    existing.leftAt = nextLeft > existingLeft ? record.leftAt : existing.leftAt;
    existing.durationMinutes = Number(existing.durationMinutes || 0) + Number(record.durationMinutes || 0);
    existing.raw.push(record.raw);
  }

  return [...grouped.values()];
}

async function getConferenceRecordings(conferenceRecordName, impersonateUserEmail) {
  if (!conferenceRecordName) {
    return [];
  }

  try {
    const payload = await meetRequest(`/${conferenceRecordName}/recordings`, {
      impersonateUserEmail,
    });
    const recordings = payload?.recordings || [];

    return recordings.map((recording) => ({
      name: recording?.name || "",
      state: recording?.state || "",
      startTime: recording?.startTime || null,
      endTime: recording?.endTime || null,
      driveFileId:
        recording?.driveDestination?.file ||
        recording?.destination?.driveDestination?.file ||
        "",
      driveExportUri:
        recording?.driveDestination?.exportUri ||
        recording?.destination?.driveDestination?.exportUri ||
        "",
      raw: recording,
    }));
  } catch {
    return [];
  }
}

function normalizeMeetIdentifiers(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return { meetingCode: "", spaceName: "" };
  }

  if (raw.startsWith("spaces/")) {
    return {
      meetingCode: raw.split("/").pop() || "",
      spaceName: raw,
    };
  }

  return {
    meetingCode: raw,
    spaceName: `spaces/${raw}`,
  };
}

function normalizeMeetCode(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/meet\.google\.com\//, "")
    .replace(/^meet\.google\.com\//, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDisplayName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function isNumericLike(value) {
  const text = String(value || "").trim();
  return /^\d+$/.test(text);
}

function getParamValue(parameter) {
  if (parameter === undefined || parameter === null) return "";
  if (typeof parameter === "string" || typeof parameter === "number" || typeof parameter === "boolean") {
    return String(parameter);
  }
  if (typeof parameter !== "object") return "";
  if (parameter.value !== undefined && parameter.value !== null && parameter.value !== "") return String(parameter.value);
  if (parameter.intValue !== undefined && parameter.intValue !== null && parameter.intValue !== "") return String(parameter.intValue);
  if (parameter.boolValue !== undefined && parameter.boolValue !== null) return parameter.boolValue ? "true" : "false";
  if (Array.isArray(parameter.multiValue)) return parameter.multiValue.map((item) => String(item)).join(",");
  if (parameter.messageValue && typeof parameter.messageValue === "object") return JSON.stringify(parameter.messageValue);
  return "";
}

function getParameterCandidate(parameters, keys = []) {
  for (const key of keys) {
    const value = getParamValue(parameters.get(String(key).toLowerCase()));
    if (value) return value;
  }
  return "";
}

function getEventParameters(event) {
  const map = new Map();
  for (const parameter of Array.isArray(event?.parameters) ? event.parameters : []) {
    if (!parameter?.name) continue;
    map.set(String(parameter.name).toLowerCase(), getParamValue(parameter));
  }
  return map;
}

function getActivityTime(item, event) {
  return (
    item?.id?.time ||
    item?.id?.timeUsec ||
    event?.timestamp ||
    event?.time ||
    event?.startTime ||
    item?.time ||
    item?.timestamp ||
    new Date().toISOString()
  );
}

function getActivityParticipant(item, event, parameters) {
  const actor = item?.actor || event?.actor || {};
  const emailCandidate =
    getParameterCandidate(parameters, [
      "participant_email",
      "participantEmail",
      "participant_email_address",
      "email",
      "email_address",
      "user_email",
      "actor_email",
      "organizer_email",
      "identifier",
    ]) ||
    actor?.email ||
    actor?.callerEmail ||
    actor?.userEmail ||
    "";
  const identifier = normalizeEmail(
    emailCandidate
  );
  const identifierType = normalizeDisplayName(parameters.get("identifier_type") || "");
  const displayName = normalizeDisplayName(
    getParameterCandidate(parameters, [
      "display_name",
      "displayName",
      "participant_name",
      "participantName",
      "name",
    ]) ||
      actor?.profileName ||
      actor?.displayName ||
      actor?.name ||
      event?.actor?.displayName ||
      ""
  );
  const endpointId = normalizeDisplayName(
    getParameterCandidate(parameters, ["endpoint_id", "endpointId", "session_id", "sessionId"]) ||
      item?.id?.uniqueQualifier ||
      item?.id?.timeUsec ||
      ""
  );

  return {
    email: identifier.includes("@") ? identifier : "",
    displayName,
    endpointId,
    identifierType,
    participantKey: normalizeDisplayName(identifier.includes("@") ? identifier : endpointId || displayName),
  };
}

function buildAuditEventSearchTokens({ item, event, parameters }) {
  const rawValues = [
    item?.id?.applicationName,
    item?.id?.customerId,
    item?.id?.time,
    item?.id?.uniqueQualifier,
    event?.name,
    event?.type,
    ...parameters.values(),
  ];

  return uniqueValues(
    rawValues
      .flatMap((value) => {
        const text = String(value || "");
        if (!text) return [];
        const normalized = normalizeDisplayName(text);
        const compactMeet = normalizeMeetCode(text);
        return [normalized, compactMeet];
      })
      .filter(Boolean)
  );
}

function buildConferenceIdVariants(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const normalized = normalizeDisplayName(raw);
  const suffix = raw.includes("/") ? raw.split("/").pop() || "" : raw;
  const suffixNormalized = normalizeDisplayName(suffix);
  return uniqueValues([normalized, suffixNormalized].filter(Boolean));
}

function eventMatchesLecture({ item, event, parameters, lectureIdentifiers, conferenceRecordStartTime, conferenceRecordEndTime }) {
  const meetingCode = normalizeMeetCode(lectureIdentifiers?.meetingCode || "");
  const conferenceIdVariants = buildConferenceIdVariants(lectureIdentifiers?.conferenceId || "");
  const conferenceRecordVariants = buildConferenceIdVariants(lectureIdentifiers?.conferenceRecordName || "");
  const calendarEventId = normalizeDisplayName(lectureIdentifiers?.calendarEventId || "");
  const storedMeetLink = normalizeMeetCode(lectureIdentifiers?.storedMeetLink || "");
  const organizerEmail = normalizeEmail(lectureIdentifiers?.organizerEmail || "");
  const eventOrganizerEmail = normalizeEmail(getParameterCandidate(parameters, ["organizer_email", "organizerEmail"]) || item?.actor?.email || "");
  const eventTokens = buildAuditEventSearchTokens({ item, event, parameters });
  const inConferenceWindow = eventFallsWithinConferenceWindow(
    item,
    event,
    conferenceRecordStartTime,
    conferenceRecordEndTime
  );

  if (meetingCode && eventTokens.some((token) => token === meetingCode || token.includes(meetingCode))) {
    return true;
  }

  if (storedMeetLink && eventTokens.some((token) => token === storedMeetLink || token.includes(storedMeetLink))) {
    return true;
  }

  if (conferenceIdVariants.some((conferenceId) => eventTokens.some((token) => token === conferenceId || token.includes(conferenceId)))) {
    return true;
  }

  if (conferenceRecordVariants.some((conferenceRecordName) => eventTokens.some((token) => token === conferenceRecordName || token.includes(conferenceRecordName)))) {
    return true;
  }

  if (calendarEventId && eventTokens.some((token) => token === calendarEventId || token.includes(calendarEventId))) {
    return true;
  }

  if (organizerEmail && eventOrganizerEmail && organizerEmail === eventOrganizerEmail && inConferenceWindow) {
    return true;
  }

  return false;
}

function eventFallsWithinConferenceWindow(item, event, conferenceRecordStartTime, conferenceRecordEndTime) {
  const activityTime = new Date(getActivityTime(item, event));
  const start = new Date(conferenceRecordStartTime || 0);
  const end = new Date(conferenceRecordEndTime || 0);

  if (Number.isNaN(activityTime.getTime()) || Number.isNaN(start.getTime())) {
    return false;
  }

  const effectiveEnd = Number.isNaN(end.getTime())
    ? new Date(start.getTime() + 4 * 60 * 60 * 1000)
    : end;

  return (
    activityTime.getTime() >= start.getTime() - 15 * 60 * 1000 &&
    activityTime.getTime() <= effectiveEnd.getTime() + 15 * 60 * 1000
  );
}

function mergeAuditRecords(records) {
  const grouped = new Map();

  for (const record of records) {
    const key = normalizeDisplayName(
      record.participantKey || record.email || record.endpointId || record.displayName || ""
    );
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...record,
        joinedAt: record.joinedAt,
        leftAt: record.leftAt,
        durationMinutes: Number(record.durationMinutes || 0),
      });
      continue;
    }

    const existingJoined = existing.joinedAt ? new Date(existing.joinedAt).getTime() : Number.POSITIVE_INFINITY;
    const nextJoined = record.joinedAt ? new Date(record.joinedAt).getTime() : Number.POSITIVE_INFINITY;
    const existingLeft = existing.leftAt ? new Date(existing.leftAt).getTime() : 0;
    const nextLeft = record.leftAt ? new Date(record.leftAt).getTime() : 0;

    existing.joinedAt = nextJoined < existingJoined ? record.joinedAt : existing.joinedAt;
    existing.leftAt = nextLeft > existingLeft ? record.leftAt : existing.leftAt;
    existing.durationMinutes = Number(existing.durationMinutes || 0) + Number(record.durationMinutes || 0);
    if (!existing.participantEmail && record.participantEmail) existing.participantEmail = record.participantEmail;
    if (!existing.participantName && record.participantName) existing.participantName = record.participantName;
    if (!existing.googleParticipantId && record.googleParticipantId) existing.googleParticipantId = record.googleParticipantId;
    if (!existing.email && record.email) existing.email = record.email;
    if (!existing.displayName && record.displayName) existing.displayName = record.displayName;
    if (!existing.endpointId && record.endpointId) existing.endpointId = record.endpointId;
  }

  return [...grouped.values()];
}

function mergeMeetSessionAndAuditRecords(auditRecords = [], meetRecords = []) {
  const grouped = new Map();

  function getKey(record) {
    return normalizeDisplayName(
      normalizeEmail(record?.participantEmail || "") ||
      record?.googleParticipantId ||
      record?.endpointId ||
      record?.participantKey ||
      record?.participantName ||
      record?.displayName ||
      ""
    );
  }

  function upsert(record, source) {
    const key = getKey(record);
    if (!key) return;

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...record,
        _source: source,
      });
      return;
    }

    const existingJoined = existing.joinedAt ? new Date(existing.joinedAt).getTime() : Number.POSITIVE_INFINITY;
    const nextJoined = record.joinedAt ? new Date(record.joinedAt).getTime() : Number.POSITIVE_INFINITY;
    const existingLeft = existing.leftAt ? new Date(existing.leftAt).getTime() : 0;
    const nextLeft = record.leftAt ? new Date(record.leftAt).getTime() : 0;
    const existingDuration = Number(existing.durationMinutes || 0);
    const nextDuration = Number(record.durationMinutes || 0);

    grouped.set(key, {
      ...existing,
      ...record,
      participantEmail: existing.participantEmail || record.participantEmail || "",
      participantName: existing.participantName || record.participantName || existing.displayName || record.displayName || "",
      googleParticipantId: existing.googleParticipantId || record.googleParticipantId || "",
      googleSessionId: existing.googleSessionId || record.googleSessionId || "",
      joinedAt: nextJoined < existingJoined ? record.joinedAt : existing.joinedAt,
      leftAt: nextLeft > existingLeft ? record.leftAt : existing.leftAt,
      durationMinutes: Math.max(existingDuration, nextDuration),
      raw: existing.raw || record.raw,
      _source: existing._source === "audit" ? "audit" : source,
    });
  }

  for (const record of auditRecords) {
    upsert(record, "audit");
  }

  for (const record of meetRecords) {
    const directEmailMatch = record?.participantEmail
      ? auditRecords.find(
          (auditRecord) => normalizeEmail(auditRecord?.participantEmail || "") === normalizeEmail(record.participantEmail)
        )
      : null;
    const directNameMatch = !directEmailMatch && record?.participantName
      ? auditRecords.find(
          (auditRecord) => normalizeDisplayName(auditRecord?.participantName || "") === normalizeDisplayName(record.participantName)
        )
      : null;

    if (directEmailMatch || directNameMatch) {
      const matched = directEmailMatch || directNameMatch;
      upsert(
        {
          ...matched,
          participantEmail: matched.participantEmail || record.participantEmail || "",
          participantName: matched.participantName || record.participantName || "",
          googleParticipantId: record.googleParticipantId || matched.googleParticipantId || "",
          googleSessionId: record.googleSessionId || matched.googleSessionId || "",
          joinedAt: record.joinedAt || matched.joinedAt,
          leftAt: record.leftAt || matched.leftAt,
          durationMinutes: Math.max(Number(record.durationMinutes || 0), Number(matched.durationMinutes || 0)),
          raw: matched.raw || record.raw,
        },
        "audit"
      );
      continue;
    }

    upsert(record, "meet");
  }

  return [...grouped.values()];
}

function buildParticipantKey(record) {
  const email = normalizeEmail(record?.participantEmail || record?.email || "");
  const name = normalizeDisplayName(record?.participantName || record?.displayName || "");
  const endpointId = normalizeDisplayName(record?.googleParticipantId || record?.endpointId || "");
  return normalizeDisplayName(email || endpointId || name || record?.participantKey || "");
}

async function getMeetConferenceParticipantRecords(conferenceRecordName, impersonateUserEmail) {
  if (!conferenceRecordName) {
    return [];
  }

  try {
    const participantsPayload = await meetRequest(`/${conferenceRecordName}/participants`, {
      impersonateUserEmail,
    });
    const participants = participantsPayload?.participants || [];
    const records = [];

    for (const participant of participants) {
      const sessionsPayload = await meetRequest(`/${participant.name}/participantSessions`, {
        impersonateUserEmail,
      });
      const sessions = sessionsPayload?.participantSessions || [];

      for (const session of sessions) {
        records.push({
          participantKey:
            participant.name ||
            participant.participantKey ||
            participant.displayName ||
            getParticipantEmail(participant) ||
            getParticipantName(participant),
          participantEmail: getParticipantEmail(participant),
          participantName: getParticipantName(participant),
          googleParticipantId: participant.name || "",
          googleSessionId: session.name || "",
          joinedAt: session.startTime || null,
          leftAt: session.endTime || null,
          durationMinutes: durationMinutes(session.startTime, session.endTime),
          raw: { participant, session },
        });
      }
    }

    return aggregateRecords(records);
  } catch {
    return [];
  }
}

function durationFromAudit(parameterMap) {
  const seconds = Number(getParamValue(parameterMap.get("duration_seconds")) || 0);
  const millis = Number(getParamValue(parameterMap.get("duration_millis")) || 0);
  const minutes = Number(getParamValue(parameterMap.get("duration_minutes")) || 0);
  if (minutes) return minutes;
  if (seconds) return Math.round(seconds / 60);
  if (millis) return Math.round(millis / 60000);
  return 0;
}

async function getAdminReportsMeetAttendanceRecords({
  impersonateUserEmail,
  scheduledStart,
  scheduledEnd,
  conferenceRecordStartTime,
  conferenceRecordEndTime,
  lectureIdentifiers,
}) {
  const baseStart = new Date(conferenceRecordStartTime || scheduledStart || Date.now());
  const baseEnd = new Date(conferenceRecordEndTime || Date.now());
  const safeStart = Number.isNaN(baseStart.getTime()) ? new Date(scheduledStart || Date.now()) : baseStart;
  const safeEnd = Number.isNaN(baseEnd.getTime()) ? new Date((scheduledEnd ? new Date(scheduledEnd).getTime() : Date.now()) + 24 * 60 * 60000) : baseEnd;
  const startTime = new Date(safeStart.getTime() - 24 * 60 * 60000).toISOString();
  const endTime = new Date(safeEnd.getTime() + 24 * 60 * 60000).toISOString();
  const matchedRecords = [];
  const fallbackWindowRecords = [];
  const fallbackWindowIdentities = [];
  const identities = [];
  const sampleAuditParameters = [];
  const sampleEvents = [];
  let pageToken = "";
  let eventsReturned = 0;

  do {
    const searchParams = new URLSearchParams({
      startTime,
      endTime,
      maxResults: "1000",
    });
    if (pageToken) searchParams.set("pageToken", pageToken);
    const payload = await adminReportsRequest(`/activity/users/all/applications/meet?${searchParams.toString()}`, {
      impersonateUserEmail,
    });
    const items = Array.isArray(payload?.items) ? payload.items : [];

    for (const item of items) {
      const events = Array.isArray(item?.events) ? item.events : [];
      for (const event of events) {
        const parameters = getEventParameters(event);
        eventsReturned += 1;
        if (sampleEvents.length < 5) {
          sampleEvents.push({
            eventName: String(event?.name || event?.type || ""),
            itemTime: String(item?.id?.time || ""),
            tokens: buildAuditEventSearchTokens({ item, event, parameters }).slice(0, 20),
          });
        }
        const matchesLecture = eventMatchesLecture({
          item,
          event,
          parameters,
          lectureIdentifiers,
          conferenceRecordStartTime,
          conferenceRecordEndTime,
        });
        if (!matchesLecture) {
          continue;
        }
        if (sampleAuditParameters.length < 5) {
          sampleAuditParameters.push({
            eventName: String(event?.name || event?.type || ""),
            parameters: Object.fromEntries([...parameters.entries()].slice(0, 25)),
          });
        }
        const participant = getActivityParticipant(item, event, parameters);
        const joinedAt = getActivityTime(item, event);
        const participantEmail =
          (participant.identifierType === "email address" || participant.identifierType === "email_address" || participant.email
            ? participant.email
            : "") ||
          normalizeEmail(
            getParameterCandidate(parameters, [
              "identifier",
              "participant_email",
              "participantEmail",
              "email",
              "email_address",
              "user_email",
              "actor_email",
              "organizer_email",
            ]) || item?.actor?.email || item?.actor?.callerEmail || item?.actor?.profileId || ""
          );
        const participantName =
          participant.displayName ||
          normalizeDisplayName(
            getParameterCandidate(parameters, [
              "display_name",
              "displayName",
              "participant_name",
              "participantName",
              "name",
            ]) || item?.actor?.profileName || item?.actor?.displayName || item?.actor?.name || ""
          );
        const identifier = normalizeEmail(
          getParameterCandidate(parameters, ["identifier", "participant_email", "email", "email_address"]) || ""
        );
        const identifierType = normalizeDisplayName(
          getParameterCandidate(parameters, ["identifier_type"]) || participant.identifierType || ""
        );
        const currentRecord = {
          participantKey: buildParticipantKey({
            ...participant,
            participantEmail,
            participantName,
          }),
          participantEmail,
          participantName,
          googleParticipantId: participant.endpointId || "",
          googleSessionId: normalizeDisplayName(getParamValue(parameters.get("identifier")) || item?.id?.uniqueQualifier || ""),
          joinedAt,
          leftAt: null,
          durationMinutes: 0,
          raw: { item, event, parameters: Object.fromEntries(parameters.entries()), participant },
        };
        if ((identifierType === "email address" || identifierType === "email_address" || identifier.includes("@")) && identifier && participantName) {
          const identityRecord = {
            email: identifier,
            name: participantName,
            role: "participant",
            source: "admin_reports",
          };
          identities.push(identityRecord);
          if (
            eventFallsWithinConferenceWindow(item, event, conferenceRecordStartTime, conferenceRecordEndTime) &&
            normalizeEmail(getParameterCandidate(parameters, ["organizer_email"]) || "") === normalizeEmail(lectureIdentifiers?.organizerEmail || impersonateUserEmail || "")
          ) {
            fallbackWindowIdentities.push(identityRecord);
          }
        }
        const durationMinutes = durationFromAudit(parameters);
        const endTimeValue = (() => {
          const candidate = getParamValue(parameters.get("event_end_time")) || getParamValue(parameters.get("end_time"));
          if (candidate) return candidate;
          if (durationMinutes && joinedAt) return new Date(new Date(joinedAt).getTime() + durationMinutes * 60000).toISOString();
          return getActivityTime(item, event);
        })();
        const finalizedRecord = {
          ...currentRecord,
          leftAt: endTimeValue,
          durationMinutes,
        };

        matchedRecords.push(finalizedRecord);

        if (
          eventFallsWithinConferenceWindow(item, event, conferenceRecordStartTime, conferenceRecordEndTime) &&
          normalizeEmail(getParameterCandidate(parameters, ["organizer_email"]) || "") === normalizeEmail(lectureIdentifiers?.organizerEmail || impersonateUserEmail || "")
        ) {
          fallbackWindowRecords.push(finalizedRecord);
        }
      }
    }

    pageToken = String(payload?.nextPageToken || "");
  } while (pageToken);

  const effectiveRecords = matchedRecords.length ? matchedRecords : fallbackWindowRecords;
  const effectiveIdentities = identities.length ? identities : fallbackWindowIdentities;

  return {
    available: effectiveRecords.length > 0,
    records: mergeAuditRecords(effectiveRecords),
    identities: effectiveIdentities,
    sampleAuditParameters,
    sampleEvents,
    reports_api_called: true,
    reports_impersonated_email: impersonateUserEmail || "",
    reports_start_time: startTime,
    reports_end_time: endTime,
    conference_record_start_time: conferenceRecordStartTime || null,
    conference_record_end_time: conferenceRecordEndTime || null,
    scheduled_start: scheduledStart || null,
    scheduled_end: scheduledEnd || null,
    eventsReturned,
  };
}

function conferenceTimeValue(record) {
  return Math.max(
    new Date(record?.endTime || 0).getTime() || 0,
    new Date(record?.startTime || 0).getTime() || 0
  );
}

function selectBestConferenceRecord(records, scheduledStart, scheduledEnd) {
  const list = Array.isArray(records) ? records.filter(Boolean) : [];
  if (!list.length) return null;

  const targetStart = new Date(scheduledStart || 0).getTime();
  const targetEnd = new Date(scheduledEnd || 0).getTime();

  if (targetStart || targetEnd) {
    const target = targetStart || targetEnd;
    return [...list].sort((left, right) => {
      const leftDiff = Math.abs(conferenceTimeValue(left) - target);
      const rightDiff = Math.abs(conferenceTimeValue(right) - target);
      if (leftDiff !== rightDiff) return leftDiff - rightDiff;
      return conferenceTimeValue(right) - conferenceTimeValue(left);
    })[0];
  }

  return [...list].sort((left, right) => conferenceTimeValue(right) - conferenceTimeValue(left))[0];
}

export async function getMeetAttendanceRecords({
  meetSpaceId,
  scheduledStart,
  scheduledEnd,
  impersonateUserEmail,
  lectureIdentifiers = {},
}) {
  if (!meetSpaceId) {
    return { available: false, records: [], conferenceRecord: null, recordings: [] };
  }

  const identifiers = normalizeMeetIdentifiers(meetSpaceId);
  const filters = [
    identifiers.meetingCode ? `space.meeting_code = "${identifiers.meetingCode}"` : "",
    identifiers.spaceName ? `space.name = "${identifiers.spaceName}"` : "",
  ].filter(Boolean);

  let conferenceRecords = [];
  for (const filter of filters) {
    try {
      const payload = await meetRequest(`/conferenceRecords?filter=${encodeURIComponent(filter)}`, {
        impersonateUserEmail,
      });
      if (Array.isArray(payload?.conferenceRecords) && payload.conferenceRecords.length) {
        conferenceRecords = payload.conferenceRecords;
        break;
      }
    } catch {}
  }

  const conferenceRecord = selectBestConferenceRecord(
    conferenceRecords,
    scheduledStart,
    scheduledEnd
  );

  if (!conferenceRecord?.name) {
    return { available: false, records: [], conferenceRecord: null, recordings: [] };
  }

  const reportsAttendance = await getAdminReportsMeetAttendanceRecords({
    impersonateUserEmail,
    scheduledStart,
    scheduledEnd,
    conferenceRecordStartTime: conferenceRecord.startTime || null,
    conferenceRecordEndTime: conferenceRecord.endTime || null,
    lectureIdentifiers: {
      ...lectureIdentifiers,
      meetingCode: identifiers.meetingCode,
      conferenceId: conferenceRecord.name,
      conferenceRecordName: conferenceRecord.name,
    },
  });

  if (!reportsAttendance.available) {
    const fallbackRecords = await getMeetConferenceParticipantRecords(conferenceRecord.name, impersonateUserEmail);
    if (!fallbackRecords.length) {
      return {
        available: false,
        records: [],
        conferenceRecord,
        recordings: await getConferenceRecordings(conferenceRecord.name, impersonateUserEmail),
        reason: "no_matching_reports_data",
        partial: true,
        emails_available: false,
        eventsReturned: reportsAttendance.eventsReturned || 0,
        reportsIdentityCount: reportsAttendance.identities?.length || 0,
        reportsIdentities: reportsAttendance.identities || [],
        sampleAuditParameters: reportsAttendance.sampleAuditParameters || [],
        sampleEvents: reportsAttendance.sampleEvents || [],
        reports_api_called: true,
        reports_impersonated_email: reportsAttendance.reports_impersonated_email || impersonateUserEmail || "",
        reports_start_time: reportsAttendance.reports_start_time || null,
        reports_end_time: reportsAttendance.reports_end_time || null,
        conference_record_start_time: reportsAttendance.conference_record_start_time || conferenceRecord.startTime || null,
        conference_record_end_time: reportsAttendance.conference_record_end_time || conferenceRecord.endTime || null,
        scheduled_start: reportsAttendance.scheduled_start || scheduledStart || null,
        scheduled_end: reportsAttendance.scheduled_end || scheduledEnd || null,
        meetSessionCount: 0,
      };
    }

    return {
      available: true,
      records: fallbackRecords,
      conferenceRecord,
      recordings: await getConferenceRecordings(conferenceRecord.name, impersonateUserEmail),
      reason: "reports_unavailable_using_meet_fallback",
      eventsReturned: reportsAttendance.eventsReturned || 0,
      reportsIdentityCount: reportsAttendance.identities?.length || 0,
      reportsIdentities: reportsAttendance.identities || [],
      sampleAuditParameters: reportsAttendance.sampleAuditParameters || [],
      sampleEvents: reportsAttendance.sampleEvents || [],
      reports_api_called: true,
      reports_impersonated_email: reportsAttendance.reports_impersonated_email || impersonateUserEmail || "",
      reports_start_time: reportsAttendance.reports_start_time || null,
      reports_end_time: reportsAttendance.reports_end_time || null,
      conference_record_start_time: reportsAttendance.conference_record_start_time || conferenceRecord.startTime || null,
      conference_record_end_time: reportsAttendance.conference_record_end_time || conferenceRecord.endTime || null,
      scheduled_start: reportsAttendance.scheduled_start || scheduledStart || null,
      scheduled_end: reportsAttendance.scheduled_end || scheduledEnd || null,
      meetSessionCount: fallbackRecords.length,
    };
  }

  const fallbackRecords = await getMeetConferenceParticipantRecords(conferenceRecord.name, impersonateUserEmail);
  const records = mergeMeetSessionAndAuditRecords(
    mergeAuditRecords(reportsAttendance.records || []),
    fallbackRecords
  );

  return {
    available: true,
    records,
    conferenceRecord,
    recordings: await getConferenceRecordings(conferenceRecord.name, impersonateUserEmail),
    eventsReturned: reportsAttendance.eventsReturned || 0,
    reportsIdentityCount: reportsAttendance.identities?.length || 0,
    reportsIdentities: reportsAttendance.identities || [],
    sampleAuditParameters: reportsAttendance.sampleAuditParameters || [],
    sampleEvents: reportsAttendance.sampleEvents || [],
    reports_api_called: true,
    reports_impersonated_email: reportsAttendance.reports_impersonated_email || impersonateUserEmail || "",
    reports_start_time: reportsAttendance.reports_start_time || null,
    reports_end_time: reportsAttendance.reports_end_time || null,
    conference_record_start_time: reportsAttendance.conference_record_start_time || conferenceRecord.startTime || null,
    conference_record_end_time: reportsAttendance.conference_record_end_time || conferenceRecord.endTime || null,
    scheduled_start: reportsAttendance.scheduled_start || scheduledStart || null,
    scheduled_end: reportsAttendance.scheduled_end || scheduledEnd || null,
    meetSessionCount: fallbackRecords.length,
  };
}

export async function shareDriveFileWithUsers({ fileId, emails = [], impersonateUserEmail }) {
  const uniqueEmails = [...new Set((emails || []).map((item) => String(item || "").trim().toLowerCase()).filter((item) => item.includes("@")))];

  if (!fileId) {
    return { sharedWith: [], shareErrors: [], publicLinkEnabled: false };
  }

  const sharedWith = [];
  const shareErrors = [];
  for (const email of uniqueEmails) {
    try {
      await driveRequest(`/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
        method: "POST",
        impersonateUserEmail,
        body: {
          type: "user",
          role: "reader",
          emailAddress: email,
        },
      });
      sharedWith.push(email);
    } catch (error) {
      shareErrors.push({
        email,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let publicLinkEnabled = false;
  if (impersonateUserEmail) {
    try {
      await driveRequest(`/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
        method: "POST",
        impersonateUserEmail,
        body: {
          type: "anyone",
          role: "reader",
          allowFileDiscovery: false,
        },
      });
      publicLinkEnabled = true;
    } catch (error) {
      shareErrors.push({
        email: "*public-link*",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { sharedWith, shareErrors, publicLinkEnabled };
}
