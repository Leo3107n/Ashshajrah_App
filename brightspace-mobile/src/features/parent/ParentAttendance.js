/**
 * Parent Attendance. Read-only attendance history across the parent's
 * enrolled children, filterable by child, subject, and status.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import ChildDropdown from "./components/ChildDropdown";
import ChildSelectionState from "./components/ChildSelectionState";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const STATUS_FILTERS = ["all", "present", "partial", "absent"];
const normalized = (value) => String(value || "").trim().toLowerCase();
const readable = (value) => String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function tone(value) {
  const status = normalized(value);
  if (status === "present") return "success";
  if (status === "partial") return "warning";
  if (status === "absent") return "danger";
  return "neutral";
}

function dateTime(value) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ParentAttendance() {
  const [data, setData] = useState({ summary: {}, items: [], children: [] });
  const [childId, setChildId] = useState("");
  const [status, setStatus] = useState("all");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.parent.attendance({ childId: childId || undefined });
      setData({
        summary: response?.summary || {},
        items: response?.items || [],
        children: response?.children || [],
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load attendance.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data.children.length === 1) {
      setChildId(data.children[0]?.id || "");
      return;
    }
    if (childId && data.children.some((child) => child.id === childId)) return;
    setChildId("");
  }, [childId, data.children]);

  const requiresChildSelection = data.children.length > 1 && !childId;

  const subjects = useMemo(
    () => [...new Set(data.items.map((item) => item.subject_name).filter(Boolean))].sort(),
    [data.items]
  );
  const visible = useMemo(
    () =>
      requiresChildSelection
        ? []
        :
      data.items.filter(
        (item) =>
          (!subject || item.subject_name === subject) &&
          (status === "all" || normalized(item.attendance_status || item.status) === status)
      ),
    [data.items, requiresChildSelection, status, subject]
  );

  if (loading) return <DashboardSkeleton message="Reviewing attendance..." />;

  const percentage = Number(data.summary.attendance_percentage || 0);
  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
    >
      <View style={styles.heading}>
        <AppText style={styles.eyebrow}>YOUR CHILDREN</AppText>
        <AppText variant="display">Attendance</AppText>
        <AppText style={styles.subtitle}>Only coordinator-verified lectures are included.</AppText>
      </View>

      <SurfaceCard style={styles.overview}>
        <View style={styles.ring}>
          <AppText style={styles.ringValue}>{percentage}%</AppText>
          <AppText style={styles.ringLabel}>ATTENDANCE</AppText>
        </View>
        <View style={styles.overviewCopy}>
          <AppText style={styles.overviewTitle}>
            {percentage >= 80 ? "Strong consistency" : percentage >= 60 ? "Building momentum" : "Needs attention"}
          </AppText>
          <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.min(100, percentage)}%` }]} /></View>
          <AppText style={styles.overviewMeta}>
            {data.summary.attended_classes || 0} attended · {data.summary.absent_classes || 0} absent
          </AppText>
        </View>
      </SurfaceCard>

      {data.children.length > 1 ? (
        <ChildDropdown
          children={data.children}
          label="SELECT CHILD"
          onChange={setChildId}
          placeholder="Choose a child to view attendance"
          selectedId={childId}
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
        {STATUS_FILTERS.map((item) => (
          <Filter active={status === item} key={item} label={readable(item)} onPress={() => setStatus(item)} />
        ))}
      </ScrollView>
      {subjects.length ? (
        <ScrollView contentContainerStyle={styles.subjectFilters} horizontal showsHorizontalScrollIndicator={false}>
          <Filter active={!subject} label="All Subjects" onPress={() => setSubject("")} />
          {subjects.map((item) => <Filter active={subject === item} key={item} label={item} onPress={() => setSubject(item)} />)}
        </ScrollView>
      ) : null}

      <View style={styles.sectionHeader}>
        <AppText style={styles.sectionTitle}>Attendance History</AppText>
        <AppText style={styles.count}>{requiresChildSelection ? 0 : visible.length} records</AppText>
      </View>

      {error ? (
        <SurfaceCard style={styles.state}>
          <Ionicons color={colors.error} name="cloud-offline-outline" size={28} />
          <AppText style={styles.errorText}>{error}</AppText>
          <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
        </SurfaceCard>
      ) : requiresChildSelection ? (
        <ChildSelectionState message="Choose a child from the dropdown to view that child’s attendance." />
      ) : visible.length ? (
        visible.map((item) => <AttendanceRow item={item} key={item.id} />)
      ) : (
        <SurfaceCard style={styles.state}>
          <Ionicons color={colors.secondary} name="calendar-clear-outline" size={30} />
          <AppText style={styles.stateTitle}>No matching records</AppText>
          <AppText style={styles.stateText}>Try another child, status, or subject filter.</AppText>
        </SurfaceCard>
      )}
    </Screen>
  );
}

function AttendanceRow({ item }) {
  const status = item.attendance_status || item.status;
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, normalized(status) === "absent" && styles.rowIconAbsent]}>
        <Ionicons color={normalized(status) === "absent" ? colors.error : colors.secondary} name={normalized(status) === "absent" ? "close-outline" : "checkmark-outline"} size={21} />
      </View>
      <View style={styles.rowCopy}>
        <AppText style={styles.rowTitle}>{item.subject_name || item.title}</AppText>
        {item.student_name ? <AppText style={styles.childName}>{item.student_name}</AppText> : null}
        <AppText style={styles.rowMeta}>{item.title} · {item.teacher_name}</AppText>
        <AppText style={styles.rowDate}>{dateTime(item.scheduled_start)}</AppText>
      </View>
      <View style={styles.rowEnd}>
        <StatusChip tone={tone(status)}>{readable(status)}</StatusChip>
        {item.duration_minutes ? <AppText style={styles.duration}>{item.duration_minutes} min</AppText> : null}
      </View>
    </View>
  );
}

function Filter({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]}><AppText numberOfLines={1} style={[styles.filterText, active && styles.filterTextActive]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.lg },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  overview: { flexDirection: "row", alignItems: "center" },
  ring: { width: 92, height: 92, alignItems: "center", justifyContent: "center", borderWidth: 8, borderColor: colors.secondaryContainer, borderRadius: 46, backgroundColor: colors.primaryContainer },
  ringValue: { color: colors.white, fontFamily: fonts.display, fontSize: fontSize.xl },
  ringLabel: { color: "#B9EEDB", fontFamily: fonts.bodyBold, fontSize: 7 },
  overviewCopy: { flex: 1, marginLeft: space.lg },
  overviewTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  bar: { height: 7, marginTop: space.sm, overflow: "hidden", borderRadius: 4, backgroundColor: colors.outlineVariant },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: colors.secondary },
  overviewMeta: { marginTop: space.xs, color: colors.outline, fontSize: 9 },
  filters: { gap: space.sm, paddingTop: space.lg },
  subjectFilters: { gap: space.sm, paddingTop: space.sm },
  filter: { minWidth: 92, height: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  filterText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  count: { color: colors.outline, fontSize: 10 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  rowIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#D1FAE5" },
  rowIconAbsent: { backgroundColor: colors.errorContainer },
  rowCopy: { flex: 1, marginHorizontal: space.sm },
  rowTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  childName: { color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: 10, marginTop: 1 },
  rowMeta: { color: colors.onSurfaceVariant, fontSize: 9 },
  rowDate: { marginTop: 3, color: colors.outline, fontSize: 9 },
  rowEnd: { alignItems: "flex-end" },
  duration: { marginTop: 3, color: colors.outline, fontSize: 8 },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
});
