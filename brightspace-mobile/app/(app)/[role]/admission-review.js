import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../../src/api";
import { AppText, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function display(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value == null || value === "") return "Not provided";
  return String(value);
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();
  if (["approved", "submitted", "verified", "access_granted", "fee_verified"].includes(value)) return "success";
  if (["rejected", "failed", "cancelled"].includes(value)) return "danger";
  return "warning";
}

export default function AdmissionReview() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [view, setView] = useState("records");
  const [data, setData] = useState({ records: [], interviews: [], scholarships: [] });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [records, interviews, scholarships] = await Promise.all([
        api.coordinator.registrationLeads(),
        api.coordinator.parentInterviewForms(),
        api.coordinator.scholarships(),
      ]);
      setData({
        records: records?.items || [],
        interviews: interviews?.items || [],
        scholarships: scholarships?.items || [],
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load admission records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    const source = data[view] || [];
    const term = search.trim().toLowerCase();
    return term
      ? source.filter((item) => [item.student_name, item.child_name, item.parent_name, item.parent_email, item.email, item.phone, item.class_level, item.program_name, item.status].some((value) => String(value || "").toLowerCase().includes(term)))
      : source;
  }, [data, search, view]);

  if (loading) {
    return <View style={styles.center}><Ionicons color={colors.gold} name="documents-outline" size={34} /><AppText style={styles.loading}>Reviewing admission records...</AppText></View>;
  }

  return (
    <>
      <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
        <AppText variant="display">Admission Review</AppText>
        <AppText style={styles.subtitle}>Submitted records, interviews, and support applications.</AppText>

        {isAdmin ? <View style={styles.permission}><Ionicons color={colors.secondary} name="eye-outline" size={20} /><AppText style={styles.permissionText}>Admin review access is read-only. Final admission, scholarship, account, and LMS-access decisions remain with Super Admin.</AppText></View> : null}

        <View style={styles.tabs}>
          <Tab active={view === "records"} label={`Records ${data.records.length}`} onPress={() => { setView("records"); setSearch(""); }} />
          <Tab active={view === "interviews"} label={`Interviews ${data.interviews.length}`} onPress={() => { setView("interviews"); setSearch(""); }} />
          <Tab active={view === "scholarships"} label={`Scholarships ${data.scholarships.length}`} onPress={() => { setView("scholarships"); setSearch(""); }} />
        </View>

        <View style={styles.search}><Ionicons color={colors.outline} name="search-outline" size={20} /><TextInput onChangeText={setSearch} placeholder="Search student or parent..." placeholderTextColor={colors.outline} style={styles.input} value={search} />{search ? <Pressable onPress={() => setSearch("")}><Ionicons color={colors.outline} name="close-circle" size={20} /></Pressable> : null}</View>
        {error ? <SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText></SurfaceCard> : null}

        <View style={styles.list}>
          {items.length ? items.map((item, index) => <ReviewCard item={item} key={item.id || index} onPress={() => setSelected({ item, view })} view={view} />) : <View style={styles.empty}><Ionicons color={colors.outline} name="documents-outline" size={30} /><AppText style={styles.meta}>No {view} found.</AppText></View>}
        </View>
      </Screen>

      <ReviewDetail onClose={() => setSelected(null)} selection={selected} />
    </>
  );
}

function ReviewCard({ item, onPress, view }) {
  const title = item.student_name || item.child_name || item.parent_name || "Admission record";
  const status = item.status || "submitted";
  const detail = view === "scholarships"
    ? item.scholarship_reason || "Support application"
    : view === "interviews"
      ? item.interested_programme || "Parent interview form"
      : item.program_name || item.phone || "Registration record";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.avatar}><AppText style={styles.avatarText}>{String(title)[0].toUpperCase()}</AppText></View>
      <View style={styles.body}><AppText numberOfLines={1} style={styles.title}>{title}</AppText><AppText numberOfLines={1} style={styles.meta}>{item.parent_name || item.parent_email || item.email || "Parent not provided"} · {item.class_level || item.program_name || "Class pending"}</AppText><AppText numberOfLines={2} style={styles.detail}>{detail}</AppText></View>
      <View style={styles.cardEnd}><StatusChip tone={statusTone(status)}>{readable(status)}</StatusChip><Ionicons color={colors.outline} name="chevron-forward" size={18} /></View>
    </Pressable>
  );
}

function ReviewDetail({ onClose, selection }) {
  if (!selection) return null;
  const { item, view } = selection;
  const title = item.student_name || item.child_name || item.parent_name || "Admission record";
  const rows = view === "records"
    ? [
        ["Student", item.student_name], ["Parent", item.parent_name], ["Relationship", item.parent_relation],
        ["Email", item.email], ["Phone", item.phone], ["Class", item.class_level], ["Programme", item.program_name],
        ["Student age", item.student_age], ["Date of birth", item.date_of_birth ? new Date(item.date_of_birth).toLocaleDateString() : ""],
        ["Gender", item.gender], ["City", item.city], ["Country", item.country], ["Nationality", item.nationality],
        ["Preferred start", item.preferred_starting_month], ["Device available", item.device_available],
        ["Developmental concern", item.developmental_concern], ["Medical conditions", item.medical_conditions],
        ["Interest reason", item.interest_reason], ["Child strengths", item.child_strengths],
        ["Support needs", item.child_support_needs], ["Special interests", item.child_special_interests],
        ["Voucher status", item.voucher_status], ["Submitted", item.submitted_at ? new Date(item.submitted_at).toLocaleString() : ""],
      ]
    : view === "interviews"
      ? [
          ["Child", item.child_name], ["Parent", item.parent_name], ["Parent email", item.parent_email],
          ["Child age", item.child_age], ["Programme", item.interested_programme], ["Form version", item.form_version],
          ["Submitted", item.submitted_at ? new Date(item.submitted_at).toLocaleString() : ""],
          ["Reviewed", item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : ""],
        ]
      : [
          ["Student", item.student_name], ["Parent", item.parent_name], ["Email", item.email], ["Phone", item.phone],
          ["Class", item.class_level], ["Dependents", item.dependents_count], ["School-going children", item.school_going_children_count],
          ["Residence", item.residence_type], ["Requested amount", item.requested_amount ? `PKR ${Number(item.requested_amount).toLocaleString()}` : ""],
          ["Approved amount", item.scholarship_amount ? `PKR ${Number(item.scholarship_amount).toLocaleString()}` : ""],
          ["Reason", item.scholarship_reason], ["Voucher created", item.voucher_created], ["Fee submitted", item.has_fee_submission],
        ];

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}><View style={styles.sheetTitle}><AppText style={styles.eyebrow}>{readable(view)} REVIEW</AppText><AppText numberOfLines={1} variant="heading">{title}</AppText></View><Pressable hitSlop={12} onPress={onClose}><Ionicons color={colors.primary} name="close" size={24} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <StatusChip tone={statusTone(item.status)}>{readable(item.status || "submitted")}</StatusChip>
            <SurfaceCard style={styles.details}>{rows.map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}</SurfaceCard>
            {view === "interviews" && item.responses ? <ResponseBlock responses={item.responses} /> : null}
            <View style={styles.locked}><Ionicons color={colors.secondary} name="lock-closed-outline" size={19} /><AppText style={styles.lockedText}>This screen records review visibility only. Final decisions and account provisioning are protected Super Admin operations.</AppText></View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }) {
  return <View style={styles.detailRow}><AppText style={styles.detailLabel}>{label}</AppText><AppText selectable style={styles.detailValue}>{display(value)}</AppText></View>;
}

function ResponseBlock({ responses }) {
  const entries = typeof responses === "object" && responses ? Object.entries(responses) : [["Response", responses]];
  return <SurfaceCard style={styles.responseCard}><AppText style={styles.responseTitle}>Interview Responses</AppText>{entries.map(([key, value]) => <DetailRow key={key} label={readable(key)} value={typeof value === "object" ? JSON.stringify(value) : value} />)}</SurfaceCard>;
}

function Tab({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><AppText numberOfLines={1} style={[styles.tabText, active && styles.activeTabText]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  permission: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  permissionText: { flex: 1, marginLeft: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  tabs: { flexDirection: "row", gap: 3, marginTop: space.lg, padding: 4, borderRadius: radius.full, backgroundColor: colors.surfaceLow },
  tab: { flex: 1, height: 42, minHeight: 42, maxHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.full },
  activeTab: { backgroundColor: colors.primary },
  tabText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9 },
  activeTabText: { color: colors.white },
  search: { minHeight: 50, flexDirection: "row", alignItems: "center", marginTop: space.md, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface },
  input: { flex: 1, marginLeft: space.sm, color: colors.onSurface, fontFamily: fonts.body },
  error: { marginTop: space.md }, errorText: { color: colors.error },
  list: { gap: space.sm, marginTop: space.lg },
  card: { minHeight: 100, flexDirection: "row", alignItems: "flex-start", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "#DDF4EA" },
  avatarText: { color: colors.primary, fontFamily: fonts.bodyBold },
  body: { flex: 1, marginHorizontal: space.md },
  title: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  meta: { marginTop: 2, color: colors.outline, fontSize: fontSize.xs },
  detail: { marginTop: 5, color: colors.onSurfaceVariant, fontSize: 10 },
  cardEnd: { alignItems: "flex-end", gap: space.sm },
  empty: { alignItems: "center", gap: space.sm, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,39,30,0.42)" },
  sheet: { maxHeight: "92%", overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.background, ...shadows.modal },
  handle: { width: 42, height: 5, alignSelf: "center", marginTop: space.sm, borderRadius: 3, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "center", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetTitle: { flex: 1, minWidth: 0, marginRight: space.md },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  sheetContent: { padding: space.lg, paddingBottom: 40 },
  details: { marginTop: space.md, paddingVertical: space.xs },
  detailRow: { minHeight: 52, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { marginTop: 3, color: colors.onSurface, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm },
  responseCard: { marginTop: space.md },
  responseTitle: { marginBottom: space.sm, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  locked: { flexDirection: "row", marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  lockedText: { flex: 1, marginLeft: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
});
