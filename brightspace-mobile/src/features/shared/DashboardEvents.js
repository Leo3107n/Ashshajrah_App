/**
 * Compact dashboard event feed shared by Student and Parent portals. Events
 * remain scoped by the backend: public events are published school events and
 * internal events are returned only when the signed-in user is an attendee.
 */
import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { AppText, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, space } from "../../theme";

const PUBLIC_EVENTS_URL = "https://ashshajrah.com/events";

function eventSlug(item) {
  const provided = String(item?.slug || "").trim();
  if (provided) return provided;
  return String(item?.title || "event")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "event";
}

function registrationUrl(item) {
  return `${PUBLIC_EVENTS_URL}/${encodeURIComponent(eventSlug(item))}`;
}

function eventTimestamp(item) {
  return new Date(item?.starts_at || 0).getTime();
}

function eventEndTimestamp(item) {
  const value = new Date(item?.ends_at || item?.starts_at || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function orderDashboardEvents(items) {
  const now = Date.now();
  const seen = new Set();
  const unique = [];

  for (const item of Array.isArray(items) ? items : []) {
    const key = String(item?.id || item?.raw_id || `${item?.type}-${item?.title}-${item?.starts_at}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.sort((left, right) => {
    const leftTime = eventTimestamp(left);
    const rightTime = eventTimestamp(right);
    const leftUpcoming = leftTime >= now;
    const rightUpcoming = rightTime >= now;
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
    return leftUpcoming ? leftTime - rightTime : rightTime - leftTime;
  });
}

function eventDate(item) {
  const value = new Date(item?.starts_at || "");
  if (Number.isNaN(value.getTime())) return "Date not available";
  return value.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionState(item) {
  const startsAt = new Date(item?.starts_at || "");
  const now = new Date();
  const sameDay = !Number.isNaN(startsAt.getTime())
    && startsAt.getFullYear() === now.getFullYear()
    && startsAt.getMonth() === now.getMonth()
    && startsAt.getDate() === now.getDate();
  const recording = Boolean(item?.recording_drive_url);
  return {
    canRegister: item?.type === "public" && startsAt.getTime() > now.getTime(),
    canJoin: sameDay && !recording && Boolean(item?.meet_link),
    canWatch: recording,
  };
}

export default function DashboardEvents({ events, onViewCalendar }) {
  // The dashboard is a forward-looking summary. Completed events remain in
  // Calendar > Events, where recordings can be opened using date filters.
  const visibleEvents = orderDashboardEvents(events)
    .filter((item) => eventEndTimestamp(item) >= Date.now())
    .slice(0, 3);
  if (!visibleEvents.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View>
          <AppText style={styles.eyebrow}>SCHOOL CALENDAR</AppText>
          <AppText style={styles.title}>Events</AppText>
        </View>
        <Pressable onPress={onViewCalendar} style={styles.calendarLink}>
          <AppText style={styles.calendarLinkText}>View Calendar</AppText>
          <Ionicons color={colors.secondary} name="arrow-forward" size={16} />
        </Pressable>
      </View>

      {visibleEvents.map((item) => {
        const action = actionState(item);
        return (
          <SurfaceCard key={item.id || item.raw_id} style={styles.card}>
            <View style={styles.icon}>
              <Ionicons
                color={colors.secondary}
                name={item.type === "internal" ? "people-outline" : "megaphone-outline"}
                size={20}
              />
            </View>
            <View style={styles.body}>
              <View style={styles.topRow}>
                <AppText numberOfLines={2} style={styles.eventTitle}>{item.title || "School Event"}</AppText>
                <StatusChip tone={item.type === "internal" ? "warning" : "success"}>
                  {item.type === "internal" ? "Internal" : "Public"}
                </StatusChip>
              </View>
              <AppText style={styles.date}>{eventDate(item)}</AppText>
              {item.description ? <AppText numberOfLines={2} style={styles.description}>{item.description}</AppText> : null}
              {action.canRegister ? (
                <EventAction
                  icon="create-outline"
                  label="Register for Event"
                  onPress={() => Linking.openURL(registrationUrl(item))}
                  primary
                />
              ) : null}
              {action.canJoin ? (
                <EventAction icon="videocam-outline" label="Join Event" onPress={() => Linking.openURL(item.meet_link)} />
              ) : null}
              {action.canWatch ? (
                <EventAction icon="play-circle-outline" label="Watch Recording" onPress={() => Linking.openURL(item.recording_drive_url)} />
              ) : null}
            </View>
          </SurfaceCard>
        );
      })}
    </View>
  );
}

function EventAction({ icon, label, onPress, primary = false }) {
  return (
    <Pressable onPress={onPress} style={[styles.action, primary && styles.actionPrimary]}>
      <Ionicons color={primary ? colors.white : colors.secondary} name={icon} size={17} />
      <AppText style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  heading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: space.sm },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.4 },
  title: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.xl, marginTop: 2 },
  calendarLink: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: space.xs },
  calendarLinkText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  card: { flexDirection: "row", gap: space.sm, padding: space.md },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: colors.goldPale },
  body: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  eventTitle: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.md },
  date: { marginTop: 3, color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  description: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.sm, lineHeight: 19 },
  action: {
    alignSelf: "flex-start",
    height: 42,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  actionText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  actionPrimary: { borderColor: colors.primary, backgroundColor: colors.primary },
  actionTextPrimary: { color: colors.white },
});
