/**
 * Dashboard dispatcher. Uses dedicated Admin, Super Admin, and Coordinator
 * homes, with a shared dashboard implementation for other roles.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../src/api";
import { useAuth } from "../../../src/context/AuthContext";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";
import CoordinatorHome from "../../../src/features/coordinator/CoordinatorHome";
import SuperAdminHome from "../../../src/features/superadmin/SuperAdminHome";
import AdminHome from "../../../src/features/admin/AdminHome";
import TeacherHome from "../../../src/features/teacher/TeacherHome";

function time(value) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function firstName(user) {
  return String(user?.name || user?.full_name || "Student").trim().split(/\s+/)[0];
}

function StudentHome() {
  const { user } = useAuth();
  const [data, setData] = useState({ stats: {}, headlines: [], lectures: [], notes: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [dashboard, calendar, timeline] = await Promise.all([
        api.student.dashboard(),
        api.student.calendarLectures({ range: "today" }),
        api.student.timeline({ range: "all" }),
      ]);
      setData({
        stats: dashboard?.stats || {},
        headlines: dashboard?.headlines || [],
        lectures: calendar?.items || [],
        notes: timeline?.notes || [],
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nextClass = useMemo(
    () => data.lectures.find((item) => ["live", "upcoming", "scheduled"].includes(String(item.display_status || item.status).toLowerCase())) || data.lectures[0],
    [data.lectures]
  );
  const stats = data.stats;
  const tiles = [
    ["Attendance", `${stats.attendance_percentage ?? 0}%`, "checkmark-circle-outline", "green"],
    ["Subjects", stats.total_subjects ?? 0, "book-outline", "gold"],
    ["Homework", `${stats.pending_homeworks ?? 0} Pending`, "clipboard-outline", "rose"],
    ["Fee Status", stats.fee_status_label || "Not Paid", "wallet-outline", "mint"],
  ];

  if (loading) {
    return <DashboardSkeleton message="Growing your dashboard..." />;
  }

  if (error) {
    return <Screen contentContainerStyle={styles.errorScreen}><SurfaceCard><Ionicons color={colors.error} name="cloud-offline-outline" size={32} /><AppText style={styles.errorTitle} variant="heading">We could not load your portal</AppText><AppText style={styles.errorBody}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard></Screen>;
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={colors.gold} colors={[colors.gold]} />}
    >
      <LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}>
        <AppText style={styles.eyebrow}>WELCOME BACK</AppText>
        <AppText style={styles.greeting} variant="display">Salaam, {firstName(user)}!</AppText>
        <AppText style={styles.heroBody}>Deep roots, endless growth.</AppText>
      </LinearGradient>

      <SurfaceCard style={styles.nextCard}>
        <View style={styles.nextTop}>
          <View>
            <AppText style={styles.nextLabel}>☆ NEXT CLASS</AppText>
            <AppText style={styles.nextTitle} variant="title">{nextClass?.subject_name || nextClass?.title || "No class scheduled"}</AppText>
            <AppText style={styles.teacher}>{nextClass?.teacher_name ? `with ${nextClass.teacher_name}` : "Enjoy your open study time"}</AppText>
          </View>
          <StatusChip tone="success">{nextClass ? String(nextClass.display_status || "Upcoming").toUpperCase() : "CLEAR"}</StatusChip>
        </View>
        {nextClass ? <View style={styles.metaRow}><Meta icon="time-outline" text={`Today, ${time(nextClass.scheduled_start)}`} /><Meta icon={nextClass.google_meet_link ? "videocam-outline" : "location-outline"} text={nextClass.google_meet_link ? "Virtual Class" : nextClass.class_level || "Classroom"} /></View> : null}
        {nextClass?.google_meet_link ? <PillButton icon={<Ionicons color={colors.white} name="videocam-outline" size={18} />} onPress={() => Linking.openURL(nextClass.google_meet_link)} style={styles.join}>Join Class</PillButton> : null}
      </SurfaceCard>

      <View style={styles.tiles}>
        {tiles.map(([label, value, icon, tone]) => <StatTile icon={icon} key={label} label={label} tone={tone} value={value} />)}
      </View>

      <SectionHeader title="Today’s Schedule" />
      <View style={styles.list}>
        {data.lectures.length ? data.lectures.slice(0, 4).map((lecture, index) => (
          <View key={lecture.id || index} style={[styles.schedule, String(lecture.display_status).toLowerCase() === "live" ? styles.scheduleActive : null]}>
            <View style={[styles.dot, index % 2 ? styles.dotGold : null]} />
            <View style={styles.scheduleText}><AppText style={styles.subject}>{lecture.subject_name || lecture.title}</AppText><AppText style={styles.scheduleTime}>{time(lecture.scheduled_start)} – {time(lecture.scheduled_end)}</AppText></View>
            <Ionicons color={colors.outline} name="chevron-forward" size={18} />
          </View>
        )) : <EmptyRow icon="calendar-outline" text="No lectures scheduled for today." />}
      </View>

      <SectionHeader title="Recent Notes" />
      {data.notes.length ? data.notes.slice(-2).reverse().map((note, index) => (
        <View key={note.id || index} style={styles.note}>
          <View style={styles.noteAvatar}><AppText style={styles.noteInitial}>{String(note.teacher_name || "T")[0]}</AppText></View>
          <View style={styles.noteBody}><AppText style={styles.noteTeacher}>{note.teacher_name || "Teacher"}</AppText><AppText numberOfLines={3} style={styles.noteText}>“{note.note}”</AppText></View>
        </View>
      )) : <EmptyRow icon="chatbubble-ellipses-outline" text="No recent teacher notes." />}
    </Screen>
  );
}

function Meta({ icon, text }) {
  return <View style={styles.meta}><Ionicons color={colors.onSurfaceVariant} name={icon} size={15} /><AppText style={styles.metaText}>{text}</AppText></View>;
}

function StatTile({ icon, label, tone, value }) {
  return <View style={styles.tile}><View style={[styles.tileIcon, styles[`${tone}Tone`]]}><Ionicons color={colors.primary} name={icon} size={19} /></View><AppText style={styles.tileLabel}>{label}</AppText><AppText numberOfLines={2} style={styles.tileValue}>{String(value)}</AppText></View>;
}

function SectionHeader({ title }) {
  return <View style={styles.sectionHeader}><AppText style={styles.sectionTitle}>{title}</AppText><AppText style={styles.viewAll}>View All →</AppText></View>;
}

function EmptyRow({ icon, text }) {
  return <View style={styles.empty}><Ionicons color={colors.outline} name={icon} size={21} /><AppText style={styles.emptyText}>{text}</AppText></View>;
}

function OtherRoleHome() {
  const { role, user } = useAuth();
  return <Screen contentContainerStyle={styles.content}><LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}><AppText style={styles.eyebrow}>{role.toUpperCase()} PORTAL</AppText><AppText style={styles.greeting} variant="display">Salaam, {firstName(user)}!</AppText><AppText style={styles.heroBody}>Your workspace is rooted in clarity and growth.</AppText></LinearGradient><SurfaceCard><AppText variant="heading">Welcome to Ash-Shajrah</AppText><AppText style={styles.otherBody}>Use the navigation below to continue managing your portal.</AppText></SurfaceCard></Screen>;
}

export default function Dashboard() {
  const { role } = useAuth();
  // Each completed operational role receives its own dashboard component.
  // Keeping dispatch here preserves one protected route while avoiding a
  // single component filled with cross-role API and permission conditions.
  if (role === "student") return <StudentHome />;
  if (role === "coordinator") return <CoordinatorHome />;
  if (role === "superadmin") return <SuperAdminHome />;
  if (role === "admin") return <AdminHome />;
  if (role === "teacher") return <TeacherHome />;
  return <OtherRoleHome />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.md },
  hero: { padding: space.xl, borderRadius: radius["2xl"], ...shadows.hero },
  eyebrow: { color: "#B9EEDB", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2 },
  greeting: { marginTop: space.xs, color: colors.white, fontSize: 27, lineHeight: 34 },
  heroBody: { marginTop: space.xs, color: "#D6E9E2", fontSize: fontSize.sm },
  nextCard: { marginTop: -5, marginHorizontal: space.sm, borderLeftWidth: 4, borderLeftColor: colors.gold },
  nextTop: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  nextLabel: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  nextTitle: { marginTop: space.xs, fontSize: fontSize.base },
  teacher: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.md },
  meta: { flexDirection: "row", alignItems: "center" },
  metaText: { marginLeft: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  join: { marginTop: space.md },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xl },
  tile: { width: "48.5%", minHeight: 112, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  tileIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17 },
  greenTone: { backgroundColor: "#D1FAE5" }, goldTone: { backgroundColor: colors.goldPale }, roseTone: { backgroundColor: colors.roseBg }, mintTone: { backgroundColor: "#DDF4EA" },
  tileLabel: { marginTop: space.sm, color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: 10, textTransform: "uppercase" },
  tileValue: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  viewAll: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  list: { gap: space.sm },
  schedule: { minHeight: 62, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  scheduleActive: { backgroundColor: colors.goldPale },
  dot: { width: 10, height: 10, marginRight: space.md, borderRadius: 5, backgroundColor: colors.emeraldLight },
  dotGold: { backgroundColor: colors.gold },
  scheduleText: { flex: 1 }, subject: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm }, scheduleTime: { color: colors.outline, fontSize: fontSize.xs },
  note: { flexDirection: "row", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  noteAvatar: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#B9EEDB" },
  noteInitial: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  noteBody: { flex: 1, marginLeft: space.sm }, noteTeacher: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs }, noteText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  empty: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  emptyText: { marginLeft: space.sm, color: colors.outline, fontSize: fontSize.xs },
  errorScreen: { justifyContent: "center" }, errorTitle: { marginTop: space.md }, errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant }, retry: { marginTop: space.lg },
  otherBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
});
