/** Subject progress summaries and verified teacher completion reports. */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const readable = (value) => String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const attendanceTone = (value) => ["present", "partial"].includes(String(value || "").toLowerCase()) ? "success" : "danger";

export default function StudentProgress() {
  const [data, setData] = useState({ summary: {}, subjects: [], items: [] });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.student.progressReports();
      setData({ summary: response?.summary || {}, subjects: response?.subjects || [], items: response?.items || [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load progress reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  if (loading) return <DashboardSkeleton message="Preparing your progress..." />;

  return (
    <>
      <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
        <View style={styles.heading}>
          <AppText style={styles.eyebrow}>LEARNING JOURNEY</AppText>
          <AppText variant="display">Progress Reports</AppText>
          <AppText style={styles.subtitle}>Verified teacher reports and subject-level progress.</AppText>
        </View>
        <View style={styles.summary}>
          <Summary label="Subjects" value={data.summary.total_subjects || 0} />
          <Summary label="Reports" value={data.summary.total_reports || 0} />
          <Summary label="Attendance" suffix="%" value={data.summary.average_attendance || 0} />
          <Summary label="Homework" suffix="%" value={data.summary.average_homework || 0} />
        </View>

        <AppText style={styles.sectionTitle}>Subject Progress</AppText>
        {error ? (
          <SurfaceCard style={styles.state}><Ionicons color={colors.error} name="cloud-offline-outline" size={28} /><AppText style={styles.errorText}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard>
        ) : data.subjects.length ? data.subjects.map((subject) => (
          <SurfaceCard key={subject.subject_id} style={styles.subjectCard}>
            <View style={styles.subjectTop}><View style={styles.subjectIcon}><AppText style={styles.subjectInitial}>{String(subject.subject_name || "S")[0]}</AppText></View><View style={styles.subjectCopy}><AppText style={styles.subjectName}>{subject.subject_name}</AppText><AppText style={styles.subjectMeta}>{subject.progress_reports} verified reports · {subject.verified_lectures} lectures</AppText></View></View>
            <Progress label="Attendance" value={subject.attendance_percentage} />
            <Progress label="Homework completion" value={subject.homework_percentage} />
          </SurfaceCard>
        )) : <SurfaceCard style={styles.state}><Ionicons color={colors.secondary} name="analytics-outline" size={30} /><AppText style={styles.stateTitle}>No subject progress yet</AppText><AppText style={styles.stateText}>Progress will appear after verified lectures and assignments.</AppText></SurfaceCard>}

        <AppText style={styles.sectionTitle}>Teacher Reports</AppText>
        {data.items.length ? data.items.map((item) => (
          <Pressable key={item.id} onPress={() => setSelected(item)} style={({ pressed }) => [styles.report, pressed && styles.pressed]}>
            <View style={styles.reportIcon}><Ionicons color={colors.secondary} name="document-text-outline" size={20} /></View>
            <View style={styles.reportCopy}><AppText style={styles.reportTitle}>{item.subject_name}</AppText><AppText numberOfLines={1} style={styles.reportMeta}>{item.lecture_title} · {item.teacher_name}</AppText><AppText style={styles.reportDate}>{new Date(item.scheduled_start).toLocaleDateString()}</AppText></View>
            <StatusChip tone={attendanceTone(item.attendance_status)}>{readable(item.attendance_status)}</StatusChip>
            <Ionicons color={colors.outline} name="chevron-forward" size={18} />
          </Pressable>
        )) : <SurfaceCard style={styles.state}><AppText style={styles.stateText}>No verified teacher reports are available yet.</AppText></SurfaceCard>}
      </Screen>
      <ReportSheet item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function ReportSheet({ item, onClose }) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}><View style={styles.overlay}><View style={styles.sheet}><View style={styles.handle}/><View style={styles.sheetHeader}><View style={styles.sheetHeading}><AppText style={styles.eyebrow}>VERIFIED REPORT</AppText><AppText variant="heading">{item?.subject_name}</AppText><AppText style={styles.sheetMeta}>{item?.lecture_title} · {item?.teacher_name}</AppText></View><Pressable accessibilityLabel="Close report" onPress={onClose}><Ionicons color={colors.onSurfaceVariant} name="close" size={26}/></Pressable></View><ScrollView contentContainerStyle={styles.sheetContent}><View style={styles.reportStatus}><StatusChip tone={attendanceTone(item?.attendance_status)}>{readable(item?.attendance_status)}</StatusChip><AppText style={styles.reportStatusText}>{item?.duration_minutes || 0} attendance minutes</AppText></View>{item?.topic_covered ? <Detail label="Topic covered" value={item.topic_covered}/> : null}{item?.summary ? <Detail label="Teacher summary" value={item.summary}/> : null}{item?.student_performance ? <Detail label="Student performance" value={item.student_performance}/> : null}{item?.homework_given ? <Detail label="Homework given" value={item.homework_given}/> : null}</ScrollView></View></View></Modal>;
}

function Summary({ label, suffix = "", value }) {
  return <View style={styles.summaryItem}><AppText style={styles.summaryValue}>{value}{suffix}</AppText><AppText style={styles.summaryLabel}>{label}</AppText></View>;
}
function Progress({ label, value }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return <View style={styles.progress}><View style={styles.progressTop}><AppText style={styles.progressLabel}>{label}</AppText><AppText style={styles.progressValue}>{safe}%</AppText></View><View style={styles.bar}><View style={[styles.barFill, { width: `${safe}%` }]}/></View></View>;
}
function Detail({ label, value }) {
  return <View style={styles.detail}><AppText style={styles.detailLabel}>{label}</AppText><AppText style={styles.detailText}>{value}</AppText></View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.lg },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  summary: { flexDirection: "row", marginBottom: space.xl, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: space.md },
  summaryValue: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  summaryLabel: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: 8 },
  sectionTitle: { marginBottom: space.sm, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  subjectCard: { marginBottom: space.md },
  subjectTop: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  subjectIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.goldPale },
  subjectInitial: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.base },
  subjectCopy: { flex: 1, marginLeft: space.sm },
  subjectName: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  subjectMeta: { color: colors.outline, fontSize: 9 },
  progress: { marginTop: space.sm },
  progressTop: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  progressValue: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  bar: { height: 7, marginTop: 4, overflow: "hidden", borderRadius: 4, backgroundColor: colors.outlineVariant },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: colors.secondary },
  report: { flexDirection: "row", alignItems: "center", marginBottom: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.72 },
  reportIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.goldPale },
  reportCopy: { flex: 1, marginHorizontal: space.sm },
  reportTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  reportMeta: { color: colors.onSurfaceVariant, fontSize: 9 },
  reportDate: { color: colors.outline, fontSize: 8 },
  state: { alignItems: "center", marginBottom: space.xl, paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { maxHeight: "86%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background, ...shadows.modal },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetHeading: { flex: 1 },
  sheetMeta: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  reportStatus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  reportStatusText: { color: colors.outline, fontSize: 9 },
  detail: { marginTop: space.lg },
  detailLabel: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.base },
  detailText: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 19 },
});
