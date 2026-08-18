import { isJoinWindowOpen } from "@/lib/dateTime";

export function getLectureJoinState(lecture, nowValue = Date.now()) {
  const start = new Date(lecture?.scheduled_start || lecture?.scheduledStart);
  const end = new Date(lecture?.scheduled_end || lecture?.scheduledEnd);

  if (!lecture?.google_meet_link || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { canJoin: false, label: "Meet link unavailable" };
  }

  const now = typeof nowValue === "number" ? nowValue : new Date(nowValue).getTime();
  const openBefore = Number(process.env.NEXT_PUBLIC_CLASS_JOIN_OPEN_BEFORE_MINUTES || 10) * 60000;
  const opensAt = start.getTime() - openBefore;
  const closesAt = end.getTime();

  if (now < opensAt) {
    return { canJoin: false, label: "Class not open yet" };
  }

  if (now > closesAt) {
    return { canJoin: false, label: "Class ended" };
  }

  return { canJoin: isJoinWindowOpen(start, end, now), label: "Join Google Meet" };
}
