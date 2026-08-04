/**
 * Coordinator Lecture Verifications. Reviews teacher completion reports and
 * attendance before approving, rejecting, marking a lecture missed, or
 * rescheduling it.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const FILTERS = [
  ["pending", "Pending"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
  ["all", "All"],
];

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTime(value) {
  if (!value) return "Schedule unavailable";
  return new Date(value).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function tone(status) {
  const value = String(status || "").toLowerCase();
  if (["verified_by_coordinator"].includes(value)) return "success";
  if (["disputed", "missed"].includes(value)) return "danger";
  if (["completed_by_teacher"].includes(value)) return "warning";
  return "neutral";
}

export default function CoordinatorLectureVerifications() {
  const [filter, setFilter] = useState("pending");
  const [data, setData] = useState({ counts: {}, items: [] });
  const [selected, setSelected] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [manualConfirm, setManualConfirm] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleEnd, setRescheduleEnd] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.coordinator.lectureVerifications.list({ status: filter });
      setData({ counts: response?.counts || {}, items: response?.items || [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load lecture verifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function openDetail(item) {
    setSelected(item);
    setRemarks("");
    setManualConfirm(false);
    setShowReschedule(false);
    setRescheduleDate("");
    setRescheduleStart("");
    setRescheduleEnd("");
  }

  async function act(action, extra = {}) {
    if (!selected?.lecture_id && !selected?.id) return;
    setSaving(true);
    try {
      await api.coordinator.lectureVerifications.update(selected.lecture_id || selected.id, {
        action,
        remarks: remarks.trim() || undefined,
        manualConfirm,
        ...extra,
      });
      setSelected(null);
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to update", nextError?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function confirmApprove() {
    Alert.alert("Approve this lecture?", "The lecture will be marked verified.", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => act("approve") },
    ]);
  }

  function confirmReject() {
    if (!remarks.trim()) {
      Alert.alert("Reason required", "Enter a clear reason before rejecting this lecture.");
      return;
    }
    Alert.alert("Reject this lecture?", "The teacher and coordinator record will show this lecture as disputed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => act("reject") },
    ]);
  }

  function confirmMarkMissed() {
    Alert.alert("Mark as missed?", "This lecture will be recorded as missed with no completion report.", [
      { text: "Cancel", style: "cancel" },
      { text: "Mark Missed", style: "destructive", onPress: () => act("mark_missed") },
    ]);
  }

  function confirmReschedule() {
    if (!rescheduleDate || !rescheduleStart || !rescheduleEnd) {
      Alert.alert("Details required", "Enter the new date and start/end time.");
      return;
    }
    const scheduledStart = new Date(`${rescheduleDate}T${rescheduleStart}:00`);
    const scheduledEnd = new Date(`${rescheduleDate}T${rescheduleEnd}:00`);
    if (Number.isNaN(scheduledStart.getTime()) || Number.isNaN(scheduledEnd.getTime())) {
      Alert.alert("Invalid date or time", "Use the format YYYY-MM-DD for the date and HH:MM for times.");
      return;
    }
    act("reschedule", { scheduledStart: scheduledStart.toISOString(), scheduledEnd: scheduledEnd.toISOString() });
  }

  const counts = useMemo(() => ({
    pending: data.counts.pending || 0,
    verified: data.counts.verified || 0,
    rejected: data.counts.rejected || 0,
  }), [data.counts]);

  if (loading) return <DashboardSkeleton message="Reviewing lecture completions..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <AppText variant="display">Lecture Verifications</AppText>
        <AppText style={styles.subtitle}>Confirm each teacher's completion report before it counts.</AppText>

        <View style={styles.summary}>
          <Metric label="Pending" value={counts.pending} />
          <Metric label="Verified" value={counts.verified} />
          <Metric label="Rejected" value={counts.rejected} />
        </View>

        <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map(([value, label]) => <Chip active={filter === value} key={value} label={label} onPress={() => setFilter(value)} />)}
        </ScrollView>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={28} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : data.items.length ? (
          <View style={styles.list}>
            {data.items.map((item) => (
              <Pressable key={item.id} onPress={() => openDetail(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.icon}><Ionicons color={colors.secondary} name="shield-checkmark-outline" size={21} /></View>
                <View style={styles.cardBody}>
                  <AppText numberOfLines={1} style={styles.cardTitle}>{item.subject_name || item.title}</AppText>
                  <AppText numberOfLines={1} style={styles.cardMeta}>{item.teacher_name} · {item.course_title || "Class"}</AppText>
                  <AppText style={styles.cardDate}>{dateTime(item.scheduled_start)}</AppText>
                  <AppText style={styles.attendanceLine}>
                    {item.joined_students_count ?? 0}/{item.total_students_count ?? 0} students attended
                  </AppText>
                </View>
                <StatusChip tone={tone(item.status)}>{readable(item.status)}</StatusChip>
              </Pressable>
            ))}
          </View>
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="checkmark-done-outline" size={30} />
            <AppText style={styles.stateTitle}>Nothing here</AppText>
            <AppText style={styles.stateText}>No lectures match this filter.</AppText>
          </SurfaceCard>
        )}
      </Screen>

      <Modal animationType="slide" onRequestClose={() => !saving && setSelected(null)} transparent visible={Boolean(selected)}>
        <Pressable onPress={() => !saving && setSelected(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetTop}>
              <View style={styles.sheetIdentity}>
                <AppText variant="heading">{selected?.subject_name || selected?.title}</AppText>
                <AppText style={styles.sheetMeta}>{selected?.teacher_name} · {dateTime(selected?.scheduled_start)}</AppText>
              </View>
              <Pressable disabled={saving} onPress={() => setSelected(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>

            <StatusChip tone={tone(selected?.status)}>{readable(selected?.status)}</StatusChip>

            <SurfaceCard style={styles.reportCard}>
              <AppText style={styles.reportLabel}>COMPLETION REPORT</AppText>
              {selected?.summary ? (
                <>
                  <Detail label="Summary" value={selected.summary} />
                  <Detail label="Topic Covered" value={selected.topic_covered} />
                  {selected?.homework_given ? <Detail label="Homework Given" value={selected.homework_given} /> : null}
                  {selected?.student_performance ? <Detail label="Student Performance" value={selected.student_performance} /> : null}
                </>
              ) : (
                <View style={styles.noReport}>
                  <Ionicons color={colors.secondary} name="alert-circle-outline" size={18} />
                  <AppText style={styles.noReportText}>No completion report has been submitted yet.</AppText>
                </View>
              )}
            </SurfaceCard>

            <SurfaceCard style={styles.reportCard}>
              <AppText style={styles.reportLabel}>ATTENDANCE</AppText>
              <View style={styles.attendanceRow}>
                <Attendance label="Present" value={selected?.joined_students_count ?? 0} />
                <Attendance label="Absent" value={selected?.absent_students_count ?? 0} />
                <Attendance label="Total" value={selected?.total_students_count ?? 0} />
              </View>
              <Detail label="Teacher Attendance" value={readable(selected?.teacher_attendance_status) || "Not recorded"} />
            </SurfaceCard>

            {String(selected?.status || "").toLowerCase() !== "verified_by_coordinator" ? (
              <>
                {!selected?.summary ? (
                  <Pressable onPress={() => setManualConfirm((current) => !current)} style={styles.manualRow}>
                    <Ionicons color={colors.secondary} name={manualConfirm ? "checkbox" : "square-outline"} size={20} />
                    <AppText style={styles.manualText}>Approve manually without a completion report</AppText>
                  </Pressable>
                ) : null}

                <View style={styles.field}>
                  <AppText style={styles.fieldLabel}>REMARKS (REQUIRED TO REJECT)</AppText>
                  <TextInput
                    multiline
                    onChangeText={setRemarks}
                    placeholder="Add a note for this decision..."
                    placeholderTextColor={colors.outline}
                    style={styles.textarea}
                    value={remarks}
                  />
                </View>

                <View style={styles.actions}>
                  <PillButton disabled={saving || (!selected?.summary && !manualConfirm)} loading={saving} onPress={confirmApprove}>Approve</PillButton>
                  <PillButton disabled={saving} onPress={confirmReject} variant="danger">Reject</PillButton>
                </View>
                <View style={styles.actions}>
                  <PillButton disabled={saving} onPress={confirmMarkMissed} variant="secondary">Mark Missed</PillButton>
                  <PillButton disabled={saving} onPress={() => setShowReschedule((current) => !current)} variant="secondary">Reschedule</PillButton>
                </View>

                {showReschedule ? (
                  <View style={styles.rescheduleBlock}>
                    <Field label="NEW DATE (YYYY-MM-DD)" onChange={setRescheduleDate} placeholder="2026-08-05" value={rescheduleDate} />
                    <Field label="START TIME (HH:MM)" onChange={setRescheduleStart} placeholder="14:00" value={rescheduleStart} />
                    <Field label="END TIME (HH:MM)" onChange={setRescheduleEnd} placeholder="15:00" value={rescheduleEnd} />
                    <PillButton disabled={saving} loading={saving} onPress={confirmReschedule} style={styles.saveButton}>Confirm Reschedule</PillButton>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.locked}>
                <Ionicons color={colors.emeraldMid} name="lock-closed" size={16} />
                <AppText style={styles.lockedText}>This lecture has been verified and is now read-only.</AppText>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Metric({ label, value }) {
  return <View style={styles.metric}><AppText style={styles.metricValue}>{String(value)}</AppText><AppText style={styles.metricLabel}>{label}</AppText></View>;
}

function Chip({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><AppText style={[styles.chipText, active && styles.chipTextActive]}>{label}</AppText></Pressable>;
}

function Attendance({ label, value }) {
  return <View style={styles.attendanceItem}><AppText style={styles.attendanceValue}>{String(value)}</AppText><AppText style={styles.attendanceLabel}>{label}</AppText></View>;
}

function Detail({ label, value }) {
  return (
    <View style={styles.detail}>
      <AppText style={styles.detailLabel}>{label}</AppText>
      <AppText style={styles.detailValue}>{value || "Not recorded"}</AppText>
    </View>
  );
}

function Field({ label, onChange, placeholder, value }) {
  return (
    <View style={styles.field}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <TextInput onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.outline} style={styles.fieldInput} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  summary: { flexDirection: "row", marginTop: space.lg, paddingVertical: space.md, borderRadius: radius.xl, backgroundColor: colors.primary },
  metric: { flex: 1, alignItems: "center", borderRightWidth: 1, borderRightColor: "rgba(255,255,255,.15)" },
  metricValue: { color: colors.white, fontFamily: fonts.displayBold, fontSize: fontSize.xl },
  metricLabel: { marginTop: 2, color: "#B9EEDB", fontFamily: fonts.bodyBold, fontSize: 8, textTransform: "uppercase" },
  filters: { gap: space.sm, marginTop: space.lg },
  chip: { height: 38, justifyContent: "center", paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: 19, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: 10 },
  chipTextActive: { color: colors.white },
  state: { alignItems: "center", paddingVertical: space.xl, marginTop: space.lg },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  errorText: { color: colors.error, fontSize: fontSize.xs, textAlign: "center" },
  retry: { marginTop: space.md },
  list: { gap: space.sm, marginTop: space.lg },
  card: { minHeight: 96, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.75 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.goldPale },
  cardBody: { flex: 1, marginHorizontal: space.md },
  cardTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardMeta: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: 10 },
  cardDate: { marginTop: 2, color: colors.outline, fontSize: 9 },
  attendanceLine: { marginTop: 3, color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: 9 },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { position: "absolute", right: 0, bottom: 0, left: 0, maxHeight: "90%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  sheetTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: space.md },
  sheetIdentity: { flex: 1 },
  sheetMeta: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceHigh },
  reportCard: { marginTop: space.md },
  reportLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase", marginBottom: space.sm },
  noReport: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  noReportText: { flex: 1, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  attendanceRow: { flexDirection: "row", marginBottom: space.sm },
  attendanceItem: { flex: 1, alignItems: "center" },
  attendanceValue: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  attendanceLabel: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: 9, textTransform: "uppercase" },
  detail: { paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { marginTop: 2, color: colors.onSurface, fontSize: fontSize.xs, lineHeight: 18 },
  manualRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg },
  manualText: { flex: 1, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  field: { marginTop: space.md },
  fieldLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase", marginBottom: 6 },
  fieldInput: { height: 48, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface },
  textarea: { minHeight: 80, paddingHorizontal: space.md, paddingTop: space.sm, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  rescheduleBlock: { marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  saveButton: { marginTop: space.md },
  locked: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: "#DDF4EA" },
  lockedText: { flex: 1, color: colors.emeraldMid, fontFamily: fonts.bodySemibold, fontSize: 10 },
});
