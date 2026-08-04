/**
 * Coordinator Teachers workspace. Teacher account directory plus class and
 * subject assignment management, against the coordinator-scoped API.
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
  return String(name || "T").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function CoordinatorTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [assignmentData, setAssignmentData] = useState({ items: [], teachers: [], courses: [], subjects: [], courseSubjects: [] });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [createForm, setCreateForm] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [teachersResponse, assignments] = await Promise.all([
        api.coordinator.teachers.list(),
        api.coordinator.teacherAssignments.list(),
      ]);
      setTeachers(teachersResponse?.items || []);
      setAssignmentData(assignments || { items: [], teachers: [], courses: [], subjects: [], courseSubjects: [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load teachers.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return teachers;
    return teachers.filter((item) => [item.full_name, item.email, item.phone].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [teachers, search]);

  function workloadFor(teacher) {
    return assignmentData.items.filter((item) => item.teacher_id === teacher?.id || item.teacher_name === teacher?.full_name);
  }

  const availableSubjects = useMemo(() => {
    if (!assignmentForm?.courseId) return [];
    return (assignmentData.courseSubjects || [])
      .filter((row) => row.course_id === assignmentForm.courseId)
      .map((row) => assignmentData.subjects.find((subject) => subject.id === row.subject_id))
      .filter(Boolean);
  }, [assignmentData.courseSubjects, assignmentData.subjects, assignmentForm?.courseId]);

  async function createTeacher() {
    if (!createForm?.fullName?.trim() || !createForm?.email?.trim()) {
      Alert.alert("Details required", "Full name and email are required.");
      return;
    }
    if (String(createForm?.password || "").length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await api.coordinator.teachers.create({
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone?.trim(),
        password: createForm.password,
      });
      setCreateForm(null);
      await load({ refresh: true });
      Alert.alert("Teacher account created", `${createForm.fullName.trim()} can now sign in with the temporary password you set.`);
    } catch (nextError) {
      Alert.alert("Unable to create teacher", nextError?.message || "Review the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function createAssignment() {
    if (!assignmentForm?.teacherId || !assignmentForm?.courseId || !assignmentForm?.subjectId) {
      Alert.alert("Assignment incomplete", "Choose a class and subject.");
      return;
    }
    setSaving(true);
    try {
      await api.coordinator.teacherAssignments.create({
        teacherId: assignmentForm.teacherId,
        courseId: assignmentForm.courseId,
        subjectId: assignmentForm.subjectId,
      });
      setAssignmentForm(null);
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to assign teacher", nextError?.message || "Review the class and subject selection.");
    } finally {
      setSaving(false);
    }
  }

  function toggleAssignmentStatus(item) {
    const next = item.status === "active" ? "suspended" : "active";
    Alert.alert(
      next === "active" ? "Reactivate assignment?" : "Suspend assignment?",
      `${item.course_title || "This class"} · ${item.subject_name || "subject"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: next === "active" ? "Reactivate" : "Suspend",
          style: next === "active" ? "default" : "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await api.coordinator.teacherAssignments.update(item.id, { status: next });
              await load({ refresh: true });
            } catch (nextError) {
              Alert.alert("Unable to update", nextError?.message || "Please try again.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  if (loading) return <DashboardSkeleton message="Loading teaching staff..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <AppText variant="display">Teachers</AppText>
            <AppText style={styles.subtitle}>Onboard teachers and manage class assignments.</AppText>
          </View>
          <Pressable onPress={() => setCreateForm({ fullName: "", email: "", phone: "", password: "" })} style={styles.addButton}>
            <Ionicons color={colors.white} name="person-add-outline" size={20} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Ionicons color={colors.outline} name="search-outline" size={20} />
          <TextInput onChangeText={setSearch} placeholder="Search teachers..." placeholderTextColor={colors.outline} style={styles.searchInput} value={search} />
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
          <AppText style={styles.sectionTitle}>Teaching Staff</AppText>
          <AppText style={styles.resultCount}>{visible.length} teachers</AppText>
        </View>
        <View style={styles.list}>
          {visible.length ? visible.map((item) => (
            <Pressable key={item.id} onPress={() => setSelected(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.avatar}><AppText style={styles.avatarText}>{initials(item.full_name)}</AppText></View>
              <View style={styles.cardBody}>
                <AppText numberOfLines={1} style={styles.cardTitle}>{item.full_name || "Unnamed"}</AppText>
                <AppText numberOfLines={1} style={styles.cardMeta}>{item.email || item.phone || "No contact details"}</AppText>
                <AppText style={styles.workloadCount}>{workloadFor(item).length} active assignments</AppText>
              </View>
              <StatusChip tone={item.status === "active" ? "success" : item.status === "suspended" ? "danger" : "neutral"}>{readable(item.status)}</StatusChip>
            </Pressable>
          )) : (
            <View style={styles.empty}>
              <Ionicons color={colors.outline} name="school-outline" size={30} />
              <AppText style={styles.emptyTitle}>No teachers found</AppText>
              <AppText style={styles.emptyText}>Add a teacher account to get started.</AppText>
            </View>
          )}
        </View>
      </Screen>

      {/* Teacher detail + workload */}
      <Modal animationType="slide" onRequestClose={() => setSelected(null)} transparent visible={Boolean(selected)}>
        <Pressable onPress={() => setSelected(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetTop}>
              <View style={styles.largeAvatar}><AppText style={styles.largeAvatarText}>{initials(selected?.full_name)}</AppText></View>
              <View style={styles.sheetIdentity}>
                <AppText style={styles.sheetName} variant="heading">{selected?.full_name}</AppText>
                <AppText style={styles.sheetMeta}>Teacher account</AppText>
              </View>
              <Pressable onPress={() => setSelected(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <SurfaceCard style={styles.details}>
              <Detail icon="mail-outline" label="Email" value={selected?.email} />
              <Detail icon="call-outline" label="Phone" value={selected?.phone} />
              <Detail icon="shield-checkmark-outline" label="Status" value={readable(selected?.status)} />
            </SurfaceCard>

            <View style={styles.workload}>
              <View style={styles.workloadHeader}>
                <View>
                  <AppText style={styles.workloadTitle}>Teaching Workload</AppText>
                  <AppText style={styles.sheetMeta}>{workloadFor(selected).length} active assignments</AppText>
                </View>
                <Pressable onPress={() => setAssignmentForm({ teacherId: selected?.id, courseId: "", subjectId: "" })} style={styles.assignButton}>
                  <Ionicons color={colors.white} name="add" size={18} /><AppText style={styles.assignText}>Assign</AppText>
                </Pressable>
              </View>
              {workloadFor(selected).map((item) => (
                <Pressable key={item.id} onPress={() => toggleAssignmentStatus(item)} style={styles.assignmentRow}>
                  <Ionicons color={colors.emeraldMid} name="school-outline" size={19} />
                  <View style={styles.assignmentBody}>
                    <AppText style={styles.assignmentTitle}>{item.course_title || "Class"}</AppText>
                    <AppText style={styles.assignmentMeta}>{item.subject_name || "Subject"}</AppText>
                  </View>
                  <StatusChip tone={item.status === "active" ? "success" : "neutral"}>{readable(item.status)}</StatusChip>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Create teacher */}
      <Modal animationType="slide" onRequestClose={() => !saving && setCreateForm(null)} transparent visible={Boolean(createForm)}>
        <Pressable onPress={() => !saving && setCreateForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetTop}>
              <AppText variant="heading">Create Teacher Account</AppText>
              <Pressable disabled={saving} onPress={() => setCreateForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <Field label="FULL NAME" onChange={(fullName) => setCreateForm((current) => ({ ...current, fullName }))} value={createForm?.fullName} />
            <Field autoCapitalize="none" keyboardType="email-address" label="EMAIL" onChange={(email) => setCreateForm((current) => ({ ...current, email }))} value={createForm?.email} />
            <Field keyboardType="phone-pad" label="PHONE (OPTIONAL)" onChange={(phone) => setCreateForm((current) => ({ ...current, phone }))} value={createForm?.phone} />
            <Field autoCapitalize="none" label="TEMPORARY PASSWORD" onChange={(password) => setCreateForm((current) => ({ ...current, password }))} secureTextEntry value={createForm?.password} />
            <PillButton disabled={saving} loading={saving} onPress={createTeacher} style={styles.saveButton}>Create Account</PillButton>
          </ScrollView>
        </View>
      </Modal>

      {/* Assign class + subject */}
      <Modal animationType="slide" onRequestClose={() => !saving && setAssignmentForm(null)} transparent visible={Boolean(assignmentForm)}>
        <Pressable onPress={() => !saving && setAssignmentForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetTop}>
              <AppText variant="heading">Assign Class & Subject</AppText>
              <Pressable disabled={saving} onPress={() => setAssignmentForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <AppText style={styles.fieldLabel}>CLASS</AppText>
            <View style={styles.chips}>
              {assignmentData.courses.map((course) => (
                <Pressable
                  key={course.id}
                  onPress={() => setAssignmentForm((current) => ({ ...current, courseId: course.id, subjectId: "" }))}
                  style={[styles.chip, assignmentForm?.courseId === course.id && styles.chipActive]}
                >
                  <AppText style={[styles.chipText, assignmentForm?.courseId === course.id && styles.chipTextActive]}>{course.title}</AppText>
                </Pressable>
              ))}
            </View>
            {assignmentForm?.courseId ? (
              <>
                <AppText style={styles.fieldLabel}>SUBJECT</AppText>
                <View style={styles.chips}>
                  {availableSubjects.length ? availableSubjects.map((subject) => (
                    <Pressable
                      key={subject.id}
                      onPress={() => setAssignmentForm((current) => ({ ...current, subjectId: subject.id }))}
                      style={[styles.chip, assignmentForm?.subjectId === subject.id && styles.chipActive]}
                    >
                      <AppText style={[styles.chipText, assignmentForm?.subjectId === subject.id && styles.chipTextActive]}>{subject.name}</AppText>
                    </Pressable>
                  )) : <AppText style={styles.emptyText}>No subjects configured for this class.</AppText>}
                </View>
              </>
            ) : null}
            <PillButton disabled={saving} loading={saving} onPress={createAssignment} style={styles.saveButton}>Confirm Assignment</PillButton>
          </ScrollView>
        </View>
      </Modal>
    </>
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

function Field({ autoCapitalize, keyboardType, label, onChange, secureTextEntry, value }) {
  return (
    <View style={styles.field}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChange}
        placeholderTextColor={colors.outline}
        secureTextEntry={secureTextEntry}
        style={styles.fieldInput}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { flexDirection: "row", alignItems: "flex-start" },
  headingCopy: { flex: 1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  addButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.secondary },
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
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.goldPale },
  avatarText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardBody: { flex: 1, marginHorizontal: space.sm, gap: 3 },
  cardTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardMeta: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  workloadCount: { color: colors.outline, fontSize: 10 },
  empty: { alignItems: "center", paddingVertical: space.xl },
  emptyTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { position: "absolute", right: 0, bottom: 0, left: 0, maxHeight: "88%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  sheetTop: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  largeAvatar: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: colors.goldPale },
  largeAvatarText: { color: colors.secondary, fontFamily: fonts.display, fontSize: fontSize.lg },
  sheetIdentity: { flex: 1, marginLeft: space.sm },
  sheetName: { color: colors.primary },
  sheetMeta: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceHigh },
  details: { gap: space.sm },
  detail: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingVertical: 4 },
  detailCopy: { flex: 1 },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { marginTop: 2, color: colors.onSurface, fontSize: fontSize.xs },
  workload: { marginTop: space.lg },
  workloadHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm },
  workloadTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  assignButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.full, backgroundColor: colors.secondary },
  assignText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  assignmentRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  assignmentBody: { flex: 1 },
  assignmentTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  assignmentMeta: { color: colors.onSurfaceVariant, fontSize: 10 },
  field: { marginTop: space.md },
  fieldLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase", marginBottom: 6 },
  fieldInput: { height: 48, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  chipText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  chipTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  saveButton: { marginTop: space.lg },
});
