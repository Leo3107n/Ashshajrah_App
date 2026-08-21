/** User directory and management UI with protected-account role boundaries. */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import api from "../../../src/api";
import SubjectDropdown from "../../../src/components/SubjectDropdown";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

const ROLES = ["all", "superadmin", "admin", "coordinator", "teacher", "parent", "student"];
const STATUSES = ["all", "active", "suspended", "archived"];

function title(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(user) {
  return String(user?.name || user?.email || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function roleTone(role) {
  if (["superadmin", "admin"].includes(role)) return "warning";
  if (["teacher", "coordinator"].includes(role)) return "success";
  return "neutral";
}

export default function SuperAdminUsers() {
  const { role: actorRole, user: currentUser } = useAuth();
  const [result, setResult] = useState({ items: [], summary: {} });
  const [assignmentData, setAssignmentData] = useState({ items: [], teachers: [], courses: [], subjects: [], courseSubjects: [] });
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [staffForm, setStaffForm] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState(null);

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [response, assignments] = await Promise.all([
        api.admin.users.list({
          role: role === "all" ? undefined : role,
          status: status === "all" ? undefined : status,
        }),
        api.coordinator.teacherAssignments.list(),
      ]);
      setResult(response || { items: [], summary: {} });
      setAssignmentData(assignments || { items: [], teachers: [], courses: [], subjects: [], courseSubjects: [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load users.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, status]);

  useEffect(() => {
    load();
  }, [load]);

  const users = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return result.items || [];
    return (result.items || []).filter((item) =>
      [item.name, item.email, item.phone, item.username, item.class_level]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [result.items, search]);

  function updateStatus(item) {
    const nextStatus = item.status === "active" ? "suspended" : "active";
    Alert.alert(
      `${nextStatus === "active" ? "Activate" : "Suspend"} account?`,
      `${item.name || "This user"} will ${nextStatus === "active" ? "regain" : "lose"} portal access.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextStatus === "active" ? "Activate" : "Suspend",
          style: nextStatus === "active" ? "default" : "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              await api.admin.users.setStatus(item.id, { status: nextStatus });
              setSelected((current) => current ? { ...current, status: nextStatus } : current);
              await load({ refresh: true });
            } catch (nextError) {
              Alert.alert("Update failed", nextError?.message || "Unable to update this account.");
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }

  function resetPassword(item) {
    Alert.alert(
      "Reset password?",
      "A new temporary password will replace the current password immediately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Password",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              const response = await api.admin.users.resetPassword(item.id);
              setTemporaryPassword(response?.temporaryPassword || "");
            } catch (nextError) {
              Alert.alert("Reset failed", nextError?.message || "Unable to reset the password.");
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }

  async function createStaff() {
    if (!staffForm?.fullName.trim() || !staffForm?.email.trim()) {
      Alert.alert("Details required", "Full name and email are required.");
      return;
    }
    if (staffForm.password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    setWorking(true);
    try {
      const response = await api.admin.staff.create(staffForm);
      const createdPassword = response?.item?.temporary_password || staffForm.password;
      setStaffForm(null);
      await load({ refresh: true });
      Alert.alert(
        "Staff account created",
        `The ${staffForm.role} account is active.\n\nTemporary password: ${createdPassword}\n\nSave this password securely now.`
      );
    } catch (nextError) {
      Alert.alert("Unable to create staff", nextError?.message || "Review the details and try again.");
    } finally {
      setWorking(false);
    }
  }

  async function createAssignment() {
    if (!assignmentForm?.teacherId || !assignmentForm?.courseId || !assignmentForm?.subjectId) {
      Alert.alert("Assignment incomplete", "Choose a teacher, class, and subject.");
      return;
    }
    setWorking(true);
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
      setWorking(false);
    }
  }

  if (loading) {
    return <DashboardSkeleton message="Growing the community directory..." />;
  }

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <AppText variant="display">User Management</AppText>
            <AppText style={styles.subtitle}>Manage access across the learning community.</AppText>
          </View>
          <View style={styles.headingActions}>
            <View style={styles.total}><AppText style={styles.totalValue}>{result.summary?.total ?? users.length}</AppText><AppText style={styles.totalLabel}>USERS</AppText></View>
            <Pressable onPress={() => setStaffForm({ fullName: "", email: "", phone: "", password: "", role: "teacher" })} style={styles.addStaff}><Ionicons color={colors.white} name="person-add-outline" size={20} /></Pressable>
          </View>
        </View>

        <View style={styles.search}>
          <Ionicons color={colors.outline} name="search-outline" size={20} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setSearch}
            placeholder="Search name, email, phone..."
            placeholderTextColor={colors.outline}
            style={styles.searchInput}
            value={search}
          />
          {search ? <Pressable onPress={() => setSearch("")}><Ionicons color={colors.outline} name="close-circle" size={20} /></Pressable> : null}
        </View>

        <AppText style={styles.filterLabel}>ROLE</AppText>
        <View style={styles.chipFrame}>
          <ScrollView alwaysBounceVertical={false} horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail} contentContainerStyle={styles.chips}>
            {ROLES.map((item) => <FilterChip active={role === item} key={item} label={title(item)} onPress={() => setRole(item)} />)}
          </ScrollView>
        </View>
        <AppText style={styles.filterLabel}>STATUS</AppText>
        <View style={styles.chipFrame}>
          <ScrollView alwaysBounceVertical={false} horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail} contentContainerStyle={styles.chips}>
            {STATUSES.map((item) => <FilterChip active={status === item} key={item} label={title(item)} onPress={() => setStatus(item)} />)}
          </ScrollView>
        </View>

        {error ? (
          <SurfaceCard style={styles.errorCard}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={25} />
            <View style={styles.errorBody}><AppText style={styles.errorTitle}>Directory unavailable</AppText><AppText style={styles.errorText}>{error}</AppText></View>
            <Pressable onPress={() => load()}><AppText style={styles.retryText}>Retry</AppText></Pressable>
          </SurfaceCard>
        ) : null}

        <View style={styles.listHeader}>
          <AppText style={styles.sectionTitle}>Community Directory</AppText>
          <AppText style={styles.resultCount}>{users.length} results</AppText>
        </View>
        <View style={styles.list}>
          {users.length ? users.map((item) => (
            <Pressable key={item.id} onPress={() => { setSelected(item); setTemporaryPassword(""); }} style={({ pressed }) => [styles.userCard, pressed && styles.pressed]}>
              <View style={styles.avatar}><AppText style={styles.avatarText}>{initials(item)}</AppText></View>
              <View style={styles.userBody}>
                <AppText numberOfLines={1} style={styles.userName}>{item.name || "Unnamed user"}</AppText>
                <AppText numberOfLines={1} style={styles.userContact}>{item.email || item.username || item.phone || "No contact details"}</AppText>
                <View style={styles.badges}><StatusChip tone={roleTone(item.role)}>{title(item.role)}</StatusChip><StatusChip tone={item.status === "active" ? "success" : item.status === "suspended" ? "danger" : "neutral"}>{title(item.status)}</StatusChip></View>
              </View>
              <Ionicons color={colors.outline} name="chevron-forward" size={20} />
            </Pressable>
          )) : <View style={styles.empty}><Ionicons color={colors.outline} name="people-outline" size={30} /><AppText style={styles.emptyTitle}>No users found</AppText><AppText style={styles.emptyText}>Try another role, status, or search.</AppText></View>}
        </View>
      </Screen>

      <Modal animationType="slide" onRequestClose={() => setSelected(null)} transparent visible={Boolean(selected)}>
        <Pressable onPress={() => setSelected(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetTop}>
              <View style={styles.largeAvatar}><AppText style={styles.largeAvatarText}>{initials(selected)}</AppText></View>
              <View style={styles.sheetIdentity}><AppText style={styles.sheetName} variant="heading">{selected?.name || "Unnamed user"}</AppText><AppText style={styles.sheetMeta}>{title(selected?.role)} account</AppText></View>
              <Pressable onPress={() => setSelected(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <SurfaceCard style={styles.details}>
              <Detail icon="mail-outline" label="Email" value={selected?.email} />
              <Detail icon="call-outline" label="Phone" value={selected?.phone} />
              <Detail icon="at-outline" label="Username" value={selected?.username} />
              <Detail icon="school-outline" label="Class" value={selected?.class_level || selected?.course_title} />
              <Detail icon="shield-checkmark-outline" label="Status" value={title(selected?.status)} />
            </SurfaceCard>

            {selected?.role === "teacher" ? (
              <View style={styles.workload}>
                <View style={styles.workloadHeader}>
                  <View><AppText style={styles.workloadTitle}>Teaching Workload</AppText><AppText style={styles.sheetMeta}>{assignmentData.items.filter((item) => item.teacher_name === selected?.name).length} active assignments</AppText></View>
                  <Pressable
                    onPress={() => {
                      const teacher = assignmentData.teachers.find((item) => item.full_name === selected?.name);
                      setAssignmentForm({ teacherId: teacher?.id || "", courseId: "", subjectId: "" });
                    }}
                    style={styles.assignButton}
                  >
                    <Ionicons color={colors.white} name="add" size={18} /><AppText style={styles.assignText}>Assign</AppText>
                  </Pressable>
                </View>
                {assignmentData.items.filter((item) => item.teacher_name === selected?.name).map((item) => (
                  <View key={item.id} style={styles.assignmentRow}>
                    <Ionicons color={colors.emeraldMid} name="school-outline" size={19} />
                    <View style={styles.assignmentBody}><AppText style={styles.assignmentTitle}>{item.course_title || "Class"}</AppText><AppText style={styles.assignmentMeta}>{item.subject_name || "Subject"}</AppText></View>
                    <StatusChip tone={item.status === "active" ? "success" : "neutral"}>{title(item.status)}</StatusChip>
                  </View>
                ))}
              </View>
            ) : null}

            {temporaryPassword ? (
              <View style={styles.passwordCard}>
                <AppText style={styles.passwordLabel}>TEMPORARY PASSWORD</AppText>
                <AppText selectable style={styles.password}>{temporaryPassword}</AppText>
                <AppText style={styles.passwordHint}>Press and hold the password to copy it. Save it now; it will not be shown again after this panel closes.</AppText>
              </View>
            ) : null}

            {selected?.id === currentUser?.id ? (
              <View style={styles.selfNotice}><Ionicons color={colors.secondary} name="information-circle-outline" size={20} /><AppText style={styles.selfText}>Use Profile to manage your own account.</AppText></View>
            ) : selected?.manageable === false || (actorRole === "admin" && ["superadmin", "admin"].includes(selected?.role)) ? (
              <View style={styles.selfNotice}><Ionicons color={colors.secondary} name="lock-closed-outline" size={20} /><AppText style={styles.selfText}>This administrator account is read-only. Only a Super Admin can change its access, role, or password.</AppText></View>
            ) : (
              <View style={styles.actions}>
                <PillButton disabled={working} onPress={() => updateStatus(selected)} variant={selected?.status === "active" ? "danger" : "primary"}>
                  {working ? "Please wait..." : selected?.status === "active" ? "Suspend Account" : "Activate Account"}
                </PillButton>
                <PillButton disabled={working} onPress={() => resetPassword(selected)} variant="secondary">Reset Password</PillButton>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => !working && setStaffForm(null)} transparent visible={Boolean(staffForm)}>
        <Pressable onPress={() => !working && setStaffForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetTop}>
              <View style={styles.sheetIdentity}><AppText variant="heading">Create Staff Account</AppText><AppText style={styles.sheetMeta}>{actorRole === "superadmin" ? "Add an administrator, coordinator, or teacher." : "Add a coordinator or teacher."}</AppText></View>
              <Pressable disabled={working} onPress={() => setStaffForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <StaffInput label="FULL NAME" onChange={(fullName) => setStaffForm((current) => ({ ...current, fullName }))} placeholder="Staff member's name" value={staffForm?.fullName} />
            <StaffInput autoCapitalize="none" keyboardType="email-address" label="EMAIL" onChange={(email) => setStaffForm((current) => ({ ...current, email }))} placeholder="name@ashshajrah.com" value={staffForm?.email} />
            <StaffInput keyboardType="phone-pad" label="PHONE (OPTIONAL)" onChange={(phone) => setStaffForm((current) => ({ ...current, phone }))} placeholder="+92..." value={staffForm?.phone} />
            <StaffInput autoCapitalize="none" label="TEMPORARY PASSWORD" onChange={(password) => setStaffForm((current) => ({ ...current, password }))} placeholder="At least 8 characters" secureTextEntry value={staffForm?.password} />
            <AppText style={styles.staffLabel}>ROLE</AppText>
            <View style={styles.roleOptions}>
              {(actorRole === "superadmin" ? ["admin", "coordinator", "teacher"] : ["coordinator", "teacher"]).map((item) => <FilterChip active={staffForm?.role === item} key={item} label={title(item)} onPress={() => setStaffForm((current) => ({ ...current, role: item }))} />)}
            </View>
            <View style={styles.selfNotice}><Ionicons color={colors.secondary} name="information-circle-outline" size={20} /><AppText style={styles.selfText}>The account will be active immediately and required to use this temporary password.</AppText></View>
            <PillButton loading={working} onPress={createStaff} style={styles.createButton}>Create Staff Account</PillButton>
          </ScrollView>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => !working && setAssignmentForm(null)} transparent visible={Boolean(assignmentForm)}>
        <Pressable onPress={() => !working && setAssignmentForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetTop}><View style={styles.sheetIdentity}><AppText variant="heading">Assign Teacher</AppText><AppText style={styles.sheetMeta}>Connect a teacher to one class subject.</AppText></View><Pressable onPress={() => setAssignmentForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable></View>
            <AppText style={styles.staffLabel}>CLASS</AppText>
            <View style={styles.optionGrid}>
              {assignmentData.courses.map((item) => <FilterChip active={assignmentForm?.courseId === item.id} key={item.id} label={item.class_level || item.title} onPress={() => setAssignmentForm((current) => ({ ...current, courseId: item.id, subjectId: "" }))} />)}
            </View>
            <AppText style={styles.staffLabel}>SUBJECT</AppText>
            <SubjectDropdown
              allowAll={false}
              onChange={(subjectId) => setAssignmentForm((current) => ({ ...current, subjectId }))}
              options={assignmentData.subjects.filter((subject) => !assignmentForm?.courseId || assignmentData.courseSubjects.some((link) => link.course_id === assignmentForm.courseId && link.subject_id === subject.id))}
              placeholder="Choose a subject"
              selectedId={assignmentForm?.subjectId}
            />
            <View style={styles.selfNotice}><Ionicons color={colors.secondary} name="time-outline" size={20} /><AppText style={styles.selfText}>Lecture scheduling will still prevent this teacher from being placed in overlapping time slots.</AppText></View>
            <PillButton loading={working} onPress={createAssignment} style={styles.createButton}>Save Assignment</PillButton>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function FilterChip({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.activeChip]}><AppText style={[styles.chipText, active && styles.activeChipText]}>{label}</AppText></Pressable>;
}

function Detail({ icon, label, value }) {
  if (!value) return null;
  return <View style={styles.detail}><Ionicons color={colors.emeraldMid} name={icon} size={19} /><View style={styles.detailBody}><AppText style={styles.detailLabel}>{label}</AppText><AppText selectable style={styles.detailValue}>{String(value)}</AppText></View></View>;
}

function StaffInput({ autoCapitalize, keyboardType, label, onChange, placeholder, secureTextEntry, value }) {
  return <><AppText style={styles.staffLabel}>{label}</AppText><TextInput autoCapitalize={autoCapitalize} keyboardType={keyboardType} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.outline} secureTextEntry={secureTextEntry} style={styles.staffInput} value={value || ""} /></>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { flexDirection: "row", alignItems: "center", gap: space.sm },
  headingCopy: { flex: 1, minWidth: 0 },
  headingActions: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: space.xs },
  subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  total: { width: 58, height: 52, flexShrink: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xs, borderRadius: radius.lg, backgroundColor: colors.primaryContainer },
  totalValue: { color: colors.white, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  totalLabel: { color: "#B9EEDB", fontFamily: fonts.bodyBold, fontSize: 8 },
  addStaff: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.primary },
  search: { minHeight: 50, flexDirection: "row", alignItems: "center", marginTop: space.lg, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface },
  searchInput: { flex: 1, marginHorizontal: space.sm, color: colors.onSurface, fontFamily: fonts.body, fontSize: fontSize.sm },
  filterLabel: { marginTop: space.md, marginBottom: space.xs, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  chipFrame: { height: 46, minHeight: 46, maxHeight: 46, overflow: "hidden" },
  chipRail: { height: 46, minHeight: 46, maxHeight: 46, flexGrow: 0 },
  chips: { height: 46, minHeight: 46, maxHeight: 46, alignItems: "center", gap: space.xs, paddingRight: space.lg },
  chip: { height: 36, minHeight: 36, maxHeight: 36, flexGrow: 0, flexShrink: 0, alignSelf: "center", alignItems: "center", justifyContent: "center", paddingHorizontal: space.md, paddingVertical: 0, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: 18, backgroundColor: colors.surface },
  activeChip: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { flexGrow: 0, flexShrink: 0, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 14 },
  activeChipText: { color: colors.white },
  errorCard: { flexDirection: "row", alignItems: "center", marginTop: space.md },
  errorBody: { flex: 1, marginHorizontal: space.sm },
  errorTitle: { color: colors.error, fontFamily: fonts.bodyBold },
  errorText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  retryText: { color: colors.secondary, fontFamily: fonts.bodyBold },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  resultCount: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  list: { gap: space.sm },
  userCard: { minHeight: 92, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  avatar: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "#DDF4EA" },
  avatarText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  userBody: { flex: 1, marginHorizontal: space.md },
  userName: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  userContact: { marginTop: 1, color: colors.outline, fontSize: fontSize.xs },
  badges: { flexDirection: "row", gap: space.xs, marginTop: space.xs },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  empty: { alignItems: "center", padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  emptyTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyText: { marginTop: 2, color: colors.outline, fontSize: fontSize.xs },
  backdrop: { flex: 1, backgroundColor: "rgba(3, 36, 27, 0.48)" },
  sheet: { maxHeight: "84%", borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", marginTop: space.sm, borderRadius: 2, backgroundColor: colors.borderGreen },
  sheetContent: { padding: space.lg, paddingBottom: 36 },
  sheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  largeAvatar: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: colors.primaryContainer },
  largeAvatarText: { color: colors.white, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  sheetIdentity: { flex: 1, marginLeft: space.md },
  sheetName: { color: colors.primary },
  sheetMeta: { color: colors.outline, fontSize: fontSize.xs },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surface },
  details: { marginTop: space.lg, paddingVertical: space.xs },
  detail: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: space.md },
  detailBody: { flex: 1, marginLeft: space.sm },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { color: colors.onSurface, fontSize: fontSize.sm },
  passwordCard: { marginTop: space.md, padding: space.lg, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.xl, backgroundColor: colors.goldPale },
  passwordLabel: { color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  password: { marginTop: space.xs, color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.xl },
  passwordHint: { marginTop: space.sm, color: colors.onSurfaceVariant, fontSize: 10 },
  selfNotice: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  selfText: { flex: 1, marginLeft: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  actions: { gap: space.sm, marginTop: space.lg },
  staffLabel: { marginTop: space.lg, marginBottom: space.xs, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  staffInput: { minHeight: 50, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface },
  roleOptions: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  createButton: { marginTop: space.lg },
  workload: { marginTop: space.lg, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface },
  workloadHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm },
  workloadTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  assignButton: { minHeight: 34, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, borderRadius: 17, backgroundColor: colors.primary },
  assignText: { marginLeft: 3, color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 },
  assignmentRow: { minHeight: 54, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.borderGreen },
  assignmentBody: { flex: 1, marginHorizontal: space.sm },
  assignmentTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  assignmentMeta: { color: colors.outline, fontSize: 10 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
