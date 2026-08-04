/**
 * Parent Homework. Read-only view of each child's assignments and submission
 * status — parents can review but the actual submission stays in the Student
 * portal.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const FILTERS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["submitted", "Submitted"],
  ["overdue", "Overdue"],
];

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function readable(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isOverdue(item) {
  if (!item?.due_date || normalized(item.status) !== "pending") return false;
  const due = new Date(item.due_date);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

function dateLabel(value) {
  if (!value) return "No due date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return parsed.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function statusTone(item) {
  if (isOverdue(item)) return "danger";
  const status = normalized(item?.status);
  if (status === "submitted") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

export default function ParentHomework() {
  const [data, setData] = useState({ items: [], children: [] });
  const [childId, setChildId] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.parent.homework({ childId: childId || undefined });
      setData({ items: response?.items || [], children: response?.children || [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load homework.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(
    () => ({
      total: data.items.length,
      pending: data.items.filter((item) => normalized(item.status) === "pending").length,
      submitted: data.items.filter((item) => normalized(item.status) === "submitted").length,
      overdue: data.items.filter(isOverdue).length,
    }),
    [data.items]
  );

  const visible = useMemo(
    () =>
      data.items.filter((item) => {
        if (filter === "overdue") return isOverdue(item);
        if (filter === "all") return true;
        return normalized(item.status) === filter;
      }),
    [filter, data.items]
  );

  if (loading) return <DashboardSkeleton message="Gathering homework..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <AppText style={styles.eyebrow}>YOUR CHILDREN</AppText>
          <AppText variant="display">Homework</AppText>
          <AppText style={styles.subtitle}>Review assignments and submission status.</AppText>
        </View>

        {data.children.length > 1 ? (
          <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
            <Filter active={!childId} label="All Children" onPress={() => setChildId("")} />
            {data.children.map((child) => (
              <Filter active={childId === child.id} key={child.id} label={child.full_name || child.name} onPress={() => setChildId(child.id)} />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.summary}>
          <Summary label="Total" value={summary.total} />
          <Summary label="Pending" value={summary.pending} />
          <Summary label="Submitted" value={summary.submitted} />
          <Summary danger label="Overdue" value={summary.overdue} />
        </View>

        <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map(([value, label]) => (
            <Filter active={filter === value} count={summary[value] ?? summary.total} key={value} label={label} onPress={() => setFilter(value)} />
          ))}
        </ScrollView>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={30} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : visible.length ? (
          visible.map((item) => <HomeworkCard item={item} key={item.id} onPress={() => setSelected(item)} />)
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="checkmark-done-outline" size={31} />
            <AppText style={styles.stateTitle}>Nothing here</AppText>
            <AppText style={styles.stateText}>No homework matches this filter.</AppText>
          </SurfaceCard>
        )}
      </Screen>

      <HomeworkDetail item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function HomeworkCard({ item, onPress }) {
  const overdue = isOverdue(item);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardIcon}>
        <Ionicons color={overdue ? colors.error : colors.secondary} name={normalized(item.status) === "submitted" ? "checkmark-circle-outline" : "document-text-outline"} size={22} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <AppText numberOfLines={1} style={styles.cardTitle}>{item.title}</AppText>
          <StatusChip tone={statusTone(item)}>{overdue ? "Overdue" : readable(item.status)}</StatusChip>
        </View>
        {item.student_name ? <AppText style={styles.childName}>{item.student_name}</AppText> : null}
        <AppText style={styles.subject}>{item.subject_name || "General"} · {item.teacher_name || "Teacher"}</AppText>
        <View style={styles.due}>
          <Ionicons color={overdue ? colors.error : colors.outline} name="calendar-outline" size={14} />
          <AppText style={[styles.dueText, overdue && styles.dueOverdue]}>Due {dateLabel(item.due_date)}</AppText>
        </View>
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function HomeworkDetail({ item, onClose }) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeading}>
              <AppText style={styles.eyebrow}>HOMEWORK DETAILS</AppText>
              <AppText variant="heading">{item?.title}</AppText>
            </View>
            <Pressable accessibilityLabel="Close homework details" onPress={onClose}>
              <Ionicons color={colors.onSurfaceVariant} name="close" size={26} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <StatusChip tone={statusTone(item || {})}>{isOverdue(item || {}) ? "Overdue" : readable(item?.status)}</StatusChip>
            <Detail icon="person-outline" label="Child" value={item?.student_name} />
            <Detail icon="book-outline" label="Subject" value={item?.subject_name} />
            <Detail icon="school-outline" label="Teacher" value={item?.teacher_name} />
            <Detail icon="calendar-outline" label="Due" value={dateLabel(item?.due_date)} />
            {item?.description ? <Detail icon="document-text-outline" label="Assignment" value={item.description} /> : null}
            {item?.submission_note ? <Detail icon="chatbox-outline" label="Submission note" value={item.submission_note} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Detail({ icon, label, value }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}><Ionicons color={colors.secondary} name={icon} size={17} /></View>
      <View style={styles.detailCopy}>
        <AppText style={styles.detailLabel}>{label}</AppText>
        <AppText style={styles.detailValue}>{value || "Not available"}</AppText>
      </View>
    </View>
  );
}

function Summary({ danger, label, value }) {
  return <View style={styles.summaryItem}><AppText style={[styles.summaryValue, danger && styles.danger]}>{String(value)}</AppText><AppText style={styles.summaryLabel}>{label}</AppText></View>;
}

function Filter({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]}><AppText numberOfLines={1} style={[styles.filterText, active && styles.filterTextActive]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.md },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  summary: { flexDirection: "row", marginTop: space.md, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: space.md },
  summaryValue: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  danger: { color: colors.error },
  summaryLabel: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: 8, textTransform: "uppercase" },
  filters: { gap: space.sm, paddingTop: space.md },
  filter: { minWidth: 92, height: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  filterText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  card: { flexDirection: "row", alignItems: "center", marginTop: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.75 },
  cardIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.goldPale },
  cardBody: { flex: 1, marginHorizontal: space.sm },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.xs },
  cardTitle: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  childName: { color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: 10, marginTop: 1 },
  subject: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  due: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.xs },
  dueText: { color: colors.outline, fontSize: 10 },
  dueOverdue: { color: colors.error, fontFamily: fonts.bodySemibold },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { maxHeight: "80%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetHeading: { flex: 1 },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  detail: { flexDirection: "row", paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  detailIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.goldPale },
  detailCopy: { flex: 1, marginLeft: space.md },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { marginTop: 3, color: colors.onSurface, fontSize: fontSize.xs, lineHeight: 18 },
});
