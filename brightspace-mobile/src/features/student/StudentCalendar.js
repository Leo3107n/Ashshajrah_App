/** Student calendar with marked lecture dates, subject filtering, and details. */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Calendar } from "react-native-calendars";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, space } from "../../theme";
import StudentLectureSheet, { lectureDate, lectureTone, readable } from "./StudentLectureSheet";

const PERIODS = [
  ["selected_date", "Day"],
  ["selected_week", "Week"],
  ["selected_month", "Month"],
];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function StudentCalendar() {
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [period, setPeriod] = useState("selected_date");
  const [subjectId, setSubjectId] = useState("");
  const [data, setData] = useState({ items: [], subjects: [], markedDates: [] });
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.student.calendarLectures({
        range: period,
        date: selectedDate,
        subjectId: subjectId || undefined,
      });
      setData({
        items: response?.items || [],
        subjects: response?.subjects || [],
        markedDates: response?.markedDates || [],
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your calendar.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, selectedDate, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const marks = Object.fromEntries(
    data.markedDates.map((item) => [
      item.date,
      { marked: true, dotColor: colors.gold },
    ])
  );
  marks[selectedDate] = {
    ...(marks[selectedDate] || {}),
    selected: true,
    selectedColor: colors.primaryContainer,
  };

  if (loading && !data.subjects.length) {
    return <DashboardSkeleton message="Opening your calendar..." />;
  }

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <AppText style={styles.eyebrow}>MY SCHEDULE</AppText>
          <AppText variant="display">Learning Calendar</AppText>
          <AppText style={styles.subtitle}>Choose a date to view your scheduled lectures.</AppText>
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

        <ScrollView contentContainerStyle={styles.periods} horizontal showsHorizontalScrollIndicator={false}>
          {PERIODS.map(([value, label]) => (
            <Filter active={period === value} key={value} label={label} onPress={() => setPeriod(value)} />
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
          <Filter active={!subjectId} label="All Subjects" onPress={() => setSubjectId("")} />
          {data.subjects.map((subject) => (
            <Filter active={subjectId === subject.id} key={subject.id} label={subject.name} onPress={() => setSubjectId(subject.id)} />
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <AppText style={styles.sectionTitle}>Lectures</AppText>
          <AppText style={styles.count}>{data.items.length} scheduled this {period === "selected_date" ? "day" : period === "selected_week" ? "week" : "month"}</AppText>
        </View>

        {error ? (
          <SurfaceCard style={styles.error}>
            <Ionicons color={colors.error} name="alert-circle-outline" size={22} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : data.items.length ? (
          data.items.map((item) => (
            <LectureCard item={item} key={item.id} onPress={() => setSelectedLecture(item)} />
          ))
        ) : (
          <SurfaceCard style={styles.empty}>
            <Ionicons color={colors.secondary} name="calendar-clear-outline" size={30} />
            <AppText style={styles.emptyTitle}>No lectures in this period</AppText>
            <AppText style={styles.emptyText}>Select another marked date, week, or month to view its schedule.</AppText>
          </SurfaceCard>
        )}
      </Screen>
      <StudentLectureSheet lecture={selectedLecture} onClose={() => setSelectedLecture(null)} />
    </>
  );
}

export function LectureCard({ item, onPress }) {
  const status = item.display_status || item.status;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.lecture, pressed && styles.pressed]}>
      <View style={styles.timeRail}>
        <AppText style={styles.time}>{lectureDate(item.scheduled_start, { hour: "2-digit", minute: "2-digit", month: undefined, day: undefined })}</AppText>
        <View style={styles.railLine} />
      </View>
      <View style={styles.lectureBody}>
        <View style={styles.lectureTop}>
          <AppText numberOfLines={1} style={styles.subject}>{item.subject_name || item.title}</AppText>
          <StatusChip tone={lectureTone(status)}>{readable(status)}</StatusChip>
        </View>
        <AppText style={styles.lectureTitle}>{item.title}</AppText>
        <View style={styles.meta}>
          <Ionicons color={colors.outline} name="person-outline" size={14} />
          <AppText style={styles.metaText}>{item.teacher_name || "Teacher"}</AppText>
          {item.google_meet_link ? <Ionicons color={colors.secondary} name="videocam-outline" size={15} /> : null}
        </View>
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function Filter({ active, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]}>
      <AppText style={[styles.filterText, active && styles.filterTextActive]}>{label}</AppText>
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
  filters: { gap: space.sm, paddingBottom: space.lg },
  filter: { paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  filterText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  count: { color: colors.outline, fontSize: 10 },
  lecture: { flexDirection: "row", alignItems: "center", marginBottom: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface },
  pressed: { opacity: 0.72 },
  timeRail: { width: 66, alignItems: "center", alignSelf: "stretch" },
  time: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  railLine: { width: 2, flex: 1, minHeight: 30, marginTop: 5, borderRadius: 1, backgroundColor: colors.goldPale },
  lectureBody: { flex: 1, marginHorizontal: space.sm },
  lectureTop: { flexDirection: "row", alignItems: "center", gap: space.xs },
  subject: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  lectureTitle: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.xs },
  metaText: { flex: 1, color: colors.outline, fontSize: 10 },
  empty: { alignItems: "center", paddingVertical: space.xl },
  emptyTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  error: { alignItems: "center" },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
});
