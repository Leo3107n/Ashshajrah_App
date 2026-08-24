/**
 * Builds react-native-calendars marks for the selected Day, Week, or Month.
 * Lecture dots are merged into the range highlight instead of being replaced.
 */
function dateFromKey(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function selectedRange(selectedDate, period) {
  const selected = dateFromKey(selectedDate);
  if (!selected) return [];

  let start = new Date(selected);
  let end = new Date(selected);

  if (period === "selected_week") {
    // Match the backend's Monday-to-Sunday week calculation.
    const daysSinceMonday = (selected.getDay() + 6) % 7;
    start.setDate(selected.getDate() - daysSinceMonday);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else if (period === "selected_month") {
    start = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
    end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 12);
  }

  const dates = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(dateKey(cursor));
  }
  return dates;
}

export function buildCalendarMarks(markedDates, selectedDate, period, palette) {
  const marks = {};

  for (const item of Array.isArray(markedDates) ? markedDates : []) {
    const key = typeof item === "string" ? item : item?.date;
    if (!key) continue;
    marks[key] = {
      marked: true,
      dotColor: palette.dotColor,
      selectedDotColor: palette.dotColor,
    };
  }

  for (const key of selectedRange(selectedDate, period)) {
    marks[key] = {
      ...(marks[key] || {}),
      selected: true,
      selectedColor: palette.selectionColor,
      selectedTextColor: palette.selectedTextColor,
    };
  }

  return marks;
}
