import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import api from "../../../src/api";
import { AppText, PillButton, Screen, SurfaceCard } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

export default function AdminMore() {
  const router = useRouter();
  const { role } = useAuth();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        api.coordinator.registrationLeads(),
        api.coordinator.parentInterviewForms(),
        api.coordinator.scholarships(),
        api.admin.auditLogs(),
      ]);
      const [leads, forms, scholarships, audits] = results.map((result) =>
        result.status === "fulfilled" ? result.value : null
      );
      setCounts({
        admissions: leads?.items?.length || 0,
        interviews: forms?.items?.length || 0,
        scholarships: scholarships?.items?.length || 0,
        audits: audits?.summary?.total ?? audits?.items?.length ?? 0,
      });
      if (results.some((result) => result.status === "rejected")) {
        setError("Some summary counts are temporarily unavailable.");
      }
    } catch (nextError) {
      setError(nextError?.message || "Unable to load administrative tools.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><Ionicons color={colors.gold} name="apps-outline" size={34} /><AppText style={styles.loadingText}>Preparing administrative tools...</AppText></View>;
  }

  const sections = [
    ["admissions", "Interested Students", "Manage inquiries, admission links, and parent-form progress.", "people-outline", counts.admissions, "mint"],
    ["admission-review", "Admission Review", "Review submitted records, parent interviews, and scholarships.", "documents-outline", (counts.interviews || 0) + (counts.scholarships || 0), "gold"],
    ["communications", "Communications", "Manage internal events, notes, and portal headlines.", "chatbubbles-outline", null, "gold"],
    ["reports", "Reports & Insights", "Review enrollment, finance, attendance, and lecture trends.", "bar-chart-outline", null, "blue"],
    ["audit", "Audit History", "Trace administrative actions and system changes.", "shield-checkmark-outline", counts.audits, "rose"],
    ["profile", "Account & Security", "Profile, secure session details, and logout.", "person-circle-outline", null, "mint"],
  ];

  return (
    <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
      <AppText variant="display">More</AppText>
      <AppText style={styles.subtitle}>{role === "superadmin" ? "Super Admin oversight and system tools." : "Administrative operations, reporting, and account tools."}</AppText>
      {error ? <SurfaceCard style={styles.warning}><View style={styles.warningBody}><Ionicons color={colors.statusPendingText} name="warning-outline" size={20}/><AppText style={styles.warningText}>{error}</AppText></View><PillButton onPress={() => load()} style={styles.retry}>Retry</PillButton></SurfaceCard> : null}
      <SurfaceCard style={styles.admissionSummary}>
        <Summary label="Admission records" value={counts.admissions} />
        <Summary label="Interview forms" value={counts.interviews} />
        <Summary label="Scholarships" value={counts.scholarships} />
      </SurfaceCard>
      <View style={styles.grid}>
        {sections.map(([route, title, body, icon, count, tone]) => (
          <Pressable key={route} onPress={() => router.push(`/(app)/${role}/${route}`)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={[styles.icon, styles[`${tone}Icon`]]}><Ionicons color={colors.primary} name={icon} size={24} /></View>
            <View style={styles.cardBody}><AppText style={styles.title}>{title}</AppText><AppText style={styles.body}>{body}</AppText></View>
            {count != null ? <View style={styles.count}><AppText style={styles.countText}>{count}</AppText></View> : null}
            <Ionicons color={colors.outline} name="chevron-forward" size={20} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function Summary({ label, value }) {
  return <View style={styles.summary}><AppText style={styles.summaryValue}>{String(value || 0)}</AppText><AppText style={styles.summaryLabel}>{label}</AppText></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loadingText: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  warning: { marginTop: space.md, backgroundColor: colors.statusPendingBg },
  warningBody: { flexDirection: "row", alignItems: "center" },
  warningText: { flex: 1, marginLeft: space.sm, color: colors.statusPendingText, fontSize: fontSize.xs },
  retry: { alignSelf: "flex-start", marginTop: space.sm, minWidth: 96 },
  admissionSummary: { flexDirection: "row", marginTop: space.lg, paddingHorizontal: space.xs },
  summary: { flex: 1, alignItems: "center" },
  summaryValue: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.xl },
  summaryLabel: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: 9, textAlign: "center" },
  grid: { gap: space.sm, marginTop: space.lg },
  card: { minHeight: 102, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  mintIcon: { backgroundColor: "#DDF4EA" }, goldIcon: { backgroundColor: colors.goldPale }, blueIcon: { backgroundColor: colors.statusScheduledBg }, roseIcon: { backgroundColor: colors.roseBg },
  cardBody: { flex: 1, marginHorizontal: space.md },
  title: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  body: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  count: { minWidth: 30, height: 30, alignItems: "center", justifyContent: "center", marginRight: space.xs, borderRadius: 15, backgroundColor: colors.primaryContainer },
  countText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
