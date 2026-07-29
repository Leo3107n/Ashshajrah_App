import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function firstName(user) {
  return String(user?.name || user?.full_name || "Admin").trim().split(/\s+/)[0];
}

function readable(value) {
  return String(value || "pending").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tone(status) {
  const value = String(status || "").toLowerCase();
  if (["active", "approved", "verified", "completed", "paid"].includes(value)) return "success";
  if (["rejected", "suspended", "cancelled", "failed"].includes(value)) return "danger";
  return "warning";
}

export default function AdminHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setData(await api.admin.stats());
    } catch (nextError) {
      setError(nextError?.message || "Unable to load the Admin overview.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><Ionicons color={colors.gold} name="leaf-outline" size={34} /><AppText style={styles.loading}>Preparing your workspace...</AppText></View>;
  }

  if (error) {
    return <Screen contentContainerStyle={styles.errorScreen}><SurfaceCard><Ionicons color={colors.error} name="cloud-offline-outline" size={32} /><AppText style={styles.errorTitle} variant="heading">Overview unavailable</AppText><AppText style={styles.errorBody}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard></Screen>;
  }

  const overview = data?.overview || {};
  const recent = data?.recent || {};
  const cards = [
    ["Students", overview.totalStudents || 0, "school-outline", "mint"],
    ["Teachers", overview.totalTeachers || 0, "person-outline", "gold"],
    ["New Admissions", overview.newRegistrationLeads || 0, "person-add-outline", "rose"],
    ["Payments", overview.totalFeeSubmissions || 0, "wallet-outline", "blue"],
  ];

  return (
    <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
      <LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}>
        <AppText style={styles.eyebrow}>ADMIN OVERVIEW</AppText>
        <AppText style={styles.greeting} variant="display">Salaam, {firstName(user)}!</AppText>
        <AppText style={styles.heroBody}>Keep daily learning operations clear, connected, and moving forward.</AppText>
      </LinearGradient>

      <View style={styles.stats}>
        {cards.map(([title, value, icon, cardTone]) => <View key={title} style={styles.statCard}><View style={[styles.statIcon, styles[`${cardTone}Tone`]]}><Ionicons color={colors.primary} name={icon} size={20} /></View><AppText style={styles.statValue}>{String(value)}</AppText><AppText style={styles.statLabel}>{title}</AppText></View>)}
      </View>

      <View style={styles.quickActions}>
        <QuickAction icon="people-outline" label="Users" onPress={() => router.push("/(app)/admin/users")} />
        <QuickAction icon="school-outline" label="Academics" onPress={() => router.push("/(app)/admin/academics")} />
        <QuickAction icon="person-add-outline" label="Admissions" onPress={() => router.push("/(app)/admin/admissions")} />
      </View>

      <SectionTitle action="Open →" onPress={() => router.push("/(app)/admin/admissions")} title="Recent Admissions" />
      <View style={styles.list}>
        {(recent.registrationLeads || []).length ? recent.registrationLeads.slice(0, 4).map((item) => <Record key={item.id} icon="person-add-outline" meta={`${item.class_level || "Class pending"} · ${item.parent_name || "Parent pending"}`} status={item.status} title={item.student_name || "Student application"} />) : <EmptyRow icon="person-add-outline" text="No recent admission activity." />}
      </View>

      <SectionTitle action="View →" onPress={() => router.push("/(app)/admin/payments")} title="Recent Payments" />
      <View style={styles.list}>
        {(recent.feeSubmissions || []).length ? recent.feeSubmissions.slice(0, 3).map((item) => <Record key={item.id} icon="receipt-outline" meta={`PKR ${Number(item.paid_amount || 0).toLocaleString()} · ${item.transaction_id || "No transaction ID"}`} status={item.status} title={item.student_name || item.voucher_no || "Fee submission"} />) : <EmptyRow icon="wallet-outline" text="No recent payment submissions." />}
      </View>
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}><View style={styles.quickIcon}><Ionicons color={colors.secondary} name={icon} size={22} /></View><AppText style={styles.quickLabel}>{label}</AppText></Pressable>;
}

function SectionTitle({ action, onPress, title }) {
  return <View style={styles.sectionHeader}><AppText style={styles.sectionTitle}>{title}</AppText><Pressable onPress={onPress}><AppText style={styles.action}>{action}</AppText></Pressable></View>;
}

function Record({ icon, meta, status, title }) {
  return <View style={styles.row}><View style={styles.rowIcon}><Ionicons color={colors.secondary} name={icon} size={19} /></View><View style={styles.rowBody}><AppText numberOfLines={1} style={styles.rowTitle}>{title}</AppText><AppText numberOfLines={1} style={styles.rowMeta}>{meta}</AppText></View><StatusChip tone={tone(status)}>{readable(status)}</StatusChip></View>;
}

function EmptyRow({ icon, text }) {
  return <View style={styles.empty}><Ionicons color={colors.outline} name={icon} size={21} /><AppText style={styles.emptyText}>{text}</AppText></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.md, paddingBottom: space.xl },
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
  rowIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.goldPale },
  rowBody: { flex: 1, marginHorizontal: space.sm },
  rowTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  rowMeta: { color: colors.outline, fontSize: fontSize.xs },
  empty: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  emptyText: { marginLeft: space.sm, color: colors.outline, fontSize: fontSize.xs },
  errorScreen: { justifyContent: "center" }, errorTitle: { marginTop: space.md }, errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant }, retry: { marginTop: space.lg },
});
