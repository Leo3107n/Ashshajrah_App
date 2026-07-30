/**
 * Admissions pipeline. Displays interested-student progress and conditionally
 * exposes only the operations granted to the signed-in role.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import api from "../../../src/api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

const FILTERS = ["All", "New", "Sent", "Submitted"];

function cleanStatus(item) {
  return String(item.admission_form_status || item.registration_status || item.status || "new").toLowerCase();
}

function filterMatches(item, filter) {
  if (filter === "All") return true;
  const value = cleanStatus(item);
  if (filter === "New") return ["new", "pending", "interested"].includes(value);
  if (filter === "Sent") return ["sent", "reminded", "overdue", "link_generated", "not_submitted"].includes(value);
  return ["submitted", "reviewed", "approved", "access_granted"].includes(value);
}

function toneFor(value) {
  const status = String(value).toLowerCase();
  if (["submitted", "reviewed", "approved", "access_granted", "resolved", "yes"].includes(status)) return "success";
  if (["failed", "rejected", "archived", "overdue"].includes(status)) return "danger";
  if (["new", "interested"].includes(status)) return "gold";
  return "warning";
}

function label(value) {
  return String(value || "new").replaceAll("_", " ");
}

export default function CoordinatorAdmissions() {
  const { role } = useAuth();
  const readOnly = role === "admin";
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.coordinator.interestedStudents.list();
      setItems(response?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load admissions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!filterMatches(item, filter)) return false;
      if (!term) return true;
      return [item.student_name, item.child_name, item.parent_name, item.email, item.phone, item.registration_code]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [filter, items, query]);

  async function generateLink(item) {
    setActing(true);
    try {
      const response = await api.coordinator.interestedStudents.createRegistrationLink(item.id);
      await load({ refresh: true });
      const updated = { ...item, admission_form_status: "sent", registration_link: response?.registration_link };
      setSelected(updated);
      Alert.alert("Admission form sent", response?.already_generated ? "The existing registration link is ready." : "A new registration link was generated and sent.");
    } catch (nextError) {
      Alert.alert("Unable to send form", nextError?.message || "Please try again.");
    } finally {
      setActing(false);
    }
  }

  function confirmGenerate(item) {
    Alert.alert("Send admission form?", `Generate and send a registration link for ${item.student_name || item.child_name || "this student"}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Send", onPress: () => generateLink(item) },
    ]);
  }

  async function updateParentStatus(item, parentFormSentStatus) {
    setActing(true);
    try {
      await api.coordinator.interestedStudents.update(item.id, { parentFormSentStatus });
      const updated = { ...item, parent_form_sent_status: parentFormSentStatus };
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      setSelected(updated);
    } catch (nextError) {
      Alert.alert("Update failed", nextError?.message || "Please try again.");
    } finally {
      setActing(false);
    }
  }

  function confirmDelete(item) {
    Alert.alert("Hide this lead?", "This removes the lead from the active admissions pipeline.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Hide",
        style: "destructive",
        onPress: async () => {
          setActing(true);
          try {
            await api.coordinator.interestedStudents.delete(item.id);
            setSelected(null);
            setItems((current) => current.filter((entry) => entry.id !== item.id));
          } catch (nextError) {
            Alert.alert("Unable to hide lead", nextError?.message || "This record may have progressed too far to delete.");
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  }

  if (loading) return <DashboardSkeleton message="Loading admissions..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.intro}>
          <View>
            <AppText style={styles.eyebrow}>ADMISSIONS PIPELINE</AppText>
            <AppText variant="heading">Prospective Students</AppText>
          </View>
          <View style={styles.count}><AppText style={styles.countText}>{items.length}</AppText></View>
        </View>

        <View style={styles.search}>
          <Ionicons color={colors.outline} name="search-outline" size={20} />
          <TextInput onChangeText={setQuery} placeholder="Search student, parent or phone" placeholderTextColor={colors.outline} style={styles.searchInput} value={query} />
          {query ? <Pressable onPress={() => setQuery("")}><Ionicons color={colors.outline} name="close-circle" size={20} /></Pressable> : null}
        </View>

        <View style={styles.filters}>
          {FILTERS.map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item ? styles.filterActive : null]}><AppText style={[styles.filterText, filter === item ? styles.filterTextActive : null]}>{item}</AppText></Pressable>)}
        </View>

        {readOnly ? <View style={styles.permissionNote}><Ionicons color={colors.secondary} name="eye-outline" size={20} /><AppText style={styles.permissionText}>Admin review access: inquiry workflow actions are managed by Coordinator or Super Admin.</AppText></View> : null}

        {error ? <SurfaceCard style={styles.error}><Ionicons color={colors.error} name="alert-circle-outline" size={22} /><AppText style={styles.errorText}>{error}</AppText><Pressable onPress={() => load()}><AppText style={styles.retry}>Retry</AppText></Pressable></SurfaceCard> : null}

        <View style={styles.list}>
          {visible.length ? visible.map((item) => <LeadCard item={item} key={item.id} onPress={() => setSelected(item)} />) : <View style={styles.empty}><Ionicons color={colors.outline} name="leaf-outline" size={32} /><AppText style={styles.emptyTitle}>No matching admissions</AppText><AppText style={styles.emptyBody}>Try another search or pipeline filter.</AppText></View>}
        </View>
      </Screen>

      <LeadDetail
        acting={acting}
        item={selected}
        readOnly={readOnly}
        onClose={() => !acting && setSelected(null)}
        onDelete={confirmDelete}
        onGenerate={confirmGenerate}
        onParentStatus={updateParentStatus}
      />
    </>
  );
}

function LeadCard({ item, onPress }) {
  const status = cleanStatus(item);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <View style={styles.avatar}><AppText style={styles.avatarText}>{String(item.student_name || item.child_name || "S")[0].toUpperCase()}</AppText></View>
      <View style={styles.cardBody}>
        <AppText numberOfLines={1} style={styles.student}>{item.student_name || item.child_name || "Prospective Student"}</AppText>
        <AppText numberOfLines={1} style={styles.parent}>{item.parent_name || "Parent not provided"}</AppText>
        <View style={styles.cardMeta}><Ionicons color={colors.outline} name="school-outline" size={13} /><AppText style={styles.metaText}>{item.class_level || "Class not selected"}</AppText></View>
      </View>
      <View style={styles.cardEnd}><StatusChip tone={toneFor(status)}>{label(status)}</StatusChip><Ionicons color={colors.outline} name="chevron-forward" size={18} /></View>
    </Pressable>
  );
}

function DetailRow({ icon, label: rowLabel, value }) {
  return <View style={styles.detailRow}><Ionicons color={colors.secondary} name={icon} size={18} /><View style={styles.detailText}><AppText style={styles.detailLabel}>{rowLabel}</AppText><AppText style={styles.detailValue}>{value || "Not provided"}</AppText></View></View>;
}

function LeadDetail({ acting, item, onClose, onDelete, onGenerate, onParentStatus, readOnly }) {
  if (!item) return null;
  const status = cleanStatus(item);
  const canDelete = !["sent", "submitted", "reminded", "overdue", "not_submitted"].includes(status);
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}><View><AppText style={styles.sheetEyebrow}>ADMISSION DETAILS</AppText><AppText variant="heading">{item.student_name || item.child_name || "Student"}</AppText></View><Pressable hitSlop={12} onPress={onClose}><Ionicons color={colors.onSurfaceVariant} name="close" size={25} /></Pressable></View>
          <Screen contentContainerStyle={styles.sheetContent}>
            <View style={styles.statusRow}><StatusChip tone={toneFor(status)}>{label(status)}</StatusChip><AppText style={styles.code}>{item.registration_code || "No registration code"}</AppText></View>
            <SurfaceCard elevated={false}>
              <DetailRow icon="person-outline" label="Parent" value={item.parent_name} />
              <DetailRow icon="mail-outline" label="Email" value={item.email} />
              <DetailRow icon="call-outline" label="Phone" value={item.phone} />
              <DetailRow icon="school-outline" label="Class" value={item.class_level} />
              <DetailRow icon="location-outline" label="Location" value={item.city_country} />
              <DetailRow icon="calendar-outline" label="Child age" value={item.child_age} />
            </SurfaceCard>
            {item.message ? <SurfaceCard elevated={false} style={styles.message}><AppText style={styles.messageLabel}>FAMILY MESSAGE</AppText><AppText style={styles.messageText}>{item.message}</AppText></SurfaceCard> : null}
            <AppText style={styles.subheading}>Parent form status</AppText>
            {readOnly ? (
              <View style={styles.readOnlyStatus}><Ionicons color={colors.secondary} name="lock-closed-outline" size={18} /><AppText style={styles.readOnlyStatusText}>{label(item.parent_form_sent_status || "not updated")}</AppText></View>
            ) : (
              <View style={styles.parentStatuses}>
                {["no", "checking issue", "resolved", "yes"].map((value) => <Pressable disabled={acting} key={value} onPress={() => onParentStatus(item, value)} style={[styles.parentStatus, item.parent_form_sent_status === value ? styles.parentStatusActive : null]}><AppText style={[styles.parentStatusText, item.parent_form_sent_status === value ? styles.parentStatusTextActive : null]}>{value}</AppText></Pressable>)}
              </View>
            )}
            {!readOnly ? <PillButton icon={<Ionicons color={colors.white} name="send-outline" size={18} />} loading={acting} onPress={() => onGenerate(item)}>{item.registration_token ? "Resend Admission Link" : "Send Admission Form"}</PillButton> : null}
            {item.registration_link && <PillButton onPress={() => Linking.openURL(item.registration_link)} style={styles.secondaryAction} variant="outline">Open Registration Form</PillButton>}
            {!readOnly && canDelete ? <Pressable disabled={acting} onPress={() => onDelete(item)} style={styles.delete}><Ionicons color={colors.error} name="trash-outline" size={18} /><AppText style={styles.deleteText}>Hide this lead</AppText></Pressable> : null}
          </Screen>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.md },
  intro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  count: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.secondaryContainer },
  countText: { color: colors.onSecondaryContainer, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  search: { minHeight: 52, flexDirection: "row", alignItems: "center", marginTop: space.lg, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, backgroundColor: colors.surface },
  searchInput: { flex: 1, paddingHorizontal: space.sm, color: colors.onSurface, fontFamily: fonts.body, fontSize: fontSize.sm },
  filters: { flexDirection: "row", gap: space.sm, marginVertical: space.md },
  filter: { minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.full, backgroundColor: colors.surfaceHigh },
  filterActive: { backgroundColor: colors.secondaryContainer },
  filterText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.onSecondaryContainer, fontFamily: fonts.bodyBold },
  permissionNote: { flexDirection: "row", alignItems: "center", marginBottom: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  permissionText: { flex: 1, marginLeft: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  list: { gap: space.sm },
  card: { minHeight: 92, flexDirection: "row", alignItems: "center", padding: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  avatar: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "#B9EEDB" },
  avatarText: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  cardBody: { flex: 1, marginHorizontal: space.sm },
  student: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  parent: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  metaText: { marginLeft: 3, color: colors.outline, fontSize: 10 },
  cardEnd: { alignItems: "flex-end", gap: space.sm },
  error: { flexDirection: "row", alignItems: "center", marginBottom: space.md, backgroundColor: colors.errorContainer },
  errorText: { flex: 1, marginHorizontal: space.sm, color: colors.error, fontSize: fontSize.xs },
  retry: { color: colors.error, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  empty: { alignItems: "center", paddingVertical: space["3xl"] },
  emptyTitle: { marginTop: space.md, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyBody: { marginTop: space.xs, color: colors.outline, fontSize: fontSize.xs },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,39,30,0.42)" },
  sheet: { maxHeight: "91%", overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.background, ...shadows.modal },
  handle: { width: 42, height: 5, alignSelf: "center", marginTop: space.sm, borderRadius: 3, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetEyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  sheetContent: { paddingTop: space.md },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  code: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  detailRow: { minHeight: 54, flexDirection: "row", alignItems: "center" },
  detailText: { flex: 1, marginLeft: space.md },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { color: colors.onSurface, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm },
  message: { marginTop: space.md, backgroundColor: colors.surfaceLow },
  messageLabel: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  messageText: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  subheading: { marginTop: space.lg, marginBottom: space.sm, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  parentStatuses: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.lg },
  parentStatus: { minHeight: 34, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.full, backgroundColor: colors.surfaceHigh },
  parentStatusActive: { backgroundColor: colors.secondaryContainer },
  parentStatusText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs, textTransform: "capitalize" },
  parentStatusTextActive: { color: colors.onSecondaryContainer, fontFamily: fonts.bodyBold },
  readOnlyStatus: { minHeight: 44, flexDirection: "row", alignItems: "center", marginBottom: space.lg, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  readOnlyStatusText: { marginLeft: space.sm, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm, textTransform: "capitalize" },
  secondaryAction: { marginTop: space.md },
  delete: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 48, marginTop: space.lg },
  deleteText: { marginLeft: space.sm, color: colors.error, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
});
