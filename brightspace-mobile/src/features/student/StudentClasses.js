/**
 * Student Classes workspace. Enrollments are rendered as class cards and each
 * subject opens a read-only detail sheet assembled from Student-scoped APIs.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import api from "../../api";
import {
  AppText,
  DashboardSkeleton,
  PillButton,
  Screen,
  StatusChip,
  SurfaceCard,
} from "../../components/ui";
import {
  colors,
  fonts,
  fontSize,
  radius,
  shadows,
  space,
} from "../../theme";

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function readable(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTime(value) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not scheduled";
  return parsed.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(value) {
  const status = normalized(value);
  if (["active", "present", "partial", "submitted", "graded"].includes(status)) {
    return "success";
  }
  if (["pending", "scheduled", "upcoming"].includes(status)) return "warning";
  if (["inactive", "absent", "rejected", "cancelled"].includes(status)) {
    return "danger";
  }
  return "neutral";
}

export default function StudentClasses() {
  const [data, setData] = useState({
    classes: [],
    summary: {},
    lectures: [],
    homework: [],
    attendance: [],
  });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const [classes, lectures, homework, attendance] = await Promise.all([
        api.student.classes(),
        api.student.lectures.list({ range: "all" }),
        api.student.homework.list(),
        api.student.attendance(),
      ]);
      setData({
        classes: classes?.items || [],
        summary: classes?.summary || {},
        lectures: lectures?.items || [],
        homework: homework?.items || [],
        attendance: attendance?.items || [],
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your classes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const details = useMemo(() => {
    if (!selected) return null;
    const subjectName = normalized(selected.subject.name);
    const lectures = data.lectures
      .filter((item) => normalized(item.subject_name) === subjectName)
      .sort(
        (left, right) =>
          new Date(left.scheduled_start).getTime() -
          new Date(right.scheduled_start).getTime()
      );
    const upcoming = lectures.filter(
      (item) =>
        new Date(item.scheduled_start).getTime() >= Date.now() &&
        !["cancelled", "missed"].includes(normalized(item.status))
    );
    const homework = data.homework.filter(
      (item) => normalized(item.subject_name) === subjectName
    );
    const attendance = data.attendance.filter(
      (item) => normalized(item.subject_name) === subjectName
    );
    const attended = attendance.filter((item) =>
      ["present", "partial"].includes(
        normalized(item.attendance_status || item.status)
      )
    ).length;

    return {
      lectures,
      upcoming,
      homework,
      attendance,
      attended,
      percentage: attendance.length
        ? Math.round((attended / attendance.length) * 100)
        : 0,
    };
  }, [data.attendance, data.homework, data.lectures, selected]);

  if (loading) {
    return <DashboardSkeleton message="Gathering your classes..." />;
  }

  if (error) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <SurfaceCard>
          <Ionicons color={colors.error} name="school-outline" size={32} />
          <AppText style={styles.errorTitle} variant="heading">
            Classes are unavailable
          </AppText>
          <AppText style={styles.errorBody}>{error}</AppText>
          <PillButton onPress={() => load()} style={styles.retry}>
            Try Again
          </PillButton>
        </SurfaceCard>
      </Screen>
    );
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
          <AppText style={styles.eyebrow}>MY LEARNING</AppText>
          <AppText variant="display">Classes & Subjects</AppText>
          <AppText style={styles.subtitle}>
            Explore your enrolled classes, teachers, and current progress.
          </AppText>
        </View>

        <View style={styles.summary}>
          <Summary
            icon="school-outline"
            label="Classes"
            value={data.summary.total_classes || 0}
          />
          <Summary
            icon="book-outline"
            label="Subjects"
            value={data.summary.total_subjects || 0}
          />
          <Summary
            icon="checkmark-circle-outline"
            label="Active"
            value={data.summary.active_classes || 0}
          />
        </View>

        {data.classes.length ? (
          data.classes.map((course) => (
            <SurfaceCard key={course.id} style={styles.course}>
              <View style={styles.courseTop}>
                <View style={styles.courseIcon}>
                  <Ionicons color={colors.secondary} name="school-outline" size={23} />
                </View>
                <View style={styles.courseCopy}>
                  <AppText style={styles.courseTitle} variant="heading">
                    {course.title || course.class_level || "Class"}
                  </AppText>
                  <AppText style={styles.courseLevel}>
                    {course.class_level || "Learning programme"}
                  </AppText>
                </View>
                <StatusChip tone={statusTone(course.enrollment_status)}>
                  {readable(course.enrollment_status)}
                </StatusChip>
              </View>

              {course.description ? (
                <AppText numberOfLines={3} style={styles.description}>
                  {course.description}
                </AppText>
              ) : null}

              <View style={styles.divider} />
              <AppText style={styles.subjectCount}>
                {course.subjects.length}{" "}
                {course.subjects.length === 1 ? "SUBJECT" : "SUBJECTS"}
              </AppText>

              <View style={styles.subjects}>
                {course.subjects.map((subject) => (
                  <Pressable
                    key={subject.id}
                    onPress={() => setSelected({ course, subject })}
                    style={({ pressed }) => [
                      styles.subject,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.subjectMark}>
                      <AppText style={styles.subjectInitial}>
                        {String(subject.name || "S")[0].toUpperCase()}
                      </AppText>
                    </View>
                    <View style={styles.subjectCopy}>
                      <AppText style={styles.subjectName}>{subject.name}</AppText>
                      <AppText numberOfLines={1} style={styles.teacher}>
                        {subject.teacher_name
                          ? `Teacher: ${subject.teacher_name}`
                          : "Teacher assignment pending"}
                      </AppText>
                      <View style={styles.subjectMeta}>
                        <Meta
                          icon="calendar-outline"
                          text={`${subject.upcoming_lectures || 0} upcoming`}
                        />
                        <Meta
                          icon="clipboard-outline"
                          text={`${subject.pending_homework || 0} homework`}
                        />
                      </View>
                    </View>
                    <Ionicons
                      color={colors.outline}
                      name="chevron-forward"
                      size={20}
                    />
                  </Pressable>
                ))}
              </View>
            </SurfaceCard>
          ))
        ) : (
          <SurfaceCard style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons color={colors.secondary} name="leaf-outline" size={28} />
            </View>
            <AppText style={styles.emptyTitle} variant="heading">
              No enrolled classes
            </AppText>
            <AppText style={styles.emptyText}>
              Your assigned classes and subjects will appear here.
            </AppText>
          </SurfaceCard>
        )}
      </Screen>

      <SubjectSheet
        details={details}
        onClose={() => setSelected(null)}
        selected={selected}
      />
    </>
  );
}

function SubjectSheet({ details, onClose, selected }) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={Boolean(selected)}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeading}>
              <AppText style={styles.eyebrow}>SUBJECT DETAILS</AppText>
              <AppText variant="heading">{selected?.subject.name}</AppText>
              <AppText style={styles.sheetClass}>
                {selected?.course.title || selected?.course.class_level}
              </AppText>
            </View>
            <Pressable accessibilityLabel="Close subject details" onPress={onClose}>
              <Ionicons color={colors.onSurfaceVariant} name="close" size={26} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.teacherCard}>
              <View style={styles.teacherAvatar}>
                <Ionicons color={colors.secondary} name="person-outline" size={22} />
              </View>
              <View style={styles.teacherCardCopy}>
                <AppText style={styles.teacherLabel}>ASSIGNED TEACHER</AppText>
                <AppText style={styles.teacherName}>
                  {selected?.subject.teacher_name || "Assignment pending"}
                </AppText>
                {selected?.subject.teacher_qualification ? (
                  <AppText style={styles.teacherQualification}>
                    {selected.subject.teacher_qualification}
                  </AppText>
                ) : null}
              </View>
            </View>

            {selected?.subject.description ? (
              <AppText style={styles.subjectDescription}>
                {selected.subject.description}
              </AppText>
            ) : null}

            <View style={styles.detailStats}>
              <DetailStat
                label="Attendance"
                value={`${details?.percentage || 0}%`}
              />
              <DetailStat
                label="Upcoming"
                value={details?.upcoming.length || 0}
              />
              <DetailStat
                label="Homework"
                value={
                  details?.homework.filter(
                    (item) => normalized(item.status) === "pending"
                  ).length || 0
                }
              />
            </View>

            <DetailHeading title="Upcoming Lectures" />
            {details?.upcoming.length ? (
              details.upcoming.slice(0, 3).map((lecture) => (
                <View key={lecture.id} style={styles.detailRow}>
                  <View style={styles.detailRowIcon}>
                    <Ionicons color={colors.secondary} name="calendar-outline" size={18} />
                  </View>
                  <View style={styles.detailRowCopy}>
                    <AppText style={styles.detailRowTitle}>
                      {lecture.title || selected?.subject.name}
                    </AppText>
                    <AppText style={styles.detailRowMeta}>
                      {dateTime(lecture.scheduled_start)}
                    </AppText>
                  </View>
                  <StatusChip tone={statusTone(lecture.display_status || lecture.status)}>
                    {readable(lecture.display_status || lecture.status)}
                  </StatusChip>
                </View>
              ))
            ) : (
              <SmallEmpty text="No upcoming lectures for this subject." />
            )}

            <DetailHeading title="Homework" />
            {details?.homework.length ? (
              details.homework.map((item) => (
                <View key={item.id} style={styles.detailRow}>
                  <View style={styles.detailRowIcon}>
                    <Ionicons color={colors.secondary} name="document-text-outline" size={18} />
                  </View>
                  <View style={styles.detailRowCopy}>
                    <AppText style={styles.detailRowTitle}>{item.title}</AppText>
                    <AppText style={styles.detailRowMeta}>
                      {item.due_date
                        ? `Due ${new Date(item.due_date).toLocaleDateString()}`
                        : "No due date"}
                    </AppText>
                  </View>
                  <StatusChip tone={statusTone(item.status)}>
                    {readable(item.status)}
                  </StatusChip>
                </View>
              ))
            ) : (
              <SmallEmpty text="No homework assigned for this subject." />
            )}

            <DetailHeading title="Attendance Summary" />
            <View style={styles.attendanceLine}>
              <AppText style={styles.attendanceText}>
                {details?.attended || 0} of {details?.attendance.length || 0}{" "}
                verified classes attended
              </AppText>
              <AppText style={styles.attendancePercent}>
                {details?.percentage || 0}%
              </AppText>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Summary({ icon, label, value }) {
  return (
    <View style={styles.summaryItem}>
      <Ionicons color={colors.secondary} name={icon} size={19} />
      <AppText style={styles.summaryValue}>{String(value)}</AppText>
      <AppText style={styles.summaryLabel}>{label}</AppText>
    </View>
  );
}

function Meta({ icon, text }) {
  return (
    <View style={styles.meta}>
      <Ionicons color={colors.outline} name={icon} size={13} />
      <AppText style={styles.metaText}>{text}</AppText>
    </View>
  );
}

function DetailStat({ label, value }) {
  return (
    <View style={styles.detailStat}>
      <AppText style={styles.detailStatValue}>{String(value)}</AppText>
      <AppText style={styles.detailStatLabel}>{label}</AppText>
    </View>
  );
}

function DetailHeading({ title }) {
  return <AppText style={styles.detailHeading}>{title}</AppText>;
}

function SmallEmpty({ text }) {
  return (
    <View style={styles.smallEmpty}>
      <Ionicons color={colors.outline} name="leaf-outline" size={17} />
      <AppText style={styles.smallEmptyText}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.lg },
  eyebrow: {
    marginBottom: 3,
    color: colors.secondary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  summary: {
    flexDirection: "row",
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: space.md },
  summaryValue: { marginTop: 2, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  summaryLabel: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: 9, textTransform: "uppercase" },
  course: { marginBottom: space.md },
  courseTop: { flexDirection: "row", alignItems: "center" },
  courseIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: colors.goldPale,
  },
  courseCopy: { flex: 1, marginHorizontal: space.sm },
  courseTitle: { fontSize: fontSize.base },
  courseLevel: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  description: { marginTop: space.md, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  divider: { height: 1, marginVertical: space.md, backgroundColor: colors.borderGreen },
  subjectCount: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  subjects: { gap: space.sm, marginTop: space.sm },
  subject: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 82,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
  },
  pressed: { opacity: 0.72 },
  subjectMark: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#DDF4EA",
  },
  subjectInitial: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.base },
  subjectCopy: { flex: 1, marginHorizontal: space.sm },
  subjectName: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  teacher: { color: colors.onSurfaceVariant, fontSize: 10 },
  subjectMeta: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: 4 },
  meta: { flexDirection: "row", alignItems: "center" },
  metaText: { marginLeft: 3, color: colors.outline, fontSize: 9 },
  empty: { alignItems: "center", paddingVertical: space.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: colors.goldPale,
  },
  emptyTitle: { marginTop: space.md },
  emptyText: { marginTop: space.xs, color: colors.onSurfaceVariant, textAlign: "center" },
  errorScreen: { justifyContent: "center" },
  errorTitle: { marginTop: space.md },
  errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
  retry: { marginTop: space.lg },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: {
    maxHeight: "88%",
    paddingTop: space.sm,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    backgroundColor: colors.background,
    ...shadows.hero,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGreen,
  },
  sheetHeading: { flex: 1 },
  sheetClass: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  teacherCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryContainer,
  },
  teacherAvatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.goldPale,
  },
  teacherCardCopy: { flex: 1, marginLeft: space.sm },
  teacherLabel: { color: "#B9EEDB", fontFamily: fonts.bodyBold, fontSize: 9 },
  teacherName: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  teacherQualification: { color: "#D6E9E2", fontSize: 10 },
  subjectDescription: { marginTop: space.md, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 19 },
  detailStats: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  detailStat: {
    flex: 1,
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
  },
  detailStatValue: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  detailStatLabel: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: 9 },
  detailHeading: { marginTop: space.xl, marginBottom: space.sm, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.base },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: space.sm,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  detailRowIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.goldPale,
  },
  detailRowCopy: { flex: 1, marginHorizontal: space.sm },
  detailRowTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  detailRowMeta: { color: colors.outline, fontSize: 9 },
  smallEmpty: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
  },
  smallEmptyText: { flex: 1, marginLeft: space.sm, color: colors.outline, fontSize: fontSize.xs },
  attendanceLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.goldPale,
  },
  attendanceText: { flex: 1, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  attendancePercent: { marginLeft: space.md, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
});
