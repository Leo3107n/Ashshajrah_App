/**
 * Student landing dashboard. It combines the protected Student overview,
 * today's timetable, teacher notes, announcements, and personal notifications
 * while keeping every action inside the Student route boundary.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import {
  AppText,
  DashboardSkeleton,
  PillButton,
  Screen,
  StatusChip,
  SurfaceCard,
} from "../../components/ui";
import {
  colors,
  fonts,
  fontSize,
  radius,
  shadows,
  space,
} from "../../theme";

function firstName(user) {
  return String(user?.name || user?.full_name || "Student")
    .trim()
    .split(/\s+/)[0];
}

function time(value) {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function readable(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function feeTone(status) {
  const value = String(status || "").toLowerCase();
  if (value === "verified") return "success";
  if (value === "pending") return "warning";
  if (value === "rejected") return "danger";
  return "neutral";
}

export default function StudentHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState({
    stats: {},
    headlines: [],
    lectures: [],
    notes: [],
    notifications: [],
    notificationSummary: {},
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const go = useCallback(
    (section) => router.push(`/(app)/student/${section}`),
    [router]
  );

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const [dashboard, calendar, timeline, notifications] = await Promise.all([
        api.student.dashboard(),
        api.student.calendarLectures({ range: "today" }),
        api.student.timeline({ range: "all" }),
        api.shared.notifications.list({ limit: 5 }),
      ]);

      setData({
        stats: dashboard?.stats || {},
        headlines: dashboard?.headlines || [],
        lectures: calendar?.items || [],
        notes: timeline?.notes || [],
        notifications: notifications?.items || [],
        notificationSummary: notifications?.summary || {},
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const nextClass = useMemo(
    () =>
      data.lectures.find((item) =>
        ["live", "upcoming", "scheduled"].includes(
          String(item.display_status || item.status).toLowerCase()
        )
      ) || data.lectures[0],
    [data.lectures]
  );

  const tiles = [
    {
      label: "Attendance",
      value: `${data.stats.attendance_percentage ?? 0}%`,
      icon: "checkmark-circle-outline",
      tone: "green",
      section: "attendance",
    },
    {
      label: "Subjects",
      value: data.stats.total_subjects ?? 0,
      icon: "book-outline",
      tone: "gold",
      section: "classes",
    },
    {
      label: "Homework",
      value: `${data.stats.pending_homeworks ?? 0} Pending`,
      icon: "clipboard-outline",
      tone: "rose",
      section: "homework",
    },
    {
      label: "Fee Status",
      value: data.stats.fee_status_label || "Not Paid",
      icon: "wallet-outline",
      tone: "mint",
      section: "fees",
    },
  ];

  if (loading) {
    return <DashboardSkeleton message="Growing your dashboard..." />;
  }

  if (error) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <SurfaceCard>
          <Ionicons
            color={colors.error}
            name="cloud-offline-outline"
            size={32}
          />
          <AppText style={styles.errorTitle} variant="heading">
            We could not load your portal
          </AppText>
          <AppText style={styles.errorBody}>{error}</AppText>
          <PillButton onPress={() => load()} style={styles.retry}>
            Try Again
          </PillButton>
        </SurfaceCard>
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[colors.gold]}
          onRefresh={() => load({ refresh: true })}
          refreshing={refreshing}
          tintColor={colors.gold}
        />
      }
    >
      <LinearGradient
        colors={[colors.primaryContainer, "#0D5C48"]}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <AppText style={styles.eyebrow}>WELCOME BACK</AppText>
            <AppText style={styles.greeting} variant="display">
              Salaam, {firstName(user)}!
            </AppText>
            <AppText style={styles.heroBody}>
              Deep roots, endless growth.
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Open notifications"
            onPress={() => go("notifications")}
            style={styles.bell}
          >
            <Ionicons color={colors.white} name="notifications-outline" size={21} />
            {Number(data.notificationSummary.unread || 0) > 0 ? (
              <View style={styles.unreadDot} />
            ) : null}
          </Pressable>
        </View>
      </LinearGradient>

      <Pressable onPress={() => go("lectures")}>
        <SurfaceCard style={styles.nextCard}>
          <View style={styles.nextTop}>
            <View style={styles.nextCopy}>
              <AppText style={styles.nextLabel}>NEXT CLASS</AppText>
              <AppText style={styles.nextTitle} variant="title">
                {nextClass?.subject_name ||
                  nextClass?.title ||
                  "No class scheduled"}
              </AppText>
              <AppText style={styles.teacher}>
                {nextClass?.teacher_name
                  ? `with ${nextClass.teacher_name}`
                  : "Enjoy your open study time"}
              </AppText>
            </View>
            <StatusChip tone="success">
              {nextClass
                ? readable(nextClass.display_status || nextClass.status)
                : "Clear"}
            </StatusChip>
          </View>
          {nextClass ? (
            <View style={styles.metaRow}>
              <Meta
                icon="time-outline"
                text={`Today, ${time(nextClass.scheduled_start)}`}
              />
              <Meta
                icon={
                  nextClass.google_meet_link
                    ? "videocam-outline"
                    : "location-outline"
                }
                text={
                  nextClass.google_meet_link
                    ? "Virtual Class"
                    : nextClass.class_level || "Classroom"
                }
              />
            </View>
          ) : null}
          {nextClass?.google_meet_link ? (
            <PillButton
              icon={
                <Ionicons color={colors.white} name="videocam-outline" size={18} />
              }
              onPress={() => Linking.openURL(nextClass.google_meet_link)}
              style={styles.join}
            >
              Join Class
            </PillButton>
          ) : null}
        </SurfaceCard>
      </Pressable>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <StatTile key={tile.label} onPress={() => go(tile.section)} {...tile} />
        ))}
      </View>

      <SectionHeader onPress={() => go("calendar")} title="Today's Schedule" />
      <View style={styles.list}>
        {data.lectures.length ? (
          data.lectures.slice(0, 4).map((lecture, index) => (
            <Pressable
              key={lecture.id || index}
              onPress={() => go("calendar")}
              style={[
                styles.schedule,
                String(lecture.display_status).toLowerCase() === "live"
                  ? styles.scheduleActive
                  : null,
              ]}
            >
              <View style={[styles.dot, index % 2 ? styles.dotGold : null]} />
              <View style={styles.scheduleText}>
                <AppText style={styles.subject}>
                  {lecture.subject_name || lecture.title}
                </AppText>
                <AppText style={styles.scheduleTime}>
                  {time(lecture.scheduled_start)} – {time(lecture.scheduled_end)}
                </AppText>
              </View>
              <Ionicons color={colors.outline} name="chevron-forward" size={18} />
            </Pressable>
          ))
        ) : (
          <EmptyRow
            icon="calendar-outline"
            text="No lectures scheduled for today."
          />
        )}
      </View>

      <SectionHeader onPress={() => go("notes")} title="Recent Notes" />
      {data.notes.length ? (
        data.notes
          .slice(-2)
          .reverse()
          .map((note, index) => (
            <Pressable
              key={note.id || index}
              onPress={() => go("notes")}
              style={styles.note}
            >
              <View style={styles.noteAvatar}>
                <AppText style={styles.noteInitial}>
                  {String(note.teacher_name || "T")[0]}
                </AppText>
              </View>
              <View style={styles.noteBody}>
                <AppText style={styles.noteTeacher}>
                  {note.teacher_name || "Teacher"}
                </AppText>
                <AppText numberOfLines={3} style={styles.noteText}>
                  “{note.note}”
                </AppText>
              </View>
            </Pressable>
          ))
      ) : (
        <EmptyRow
          icon="chatbubble-ellipses-outline"
          text="No recent teacher notes."
        />
      )}

      <SectionHeader title="Announcements" />
      <View style={styles.stack}>
        {data.headlines.length ? (
          data.headlines.slice(0, 3).map((item, index) => (
            <View key={item.id || index} style={styles.announcement}>
              <View style={styles.announcementIcon}>
                <Ionicons color={colors.secondary} name="megaphone-outline" size={18} />
              </View>
              <View style={styles.announcementBody}>
                <AppText style={styles.announcementTitle}>
                  {item.headline || item.title || "Announcement"}
                </AppText>
                <AppText numberOfLines={3} style={styles.announcementText}>
                  {item.message ||
                    item.content ||
                    item.description ||
                    (item.end_date ? `Active until ${item.end_date}` : "")}
                </AppText>
              </View>
            </View>
          ))
        ) : (
          <EmptyRow icon="megaphone-outline" text="No active announcements." />
        )}
      </View>

      <SectionHeader
        badge={data.notificationSummary.unread}
        onPress={() => go("notifications")}
        title="Notifications"
      />
      <View style={styles.stack}>
        {data.notifications.length ? (
          data.notifications.slice(0, 3).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => go("notifications")}
              style={styles.notification}
            >
              <View
                style={[
                  styles.notificationIcon,
                  !item.is_read && styles.notificationUnread,
                ]}
              >
                <Ionicons
                  color={colors.primary}
                  name={item.is_read ? "notifications-outline" : "notifications"}
                  size={18}
                />
              </View>
              <View style={styles.notificationBody}>
                <AppText numberOfLines={1} style={styles.notificationTitle}>
                  {item.title || readable(item.type) || "Notification"}
                </AppText>
                <AppText numberOfLines={2} style={styles.notificationText}>
                  {item.message}
                </AppText>
              </View>
            </Pressable>
          ))
        ) : (
          <EmptyRow
            icon="notifications-outline"
            text="You're all caught up."
          />
        )}
      </View>
    </Screen>
  );
}

function Meta({ icon, text }) {
  return (
    <View style={styles.meta}>
      <Ionicons color={colors.onSurfaceVariant} name={icon} size={15} />
      <AppText style={styles.metaText}>{text}</AppText>
    </View>
  );
}

function StatTile({ icon, label, onPress, tone, value }) {
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <View style={[styles.tileIcon, styles[`${tone}Tone`]]}>
        <Ionicons color={colors.primary} name={icon} size={19} />
      </View>
      <AppText style={styles.tileLabel}>{label}</AppText>
      <AppText numberOfLines={2} style={styles.tileValue}>
        {String(value)}
      </AppText>
      <Ionicons
        color={colors.outline}
        name="arrow-forward-outline"
        size={15}
        style={styles.tileArrow}
      />
    </Pressable>
  );
}

function SectionHeader({ badge, onPress, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <AppText style={styles.sectionTitle}>{title}</AppText>
        {Number(badge || 0) > 0 ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{badge}</AppText>
          </View>
        ) : null}
      </View>
      {onPress ? (
        <Pressable accessibilityLabel={`View all ${title}`} onPress={onPress}>
          <AppText style={styles.viewAll}>View All →</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyRow({ icon, text }) {
  return (
    <View style={styles.empty}>
      <Ionicons color={colors.outline} name={icon} size={21} />
      <AppText style={styles.emptyText}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.xl },
  hero: { padding: space.xl, borderRadius: radius["2xl"], ...shadows.hero },
  heroTop: { flexDirection: "row", alignItems: "flex-start" },
  heroCopy: { flex: 1 },
  eyebrow: {
    color: "#B9EEDB",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  greeting: {
    marginTop: space.xs,
    color: colors.white,
    fontSize: 27,
    lineHeight: 34,
  },
  heroBody: { marginTop: space.xs, color: "#D6E9E2", fontSize: fontSize.sm },
  bell: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  unreadDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderWidth: 1.5,
    borderColor: colors.primaryContainer,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  nextCard: {
    marginTop: space.md,
    marginHorizontal: space.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  nextTop: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  nextCopy: { flex: 1 },
  nextLabel: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  nextTitle: { marginTop: space.xs, fontSize: fontSize.base },
  teacher: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.md },
  meta: { flexDirection: "row", alignItems: "center" },
  metaText: { marginLeft: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  join: { marginTop: space.md },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xl },
  tile: {
    width: "48.5%",
    minHeight: 120,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceLow,
  },
  tileIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  greenTone: { backgroundColor: "#D1FAE5" },
  goldTone: { backgroundColor: colors.goldPale },
  roseTone: { backgroundColor: colors.roseBg },
  mintTone: { backgroundColor: "#DDF4EA" },
  tileLabel: {
    marginTop: space.sm,
    color: colors.onSurfaceVariant,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: "uppercase",
  },
  tileValue: { paddingRight: 16, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  tileArrow: { position: "absolute", right: space.md, bottom: space.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  badge: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: space.sm,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.secondaryContainer,
  },
  badgeText: { color: colors.onSecondaryContainer, fontFamily: fonts.bodyBold, fontSize: 9 },
  viewAll: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  list: { gap: space.sm },
  stack: { gap: space.sm },
  schedule: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  scheduleActive: { backgroundColor: colors.goldPale },
  dot: {
    width: 10,
    height: 10,
    marginRight: space.md,
    borderRadius: 5,
    backgroundColor: colors.emeraldLight,
  },
  dotGold: { backgroundColor: colors.gold },
  scheduleText: { flex: 1 },
  subject: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  scheduleTime: { color: colors.outline, fontSize: fontSize.xs },
  note: {
    flexDirection: "row",
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
  },
  noteAvatar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#B9EEDB",
  },
  noteInitial: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  noteBody: { flex: 1, marginLeft: space.sm },
  noteTeacher: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  noteText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  announcement: {
    flexDirection: "row",
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  announcementIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.goldPale,
  },
  announcementBody: { flex: 1, marginLeft: space.sm },
  announcementTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  announcementText: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  notification: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
  },
  notificationIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  notificationUnread: { backgroundColor: colors.goldPale },
  notificationBody: { flex: 1, marginLeft: space.sm },
  notificationTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  notificationText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
  },
  emptyText: { marginLeft: space.sm, color: colors.outline, fontSize: fontSize.xs },
  errorScreen: { justifyContent: "center" },
  errorTitle: { marginTop: space.md },
  errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
  retry: { marginTop: space.lg },
});
