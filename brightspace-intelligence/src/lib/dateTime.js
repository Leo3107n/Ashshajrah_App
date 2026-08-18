export const APP_TIMEZONE = "Asia/Karachi";

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const normalized = hasExplicitTimezone ? text : text.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDateString(value) {
  const date = asDate(value) || new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function localDateParts(value) {
  const date = asDate(value) || new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function formatDateTime(value) {
  const date = asDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatTimeRange(start, end) {
  const startDate = asDate(start);
  if (!startDate) return "";

  const options = { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit" };
  const startText = new Intl.DateTimeFormat("en-US", options).format(startDate);
  const endDate = asDate(end);

  if (!endDate) return startText;

  const endText = new Intl.DateTimeFormat("en-US", options).format(endDate);
  return `${startText} - ${endText}`;
}

export function formatDateTimeRange(start, end) {
  const startDate = asDate(start);
  if (!startDate) return "";

  const dateText = formatDateTime(startDate);
  const endDate = asDate(end);

  if (!endDate) return dateText;

  const endText = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(endDate);

  return `${dateText} - ${endText}`;
}

export function getDayRange(dateValue) {
  const dateString = typeof dateValue === "string" ? dateValue : localDateString(dateValue);
  const [year, month, day] = String(dateString).split("-").map(Number);

  if (!year || !month || !day) return null;

  const datePrefix = `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
  return {
    start: `${datePrefix} 00:00:00`,
    end: `${datePrefix} 23:59:59.999`,
  };
}

export function getCurrentWeekRange(dateValue = new Date()) {
  const stringParts = String(dateValue).split("-");
  const parts =
    typeof dateValue === "string"
      ? {
          year: stringParts[0],
          month: stringParts[1],
          day: stringParts[2],
          weekday: localDateParts(`${dateValue}T12:00:00.000+05:00`).weekday,
        }
      : localDateParts(dateValue);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  if (!year || !month || !day) return null;

  const weekdayIndex = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[parts.weekday] ?? 0;
  const mondayUtc = new Date(Date.UTC(year, month - 1, day - weekdayIndex));
  const sundayUtc = new Date(Date.UTC(year, month - 1, day - weekdayIndex + 6));

  return {
    start: getDayRange(mondayUtc.toISOString())?.start,
    end: getDayRange(sundayUtc.toISOString())?.end,
  };
}

export function getNextWeekRange(dateValue = new Date()) {
  const current = getCurrentWeekRange(dateValue);
  if (!current?.start) return null;

  const nextMonday = new Date(new Date(current.start).getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextSunday = new Date(nextMonday.getTime() + 6 * 24 * 60 * 60 * 1000);

  return {
    start: getDayRange(nextMonday)?.start,
    end: getDayRange(nextSunday)?.end,
  };
}

export function getMonthRange(dateValue = new Date()) {
  const dateString = typeof dateValue === "string" ? dateValue : localDateString(dateValue);
  const [year, month] = String(dateString).split("-").map(Number);

  if (!year || !month) return null;

  const firstDay = `${String(year).padStart(4, "0")}-${pad(month)}-01`;
  const lastDate = new Date(Date.UTC(year, month, 0));
  const lastDay = `${String(year).padStart(4, "0")}-${pad(month)}-${pad(lastDate.getUTCDate())}`;

  return {
    start: getDayRange(firstDay)?.start,
    end: getDayRange(lastDay)?.end,
  };
}

export function isJoinWindowOpen(start, end, nowValue = Date.now()) {
  const startDate = asDate(start);
  const endDate = asDate(end);
  const nowDate = asDate(nowValue) || new Date(nowValue);

  if (!startDate || !endDate || Number.isNaN(nowDate.getTime())) return false;

  const openBefore = Number(process.env.NEXT_PUBLIC_CLASS_JOIN_OPEN_BEFORE_MINUTES || 10) * 60 * 1000;
  const openAfter = Number(process.env.NEXT_PUBLIC_CLASS_JOIN_OPEN_AFTER_MINUTES || 0) * 60 * 1000;

  return nowDate.getTime() >= startDate.getTime() - openBefore && nowDate.getTime() <= endDate.getTime() + openAfter;
}
