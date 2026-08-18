/**
 * Parent Calendar. Shows lectures for all enrolled children on a selected
 * date, with subject and child filters and a read-only lecture detail sheet.
 * Parents can see the Meet link to know if/when a class is happening but cannot
 * join or take any action — that remains in the Student and Teacher portals.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Calendar } from "react-native-calendars";
import api from "../../api";
import {
  AppText,
  DashboardSkeleton,
  PillButton,
  Screen,
  StatusChip,
  SurfaceCard,
} from "../../components/ui";
import ChildDropdown from "./components/ChildDropdown";
import ChildSelectionState from "./components/ChildSelectionState";
import { colors, fonts, fontSize, radius, space } from "../../theme";

const PERIODS = [
  ["selected_date", "Day"],
  ["selected_week", "Week"],
  ["selected_month", "Month"],
];

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readable(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function timeLabel(value) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function lectureTone(value) {
  const status = String(value || "").toLowerCase();
  if (["live", "verified_by_coordinator", "completed_by_teacher"].includes(status)) return "success";
  if (["scheduled", "upcoming", "rescheduled"].includes(status)) return "warning";
  if (["cancelled", "missed", "disputed"].includes(status)) return "danger";
  return "neutral";
}

export default function ParentCalendar() {
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [period, setPeriod] = useState("selected_date");
  const [childFilter, setChildFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [data, setData] = useState({ items: [], children: [], subjects: [], markedDates: [] });
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.parent.classes({
        range: period,
        date: selectedDate,
        childId: childFilter || undefined,
        subjectId: subjectFilter || undefined,
      });
      setData({
        items: response?.items || [],
        children: response?.children || [],
        subjects: response?.subjects || [],
        markedDates: response?.markedDates || [],
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load the class calendar.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, selectedDate, childFilter, subjectFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setSelectedLecture(null);
  }, [period, selectedDate, childFilter, subjectFilter]);

  useEffect(() => {
    if (data.children.length === 1) {
      setChildFilter(data.children[0]?.id || "");
      return;
    }
    if (childFilter && data.children.some((child) => child.id === childFilter)) return;
    setChildFilter("");
  }, [childFilter, data.children]);

  const requiresChildSelection = data.children.length > 1 && !childFilter;

  const marks = Object.fromEntries(
    (data.markedDates || []).map((item) => [
      item.date || item,
      { marked: true, dotColor: colors.gold },
    ])
  );
  marks[selectedDate] = {
    ...(marks[selectedDate] || {}),
    selected: true,
    selectedColor: colors.primaryContainer,
  };

  if (loading && !data.children.length) {
    return <DashboardSkeleton message="Loading the class calendar..." />;
  }

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.gold]}
            onRefresh={() => load({ refresh: true })}
            refreshing={refreshing}
            tintColor={colors.gold}
          />
        }
      >
        <View style={styles.heading}>
          <AppText style={styles.eyebrow}>CLASS SCHEDULE</AppText>
          <AppText variant="display">Learning Calendar</AppText>
          <AppText style={styles.subtitle}>
            Select a date to view your child&apos;s scheduled classes.
          </AppText>
        </View>

        <SurfaceCard style={styles.calendarCard}>
          <Calendar
            current={selectedDate}
            markedDates={marks}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            theme={{
              arrowColor: colors.secondary,
              calendarBackground: colors.surface,
              dayTextColor: colors.onSurface,
              monthTextColor: colors.primary,
              selectedDayTextColor: colors.white,
              textDayFontFamily: fonts.body,
              textDayHeaderFontFamily: fonts.bodyBold,
              textMonthFontFamily: fonts.display,
              todayTextColor: colors.secondary,
            }}
          />
        </SurfaceCard>

        <ScrollView
          contentContainerStyle={styles.periods}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {PERIODS.map(([value, label]) => (
            <FilterChip
              active={period === value}
              key={value}
              label={label}
              onPress={() => setPeriod(value)}
            />
          ))}
        </ScrollView>

        {/* Child filter */}
        {data.children.length > 1 ? (
          <ChildDropdown
            children={data.children}
            label="SELECT CHILD"
            onChange={setChildFilter}
            placeholder="Choose a child to view class schedule"
            selectedId={childFilter}
          />
        ) : null}

        {/* Subject filter */}
        {data.subjects.length > 1 ? (
          <ScrollView
            contentContainerStyle={styles.subFilters}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <FilterChip
              active={!subjectFilter}
              label="All Subjects"
              onPress={() => setSubjectFilter("")}
            />
            {data.subjects.map((subject) => (
              <FilterChip
                active={subjectFilter === subject.id}
                key={subject.id}
                label={subject.name}
                onPress={() => setSubjectFilter(subject.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.sectionHeader}>
          <AppText style={styles.sectionTitle}>Classes</AppText>
          <AppText style={styles.count}>{requiresChildSelection ? 0 : data.items.length} scheduled this {period === "selected_date" ? "day" : period === "selected_week" ? "week" : "month"}</AppText>
        </View>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="alert-circle-outline" size={22} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : requiresChildSelection ? (
          <ChildSelectionState message="Choose a child from the dropdown to view that child’s class schedule." />
        ) : data.items.length ? (
          data.items.map((item) => (
            <LectureRow
              item={item}
              key={item.id}
              onPress={() => setSelectedLecture(item)}
            />
          ))
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="calendar-clear-outline" size={30} />
            <AppText style={styles.stateTitle}>No classes in this period</AppText>
            <AppText style={styles.stateText}>
              Select another marked date, week, or month to view the schedule.
            </AppText>
          </SurfaceCard>
        )}
      </Screen>

      {/* Detail sheet */}
      {selectedLecture ? (
        <LectureDetailSheet
          item={selectedLecture}
          onClose={() => setSelectedLecture(null)}
        />
      ) : null}
    </>
  );
}

function LectureRow({ item, onPress }) {
  const status = item.display_status || item.status;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.lecture, pressed && styles.pressed]}
    >
      <View style={styles.timeRail}>
        <AppText style={styles.time}>{timeLabel(item.scheduled_start)}</AppText>
        <View style={styles.railLine} />
      </View>
      <View style={styles.lectureBody}>
        <View style={styles.lectureTop}>
          <AppText numberOfLines={1} style={styles.subject}>
            {item.subject_name || item.title}
          </AppText>
          <StatusChip tone={lectureTone(status)}>{readable(status)}</StatusChip>
        </View>
        {item.student_name ? (
          <AppText style={styles.childName}>{item.student_name}</AppText>
        ) : null}
        <View style={styles.meta}>
          <Ionicons color={colors.outline} name="person-outline" size={14} />
          <AppText style={styles.metaText}>{item.teacher_name || "Teacher"}</AppText>
          {item.google_meet_link ? (
            <Ionicons color={colors.secondary} name="videocam-outline" size={15} />
          ) : null}
        </View>
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function LectureDetailSheet({ item, onClose }) {
  const status = item?.display_status || item?.status;
  return (
    <View style={styles.overlay}>
      <Pressable onPress={onClose} style={styles.overlayBg} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeading}>
            <AppText style={styles.sheetEyebrow}>CLASS DETAILS</AppText>
            <AppText variant="heading">{item?.subject_name || item?.title}</AppText>
          </View>
          <Pressable accessibilityLabel="Close class details" onPress={onClose}>
            <Ionicons color={colors.onSurfaceVariant} name="close" size={26} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <StatusChip tone={lectureTone(status)}>{readable(status)}</StatusChip>
          <Detail icon="person-outline" label="Teacher" value={item?.teacher_name} />
          <Detail icon="school-outline" label="Student" value={item?.student_name} />
          <Detail
            icon="calendar-outline"
            label="Starts"
            value={
              item?.scheduled_start
                ? new Date(item.scheduled_start).toLocaleString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Not scheduled"
            }
          />
          <Detail
            icon="time-outline"
            label="Ends"
            value={
              item?.scheduled_end
                ? new Date(item.scheduled_end).toLocaleString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Not scheduled"
            }
          />
          {item?.description ? (
            <Detail icon="document-text-outline" label="About" value={item.description} />
          ) : null}
          {item?.google_meet_link ? (
            <>
              <View style={styles.meetRow}>
                <Ionicons color={colors.secondary} name="videocam-outline" size={18} />
                <AppText style={styles.meetText}>Google Meet link is available for this scheduled class.</AppText>
              </View>
              <PillButton
                icon={<Ionicons color={colors.white} name="videocam-outline" size={18} />}
                onPress={() => Linking.openURL(item.google_meet_link)}
                style={styles.meetButton}
              >
                Open Google Meet
              </PillButton>
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function Detail({ icon, label, value }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>
        <Ionicons color={colors.secondary} name={icon} size={17} />
      </View>
      <View style={styles.detailCopy}>
        <AppText style={styles.detailLabel}>{label}</AppText>
        <AppText style={styles.detailValue}>{value || "Not available"}</AppText>
      </View>
    </View>
  );
}

function FilterChip({ active, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <AppText style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.lg },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  calendarCard: { padding: space.xs, overflow: "hidden" },
  periods: { gap: space.sm, paddingTop: space.lg, paddingBottom: space.sm },
  filters: { gap: space.sm, paddingTop: space.lg, paddingBottom: space.sm },
  subFilters: { gap: space.sm, paddingBottom: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  chipText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  chipTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  count: { color: colors.outline, fontSize: 10 },
  lecture: { flexDirection: "row", alignItems: "center", marginBottom: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface },
  pressed: { opacity: 0.72 },
  timeRail: { width: 60, alignItems: "center", alignSelf: "stretch" },
  time: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  railLine: { width: 2, flex: 1, minHeight: 24, marginTop: 5, borderRadius: 1, backgroundColor: colors.goldPale },
  lectureBody: { flex: 1, marginHorizontal: space.sm },
  lectureTop: { flexDirection: "row", alignItems: "center", gap: space.xs },
  subject: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  childName: { color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: 10, marginTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.xs },
  metaText: { flex: 1, color: colors.outline, fontSize: 10 },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  // Detail sheet — rendered inline as absolute overlay to avoid needing Modal
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end" },
  overlayBg: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { maxHeight: "72%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
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
