/**
 * Parent Lectures. Searchable, all-time lecture history across the parent's
 * children (the calendar tab covers day-by-day scheduling; this is the flat
 * history/search view, mirroring the Student Lectures screen but read-only).
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import ChildDropdown from "./components/ChildDropdown";
import ChildSelectionState from "./components/ChildSelectionState";
import useParentChildSelection from "./useParentChildSelection";
import { colors, fonts, fontSize, radius, space } from "../../theme";

const FILTERS = [
  ["all", "All"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
  ["recorded", "Recordings"],
];

function readable(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusOf(item) {
  return String(item.display_status || item.status || "").toLowerCase();
}

function lectureTone(value) {
  const status = String(value || "").toLowerCase();
  if (["live", "verified_by_coordinator", "completed_by_teacher"].includes(status)) return "success";
  if (["scheduled", "upcoming", "rescheduled"].includes(status)) return "warning";
  if (["cancelled", "missed", "disputed"].includes(status)) return "danger";
  return "neutral";
}

function dateTime(value, options) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not scheduled" : parsed.toLocaleString([], options);
}

function classActionState(item) {
  const now = Date.now();
  const start = item?.scheduled_start ? new Date(item.scheduled_start).getTime() : 0;
  const end = item?.scheduled_end ? new Date(item.scheduled_end).getTime() : 0;
  const status = statusOf(item || {});
  const future = Boolean(start && now < start);
  const live = status === "live" || Boolean(start && now >= start && (!end || now <= end));
  const ended = Boolean(
    end ? now > end : ["completed", "completed_by_teacher", "verified_by_coordinator"].includes(status)
  );

  return {
    future,
    canJoin: live && Boolean(item?.google_meet_link),
    canWatchRecording: ended && Boolean(item?.recording_drive_url),
  };
}

export default function ParentLectures() {
  const [data, setData] = useState({ items: [], subjects: [], children: [] });
  const [childId, setChildId] = useParentChildSelection(data.children);
  const [filter, setFilter] = useState("all");
  const [subjectId, setSubjectId] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.parent.lectures({ range: "all", childId: childId || undefined });
      setData({ items: response?.items || [], subjects: response?.subjects || [], children: response?.children || [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load lectures.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelected(null);
  }, [childId, filter, subjectId]);

  const requiresChildSelection = data.children.length > 1 && !childId;

  const visible = useMemo(
    () =>
      requiresChildSelection
        ? []
        :
      data.items.filter((item) => {
        if (subjectId && item.subject_id !== subjectId) return false;
        const status = statusOf(item);
        if (filter === "upcoming") return ["scheduled", "upcoming", "live", "rescheduled"].includes(status);
        if (filter === "completed") return ["completed_by_teacher", "verified_by_coordinator", "ended"].includes(status);
        if (filter === "recorded") return Boolean(item.recording_drive_url);
        return true;
      }),
    [data.items, filter, requiresChildSelection, subjectId]
  );

  if (loading) return <DashboardSkeleton message="Gathering lectures..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => { setChildId(""); if (!childId) load({ refresh: true }); }} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <AppText style={styles.eyebrow}>YOUR CHILDREN</AppText>
          <AppText variant="display">Lectures</AppText>
          <AppText style={styles.subtitle}>Review scheduled and completed classes.</AppText>
        </View>

        {data.children.length > 1 ? (
          <ChildDropdown
            children={data.children}
            label="SELECT CHILD"
            onChange={setChildId}
            placeholder="Choose a child to view lecture schedule"
            selectedId={childId}
          />
        ) : null}

        <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map(([value, label]) => (
            <Filter active={filter === value} key={value} label={label} onPress={() => setFilter(value)} />
          ))}
        </ScrollView>
        {data.subjects.length ? (
          <ScrollView contentContainerStyle={styles.subjects} horizontal showsHorizontalScrollIndicator={false}>
            <Filter active={!subjectId} label="All Subjects" onPress={() => setSubjectId("")} />
            {data.subjects.map((subject) => (
              <Filter active={subjectId === subject.id} key={subject.id} label={subject.name} onPress={() => setSubjectId(subject.id)} />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.countRow}>
          <AppText style={styles.countTitle}>{visible.length} lectures</AppText>
          <Ionicons color={colors.secondary} name="videocam-outline" size={19} />
        </View>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={28} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : requiresChildSelection ? (
          <ChildSelectionState message="Choose a child from the dropdown to view that child’s lecture schedule." />
        ) : visible.length ? (
          visible.map((item) => <LectureRow item={item} key={item.id} onPress={() => setSelected(item)} />)
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="videocam-off-outline" size={30} />
            <AppText style={styles.stateTitle}>No matching lectures</AppText>
            <AppText style={styles.stateText}>Try another child, status, or subject filter.</AppText>
          </SurfaceCard>
        )}
      </Screen>

      {selected ? <LectureDetailSheet item={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function LectureRow({ item, onPress }) {
  const status = statusOf(item);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.lecture, pressed && styles.pressed]}>
      <View style={styles.icon}><Ionicons color={colors.secondary} name="videocam-outline" size={20} /></View>
      <View style={styles.lectureBody}>
        <View style={styles.lectureTop}>
          <AppText numberOfLines={1} style={styles.subject}>{item.subject_name || item.title}</AppText>
          <StatusChip tone={lectureTone(status)}>{readable(status)}</StatusChip>
        </View>
        {item.student_name ? <AppText style={styles.childName}>{item.student_name}</AppText> : null}
        <AppText style={styles.meta}>{dateTime(item.scheduled_start, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</AppText>
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function LectureDetailSheet({ item, onClose }) {
  const status = statusOf(item || {});
  const action = classActionState(item);
  return (
    <View style={styles.overlay}>
      <Pressable onPress={onClose} style={styles.overlayBg} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeading}>
            <AppText style={styles.sheetEyebrow}>LECTURE DETAILS</AppText>
            <AppText variant="heading">{item?.subject_name || item?.title}</AppText>
          </View>
          <Pressable accessibilityLabel="Close lecture details" onPress={onClose}>
            <Ionicons color={colors.onSurfaceVariant} name="close" size={26} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <StatusChip tone={lectureTone(status)}>{readable(status)}</StatusChip>
          <Detail icon="person-outline" label="Child" value={item?.student_name} />
          <Detail icon="calendar-outline" label="Starts" value={dateTime(item?.scheduled_start, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
          <Detail icon="time-outline" label="Ends" value={dateTime(item?.scheduled_end, { hour: "2-digit", minute: "2-digit" })} />
          {item?.description ? <Detail icon="document-text-outline" label="About" value={item.description} /> : null}
          {action.canWatchRecording ? (
            <View style={styles.meetRow}>
              <Ionicons color={colors.secondary} name="play-circle-outline" size={18} />
              <AppText style={styles.meetText}>A recording is available for this lecture.</AppText>
            </View>
          ) : null}
          {action.canWatchRecording ? (
            <PillButton
              icon={<Ionicons color={colors.white} name="play-circle-outline" size={18} />}
              onPress={() => Linking.openURL(item.recording_drive_url)}
              style={styles.meetButton}
            >
              Watch Recording
            </PillButton>
          ) : null}
          {action.canJoin ? (
            <>
              <View style={styles.meetRow}>
                <Ionicons color={colors.secondary} name="videocam-outline" size={18} />
                <AppText style={styles.meetText}>This class has started. You can join now.</AppText>
              </View>
              <PillButton
                icon={<Ionicons color={colors.white} name="videocam-outline" size={18} />}
                onPress={() => Linking.openURL(item.google_meet_link)}
                style={styles.meetButton}
              >
                Join Class
              </PillButton>
            </>
          ) : null}
          {action.future ? (
            <View style={styles.meetRow}>
              <Ionicons color={colors.secondary} name="time-outline" size={18} />
              <AppText style={styles.meetText}>This class has not started yet.</AppText>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
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

function Filter({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]}><AppText numberOfLines={1} style={[styles.filterText, active && styles.filterTextActive]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.md },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  filters: { gap: space.sm, paddingVertical: space.sm },
  subjects: { gap: space.sm, paddingVertical: space.sm },
  filter: { minWidth: 92, height: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  filterText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: space.md },
  countTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  lecture: { flexDirection: "row", alignItems: "center", marginBottom: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface },
  pressed: { opacity: 0.75 },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.goldPale },
  lectureBody: { flex: 1, marginHorizontal: space.sm },
  lectureTop: { flexDirection: "row", alignItems: "center", gap: space.xs },
  subject: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  childName: { color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: 10, marginTop: 1 },
  meta: { marginTop: 3, color: colors.outline, fontSize: 10 },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end" },
  overlayBg: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { maxHeight: "72%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetHeading: { flex: 1 },
  sheetEyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  detail: { flexDirection: "row", paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  detailIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.goldPale },
  detailCopy: { flex: 1, marginLeft: space.md },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { marginTop: 3, color: colors.onSurface, fontSize: fontSize.xs, lineHeight: 18 },
  meetRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  meetText: { flex: 1, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  meetButton: { marginTop: space.md },
});

