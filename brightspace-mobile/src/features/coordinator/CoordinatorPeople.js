/**
 * Coordinator People directory. Tabbed Students/Parents roster with search,
 * edit, and archive actions against the coordinator-scoped API (not the admin
 * users API, which coordinator cannot call).
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name) {
  return String(name || "U").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();
  if (value === "active") return "success";
  if (value === "suspended") return "danger";
  return "neutral";
}

export default function CoordinatorPeople() {
  const [tab, setTab] = useState("students");
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [studentsResponse, parentsResponse] = await Promise.all([
        api.coordinator.students.list(),
        api.coordinator.parents.list(),
      ]);
      setStudents(studentsResponse?.items || []);
      setParents(parentsResponse?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load the directory.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = tab === "students" ? students : parents;
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.full_name, item.student_email, item.contact_email, item.email, item.parent_phone, item.phone, item.course_title, item.class_levels]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [items, search]);

  function openEdit(item) {
    if (tab === "students") {
      setForm({
        kind: "student",
        id: item.id,
        full_name: item.full_name || "",
        email: item.student_email || item.contact_email || "",
        phone: item.student_phone || item.contact_phone || "",
        grade_level: item.grade_level || item.course_title || "",
        status: item.status || "active",
      });
    } else {
      setForm({
        kind: "parent",
        id: item.id,
        full_name: item.full_name || "",
        email: item.email || "",
        phone: item.phone || "",
        relation: item.relation || "",
        status: item.status || "active",
      });
    }
  }

  async function saveForm() {
    if (!form?.full_name?.trim()) {
      Alert.alert("Name required", "Enter a full name before saving.");
      return;
    }
    setSaving(true);
    try {
      if (form.kind === "student") {
        await api.coordinator.students.update({
          id: form.id,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          grade_level: form.grade_level,
          status: form.status,
        });
      } else {
        await api.coordinator.parents.update({
          id: form.id,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          relation: form.relation,
          status: form.status,
        });
      }
      setForm(null);
      setSelected(null);
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to save", nextError?.message || "Review the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  function archive(item) {
    Alert.alert(
      `Archive this ${tab === "students" ? "student" : "parent"}?`,
      `${item.full_name || "This record"} will lose portal access. This can be reversed later by support.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              if (tab === "students") await api.coordinator.students.delete({ id: item.id });
              else await api.coordinator.parents.delete({ id: item.id });
              setSelected(null);
              await load({ refresh: true });
            } catch (nextError) {
              Alert.alert("Unable to archive", nextError?.message || "Please try again.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  if (loading) return <DashboardSkeleton message="Growing the community directory..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <AppText variant="display">Students & Parents</AppText>
          <AppText style={styles.subtitle}>Manage enrolled families and their access.</AppText>
        </View>

        <View style={styles.tabs}>
          <Tab active={tab === "students"} count={students.length} label="Students" onPress={() => setTab("students")} />
          <Tab active={tab === "parents"} count={parents.length} label="Parents" onPress={() => setTab("parents")} />
        </View>

        <View style={styles.search}>
          <Ionicons color={colors.outline} name="search-outline" size={20} />
          <TextInput onChangeText={setSearch} placeholder={`Search ${tab}...`} placeholderTextColor={colors.outline} style={styles.searchInput} value={search} />
          {search ? <Pressable onPress={() => setSearch("")}><Ionicons color={colors.outline} name="close-circle" size={20} /></Pressable> : null}
        </View>

        {error ? (
          <SurfaceCard style={styles.errorCard}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={25} />
            <View style={styles.errorBody}><AppText style={styles.errorTitle}>Directory unavailable</AppText><AppText style={styles.errorText}>{error}</AppText></View>
            <Pressable onPress={() => load()}><AppText style={styles.retryText}>Retry</AppText></Pressable>
          </SurfaceCard>
        ) : null}

        <View style={styles.listHeader}>
          <AppText style={styles.sectionTitle}>{readable(tab)}</AppText>
          <AppText style={styles.resultCount}>{visible.length} results</AppText>
        </View>
        <View style={styles.list}>
          {visible.length ? visible.map((item) => (
            <Pressable key={item.id} onPress={() => { setSelected(item); }} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.avatar}><AppText style={styles.avatarText}>{initials(item.full_name)}</AppText></View>
              <View style={styles.cardBody}>
                <AppText numberOfLines={1} style={styles.cardTitle}>{item.full_name || "Unnamed"}</AppText>
                <AppText numberOfLines={1} style={styles.cardMeta}>
                  {tab === "students"
                    ? `${item.course_title || item.grade_level || "No class"} · ${item.parent_name || "No parent linked"}`
                    : `${item.student_names || "No children linked"}`}
                </AppText>
                <StatusChip tone={statusTone(item.status)}>{readable(item.status || "active")}</StatusChip>
              </View>
              <Ionicons color={colors.outline} name="chevron-forward" size={20} />
            </Pressable>
          )) : (
            <View style={styles.empty}>
              <Ionicons color={colors.outline} name="people-outline" size={30} />
              <AppText style={styles.emptyTitle}>No {tab} found</AppText>
              <AppText style={styles.emptyText}>Try another search term.</AppText>
            </View>
          )}
        </View>
      </Screen>

      {/* Detail sheet */}
      <Modal animationType="slide" onRequestClose={() => setSelected(null)} transparent visible={Boolean(selected)}>
        <Pressable onPress={() => setSelected(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetTop}>
              <View style={styles.largeAvatar}><AppText style={styles.largeAvatarText}>{initials(selected?.full_name)}</AppText></View>
              <View style={styles.sheetIdentity}>
                <AppText style={styles.sheetName} variant="heading">{selected?.full_name || "Unnamed"}</AppText>
                <AppText style={styles.sheetMeta}>{tab === "students" ? "Student" : "Parent"} record</AppText>
              </View>
              <Pressable onPress={() => setSelected(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <SurfaceCard style={styles.details}>
              {tab === "students" ? (
                <>
                  <Detail icon="mail-outline" label="Email" value={selected?.student_email || selected?.contact_email} />
                  <Detail icon="call-outline" label="Phone" value={selected?.student_phone || selected?.contact_phone} />
                  <Detail icon="school-outline" label="Class" value={selected?.course_title || selected?.grade_level} />
                  <Detail icon="person-outline" label="Parent" value={selected?.parent_name} />
                  <Detail icon="shield-checkmark-outline" label="Status" value={readable(selected?.status)} />
                </>
              ) : (
                <>
                  <Detail icon="mail-outline" label="Email" value={selected?.email} />
                  <Detail icon="call-outline" label="Phone" value={selected?.phone} />
                  <Detail icon="people-outline" label="Children" value={selected?.student_names} />
                  <Detail icon="ribbon-outline" label="Relation" value={readable(selected?.relation)} />
                  <Detail icon="shield-checkmark-outline" label="Status" value={readable(selected?.status)} />
                </>
              )}
            </SurfaceCard>
            <View style={styles.actions}>
              <PillButton disabled={saving} onPress={() => openEdit(selected)} variant="secondary">Edit Details</PillButton>
              <PillButton disabled={saving} onPress={() => archive(selected)} variant="danger">Archive Record</PillButton>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit form */}
      <Modal animationType="slide" onRequestClose={() => !saving && setForm(null)} transparent visible={Boolean(form)}>
        <Pressable onPress={() => !saving && setForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetTop}>
              <AppText variant="heading">Edit {form?.kind === "student" ? "Student" : "Parent"}</AppText>
              <Pressable disabled={saving} onPress={() => setForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <Field label="FULL NAME" onChange={(full_name) => setForm((current) => ({ ...current, full_name }))} value={form?.full_name} />
            <Field autoCapitalize="none" keyboardType="email-address" label="EMAIL" onChange={(email) => setForm((current) => ({ ...current, email }))} value={form?.email} />
            <Field keyboardType="phone-pad" label="PHONE" onChange={(phone) => setForm((current) => ({ ...current, phone }))} value={form?.phone} />
            {form?.kind === "student" ? (
              <Field label="CLASS / GRADE LEVEL" onChange={(grade_level) => setForm((current) => ({ ...current, grade_level }))} value={form?.grade_level} />
            ) : (
              <Field label="RELATION" onChange={(relation) => setForm((current) => ({ ...current, relation }))} value={form?.relation} />
            )}
            <PillButton disabled={saving} loading={saving} onPress={saveForm} style={styles.saveButton}>Save Changes</PillButton>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Tab({ active, count, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <AppText style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</AppText>
      <View style={[styles.badge, active && styles.badgeActive]}><AppText style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</AppText></View>
    </Pressable>
  );
}

function Detail({ icon, label, value }) {
  return (
    <View style={styles.detail}>
      <Ionicons color={colors.secondary} name={icon} size={17} />
      <View style={styles.detailCopy}>
        <AppText style={styles.detailLabel}>{label}</AppText>
        <AppText style={styles.detailValue}>{value || "Not available"}</AppText>
      </View>
    </View>
  );
}

function Field({ autoCapitalize, keyboardType, label, onChange, value }) {
  return (
    <View style={styles.field}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChange}
        placeholderTextColor={colors.outline}
        style={styles.fieldInput}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.md },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  tabs: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.full, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  tabLabel: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm },
  tabLabelActive: { color: colors.white },
  badge: { minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, paddingHorizontal: 5, backgroundColor: colors.goldPale },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  badgeText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  badgeTextActive: { color: colors.white },
  search: { minHeight: 50, flexDirection: "row", alignItems: "center", marginTop: space.md, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface },
  searchInput: { flex: 1, marginLeft: space.sm, color: colors.onSurface, fontFamily: fonts.body },
  errorCard: { flexDirection: "row", alignItems: "center", marginTop: space.md, gap: space.sm },
  errorBody: { flex: 1 },
  errorTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  errorText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  retryText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  resultCount: { color: colors.outline, fontSize: 10 },
  list: { gap: space.sm },
  card: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.75 },
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "#B9EEDB" },
  avatarText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardBody: { flex: 1, marginHorizontal: space.sm, gap: 4 },
  cardTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardMeta: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  empty: { alignItems: "center", paddingVertical: space.xl },
  emptyTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { position: "absolute", right: 0, bottom: 0, left: 0, maxHeight: "85%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  sheetTop: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  largeAvatar: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: "#B9EEDB" },
  largeAvatarText: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  sheetIdentity: { flex: 1, marginLeft: space.sm },
  sheetName: { color: colors.primary },
  sheetMeta: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceHigh },
  details: { gap: space.sm },
  detail: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingVertical: 4 },
  detailCopy: { flex: 1 },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { marginTop: 2, color: colors.onSurface, fontSize: fontSize.xs },
  actions: { gap: space.sm, marginTop: space.lg },
  field: { marginTop: space.md },
  fieldLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase", marginBottom: 6 },
  fieldInput: { height: 48, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface },
  saveButton: { marginTop: space.lg },
});
