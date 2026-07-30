/**
 * Teacher Homework Management.
 *
 * This screen combines three role-scoped backend workflows: viewing homework
 * batches, assigning/editing work for an owned lecture, and reviewing student
 * submissions. The API creates one database row per student, while this UI
 * deliberately presents those rows as one assignment card.
 */
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const EMPTY_FORM = { lectureId: "", title: "", description: "", dueDate: "", originalTitle: "" };
const day = (value) => value ? String(value).slice(0, 10) : "";
const readableDate = (value) => value ? new Date(`${day(value)}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "No due date";
const lectureLabel = (item) => `${item.subject_name || item.title || "Lecture"} · ${item.class_level || item.course_title || "Class"}`;

export default function TeacherHomework() {
  const [tab, setTab] = useState("assignments");
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formVisible, setFormVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(null);
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      // Fetch independently so one request cannot accidentally broaden the
      // ownership scope of another resource.
      const [homeworkData, submissionData, lectureData] = await Promise.all([
        api.teacher.homework.list(),
        api.teacher.homework.submissions(),
        api.teacher.lectures.list(),
      ]);
      setAssignments(homeworkData?.items || []);
      setSubmissions(submissionData?.items || []);
      setLectures(lectureData?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load homework.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => ({
    assigned: assignments.length,
    submitted: assignments.reduce((sum, item) => sum + Number(item.submitted_count || 0), 0),
    pending: assignments.reduce((sum, item) => sum + Number(item.pending_count || 0), 0),
  }), [assignments]);

  function openCreate() {
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    setForm({ ...EMPTY_FORM, dueDate: nextWeek });
    setFormVisible(true);
  }

  function openEdit(item) {
    setForm({
      lectureId: item.lecture_id,
      title: item.title || "",
      description: item.description || "",
      dueDate: day(item.due_date),
      originalTitle: item.title || "",
    });
    setFormVisible(true);
  }

  async function saveAssignment() {
    if (!form.lectureId || !form.title.trim()) {
      Alert.alert("Missing details", "Select a lecture and enter a homework title.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim(), description: form.description.trim() };
      const result = form.originalTitle
        ? await api.teacher.homework.update(payload)
        : await api.teacher.homework.create(payload);
      setFormVisible(false);
      Alert.alert("Homework", result?.message || "Homework saved.");
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to save homework", nextError?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function confirmReview(action) {
    const verb = action === "approve" ? "Approve" : "Return";
    Alert.alert(`${verb} submission?`, action === "approve" ? "The submission will be accepted." : "The work will return to the student as pending.", [
      { text: "Cancel", style: "cancel" },
      { text: verb, style: action === "reject" ? "destructive" : "default", onPress: () => reviewSubmission(action) },
    ]);
  }

  async function reviewSubmission(action) {
    setSaving(true);
    try {
      const result = await api.teacher.homework.reviewSubmission(review.id, { action, remarks: remarks.trim() });
      setReview(null);
      setRemarks("");
      Alert.alert("Submission updated", result?.message || "Review saved.");
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to review submission", nextError?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardSkeleton message="Preparing homework records..."/>;
  return <>
    <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold}/>}>
      <View style={styles.headingRow}><View style={styles.headingCopy}><AppText variant="display">Homework</AppText><AppText style={styles.subtitle}>Assign work and review student submissions.</AppText></View><Pressable accessibilityLabel="Create homework" onPress={openCreate} style={styles.add}><Ionicons color={colors.white} name="add" size={24}/></Pressable></View>
      <View style={styles.summary}>
        <Metric label="Assignments" value={totals.assigned}/><Metric label="Submitted" value={totals.submitted}/><Metric label="Pending" value={totals.pending}/>
      </View>
      <View style={styles.tabs}><Tab active={tab === "assignments"} label="Assignments" onPress={() => setTab("assignments")}/><Tab active={tab === "submissions"} count={submissions.length} label="To Review" onPress={() => setTab("submissions")}/></View>
      {error ? <SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard> : null}
      <View style={styles.list}>
        {tab === "assignments"
          ? assignments.length ? assignments.map((item) => <AssignmentCard item={item} key={`${item.lecture_id}-${item.title}`} onEdit={() => openEdit(item)}/>) : <Empty icon="book-outline" text="No homework has been assigned yet."/>
          : submissions.length ? submissions.map((item) => <SubmissionCard item={item} key={item.id} onPress={() => { setReview(item); setRemarks(""); }}/>) : <Empty icon="checkmark-done-outline" text="There are no submissions waiting for review."/>}
      </View>
    </Screen>
    <AssignmentForm calendarVisible={calendarVisible} form={form} lectures={lectures} onCalendar={setCalendarVisible} onChange={setForm} onClose={() => setFormVisible(false)} onSave={saveAssignment} saving={saving} visible={formVisible}/>
    <ReviewSheet item={review} onClose={() => setReview(null)} onConfirm={confirmReview} onRemarks={setRemarks} remarks={remarks} saving={saving}/>
  </>;
}

function Metric({ label, value }) { return <View style={styles.metric}><AppText style={styles.metricValue}>{value}</AppText><AppText style={styles.metricLabel}>{label}</AppText></View>; }
function Tab({ active, count, label, onPress }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><AppText style={[styles.tabText, active && styles.activeTabText]}>{label}</AppText>{count ? <View style={[styles.badge, active && styles.activeBadge]}><AppText style={[styles.badgeText, active && styles.activeBadgeText]}>{count}</AppText></View> : null}</Pressable>; }

function AssignmentCard({ item, onEdit }) {
  return <SurfaceCard style={styles.card}><View style={styles.cardTop}><View style={styles.cardIcon}><Ionicons color={colors.secondary} name="document-text-outline" size={20}/></View><View style={styles.cardCopy}><AppText style={styles.cardTitle}>{item.title}</AppText><AppText style={styles.cardMeta}>{item.subject_name} · {item.class_level || item.course_title}</AppText></View><Pressable accessibilityLabel="Edit homework" onPress={onEdit} style={styles.edit}><Ionicons color={colors.primary} name="create-outline" size={18}/></Pressable></View>{item.description ? <AppText numberOfLines={2} style={styles.description}>{item.description}</AppText> : null}<View style={styles.due}><Ionicons color={colors.outline} name="calendar-outline" size={14}/><AppText style={styles.dueText}>Due {readableDate(item.due_date)}</AppText></View><View style={styles.progress}><StatusChip tone="success">{item.submitted_count || 0} submitted</StatusChip><StatusChip tone="warning">{item.pending_count || 0} pending</StatusChip><AppText style={styles.total}>{item.total_students_count || 0} students</AppText></View></SurfaceCard>;
}

function SubmissionCard({ item, onPress }) {
  return <Pressable onPress={onPress} style={styles.submission}><View style={styles.avatar}><AppText style={styles.initial}>{String(item.student_name || "S")[0].toUpperCase()}</AppText></View><View style={styles.submissionCopy}><AppText style={styles.cardTitle}>{item.student_name || "Student"}</AppText><AppText numberOfLines={1} style={styles.cardMeta}>{item.title} · {item.subject_name}</AppText><AppText style={styles.submittedAt}>Submitted {new Date(item.updated_at).toLocaleDateString()}</AppText></View><Ionicons color={colors.outline} name="chevron-forward" size={18}/></Pressable>;
}

/** Modal form uses lecture cards and a calendar so dates are never typed manually. */
function AssignmentForm({ calendarVisible, form, lectures, onCalendar, onChange, onClose, onSave, saving, visible }) {
  const editing = Boolean(form.originalTitle);
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}><View style={styles.backdrop}><View style={styles.sheet}><SheetHeader onClose={onClose} title={editing ? "Edit Homework" : "Create Homework"}/><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Label>Assigned Lecture</Label><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lectureRail}>{lectures.map((item) => <Pressable disabled={editing} key={item.id} onPress={() => onChange({ ...form, lectureId: item.id })} style={[styles.lectureChip, form.lectureId === item.id && styles.selectedLecture, editing && styles.disabledLecture]}><AppText numberOfLines={1} style={[styles.lectureText, form.lectureId === item.id && styles.selectedLectureText]}>{lectureLabel(item)}</AppText><AppText style={[styles.lectureTime, form.lectureId === item.id && styles.selectedLectureText]}>{new Date(item.scheduled_start).toLocaleDateString()}</AppText></Pressable>)}</ScrollView>
    <Label>Title</Label><TextInput maxLength={150} onChangeText={(title) => onChange({ ...form, title })} placeholder="e.g. Reading practice" placeholderTextColor={colors.outline} style={styles.input} value={form.title}/>
    <Label>Description</Label><TextInput maxLength={1500} multiline onChangeText={(description) => onChange({ ...form, description })} placeholder="Instructions for students" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} textAlignVertical="top" value={form.description}/>
    <Label>Due Date</Label><Pressable onPress={() => onCalendar(!calendarVisible)} style={styles.dateInput}><Ionicons color={colors.secondary} name="calendar-outline" size={18}/><AppText style={styles.dateText}>{readableDate(form.dueDate)}</AppText></Pressable>
    {calendarVisible ? <SurfaceCard style={styles.calendar}><Calendar minDate={new Date().toISOString().slice(0, 10)} markedDates={form.dueDate ? { [form.dueDate]: { selected: true, selectedColor: colors.gold } } : {}} onDayPress={(selected) => { onChange({ ...form, dueDate: selected.dateString }); onCalendar(false); }} theme={{ calendarBackground: colors.surface, dayTextColor: colors.onSurface, monthTextColor: colors.primary, arrowColor: colors.secondary, todayTextColor: colors.emeraldMid, textMonthFontFamily: fonts.displayBold, textDayFontFamily: fonts.body }}/></SurfaceCard> : null}
    <PillButton disabled={saving} loading={saving} onPress={onSave} style={styles.sheetAction}>{editing ? "Save Changes" : "Assign Homework"}</PillButton>
  </ScrollView></View></View></Modal>;
}

function ReviewSheet({ item, onClose, onConfirm, onRemarks, remarks, saving }) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}><View style={styles.backdrop}><View style={styles.reviewSheet}><SheetHeader onClose={onClose} title="Review Submission"/><ScrollView showsVerticalScrollIndicator={false}><AppText style={styles.studentTitle}>{item?.student_name}</AppText><AppText style={styles.reviewMeta}>{item?.title} · {item?.subject_name}</AppText>{item?.submission_note ? <Detail label="Student Note" value={item.submission_note}/> : null}{item?.submission_attachment_url ? <PillButton onPress={() => Linking.openURL(item.submission_attachment_url)} style={styles.attachment} variant="outline">Open Attachment</PillButton> : null}<Label>Teacher Remarks</Label><TextInput multiline onChangeText={onRemarks} placeholder="Optional feedback for the student" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} textAlignVertical="top" value={remarks}/><View style={styles.reviewActions}><PillButton disabled={saving} onPress={() => onConfirm("reject")} style={styles.reviewButton} variant="outline">Return</PillButton><PillButton disabled={saving} loading={saving} onPress={() => onConfirm("approve")} style={styles.reviewButton}>Approve</PillButton></View></ScrollView></View></View></Modal>;
}

function SheetHeader({ onClose, title }) { return <View style={styles.sheetHead}><AppText style={styles.sheetTitle}>{title}</AppText><Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}><Ionicons color={colors.primary} name="close" size={22}/></Pressable></View>; }
function Label({ children }) { return <AppText style={styles.label}>{children}</AppText>; }
function Detail({ label, value }) { return <View style={styles.detail}><AppText style={styles.detailLabel}>{label}</AppText><AppText style={styles.detailValue}>{value}</AppText></View>; }
function Empty({ icon, text }) { return <View style={styles.empty}><Ionicons color={colors.outline} name={icon} size={30}/><AppText style={styles.emptyText}>{text}</AppText></View>; }

const styles = StyleSheet.create({
  content:{paddingTop:space.lg,paddingBottom:space.xl},headingRow:{flexDirection:"row",alignItems:"center"},headingCopy:{flex:1},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},add:{width:46,height:46,alignItems:"center",justifyContent:"center",borderRadius:23,backgroundColor:colors.primary,...shadows.subtle},
  summary:{flexDirection:"row",marginTop:space.lg,paddingVertical:space.md,borderRadius:radius.xl,backgroundColor:colors.primary},metric:{flex:1,alignItems:"center",borderRightWidth:1,borderRightColor:"rgba(255,255,255,.15)"},metricValue:{color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize.xl},metricLabel:{marginTop:2,color:"#B9EEDB",fontFamily:fonts.bodyBold,fontSize:8,textTransform:"uppercase"},
  tabs:{flexDirection:"row",marginTop:space.lg,padding:4,borderRadius:radius.full,backgroundColor:colors.surfaceLow},tab:{flex:1,minHeight:42,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,borderRadius:radius.full},activeTab:{backgroundColor:colors.surface,...shadows.subtle},tabText:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},activeTabText:{color:colors.primary},badge:{minWidth:20,height:20,alignItems:"center",justifyContent:"center",borderRadius:10,backgroundColor:colors.primary},activeBadge:{backgroundColor:colors.gold},badgeText:{color:colors.white,fontFamily:fonts.bodyBold,fontSize:8},activeBadgeText:{color:colors.primary},
  list:{gap:space.sm,marginTop:space.lg},card:{padding:space.md},cardTop:{flexDirection:"row",alignItems:"center"},cardIcon:{width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:21,backgroundColor:colors.goldPale},cardCopy:{flex:1,marginHorizontal:space.md},cardTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},cardMeta:{marginTop:2,color:colors.outline,fontSize:9},edit:{width:36,height:36,alignItems:"center",justifyContent:"center",borderRadius:18,backgroundColor:colors.surfaceLow},description:{marginTop:space.md,color:colors.onSurfaceVariant,fontSize:fontSize.xs,lineHeight:18},due:{flexDirection:"row",alignItems:"center",gap:5,marginTop:space.md},dueText:{color:colors.outline,fontSize:9},progress:{flexDirection:"row",alignItems:"center",gap:space.xs,marginTop:space.md},total:{flex:1,color:colors.outline,fontSize:8,textAlign:"right"},
  submission:{flexDirection:"row",alignItems:"center",padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface,...shadows.subtle},avatar:{width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:21,backgroundColor:colors.primaryContainer},initial:{color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize.base},submissionCopy:{flex:1,marginHorizontal:space.md},submittedAt:{marginTop:5,color:colors.emeraldMid,fontFamily:fonts.bodyBold,fontSize:8},
  empty:{alignItems:"center",padding:space.xl,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},emptyText:{marginTop:space.sm,color:colors.outline,fontSize:fontSize.xs,textAlign:"center"},error:{marginTop:space.md,backgroundColor:colors.errorContainer},errorText:{color:colors.error,fontSize:fontSize.xs},retry:{alignSelf:"flex-start",marginTop:space.sm},
  backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,39,30,.35)"},sheet:{height:"90%",padding:space.lg,paddingBottom:space["2xl"],borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,backgroundColor:colors.background},reviewSheet:{maxHeight:"78%",padding:space.lg,paddingBottom:space["2xl"],borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,backgroundColor:colors.background},sheetHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:space.md},sheetTitle:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},close:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.surfaceHigh},
  label:{marginTop:space.md,marginBottom:space.xs,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},lectureRail:{gap:space.xs,paddingRight:space.md},lectureChip:{width:180,minHeight:64,justifyContent:"center",padding:space.sm,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.lg,backgroundColor:colors.surface},selectedLecture:{borderColor:colors.primary,backgroundColor:colors.primary},disabledLecture:{opacity:.8},lectureText:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:9},selectedLectureText:{color:colors.white},lectureTime:{marginTop:3,color:colors.outline,fontSize:8},
  input:{minHeight:48,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.lg,backgroundColor:colors.surface,color:colors.onSurface,fontFamily:fonts.body,fontSize:fontSize.xs},textarea:{minHeight:104,paddingTop:space.md},dateInput:{height:48,flexDirection:"row",alignItems:"center",gap:space.sm,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.lg,backgroundColor:colors.surface},dateText:{color:colors.onSurface,fontSize:fontSize.xs},calendar:{marginTop:space.sm,padding:0,overflow:"hidden"},sheetAction:{marginTop:space.xl},
  studentTitle:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},reviewMeta:{marginTop:3,color:colors.emeraldMid,fontSize:fontSize.xs},detail:{marginTop:space.lg,padding:space.md,borderRadius:radius.lg,backgroundColor:colors.surfaceLow},detailLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:8,textTransform:"uppercase"},detailValue:{marginTop:5,color:colors.onSurface,fontSize:fontSize.xs,lineHeight:18},attachment:{marginTop:space.md},reviewActions:{flexDirection:"row",gap:space.sm,marginTop:space.lg},reviewButton:{flex:1},
});
