/** Coordinator home summarizing admissions, payments, and lecture operations. */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function firstName(user) {
  return String(user?.name || user?.full_name || "Coordinator").trim().split(/\s+/)[0];
}

function friendlyDate(value) {
  if (!value) return "Recently";
  return new Date(value).toLocaleDateString([], { day: "numeric", month: "short" });
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();
  if (["approved", "active", "verified", "completed"].includes(value)) return "success";
  if (["rejected", "cancelled", "suspended"].includes(value)) return "danger";
  return "warning";
}

export default function CoordinatorHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setDashboard(await api.coordinator.dashboard());
    } catch (nextError) {
      setError(nextError?.message || "Unable to load the coordinator dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <DashboardSkeleton message="Preparing your workspace..." />;
  }

  if (error) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <SurfaceCard>
          <Ionicons color={colors.error} name="cloud-offline-outline" size={32} />
          <AppText style={styles.errorTitle} variant="heading">Workspace unavailable</AppText>
          <AppText style={styles.errorBody}>{error}</AppText>
          <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
        </SurfaceCard>
      </Screen>
    );
  }

  const stats = dashboard?.stats || {};
  const cards = [
    ["Registrations", stats.totalRegistrations || 0, "people-outline", "mint"],
    ["New Leads", stats.newLeads || 0, "person-add-outline", "gold"],
    ["Pending Payments", stats.pendingPaymentVerifications || 0, "wallet-outline", "rose"],
    ["Active Students", stats.activeStudents || 0, "school-outline", "blue"],
  ];

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
    >
      <LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}>
        <AppText style={styles.eyebrow}>COORDINATOR WORKSPACE</AppText>
        <AppText style={styles.greeting} variant="display">Salaam, {firstName(user)}!</AppText>
        <AppText style={styles.heroBody}>Guide every learner from admission to achievement.</AppText>
      </LinearGradient>

      <View style={styles.stats}>
        {cards.map(([label, value, icon, tone]) => (
          <View key={label} style={styles.statCard}>
            <View style={[styles.statIcon, styles[`${tone}Tone`]]}>
              <Ionicons color={colors.primary} name={icon} size={20} />
            </View>
            <AppText style={styles.statValue}>{String(value)}</AppText>
            <AppText style={styles.statLabel}>{label}</AppText>
          </View>
        ))}
      </View>

      <View style={styles.quickActions}>
        <QuickAction icon="person-add-outline" label="Admissions" onPress={() => router.push("/(app)/coordinator/admissions")} />
        <QuickAction icon="wallet-outline" label="Payments" onPress={() => router.push("/(app)/coordinator/payments")} />
        <QuickAction icon="document-text-outline" label="Vouchers" onPress={() => router.push("/(app)/coordinator/payments")} />
      </View>

      <SectionTitle action="View All →" onPress={() => router.push("/(app)/coordinator/admissions")} title="Recent Admissions" />
      <View style={styles.list}>
        {(dashboard?.recentLeads || []).length ? dashboard.recentLeads.slice(0, 4).map((lead) => (
          <Pressable key={lead.id} onPress={() => router.push("/(app)/coordinator/admissions")} style={styles.row}>
            <View style={styles.avatar}><AppText style={styles.avatarText}>{String(lead.student_name || "S")[0]}</AppText></View>
            <View style={styles.rowBody}>
              <AppText numberOfLines={1} style={styles.rowTitle}>{lead.student_name || "Student application"}</AppText>
              <AppText numberOfLines={1} style={styles.rowMeta}>{lead.parent_name || "Parent not provided"} · {friendlyDate(lead.created_at)}</AppText>
            </View>
            <StatusChip tone={statusTone(lead.status)}>{String(lead.status || "pending").replaceAll("_", " ")}</StatusChip>
          </Pressable>
        )) : <EmptyRow icon="people-outline" text="No recent admission leads." />}
      </View>

      <SectionTitle title="Operations Snapshot" />
      <SurfaceCard style={styles.operations}>
        <Operation icon="mail-outline" label="Interview links sent" value={stats.parentInterviewSent || 0} />
        <View style={styles.divider} />
        <Operation icon="document-attach-outline" label="Pending vouchers" value={stats.pendingVouchers || 0} />
        <View style={styles.divider} />
        <Operation icon="checkmark-done-outline" label="Lectures needing approval" value={stats.lectureNeedsApproval || 0} />
      </SurfaceCard>

      <SectionTitle title="Recent Lectures" />
      <View style={styles.list}>
        {(dashboard?.recentLectures || []).length ? dashboard.recentLectures.slice(0, 3).map((lecture, index) => (
          <View key={lecture.id || index} style={styles.lecture}>
            <View style={[styles.lectureMark, index % 2 ? styles.goldMark : null]} />
            <View style={styles.rowBody}>
              <AppText numberOfLines={1} style={styles.rowTitle}>{lecture.subject_name || lecture.title || "Lecture"}</AppText>
              <AppText numberOfLines={1} style={styles.rowMeta}>{lecture.teacher_name || "Teacher"} · {lecture.class_name || "Class"}</AppText>
            </View>
            <StatusChip tone={statusTone(lecture.status)}>{String(lecture.status || "scheduled").replaceAll("_", " ")}</StatusChip>
          </View>
        )) : <EmptyRow icon="calendar-outline" text="No recent lectures." />}
      </View>
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed ? styles.pressed : null]}>
      <View style={styles.quickIcon}><Ionicons color={colors.secondary} name={icon} size={22} /></View>
      <AppText style={styles.quickLabel}>{label}</AppText>
    </Pressable>
  );
}

function SectionTitle({ action, onPress, title }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText style={styles.sectionTitle}>{title}</AppText>
      {action ? <Pressable onPress={onPress}><AppText style={styles.action}>{action}</AppText></Pressable> : null}
    </View>
  );
}

function Operation({ icon, label, value }) {
  return <View style={styles.operation}><Ionicons color={colors.emeraldMid} name={icon} size={20} /><AppText style={styles.operationLabel}>{label}</AppText><AppText style={styles.operationValue}>{String(value)}</AppText></View>;
}

function EmptyRow({ icon, text }) {
  return <View style={styles.empty}><Ionicons color={colors.outline} name={icon} size={21} /><AppText style={styles.emptyText}>{text}</AppText></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.md },
  hero: { padding: space.xl, borderRadius: radius["2xl"], ...shadows.hero },
  eyebrow: { color: "#B9EEDB", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2 },
  greeting: { marginTop: space.xs, color: colors.white, fontSize: 27, lineHeight: 34 },
  heroBody: { marginTop: space.xs, color: "#D6E9E2", fontSize: fontSize.sm },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  statCard: { width: "48.5%", minHeight: 120, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  statIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  mintTone: { backgroundColor: "#DDF4EA" }, goldTone: { backgroundColor: colors.goldPale }, roseTone: { backgroundColor: colors.roseBg }, blueTone: { backgroundColor: colors.statusScheduledBg },
  statValue: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.xl },
  statLabel: { color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: 10, textTransform: "uppercase" },
  quickActions: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  quick: { flex: 1, minHeight: 86, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  quickIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.goldPale },
  quickLabel: { marginTop: space.xs, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 10 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  action: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  list: { gap: space.sm },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#B9EEDB" },
  avatarText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  rowBody: { flex: 1, marginHorizontal: space.sm },
  rowTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  rowMeta: { color: colors.outline, fontSize: fontSize.xs },
  operations: { paddingVertical: space.xs },
  operation: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: space.md },
  operationLabel: { flex: 1, marginLeft: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  operationValue: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  divider: { height: 1, marginLeft: 48, backgroundColor: colors.borderGreen },
  lecture: { minHeight: 66, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  lectureMark: { width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: colors.emeraldLight },
  goldMark: { backgroundColor: colors.gold },
  empty: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  emptyText: { marginLeft: space.sm, color: colors.outline, fontSize: fontSize.xs },
  errorScreen: { justifyContent: "center" },
  errorTitle: { marginTop: space.md },
  errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
  retry: { marginTop: space.lg },
});
