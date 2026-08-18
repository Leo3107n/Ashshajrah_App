import crypto from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_SERVICE_CALENDAR_ID || "primary";
}

function shouldUseCalendarAttendees() {
  return String(process.env.GOOGLE_USE_CALENDAR_ATTENDEES || "false").toLowerCase() === "true";
}

function getFallbackMeetLink() {
  return String(process.env.GOOGLE_FALLBACK_MEET_LINK || process.env.NEXT_PUBLIC_FALLBACK_MEET_LINK || "").trim();
}

function assertValidMeetLink(value) {
  if (!value) return "";

  try {
    const url = new URL(value);
    const isGoogleMeet = url.protocol === "https:" && url.hostname === "meet.google.com";

    if (!isGoogleMeet) {
      throw new Error("Fallback link must be a Google Meet URL.");
    }

    return url.toString();
  } catch {
    throw new Error("GOOGLE_FALLBACK_MEET_LINK must be a valid https://meet.google.com/... URL.");
  }
}

export function extractMeetCodeFromLink(value) {
  const meetLink = assertValidMeetLink(value);

  if (!meetLink) {
    return "";
  }

  try {
    const url = new URL(meetLink);
    return String(url.pathname || "")
      .replace(/^\/+/, "")
      .split("/")[0]
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGoogleAccessToken(impersonateUserEmail) {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  if (impersonateUserEmail) {
    payload.sub = impersonateUserEmail;
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
    throw new Error(`Google auth failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function calendarRequest(path, options = {}) {
  const accessToken = await getGoogleAccessToken(options.impersonateUserEmail);
  const response = await fetch(`${GOOGLE_CALENDAR_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text();
    let message = responseText;

    try {
      const payload = JSON.parse(responseText);
      message = payload?.error?.message || responseText;
    } catch {}

    throw new Error(`Google Calendar request failed (${response.status}): ${message}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function getCalendarConferenceTypes(calendarId, impersonateUserEmail) {
  const calendar = await calendarRequest(`/calendars/${calendarId}`, {
    impersonateUserEmail,
  });
  return calendar?.conferenceProperties?.allowedConferenceSolutionTypes || [];
}

function buildEventPayload(payload, includeConferenceData = true) {
  const attendees = Array.isArray(payload?.attendees)
    ? payload.attendees
        .filter((item) => item?.email && String(item.email).includes("@"))
        .map((item) => ({ email: String(item.email).trim(), displayName: item.name || undefined }))
    : [];
  const start = new Date(payload.start);
  const end = new Date(payload.end);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid Google Calendar date/time payload.");
  }

  function toCalendarLocalDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid Google Calendar local date/time payload.");
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  const eventPayload = {
    summary: payload.title,
    description: payload.description || "",
    start: { dateTime: toCalendarLocalDateTime(start), timeZone: payload.timeZone || "Asia/Karachi" },
    end: { dateTime: toCalendarLocalDateTime(end), timeZone: payload.timeZone || "Asia/Karachi" },
    conferenceData: includeConferenceData
      ? {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        }
      : undefined,
  };

  if (attendees.length) {
    eventPayload.attendees = attendees;
  }

  return eventPayload;
}

export async function createCalendarLectureEvent(payload) {
  const organizerEmail = String(payload?.organizerEmail || "").trim();
  const calendarId = encodeURIComponent(organizerEmail || getCalendarId());
  const allowedTypes = await getCalendarConferenceTypes(calendarId, organizerEmail || undefined);
  const canCreateMeet = allowedTypes.includes("hangoutsMeet");
  const fallbackMeetLink = assertValidMeetLink(getFallbackMeetLink());

  if (!canCreateMeet && !fallbackMeetLink) {
    throw new Error(
      `Google Calendar cannot create Meet links for this calendar. Allowed conference types: ${allowedTypes.join(", ") || "none"}. Set GOOGLE_FALLBACK_MEET_LINK or use a Google Workspace calendar with Meet enabled.`
    );
  }

  const data = await calendarRequest(
    `/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: "POST",
      body: JSON.stringify(buildEventPayload(payload, canCreateMeet)),
      impersonateUserEmail: organizerEmail || undefined,
    }
  );

  const videoEntryPoint = data?.conferenceData?.entryPoints?.find((entry) => entry?.entryPointType === "video");

  return {
    eventId: data?.id || "",
    meetLink: data?.hangoutLink || videoEntryPoint?.uri || fallbackMeetLink,
    meetSpaceId:
      data?.conferenceData?.conferenceId ||
      extractMeetCodeFromLink(data?.hangoutLink || videoEntryPoint?.uri || fallbackMeetLink),
    eventHtmlLink: data?.htmlLink || "",
  };
}

export async function updateCalendarLectureEvent(eventId, payload) {
  if (!eventId) {
    return null;
  }

  const organizerEmail = String(payload?.organizerEmail || "").trim();
  const calendarId = encodeURIComponent(organizerEmail || getCalendarId());
  const fallbackMeetLink = assertValidMeetLink(getFallbackMeetLink());
  const data = await calendarRequest(
    `/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: "PATCH",
      body: JSON.stringify(buildEventPayload(payload, false)),
      impersonateUserEmail: organizerEmail || undefined,
    }
  );

  const videoEntryPoint = data?.conferenceData?.entryPoints?.find((entry) => entry?.entryPointType === "video");

  return {
    eventId: data?.id || eventId,
    meetLink: data?.hangoutLink || videoEntryPoint?.uri || fallbackMeetLink,
    meetSpaceId:
      data?.conferenceData?.conferenceId ||
      extractMeetCodeFromLink(data?.hangoutLink || videoEntryPoint?.uri || fallbackMeetLink),
    eventHtmlLink: data?.htmlLink || "",
  };
}

export async function getCalendarLectureEvent(eventId, organizerEmail) {
  if (!eventId) {
    return null;
  }

  const calendarId = encodeURIComponent(String(organizerEmail || "").trim() || getCalendarId());
  const data = await calendarRequest(
    `/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
    {
      impersonateUserEmail: organizerEmail || undefined,
    }
  );

  return {
    id: data?.id || "",
    organizer: {
      email: String(data?.organizer?.email || "").trim().toLowerCase(),
      displayName: String(data?.organizer?.displayName || "").trim(),
    },
    creator: {
      email: String(data?.creator?.email || "").trim().toLowerCase(),
      displayName: String(data?.creator?.displayName || "").trim(),
    },
    attendees: Array.isArray(data?.attendees)
      ? data.attendees.map((item) => ({
          email: String(item?.email || "").trim().toLowerCase(),
          displayName: String(item?.displayName || "").trim(),
          responseStatus: String(item?.responseStatus || "").trim(),
        }))
      : [],
  };
}

export async function cancelCalendarLectureEvent(eventId, organizerEmail) {
  if (!eventId) {
    return null;
  }

  const calendarId = encodeURIComponent(String(organizerEmail || "").trim() || getCalendarId());

  return calendarRequest(`/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    impersonateUserEmail: organizerEmail || undefined,
  });
}
