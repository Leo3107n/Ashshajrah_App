/** Read-only Student lecture detail sheet with safe meeting/recording actions. */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import api from "../../api";
import { AppText, PillButton, StatusChip } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

export function readable(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function lectureTone(value) {
  const status = String(value || "").toLowerCase();
  if (["live", "verified_by_coordinator", "completed_by_teacher"].includes(status)) {
    return "success";
  }
  if (["scheduled", "upcoming", "rescheduled"].includes(status)) return "warning";
  if (["cancelled", "missed", "disputed"].includes(status)) return "danger";
  return "neutral";
}

export function lectureDate(value, options = {}) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not scheduled";
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export default function StudentLectureSheet({ lecture, onClose }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!lecture?.id) {
      setItem(null);
      setError("");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError("");
    api.student.lectures
      .detail(lecture.id)
      .then((response) => {
        if (active) setItem(response?.item || lecture);
      })
      .catch((nextError) => {
        if (active) setError(nextError?.message || "Unable to load this lecture.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lecture]);

  const detail = item || lecture;
  const status = detail?.display_status || detail?.status;
  const hasMeetLink = Boolean(detail?.google_meet_link);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={Boolean(lecture)}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText style={styles.eyebrow}>LECTURE DETAILS</AppText>
              <AppText variant="heading">
                {detail?.subject_name || detail?.title || "Lecture"}
              </AppText>
            </View>
            <Pressable accessibilityLabel="Close lecture details" onPress={onClose}>
              <Ionicons color={colors.onSurfaceVariant} name="close" size={26} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {loading ? (
              <View style={styles.state}>
                <Ionicons color={colors.secondary} name="hourglass-outline" size={25} />
                <AppText style={styles.stateText}>Loading lecture details...</AppText>
              </View>
            ) : error ? (
              <View style={styles.error}>
                <Ionicons color={colors.error} name="alert-circle-outline" size={22} />
                <AppText style={styles.errorText}>{error}</AppText>
              </View>
            ) : (
              <>
                <View style={styles.titleRow}>
                  <View style={styles.lectureIcon}>
                    <Ionicons color={colors.secondary} name="videocam-outline" size={23} />
                  </View>
                  <View style={styles.titleCopy}>
                    <AppText style={styles.title}>{detail?.title}</AppText>
                    <AppText style={styles.teacher}>
                      {detail?.teacher_name || "Teacher"}
                    </AppText>
                  </View>
                  <StatusChip tone={lectureTone(status)}>{readable(status)}</StatusChip>
                </View>

                <View style={styles.timeCard}>
                  <Info
                    icon="calendar-outline"
                    label="Starts"
                    value={lectureDate(detail?.scheduled_start, { weekday: "short" })}
                  />
                  <Info
                    icon="time-outline"
                    label="Ends"
                    value={lectureDate(detail?.scheduled_end, { weekday: "short" })}
                  />
                </View>

                {detail?.description ? (
                  <Section label="About this lecture" value={detail.description} />
                ) : null}
                {detail?.topic_covered ? (
                  <Section label="Topic covered" value={detail.topic_covered} />
                ) : null}
                {detail?.summary ? (
                  <Section label="Teacher summary" value={detail.summary} />
                ) : null}
                {detail?.homework_given ? (
                  <Section label="Homework given" value={detail.homework_given} />
                ) : null}
                {detail?.student_performance ? (
                  <Section
                    label="Student performance"
                    value={detail.student_performance}
                  />
                ) : null}

                {hasMeetLink ? (
                  <PillButton
                    icon={<Ionicons color={colors.white} name="videocam-outline" size={18} />}
                    onPress={() => Linking.openURL(detail.google_meet_link)}
                    style={styles.action}
                  >
                    Open Google Meet
                  </PillButton>
                ) : null}
                {detail?.recording_drive_url ? (
                  <PillButton
                    icon={<Ionicons color={colors.white} name="play-circle-outline" size={18} />}
                    onPress={() => Linking.openURL(detail.recording_drive_url)}
                    style={styles.action}
                  >
                    Watch Recording
                  </PillButton>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Info({ icon, label, value }) {
  return (
    <View style={styles.info}>
      <Ionicons color={colors.secondary} name={icon} size={18} />
      <View style={styles.infoCopy}>
        <AppText style={styles.infoLabel}>{label}</AppText>
        <AppText style={styles.infoValue}>{value}</AppText>
      </View>
    </View>
  );
}

function Section({ label, value }) {
  return (
    <View style={styles.section}>
      <AppText style={styles.sectionLabel}>{label}</AppText>
      <AppText style={styles.sectionText}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: {
    maxHeight: "88%",
    paddingTop: space.sm,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    backgroundColor: colors.background,
    ...shadows.modal,
  },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGreen,
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  content: { padding: space.lg, paddingBottom: space["3xl"] },
  titleRow: { flexDirection: "row", alignItems: "center" },
  lectureIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: colors.goldPale,
  },
  titleCopy: { flex: 1, marginHorizontal: space.sm },
  title: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  teacher: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  timeCard: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceLow,
  },
  info: { flex: 1, flexDirection: "row", alignItems: "center" },
  infoCopy: { flex: 1, marginLeft: space.sm },
  infoLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  infoValue: { color: colors.primary, fontSize: 10 },
  section: { marginTop: space.lg },
  sectionLabel: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.base },
  sectionText: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 19 },
  action: { marginTop: space.lg },
  state: { alignItems: "center", paddingVertical: space["2xl"] },
  stateText: { marginTop: space.sm, color: colors.onSurfaceVariant },
  error: { flexDirection: "row", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.errorContainer },
  errorText: { flex: 1, marginLeft: space.sm, color: colors.error, fontSize: fontSize.xs },
});
