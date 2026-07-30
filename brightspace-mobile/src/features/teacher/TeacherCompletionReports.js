/**
 * Teacher Lecture Completion Reports.
 *
 * Owned lectures are split into pending and submitted queues. Opening a
 * lecture fetches its role-scoped detail before the form is populated, and
 * reports are handed to the coordinator by the dedicated completion endpoint.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const EMPTY = { summary: "", topicCovered: "", homeworkGiven: "", studentPerformance: "" };
const readable = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateTime = (value) => value ? new Date(value).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Schedule unavailable";

function reportState(item) {
  const status = String(item?.display_status || item?.status || "").toLowerCase();
  if (status === "verified_by_coordinator") return "verified";
  if (item?.report_id || status === "completed_by_teacher") return "submitted";
  return "pending";
}

function canReport(item) {
  const status = String(item?.display_status || item?.status || "").toLowerCase();
  return status !== "verified_by_coordinator" && (
    ["live", "ended", "missed", "completed_by_teacher"].includes(status)
    || new Date(item?.scheduled_end || 0).getTime() <= Date.now()
  );
}

export default function TeacherCompletionReports() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const result = await api.teacher.lectures.list();
      setItems(result?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load completion reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => items.reduce((output, item) => {
    const state = reportState(item);
    output[state] += 1;
    return output;
  }, { pending: 0, submitted: 0, verified: 0 }), [items]);

  const visible = useMemo(() => items.filter((item) => filter === "all" || reportState(item) === filter), [filter, items]);

  async function open(item) {
    setSelected(item);
    setDetailLoading(true);
    try {
      // Fetching detail here ensures existing report fields and ownership are
      // both checked immediately before a teacher edits or submits.
      const result = await api.teacher.lectures.detail(item.id);
      const detail = { ...item, ...(result?.item || {}) };
      setSelected(detail);
      setForm({
        summary: detail.summary || "",
        topicCovered: detail.topic_covered || "",
        homeworkGiven: detail.homework_given || "",
        studentPerformance: detail.student_performance || "",
      });
    } catch (nextError) {
      setSelected(null);
      Alert.alert("Unable to open report", nextError?.message || "Please try again.");
    } finally {
      setDetailLoading(false);
    }
  }

  function confirmSubmit() {
    if (!form.summary.trim() || !form.topicCovered.trim()) {
      Alert.alert("Incomplete report", "Lecture summary and topic covered are required.");
      return;
    }
    Alert.alert("Submit completion report?", "The report will be sent to the coordinator for verification.", [
      { text: "Cancel", style: "cancel" },
      { text: "Submit", onPress: submit },
    ]);
  }

  async function submit() {
    setSaving(true);
    try {
      const result = await api.teacher.lectures.submitCompletionReport(selected.id, {
        summary: form.summary.trim(),
        topicCovered: form.topicCovered.trim(),
        homeworkGiven: form.homeworkGiven.trim(),
        studentPerformance: form.studentPerformance.trim(),
      });
      setSelected(null);
      Alert.alert("Report submitted", result?.message || "The coordinator can now review this lecture.");
      await load({ refresh: true });
      setFilter("submitted");
    } catch (nextError) {
      Alert.alert("Unable to submit report", nextError?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardSkeleton message="Collecting lecture reports..."/>;
  return <>
    <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold}/>}>
      <AppText variant="display">Completion Reports</AppText>
      <AppText style={styles.subtitle}>Document each completed class for coordinator verification.</AppText>
      <View style={styles.summary}><Metric label="Pending" value={counts.pending}/><Metric label="Submitted" value={counts.submitted}/><Metric label="Verified" value={counts.verified}/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.filters}>
        {[["pending", "Pending"], ["submitted", "Submitted"], ["verified", "Verified"], ["all", "All"]].map(([value, label]) => <Chip active={filter === value} key={value} label={label} onPress={() => setFilter(value)}/>)}
      </ScrollView>
      {error ? <SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard> : null}
      <View style={styles.list}>{visible.length ? visible.map((item) => <ReportCard item={item} key={item.id} onPress={() => open(item)}/>) : <Empty filter={filter}/>}</View>
    </Screen>
    <ReportSheet form={form} item={selected} loading={detailLoading} onChange={setForm} onClose={() => setSelected(null)} onSubmit={confirmSubmit} saving={saving}/>
  </>;
}

function Metric({ label, value }) { return <View style={styles.metric}><AppText style={styles.metricValue}>{value}</AppText><AppText style={styles.metricLabel}>{label}</AppText></View>; }
function Chip({ active, label, onPress }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.activeChip]}><AppText style={[styles.chipText, active && styles.activeChipText]}>{label}</AppText></Pressable>; }

function ReportCard({ item, onPress }) {
  const state = reportState(item);
  const tone = state === "verified" ? "success" : state === "submitted" ? "warning" : "neutral";
  return <Pressable onPress={onPress} style={styles.card}><View style={styles.icon}><Ionicons color={colors.secondary} name={state === "verified" ? "shield-checkmark-outline" : "document-text-outline"} size={21}/></View><View style={styles.cardBody}><AppText style={styles.cardTitle}>{item.subject_name || item.title}</AppText><AppText style={styles.cardMeta}>{item.class_level || item.course_title || "Assigned class"} · {dateTime(item.scheduled_start)}</AppText><StatusChip tone={tone}>{readable(state)}</StatusChip></View><Ionicons color={colors.outline} name="chevron-forward" size={18}/></Pressable>;
}

function ReportSheet({ form, item, loading, onChange, onClose, onSubmit, saving }) {
  const state = reportState(item);
  const locked = state === "verified";
  const eligible = canReport(item);
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.sheetHead}><View style={styles.sheetCopy}><AppText style={styles.sheetTitle}>{item?.subject_name || item?.title}</AppText><AppText style={styles.sheetMeta}>{item?.class_level || item?.course_title || "Lecture Completion Report"}</AppText></View><Pressable accessibilityLabel="Close report" onPress={onClose} style={styles.close}><Ionicons color={colors.primary} name="close" size={22}/></Pressable></View>
    {loading ? <DashboardSkeleton message="Opening report..."/> : <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.schedule}><Ionicons color={colors.secondary} name="calendar-outline" size={18}/><View><AppText style={styles.scheduleLabel}>LECTURE SCHEDULE</AppText><AppText style={styles.scheduleValue}>{dateTime(item?.scheduled_start)}</AppText></View></View>
      {locked ? <View style={styles.locked}><Ionicons color={colors.statusPresentText} name="shield-checkmark-outline" size={20}/><AppText style={styles.lockedText}>Verified by the coordinator. This report is now read-only.</AppText></View> : null}
      {!locked && !eligible ? <View style={styles.waiting}><Ionicons color={colors.statusPendingText} name="time-outline" size={20}/><AppText style={styles.waitingText}>This report becomes available after the lecture ends.</AppText></View> : null}
      <Field editable={!locked && eligible} label="Lecture Summary *" multiline onChange={(summary) => onChange({ ...form, summary })} placeholder="Summarize the classroom session" value={form.summary}/>
      <Field editable={!locked && eligible} label="Topic Covered *" multiline onChange={(topicCovered) => onChange({ ...form, topicCovered })} placeholder="What curriculum topic was covered?" value={form.topicCovered}/>
      <Field editable={!locked && eligible} label="Homework Given" multiline onChange={(homeworkGiven) => onChange({ ...form, homeworkGiven })} placeholder="Optional homework or follow-up work" value={form.homeworkGiven}/>
      <Field editable={!locked && eligible} label="Student Performance" multiline onChange={(studentPerformance) => onChange({ ...form, studentPerformance })} placeholder="Optional class performance notes" value={form.studentPerformance}/>
      {!locked && eligible ? <PillButton disabled={saving} loading={saving} onPress={onSubmit} style={styles.submit}>{state === "submitted" ? "Resubmit Report" : "Submit for Verification"}</PillButton> : null}
    </ScrollView>}
  </View></View></Modal>;
}

/** Shared field preserves consistent spacing and read-only styling. */
function Field({ editable, label, multiline, onChange, placeholder, value }) { return <View><AppText style={styles.label}>{label}</AppText><TextInput editable={editable} maxLength={2000} multiline={multiline} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.outline} style={[styles.input, multiline && styles.textarea, !editable && styles.readOnly]} textAlignVertical="top" value={value}/></View>; }
function Empty({ filter }) { return <View style={styles.empty}><Ionicons color={colors.outline} name="document-text-outline" size={32}/><AppText style={styles.emptyTitle}>No {filter === "all" ? "" : filter} reports</AppText><AppText style={styles.emptyText}>Lecture reports will appear here as their status changes.</AppText></View>; }

const styles = StyleSheet.create({
  content:{paddingTop:space.lg,paddingBottom:space.xl},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},
  summary:{flexDirection:"row",marginTop:space.lg,paddingVertical:space.md,borderRadius:radius.xl,backgroundColor:colors.primary},metric:{flex:1,alignItems:"center",borderRightWidth:1,borderRightColor:"rgba(255,255,255,.15)"},metricValue:{color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize.xl},metricLabel:{marginTop:2,color:"#B9EEDB",fontFamily:fonts.bodyBold,fontSize:8,textTransform:"uppercase"},
  rail:{flexGrow:0,marginTop:space.lg},filters:{gap:space.xs,paddingRight:space.lg},chip:{height:38,justifyContent:"center",paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:19,backgroundColor:colors.surface},activeChip:{backgroundColor:colors.primary},chipText:{color:colors.onSurfaceVariant,fontFamily:fonts.bodyBold,fontSize:10},activeChipText:{color:colors.white},
  list:{gap:space.sm,marginTop:space.lg},card:{minHeight:92,flexDirection:"row",alignItems:"center",padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface,...shadows.subtle},icon:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:colors.goldPale},cardBody:{flex:1,alignItems:"flex-start",marginHorizontal:space.md},cardTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},cardMeta:{marginVertical:5,color:colors.outline,fontSize:9},
  empty:{alignItems:"center",padding:space.xl,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},emptyTitle:{marginTop:space.sm,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},emptyText:{marginTop:3,color:colors.outline,fontSize:fontSize.xs,textAlign:"center"},error:{marginTop:space.md,backgroundColor:colors.errorContainer},errorText:{color:colors.error,fontSize:fontSize.xs},retry:{alignSelf:"flex-start",marginTop:space.sm},
  backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,39,30,.35)"},sheet:{height:"90%",padding:space.lg,paddingBottom:space["2xl"],borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,backgroundColor:colors.background},sheetHead:{flexDirection:"row",alignItems:"center",marginBottom:space.md},sheetCopy:{flex:1},sheetTitle:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},sheetMeta:{marginTop:2,color:colors.emeraldMid,fontSize:fontSize.xs},close:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.surfaceHigh},
  schedule:{flexDirection:"row",alignItems:"center",gap:space.md,padding:space.md,borderRadius:radius.lg,backgroundColor:colors.goldPale},scheduleLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:8},scheduleValue:{marginTop:2,color:colors.primary,fontSize:fontSize.xs},locked:{flexDirection:"row",alignItems:"center",gap:space.sm,marginTop:space.md,padding:space.md,borderRadius:radius.lg,backgroundColor:colors.statusPresentBg},lockedText:{flex:1,color:colors.statusPresentText,fontSize:fontSize.xs},waiting:{flexDirection:"row",alignItems:"center",gap:space.sm,marginTop:space.md,padding:space.md,borderRadius:radius.lg,backgroundColor:colors.statusPendingBg},waitingText:{flex:1,color:colors.statusPendingText,fontSize:fontSize.xs},
  label:{marginTop:space.md,marginBottom:space.xs,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},input:{minHeight:48,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.lg,backgroundColor:colors.surface,color:colors.onSurface,fontFamily:fonts.body,fontSize:fontSize.xs},textarea:{minHeight:96,paddingTop:space.md},readOnly:{color:colors.onSurfaceVariant,backgroundColor:colors.surfaceLow},submit:{marginTop:space.xl},
});
