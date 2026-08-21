/**
 * Academics workspace for classes, subjects, and lectures. UI actions are
 * role-aware and every permission boundary is also enforced by the APIs.
 */
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

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function emptyForm(kind) {
  return { kind, id: "", name: "", description: "", status: "active", courseIds: [] };
}

export default function SuperAdminAcademics() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [view, setView] = useState("classes");
  const [courses, setCourses] = useState({ items: [], summary: {}, schedules: [] });
  const [subjects, setSubjects] = useState({ items: [], summary: {}, classOptions: [] });
  const [lectures, setLectures] = useState({ items: [] });
  const [assignmentData, setAssignmentData] = useState({ teachers: [], courses: [], subjects: [], courseSubjects: [] });
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [lectureForm, setLectureForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [courseResult, subjectResult, lectureResult, assignments] = await Promise.all([
        api.admin.courses.list(),
        api.admin.subjects.list(),
        api.admin.lectures(),
        api.coordinator.teacherAssignments.list(),
      ]);
      setCourses(courseResult || { items: [], summary: {}, schedules: [] });
      setSubjects(subjectResult || { items: [], summary: {}, classOptions: [] });
      setLectures(lectureResult || { items: [] });
      setAssignmentData(assignments || { teachers: [], courses: [], subjects: [], courseSubjects: [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load academic records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => {
    const source = view === "classes" ? courses.items : view === "subjects" ? subjects.items : lectures.items;
    const term = search.trim().toLowerCase();
    if (!term) return source || [];
    return (source || []).filter((item) =>
      [item.name, item.title, item.class_mode, item.description, item.assigned_subjects, item.class_level, item.teacher_name, item.subject_name]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [courses.items, lectures.items, search, subjects.items, view]);

  function newLectureForm() {
    const today = new Date().toISOString().slice(0, 10);
    return { id: "", courseId: "", teacherId: "", subjectId: "", title: "", description: "", startDate: today, endDate: today, startTime: "09:00", endTime: "10:00", days: [], googleMeetLink: "" };
  }

  function editLecture(item) {
    const start = new Date(item.scheduled_start);
    const end = new Date(item.scheduled_end);
    const pad = (value) => String(value).padStart(2, "0");
    const localDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const localTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    setLectureForm({ id: item.id, title: item.title || "", description: item.description || "", startDate: localDate(start), endDate: localDate(end), startTime: localTime(start), endTime: localTime(end), googleMeetLink: item.google_meet_link || "", action: "update" });
  }

  async function saveLecture() {
    if (!lectureForm?.title.trim()) {
      Alert.alert("Title required", "Enter a lecture title.");
      return;
    }
    setSaving(true);
    try {
      if (lectureForm.id) {
        await api.coordinator.lectureSchedules.update(lectureForm.id, {
          action: lectureForm.action || "update",
          title: lectureForm.title,
          description: lectureForm.description,
          scheduledStart: `${lectureForm.startDate} ${lectureForm.startTime}:00`,
          scheduledEnd: `${lectureForm.endDate} ${lectureForm.endTime}:00`,
          googleMeetLink: lectureForm.googleMeetLink,
        });
      } else {
        if (!lectureForm.courseId || !lectureForm.teacherId || !lectureForm.subjectId || !lectureForm.days.length) {
          Alert.alert("Schedule incomplete", "Choose a class, teacher, subject, and at least one lecture day.");
          setSaving(false);
          return;
        }
        await api.coordinator.lectureSchedules.create(lectureForm);
      }
      setLectureForm(null);
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to save lecture", nextError?.message || "Review the schedule and try again.");
    } finally {
      setSaving(false);
    }
  }

  function cancelLecture() {
    if (!lectureForm?.id) return;
    Alert.alert("Cancel lecture?", "Students, parents, and the teacher will be notified.", [
      { text: "Keep Lecture", style: "cancel" },
      { text: "Cancel Lecture", style: "destructive", onPress: async () => {
        setSaving(true);
        try {
          await api.coordinator.lectureSchedules.update(lectureForm.id, { action: "cancel" });
          setLectureForm(null);
          await load({ refresh: true });
        } catch (nextError) {
          Alert.alert("Unable to cancel", nextError?.message || "Please try again.");
        } finally {
          setSaving(false);
        }
      } },
    ]);
  }

  function edit(item) {
    setForm({
      kind: view === "classes" ? "class" : "subject",
      id: item.id,
      name: item.name || item.class_mode || "",
      description: item.description || "",
      status: item.status || "active",
      courseIds: item.course_ids || [],
    });
  }

  async function save() {
    if (!form?.name.trim()) {
      Alert.alert("Name required", `Enter a ${form?.kind} name.`);
      return;
    }
    if (form.kind === "subject" && !form.courseIds.length) {
      Alert.alert("Class required", "Assign this subject to at least one class.");
      return;
    }
    setSaving(true);
    try {
      if (form.kind === "class") {
        const payload = { name: form.name, classMode: form.name, description: form.description, status: form.status };
        if (form.id) await api.admin.courses.update(form.id, payload);
        else await api.admin.courses.create(payload);
      } else {
        const payload = { name: form.name, description: form.description, status: form.status, courseIds: form.courseIds };
        if (form.id) await api.admin.subjects.update(form.id, payload);
        else await api.admin.subjects.create(payload);
      }
      setForm(null);
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to save", nextError?.message || "Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  function removeItem() {
    if (!form?.id) return;
    Alert.alert(
      `Delete ${form.kind}?`,
      form.kind === "class"
        ? "This permanently removes the class and its subject links."
        : "This permanently removes the subject and its class assignments.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              if (form.kind === "class") await api.admin.courses.delete(form.id);
              else await api.admin.subjects.delete(form.id);
              setForm(null);
              await load({ refresh: true });
            } catch (nextError) {
              Alert.alert("Unable to delete", nextError?.message || "This record may still be in use.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return <DashboardSkeleton message="Preparing the academic catalog..." />;
  }

  const summary = view === "classes" ? courses.summary : subjects.summary;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <AppText variant="display">Academics</AppText>
            <AppText style={styles.subtitle}>Shape classes, subjects, and the learning structure.</AppText>
          </View>
          {(!isAdmin || view === "lectures") ? (
            <Pressable onPress={() => view === "lectures" ? setLectureForm(newLectureForm()) : setForm(emptyForm(view === "classes" ? "class" : "subject"))} style={styles.addButton}>
              <Ionicons color={colors.white} name="add" size={23} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.tabs}>
          <Tab active={view === "classes"} icon="library-outline" label="Classes" onPress={() => { setView("classes"); setSearch(""); }} />
          <Tab active={view === "subjects"} icon="book-outline" label="Subjects" onPress={() => { setView("subjects"); setSearch(""); }} />
          <Tab active={view === "lectures"} icon="calendar-outline" label="Lectures" onPress={() => { setView("lectures"); setSearch(""); }} />
        </View>

        <View style={styles.stats}>
          <Stat label="Total" value={view === "lectures" ? lectures.items?.length || 0 : summary?.total || 0} />
          <Stat label={view === "lectures" ? "Upcoming" : "Active"} value={view === "lectures" ? lectures.items?.filter((item) => item.display_status === "upcoming").length || 0 : summary?.active || 0} />
          <Stat label={view === "classes" ? "Schedules" : view === "subjects" ? "Inactive" : "Completed"} value={view === "classes" ? courses.summary?.schedules || 0 : view === "subjects" ? subjects.summary?.inactive || 0 : lectures.items?.filter((item) => ["completed_by_teacher", "verified_by_coordinator"].includes(item.status)).length || 0} />
        </View>

        {isAdmin && view !== "lectures" ? (
          <View style={styles.note}><Ionicons color={colors.secondary} name="lock-closed-outline" size={20} /><AppText style={styles.noteText}>The class and subject catalogs are read-only for Admin. Super Admin controls structural changes.</AppText></View>
        ) : null}

        <View style={styles.search}>
          <Ionicons color={colors.outline} name="search-outline" size={20} />
          <TextInput
            onChangeText={setSearch}
            placeholder={`Search ${view}...`}
            placeholderTextColor={colors.outline}
            style={styles.searchInput}
            value={search}
          />
          {search ? <Pressable onPress={() => setSearch("")}><Ionicons color={colors.outline} name="close-circle" size={20} /></Pressable> : null}
        </View>

        {error ? <SurfaceCard style={styles.error}><Ionicons color={colors.error} name="cloud-offline-outline" size={25} /><View style={styles.errorBody}><AppText style={styles.errorTitle}>Academic catalog unavailable</AppText><AppText style={styles.errorText}>{error}</AppText></View><Pressable onPress={() => load()}><AppText style={styles.retry}>Retry</AppText></Pressable></SurfaceCard> : null}

        <View style={styles.listHeader}>
          <AppText style={styles.sectionTitle}>{view === "classes" ? "Class Catalog" : view === "subjects" ? "Subject Catalog" : "Lecture Operations"}</AppText>
          <AppText style={styles.resultCount}>{items.length} records</AppText>
        </View>
        <View style={styles.list}>
          {items.length ? items.map((item, index) => (
            <Pressable disabled={isAdmin && view !== "lectures"} key={item.id} onPress={() => view === "lectures" ? editLecture(item) : edit(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={[styles.icon, index % 3 === 1 && styles.goldIcon, index % 3 === 2 && styles.roseIcon]}>
                <Ionicons color={colors.primary} name={view === "classes" ? "school-outline" : view === "subjects" ? "book-outline" : "calendar-outline"} size={22} />
              </View>
              <View style={styles.cardBody}>
                <AppText numberOfLines={1} style={styles.cardTitle}>{item.name || item.class_mode || item.title || "Untitled"}</AppText>
                <AppText numberOfLines={2} style={styles.cardMeta}>
                  {view === "classes"
                    ? item.assigned_subjects || item.description || "No subjects assigned"
                    : view === "subjects" ? item.class_level || item.description || "No classes assigned" : `${item.teacher_name || "Teacher"} · ${item.class_level || "Class"} · ${item.subject_name || "Subject"}`}
                </AppText>
                <StatusChip tone={["active", "verified_by_coordinator"].includes(item.status) ? "success" : "warning"}>{readable(view === "lectures" ? item.display_status || item.status : item.status)}</StatusChip>
              </View>
              <Ionicons color={colors.outline} name={isAdmin && view !== "lectures" ? "lock-closed-outline" : "chevron-forward"} size={20} />
            </Pressable>
          )) : <View style={styles.empty}><Ionicons color={colors.outline} name={view === "classes" ? "library-outline" : view === "subjects" ? "book-outline" : "calendar-outline"} size={31} /><AppText style={styles.emptyTitle}>No {view} found</AppText><AppText style={styles.emptyText}>{isAdmin && view !== "lectures" ? "No catalog records are currently available." : "Create one with the plus button above."}</AppText></View>}
        </View>

        {view === "classes" ? (
          <>
            <View style={styles.listHeader}><AppText style={styles.sectionTitle}>Recent Schedules</AppText></View>
            <SurfaceCard style={styles.scheduleCard}>
              {(courses.schedules || []).length ? courses.schedules.slice(0, 5).map((item, index) => (
                <View key={item.id || index} style={styles.schedule}>
                  <Ionicons color={colors.emeraldMid} name="calendar-outline" size={19} />
                  <View style={styles.scheduleBody}><AppText numberOfLines={1} style={styles.scheduleTitle}>{item.title}</AppText><AppText style={styles.scheduleTime}>{item.schedule_time ? new Date(item.schedule_time).toLocaleDateString() : "Schedule pending"}</AppText></View>
                  <StatusChip tone={item.status === "completed" ? "success" : "neutral"}>{readable(item.status)}</StatusChip>
                </View>
              )) : <View style={styles.schedule}><AppText style={styles.emptyText}>No recent lecture schedules.</AppText></View>}
            </SurfaceCard>
          </>
        ) : null}
      </Screen>

      <Modal animationType="slide" onRequestClose={() => !saving && setForm(null)} transparent visible={Boolean(form)}>
        <Pressable onPress={() => !saving && setForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHeader}>
              <View><AppText variant="heading">{form?.id ? "Edit" : "Create"} {readable(form?.kind)}</AppText><AppText style={styles.sheetSubtitle}>Changes apply across the learning portal.</AppText></View>
              <Pressable disabled={saving} onPress={() => setForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>

            <AppText style={styles.fieldLabel}>{form?.kind === "class" ? "CLASS NAME" : "SUBJECT NAME"}</AppText>
            <TextInput onChangeText={(name) => setForm((current) => ({ ...current, name }))} placeholder={form?.kind === "class" ? "e.g. Grade 4" : "e.g. Mathematics"} placeholderTextColor={colors.outline} style={styles.input} value={form?.name || ""} />
            <AppText style={styles.fieldLabel}>DESCRIPTION</AppText>
            <TextInput multiline onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Add a short description" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} textAlignVertical="top" value={form?.description || ""} />

            <AppText style={styles.fieldLabel}>STATUS</AppText>
            <View style={styles.statuses}>
              {["active", form?.kind === "class" ? "pending" : "inactive"].map((item) => <SelectChip active={form?.status === item} key={item} label={readable(item)} onPress={() => setForm((current) => ({ ...current, status: item }))} />)}
            </View>

            {form?.kind === "subject" ? (
              <>
                <AppText style={styles.fieldLabel}>ASSIGNED CLASSES</AppText>
                <View style={styles.classOptions}>
                  {(subjects.classOptions || []).map((course) => {
                    const active = form.courseIds.includes(course.id);
                    return <SelectChip active={active} key={course.id} label={course.class_level || course.title} onPress={() => setForm((current) => ({ ...current, courseIds: active ? current.courseIds.filter((id) => id !== course.id) : [...current.courseIds, course.id] }))} />;
                  })}
                </View>
              </>
            ) : (
              <View style={styles.note}><Ionicons color={colors.secondary} name="information-circle-outline" size={20} /><AppText style={styles.noteText}>Subjects from the academic catalog are linked automatically when a recognized class level is saved.</AppText></View>
            )}

            <View style={styles.formActions}>
              <PillButton loading={saving} onPress={save}>{form?.id ? "Save Changes" : `Create ${readable(form?.kind)}`}</PillButton>
              {form?.id ? <PillButton disabled={saving} onPress={removeItem} variant="secondary">Delete {readable(form?.kind)}</PillButton> : null}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => !saving && setLectureForm(null)} transparent visible={Boolean(lectureForm)}>
        <Pressable onPress={() => !saving && setLectureForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHeader}><View><AppText variant="heading">{lectureForm?.id ? "Manage Lecture" : "Schedule Lecture"}</AppText><AppText style={styles.sheetSubtitle}>Teacher time conflicts are checked automatically.</AppText></View><Pressable onPress={() => setLectureForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable></View>
            {!lectureForm?.id ? (
              <>
                <AppText style={styles.fieldLabel}>CLASS</AppText>
                <View style={styles.classOptions}>{assignmentData.courses.map((item) => <SelectChip active={lectureForm?.courseId === item.id} key={item.id} label={item.class_level || item.title} onPress={() => setLectureForm((current) => ({ ...current, courseId: item.id, subjectId: "", teacherId: "" }))} />)}</View>
                <AppText style={styles.fieldLabel}>SUBJECT</AppText>
                <SubjectDropdown
                  allowAll={false}
                  onChange={(subjectId) => setLectureForm((current) => ({ ...current, subjectId, teacherId: "" }))}
                  options={assignmentData.subjects.filter((subject) => assignmentData.courseSubjects.some((link) => link.course_id === lectureForm?.courseId && link.subject_id === subject.id))}
                  placeholder="Choose a subject"
                  selectedId={lectureForm?.subjectId}
                />
                <AppText style={styles.fieldLabel}>TEACHER</AppText>
                <View style={styles.classOptions}>{assignmentData.teachers.filter((teacher) => assignmentData.items?.some((assignment) => assignment.teacher_id === teacher.id && assignment.course_id === lectureForm?.courseId && assignment.subject_id === lectureForm?.subjectId)).map((item) => <SelectChip active={lectureForm?.teacherId === item.id} key={item.id} label={item.full_name} onPress={() => setLectureForm((current) => ({ ...current, teacherId: item.id }))} />)}</View>
              </>
            ) : null}
            <AppText style={styles.fieldLabel}>TITLE</AppText>
            <TextInput onChangeText={(title) => setLectureForm((current) => ({ ...current, title }))} placeholder="Lecture title" placeholderTextColor={colors.outline} style={styles.input} value={lectureForm?.title || ""} />
            <AppText style={styles.fieldLabel}>DESCRIPTION</AppText>
            <TextInput multiline onChangeText={(description) => setLectureForm((current) => ({ ...current, description }))} placeholder="Optional description" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} value={lectureForm?.description || ""} />
            <View style={styles.dateRow}><View style={styles.half}><AppText style={styles.fieldLabel}>START DATE</AppText><TextInput onChangeText={(startDate) => setLectureForm((current) => ({ ...current, startDate }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.outline} style={styles.input} value={lectureForm?.startDate || ""} /></View><View style={styles.half}><AppText style={styles.fieldLabel}>END DATE</AppText><TextInput onChangeText={(endDate) => setLectureForm((current) => ({ ...current, endDate }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.outline} style={styles.input} value={lectureForm?.endDate || ""} /></View></View>
            <View style={styles.dateRow}><View style={styles.half}><AppText style={styles.fieldLabel}>START TIME</AppText><TextInput onChangeText={(startTime) => setLectureForm((current) => ({ ...current, startTime }))} placeholder="09:00" placeholderTextColor={colors.outline} style={styles.input} value={lectureForm?.startTime || ""} /></View><View style={styles.half}><AppText style={styles.fieldLabel}>END TIME</AppText><TextInput onChangeText={(endTime) => setLectureForm((current) => ({ ...current, endTime }))} placeholder="10:00" placeholderTextColor={colors.outline} style={styles.input} value={lectureForm?.endTime || ""} /></View></View>
            {!lectureForm?.id ? <><AppText style={styles.fieldLabel}>LECTURE DAYS</AppText><View style={styles.classOptions}>{["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day) => <SelectChip active={lectureForm?.days.includes(day)} key={day} label={readable(day)} onPress={() => setLectureForm((current) => ({ ...current, days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day] }))} />)}</View></> : null}
            <AppText style={styles.fieldLabel}>GOOGLE MEET LINK</AppText>
            <TextInput autoCapitalize="none" onChangeText={(googleMeetLink) => setLectureForm((current) => ({ ...current, googleMeetLink }))} placeholder="https://meet.google.com/..." placeholderTextColor={colors.outline} style={styles.input} value={lectureForm?.googleMeetLink || ""} />
            {lectureForm?.id ? <View style={styles.statuses}><SelectChip active={lectureForm.action === "update"} label="Update" onPress={() => setLectureForm((current) => ({ ...current, action: "update" }))} /><SelectChip active={lectureForm.action === "reschedule"} label="Reschedule" onPress={() => setLectureForm((current) => ({ ...current, action: "reschedule" }))} /></View> : null}
            <View style={styles.formActions}><PillButton loading={saving} onPress={saveLecture}>{lectureForm?.id ? "Save Lecture" : "Create Schedule"}</PillButton>{lectureForm?.id && !["cancelled", "rescheduled"].includes(lectureForm.status) ? <PillButton disabled={saving} onPress={cancelLecture} variant="secondary">Cancel Lecture</PillButton> : null}</View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Tab({ active, icon, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><Ionicons color={active ? colors.white : colors.secondary} name={icon} size={19} /><AppText style={[styles.tabText, active && styles.activeTabText]}>{label}</AppText></Pressable>;
}

function Stat({ label, value }) {
  return <View style={styles.stat}><AppText style={styles.statValue}>{String(value)}</AppText><AppText style={styles.statLabel}>{label}</AppText></View>;
}

function SelectChip({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.selectChip, active && styles.activeSelect]}><Ionicons color={active ? colors.white : colors.outline} name={active ? "checkmark-circle" : "ellipse-outline"} size={16} /><AppText style={[styles.selectText, active && styles.activeSelectText]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headingText: { flex: 1 },
  subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  addButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center", marginLeft: space.md, borderRadius: 23, backgroundColor: colors.primaryContainer, ...shadows.button },
  tabs: { flexDirection: "row", gap: space.sm, marginTop: space.lg, padding: 4, borderRadius: radius.full, backgroundColor: colors.surfaceLow },
  tab: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.full },
  activeTab: { backgroundColor: colors.primary },
  tabText: { marginLeft: space.xs, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  activeTabText: { color: colors.white },
  stats: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  stat: { flex: 1, alignItems: "center", paddingVertical: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  statValue: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  statLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  search: { minHeight: 50, flexDirection: "row", alignItems: "center", marginTop: space.md, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface },
  searchInput: { flex: 1, marginHorizontal: space.sm, color: colors.onSurface, fontFamily: fonts.body, fontSize: fontSize.sm },
  error: { flexDirection: "row", alignItems: "center", marginTop: space.md },
  errorBody: { flex: 1, marginHorizontal: space.sm },
  errorTitle: { color: colors.error, fontFamily: fonts.bodyBold },
  errorText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  retry: { color: colors.secondary, fontFamily: fonts.bodyBold },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  resultCount: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  list: { gap: space.sm },
  card: { minHeight: 96, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  icon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "#DDF4EA" },
  goldIcon: { backgroundColor: colors.goldPale },
  roseIcon: { backgroundColor: colors.roseBg },
  cardBody: { flex: 1, marginHorizontal: space.md },
  cardTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardMeta: { minHeight: 28, marginTop: 2, color: colors.outline, fontSize: fontSize.xs },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  empty: { alignItems: "center", padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  emptyTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyText: { color: colors.outline, fontSize: fontSize.xs },
  scheduleCard: { paddingVertical: space.xs },
  schedule: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm },
  scheduleBody: { flex: 1, marginHorizontal: space.sm },
  scheduleTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  scheduleTime: { color: colors.outline, fontSize: 10 },
  backdrop: { flex: 1, backgroundColor: "rgba(3, 36, 27, 0.48)" },
  sheet: { maxHeight: "88%", borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", marginTop: space.sm, borderRadius: 2, backgroundColor: colors.borderGreen },
  sheetContent: { padding: space.lg, paddingBottom: 36 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetSubtitle: { marginTop: 2, color: colors.outline, fontSize: fontSize.xs },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surface },
  fieldLabel: { marginTop: space.lg, marginBottom: space.xs, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  input: { minHeight: 50, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface },
  textarea: { minHeight: 88, paddingTop: space.md },
  statuses: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  classOptions: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  selectChip: { minHeight: 36, flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: 18, backgroundColor: colors.surface },
  activeSelect: { borderColor: colors.primary, backgroundColor: colors.primary },
  selectText: { marginLeft: 5, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: 11 },
  activeSelectText: { color: colors.white },
  note: { flexDirection: "row", marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  noteText: { flex: 1, marginLeft: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  formActions: { gap: space.sm, marginTop: space.xl },
  dateRow: { flexDirection: "row", gap: space.sm },
  half: { flex: 1 },
});
