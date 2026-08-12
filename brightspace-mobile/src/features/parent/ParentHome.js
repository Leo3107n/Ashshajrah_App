/**
 * Parent home dashboard. Shows an overview of each child's academic status —
 * upcoming classes, homework, attendance, and fee standing — sourced entirely
 * from the Parent-scoped API so no student or teacher data leaks across roles.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import {
  AppText,
  DashboardSkeleton,
  PillButton,
  Screen,
  StatusChip,
  SurfaceCard,
} from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function firstName(user) {
  return String(user?.name || user?.full_name || "Parent").trim().split(/\s+/)[0];
}

function time(value) {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function readable(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function feeTone(status) {
  const value = String(status || "").toLowerCase();
  if (["verified", "approved", "paid"].includes(value)) return "success";
  if (["submitted", "pending"].includes(value)) return "warning";
  if (["rejected", "overdue"].includes(value)) return "danger";
  return "neutral";
}

function attendanceTone(value) {
  const pct = Number(value || 0);
  if (pct >= 80) return "success";
  if (pct >= 60) return "warning";
  return "danger";
}

function childDisplayName(child) {
  return String(child?.full_name || child?.name || "Child").trim();
}

function childLectures(child) {
  return Array.isArray(child?.today_lectures) ? child.today_lectures : [];
}

function feeDeadlineBanner(children) {
  const missed = (Array.isArray(children) ? children : [])
    .filter((child) => child?.fee_deadline_missed)
    .sort((left, right) => {
      const leftTime = left?.fee_due_date ? new Date(left.fee_due_date).getTime() : Number.POSITIVE_INFINITY;
      const rightTime = right?.fee_due_date ? new Date(right.fee_due_date).getTime() : Number.POSITIVE_INFINITY;
      return leftTime - rightTime;
    })[0];

  if (!missed) return null;

  const parsed = missed.fee_due_date ? new Date(missed.fee_due_date) : null;
  const dueLabel = parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
    : "";

  return dueLabel
    ? `Fee Deadline was ${dueLabel}.`
    : "Fee Deadline is missed.";
}

export default function ParentHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState({
    children: [],
    headlines: [],
    notifications: [],
    notificationSummary: {},
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const deadlineBanner = useMemo(() => feeDeadlineBanner(data.children), [data.children]);

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [dashboard, notifications] = await Promise.all([
        api.parent.dashboard(),
        api.shared.notifications.list({ limit: 5 }),
      ]);
      setData({
        children: dashboard?.children || [],
        headlines: dashboard?.headlines || [],
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

  useEffect(() => { load(); }, [load]);

  if (loading) return <DashboardSkeleton message="Preparing your parent portal..." />;

  if (error) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <SurfaceCard>
          <Ionicons color={colors.error} name="cloud-offline-outline" size={32} />
          <AppText style={styles.errorTitle} variant="heading">Dashboard unavailable</AppText>
          <AppText style={styles.errorBody}>{error}</AppText>
          <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
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
      <LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <AppText style={styles.eyebrow}>PARENT PORTAL</AppText>
            <AppText style={styles.greeting} variant="display">
              Salaam, {firstName(user)}!
            </AppText>
            <AppText style={styles.heroBody}>
              Stay close to your child's learning journey.
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Open notifications"
            onPress={() => router.push("/(app)/parent/profile")}
            style={styles.bell}
          >
            <Ionicons color={colors.white} name="notifications-outline" size={21} />
            {Number(data.notificationSummary.unread || 0) > 0 ? (
              <View style={styles.unreadDot} />
            ) : null}
          </Pressable>
        </View>
      </LinearGradient>

      {deadlineBanner ? (
        <SurfaceCard style={styles.deadlineBanner}>
          <Ionicons color={colors.error} name="alert-circle-outline" size={20} />
          <AppText style={styles.deadlineBannerText}>{deadlineBanner}</AppText>
        </SurfaceCard>
      ) : null}

      {/* Children cards */}
      <SectionHeader title={`${data.children.length} ${data.children.length === 1 ? "Child" : "Children"}`} />
      {data.children.length ? (
        data.children.map((child) => (
          <ChildCard
            child={child}
            key={child.id || childDisplayName(child)}
            onCalendar={() => router.push("/(app)/parent/calendar")}
            onFees={() => router.push("/(app)/parent/fees")}
          />
        ))
      ) : (
        <SurfaceCard style={styles.empty}>
          <Ionicons color={colors.secondary} name="people-outline" size={28} />
          <AppText style={styles.emptyTitle}>No enrolled children</AppText>
          <AppText style={styles.emptyText}>
            Your children's academic profiles will appear here once they are enrolled.
          </AppText>
        </SurfaceCard>
      )}

      {/* Quick actions */}
      <SectionHeader title="Quick Access" />
      <View style={styles.quickActions}>
        <QuickAction
          icon="calendar-outline"
          label="Calendar"
          onPress={() => router.push("/(app)/parent/calendar")}
        />
        <QuickAction
          icon="wallet-outline"
          label="Fees"
          onPress={() => router.push("/(app)/parent/fees")}
        />
        <QuickAction
          icon="checkmark-circle-outline"
          label="Attendance"
          onPress={() => router.push("/(app)/parent/attendance")}
        />
        <QuickAction
          icon="book-outline"
          label="Homework"
          onPress={() => router.push("/(app)/parent/homework")}
        />
        <QuickAction
          icon="videocam-outline"
          label="Lectures"
          onPress={() => router.push("/(app)/parent/lectures")}
        />
        <QuickAction
          icon="chatbubbles-outline"
          label="Notes"
          onPress={() => router.push("/(app)/parent/notes")}
        />
        <QuickAction
          icon="person-outline"
          label="Profile"
          onPress={() => router.push("/(app)/parent/profile")}
        />
      </View>

      {/* Announcements */}
      {data.headlines.length ? (
        <>
          <SectionHeader title="Announcements" />
          <View style={styles.stack}>
            {data.headlines.slice(0, 3).map((item, index) => (
              <View key={item.id || index} style={styles.announcement}>
                <View style={styles.announcementIcon}>
                  <Ionicons color={colors.secondary} name="megaphone-outline" size={18} />
                </View>
                <View style={styles.announcementBody}>
                  <AppText style={styles.announcementTitle}>
                    {item.headline || item.title || "Announcement"}
                  </AppText>
                  <AppText numberOfLines={3} style={styles.announcementText}>
                    {item.message || item.content || item.description || ""}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function ChildCard({ child, onCalendar, onFees }) {
  const attendancePct = Number(child.attendance_percentage || 0);
  const pendingHomework = Number(child.pending_homeworks || 0);
  const feeStatus = String(child.fee_status || "").toLowerCase();
  const displayName = childDisplayName(child);
  const lectures = childLectures(child);

  const nextLecture = useMemo(
    () =>
      lectures.find((item) =>
        ["live", "upcoming", "scheduled"].includes(String(item.display_status || item.status).toLowerCase())
      ) || lectures[0],
    [lectures]
  );

  return (
    <SurfaceCard style={styles.childCard}>
      {/* Child header */}
      <View style={styles.childHeader}>
        <View style={styles.childAvatar}>
          <AppText style={styles.childInitial}>
            {displayName[0].toUpperCase()}
          </AppText>
        </View>
        <View style={styles.childCopy}>
          <AppText style={styles.childName}>{displayName}</AppText>
          <AppText style={styles.childClass}>
            {child.course_title || child.class_level || "Enrolled student"}
          </AppText>
        </View>
        <StatusChip tone={feeTone(feeStatus)}>
          {child.fee_status_label || readable(feeStatus) || "Fees"}
        </StatusChip>
      </View>

      {/* Stats row */}
      <View style={styles.childStats}>
        <Stat
          icon="checkmark-circle-outline"
          label="Attendance"
          tone={attendanceTone(attendancePct)}
          value={`${attendancePct}%`}
        />
        <Stat
          icon="book-outline"
          label="Subjects"
          tone="neutral"
          value={String(child.total_subjects || 0)}
        />
        <Stat
          icon="clipboard-outline"
          label="Homework"
          tone={pendingHomework > 0 ? "warning" : "success"}
          value={`${pendingHomework} pending`}
        />
      </View>

      {/* Next class */}
      {nextLecture ? (
        <Pressable onPress={onCalendar} style={styles.nextLecture}>
          <View style={styles.nextDot} />
          <View style={styles.nextCopy}>
            <AppText style={styles.nextSubject}>
              {nextLecture.subject_name || nextLecture.title || "Class"}
            </AppText>
            <AppText style={styles.nextTime}>
              Today, {time(nextLecture.scheduled_start)} · {nextLecture.teacher_name || "Teacher"}
            </AppText>
          </View>
          <StatusChip tone="warning">
            {readable(nextLecture.display_status || nextLecture.status)}
          </StatusChip>
        </Pressable>
      ) : (
        <View style={styles.noCLass}>
          <Ionicons color={colors.outline} name="calendar-clear-outline" size={15} />
          <AppText style={styles.noClassText}>No classes scheduled today</AppText>
        </View>
      )}

      {/* Actions */}
      <View style={styles.childActions}>
        <Pressable onPress={onCalendar} style={styles.childAction}>
          <Ionicons color={colors.secondary} name="calendar-outline" size={16} />
          <AppText style={styles.childActionText}>Schedule</AppText>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable onPress={onFees} style={styles.childAction}>
          <Ionicons color={colors.secondary} name="wallet-outline" size={16} />
          <AppText style={styles.childActionText}>Fees</AppText>
        </Pressable>
      </View>
    </SurfaceCard>
  );
}

function Stat({ icon, label, tone, value }) {
  const bgColors = {
    success: "#D1FAE5",
    warning: colors.goldPale,
    danger: colors.errorContainer,
    neutral: colors.surfaceLow,
  };
  return (
    <View style={[styles.stat, { backgroundColor: bgColors[tone] || bgColors.neutral }]}>
      <Ionicons color={colors.primary} name={icon} size={16} />
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

function SectionHeader({ title }) {
  return (
    <AppText style={styles.sectionTitle}>{title}</AppText>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.quick}>
      <View style={styles.quickIcon}>
        <Ionicons color={colors.secondary} name={icon} size={22} />
      </View>
      <AppText style={styles.quickLabel}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.xl },
  hero: { padding: space.xl, borderRadius: radius["2xl"], ...shadows.hero },
  heroTop: { flexDirection: "row", alignItems: "flex-start" },
  heroCopy: { flex: 1 },
  eyebrow: { color: "#B9EEDB", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2 },
  greeting: { marginTop: space.xs, color: colors.white, fontSize: 27, lineHeight: 34 },
  heroBody: { marginTop: space.xs, color: "#D6E9E2", fontSize: fontSize.sm },
  bell: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(255,255,255,0.12)" },
  unreadDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderWidth: 1.5, borderColor: colors.primaryContainer, borderRadius: 4, backgroundColor: colors.gold },
  deadlineBanner: { flexDirection: "row", alignItems: "center", marginTop: space.md, backgroundColor: colors.errorContainer, borderColor: colors.error, borderWidth: 1 },
  deadlineBannerText: { flex: 1, marginLeft: space.sm, color: colors.error, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  sectionTitle: { marginTop: space.xl, marginBottom: space.sm, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  childCard: { marginBottom: space.md },
  childHeader: { flexDirection: "row", alignItems: "center" },
  childAvatar: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "#B9EEDB" },
  childInitial: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.xl },
  childCopy: { flex: 1, marginHorizontal: space.sm },
  childName: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  childClass: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  childStats: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  stat: { flex: 1, alignItems: "center", padding: space.sm, borderRadius: radius.lg },
  statValue: { marginTop: 3, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs, textAlign: "center" },
  statLabel: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: 8, textTransform: "uppercase", textAlign: "center" },
  nextLecture: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  nextDot: { width: 9, height: 9, marginRight: space.md, borderRadius: 5, backgroundColor: colors.gold },
  nextCopy: { flex: 1 },
  nextSubject: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  nextTime: { color: colors.onSurfaceVariant, fontSize: 9 },
  noCLass: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.sm },
  noClassText: { marginLeft: space.sm, color: colors.outline, fontSize: fontSize.xs },
  childActions: { flexDirection: "row", marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderGreen },
  childAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs },
  childActionText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  actionDivider: { width: 1, backgroundColor: colors.borderGreen },
  empty: { alignItems: "center", paddingVertical: space.xl },
  emptyTitle: { marginTop: space.md, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyText: { marginTop: space.xs, color: colors.onSurfaceVariant, textAlign: "center", fontSize: fontSize.xs },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  quick: { width: "31%", minHeight: 86, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  quickIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.goldPale },
  quickLabel: { marginTop: space.xs, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 10 },
  stack: { gap: space.sm },
  announcement: { flexDirection: "row", padding: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, backgroundColor: colors.surface },
  announcementIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.goldPale },
  announcementBody: { flex: 1, marginLeft: space.sm },
  announcementTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  announcementText: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  errorScreen: { justifyContent: "center" },
  errorTitle: { marginTop: space.md },
  errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
  retry: { marginTop: space.lg },
});
