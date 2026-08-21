/** Searchable Student lecture history with status/subject filters and details. */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import SubjectDropdown from "../../components/SubjectDropdown";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, space } from "../../theme";
import StudentLectureSheet from "./StudentLectureSheet";
import { LectureCard } from "./StudentCalendar";

const FILTERS = [
  ["all", "All"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
  ["recorded", "Recordings"],
];

function statusOf(item) {
  return String(item.display_status || item.status || "").toLowerCase();
}

export default function StudentLectures() {
  const [data, setData] = useState({ items: [], subjects: [] });
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
      const response = await api.student.lectures.list({ range: "all" });
      setData({ items: response?.items || [], subjects: response?.subjects || [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load lectures.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () =>
      data.items.filter((item) => {
        if (subjectId && item.subject_id !== subjectId) return false;
        const status = statusOf(item);
        if (filter === "upcoming") return ["scheduled", "upcoming", "live", "rescheduled"].includes(status);
        if (filter === "completed") return ["completed_by_teacher", "verified_by_coordinator", "ended"].includes(status);
        if (filter === "recorded") return Boolean(item.recording_drive_url);
        return true;
      }),
    [data.items, filter, subjectId]
  );

  if (loading) return <DashboardSkeleton message="Gathering your lectures..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <AppText style={styles.eyebrow}>MY LEARNING</AppText>
          <AppText variant="display">Lectures</AppText>
          <AppText style={styles.subtitle}>Join scheduled classes and revisit completed learning.</AppText>
        </View>

        <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map(([value, label]) => (
            <Filter active={filter === value} key={value} label={label} onPress={() => setFilter(value)} />
          ))}
        </ScrollView>
        <SubjectDropdown
          onChange={setSubjectId}
          options={data.subjects}
          selectedId={subjectId}
        />

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
        ) : visible.length ? (
          visible.map((item) => <LectureCard item={item} key={item.id} onPress={() => setSelected(item)} />)
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="videocam-off-outline" size={30} />
            <AppText style={styles.stateTitle}>No matching lectures</AppText>
            <AppText style={styles.stateText}>Try another status or subject filter.</AppText>
          </SurfaceCard>
        )}
      </Screen>
      <StudentLectureSheet lecture={selected} onClose={() => setSelected(null)} />
    </>
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
  heading: { marginBottom: space.md },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  filters: { gap: space.sm, paddingVertical: space.sm },
  subjects: { gap: space.sm, paddingVertical: space.sm },
  filter: { paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  filterText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: space.md },
  countTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
});
