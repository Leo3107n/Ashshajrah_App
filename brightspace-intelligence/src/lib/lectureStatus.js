const JOINABLE_DB_STATUSES = new Set(["scheduled", "upcoming", "live"]);
const FINAL_DB_STATUSES = new Set([
  "completed_by_teacher",
  "verified_by_coordinator",
  "missed",
  "cancelled",
  "rescheduled",
  "disputed",
]);

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = new Date(text.includes("T") ? text : text.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDbStatus(lecture) {
  return String(lecture?.status || lecture?.display_status || "").trim().toLowerCase();
}

export function getLectureDisplayStatus(lecture) {
  const dbStatus = getDbStatus(lecture);
  const start = parseDate(lecture?.scheduled_start);
  const end = parseDate(lecture?.scheduled_end);
  const now = new Date();

  if (dbStatus === "completed_by_teacher") return "completed";
  if (dbStatus === "verified_by_coordinator") return "verified";
  if (FINAL_DB_STATUSES.has(dbStatus)) return dbStatus;

  if (!start || !end) return dbStatus || "scheduled";
  const joinOpenBefore = Number(process.env.NEXT_PUBLIC_CLASS_JOIN_OPEN_BEFORE_MINUTES || 10) * 60 * 1000;
  const joinOpenAfter = Number(process.env.NEXT_PUBLIC_CLASS_JOIN_OPEN_AFTER_MINUTES || 0) * 60 * 1000;

  if (now < start.getTime() - joinOpenBefore) return "upcoming";
  if (now >= start.getTime() && now <= end.getTime()) return "live";
  if (now > end.getTime() + joinOpenAfter) return "ended";
  if (now >= start.getTime() - joinOpenBefore && now <= end.getTime() + joinOpenAfter) {
    return now < start.getTime() ? "upcoming" : "live";
  }

  return dbStatus || "scheduled";
}

export function matchesLectureStatusFilter(lecture, filterStatus) {
  const status = String(filterStatus || "").trim().toLowerCase();
  if (!status) return true;

  const displayStatus = getLectureDisplayStatus(lecture);
  const rawStatus = getDbStatus(lecture);

  if (["live", "upcoming", "ended"].includes(status)) {
    return displayStatus === status;
  }

  if (status === "completed") {
    return displayStatus === "completed" || rawStatus === "completed_by_teacher";
  }

  if (status === "verified") {
    return displayStatus === "verified" || rawStatus === "verified_by_coordinator";
  }

  if (FINAL_DB_STATUSES.has(status)) {
    return rawStatus === status || displayStatus === status;
  }

  return displayStatus === status || rawStatus === status;
}

export function canShowJoinMeet(lecture) {
  const dbStatus = getDbStatus(lecture);
  if (!lecture?.google_meet_link) return false;
  if (FINAL_DB_STATUSES.has(dbStatus)) return false;
  const displayStatus = getLectureDisplayStatus(lecture);
  if (displayStatus === "ended") return false;
  if (!JOINABLE_DB_STATUSES.has(dbStatus) && !["upcoming", "live"].includes(displayStatus)) {
    return false;
  }

  const start = parseDate(lecture?.scheduled_start);
  const end = parseDate(lecture?.scheduled_end);
  if (!start || !end) return false;

  const now = new Date();
  const openBefore = Number(process.env.NEXT_PUBLIC_CLASS_JOIN_OPEN_BEFORE_MINUTES || 10) * 60 * 1000;
  return now.getTime() >= start.getTime() - openBefore && now.getTime() <= end.getTime();
}

export function getLecturePrimaryLink(lecture) {
  const recordingUrl = lecture?.recording_drive_url || lecture?.recording?.url || "";
  const displayStatus = getLectureDisplayStatus(lecture);
  const dbStatus = getDbStatus(lecture);
  const hasEnded = displayStatus === "ended" || FINAL_DB_STATUSES.has(dbStatus);

  if (hasEnded && recordingUrl) {
    return {
      href: recordingUrl,
      label: "View recording",
      kind: "recording",
    };
  }

  if (canShowJoinMeet(lecture)) {
    return {
      href: lecture?.google_meet_link,
      label: "Join Class",
      kind: "meet",
    };
  }

  if (recordingUrl) {
    return {
      href: recordingUrl,
      label: "View recording",
      kind: "recording",
    };
  }

  return null;
}

export function getLectureEventDetailLink(lecture) {
  const recordingUrl = lecture?.recording_drive_url || lecture?.recording?.url || "";
  const dbStatus = getDbStatus(lecture);
  const end = parseDate(lecture?.scheduled_end);
  const now = new Date();
  const hasEnded = Boolean(end && now.getTime() > end.getTime()) || FINAL_DB_STATUSES.has(dbStatus);

  if (hasEnded && recordingUrl) {
    return {
      href: recordingUrl,
      label: "View recording",
      kind: "recording",
    };
  }

  if (!hasEnded && lecture?.google_meet_link) {
    return {
      href: lecture.google_meet_link,
      label: "Join Class",
      kind: "meet",
    };
  }

  return null;
}

export function getTeacherLectureActionLink(lecture) {
  const recordingUrl = lecture?.recording_drive_url || lecture?.recording?.url || "";
  const displayStatus = getLectureDisplayStatus(lecture);
  const dbStatus = getDbStatus(lecture);
  const hasEnded = displayStatus === "ended" || FINAL_DB_STATUSES.has(dbStatus);

  if (hasEnded && recordingUrl) {
    return {
      href: recordingUrl,
      label: "View recording",
      kind: "recording",
    };
  }

  if (["upcoming", "live", "scheduled"].includes(displayStatus) && lecture?.google_meet_link) {
    return {
      href: lecture.google_meet_link,
      label: "Join Class",
      kind: "meet",
    };
  }

  if (lecture?.google_meet_link && canShowJoinMeet(lecture)) {
    return {
      href: lecture.google_meet_link,
      label: "Join Class",
      kind: "meet",
    };
  }

  if (recordingUrl) {
    return {
      href: recordingUrl,
      label: "View recording",
      kind: "recording",
    };
  }

  return null;
}

export function canShowMarkConducted(lecture) {
  const dbStatus = getDbStatus(lecture);
  const displayStatus = getLectureDisplayStatus(lecture);
  if (FINAL_DB_STATUSES.has(dbStatus)) return false;
  if (!["scheduled", "upcoming", "live", "ended"].includes(dbStatus) && !["scheduled", "upcoming", "live", "ended"].includes(displayStatus)) return false;

  const end = parseDate(lecture?.scheduled_end);
  const start = parseDate(lecture?.scheduled_start);
  if (!start || !end) return false;

  const now = Date.now();
  if (now < start.getTime()) return false;
  return true;
}

export function getAttendanceStatus(durationMinutes) {
  const threshold = Number(process.env.LECTURE_PRESENT_THRESHOLD_MINUTES || 20);
  const duration = Number(durationMinutes || 0);

  if (!duration) return "absent";
  if (duration >= threshold) return "present";
  return "partial";
}
