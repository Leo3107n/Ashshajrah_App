/**
 * Student Homework workspace. Assignments are categorized locally from the
 * Student-scoped API and pending work can be submitted with a note and file.
 */
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
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

const FILTERS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["submitted", "Submitted"],
  ["overdue", "Overdue"],
];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function readable(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  return parsed.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(item) {
  if (isOverdue(item)) return "danger";
  const status = normalized(item?.status);
  if (status === "submitted") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

export default function StudentHomework() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.student.homework.list();
      setItems(response?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load homework.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((item) => normalized(item.status) === "pending").length,
      submitted: items.filter((item) => normalized(item.status) === "submitted").length,
      overdue: items.filter(isOverdue).length,
    }),
    [items]
  );

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (filter === "overdue") return isOverdue(item);
        if (filter === "all") return true;
        return normalized(item.status) === filter;
      }),
    [filter, items]
  );

  if (loading) {
    return <DashboardSkeleton message="Gathering your homework..." />;
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
          <AppText style={styles.eyebrow}>MY ASSIGNMENTS</AppText>
          <AppText variant="display">Homework</AppText>
          <AppText style={styles.subtitle}>
            Review assignments and submit your completed work.
          </AppText>
        </View>

        <View style={styles.summary}>
          <Summary label="Total" value={summary.total} />
          <Summary label="Pending" value={summary.pending} />
          <Summary label="Submitted" value={summary.submitted} />
          <Summary label="Overdue" value={summary.overdue} danger />
        </View>

        <ScrollView
          contentContainerStyle={styles.filters}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {FILTERS.map(([value, label]) => (
            <Filter
              active={filter === value}
              count={summary[value] ?? summary.total}
              key={value}
              label={label}
              onPress={() => setFilter(value)}
            />
          ))}
        </ScrollView>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={30} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>
              Try Again
            </PillButton>
          </SurfaceCard>
        ) : visible.length ? (
          visible.map((item) => (
            <HomeworkCard
              item={item}
              key={item.id}
              onPress={() => setSelected(item)}
            />
          ))
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="checkmark-done-outline" size={31} />
            <AppText style={styles.stateTitle}>Nothing here</AppText>
            <AppText style={styles.stateText}>
              No homework matches this filter.
            </AppText>
          </SurfaceCard>
        )}
      </Screen>

      <HomeworkSheet
        item={selected}
        onClose={() => setSelected(null)}
        onSubmitted={async () => {
          setSelected(null);
          await load({ refresh: true });
        }}
      />
    </>
  );
}

function HomeworkCard({ item, onPress }) {
  const overdue = isOverdue(item);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardIcon}>
        <Ionicons
          color={overdue ? colors.error : colors.secondary}
          name={normalized(item.status) === "submitted" ? "checkmark-circle-outline" : "document-text-outline"}
          size={22}
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <AppText numberOfLines={1} style={styles.cardTitle}>
            {item.title}
          </AppText>
          <StatusChip tone={statusTone(item)}>
            {overdue ? "Overdue" : readable(item.status)}
          </StatusChip>
        </View>
        <AppText style={styles.subject}>
          {item.subject_name || "General"} · {item.teacher_name || "Teacher"}
        </AppText>
        <View style={styles.due}>
          <Ionicons color={overdue ? colors.error : colors.outline} name="calendar-outline" size={14} />
          <AppText style={[styles.dueText, overdue && styles.dueOverdue]}>
            Due {dateLabel(item.due_date)}
          </AppText>
        </View>
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function HomeworkSheet({ item, onClose, onSubmitted }) {
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNote(item?.submission_note || "");
    setFile(null);
    setError("");
  }, [item]);

  const pending = normalized(item?.status) === "pending";

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    if (Number(asset.size || 0) > MAX_FILE_BYTES) {
      setError("The selected file must be 10 MB or smaller.");
      return;
    }
    setFile(asset);
    setError("");
  }

  async function submit() {
    if (saving) return;
    if (!note.trim()) {
      setError("Add a short submission note before sending your work.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      let body = { note: note.trim() };
      if (file) {
        body = new FormData();
        body.append("note", note.trim());
        if (Platform.OS === "web" && file.file) {
          body.append("file", file.file, file.name);
        } else {
          body.append("file", {
            uri: file.uri,
            name: file.name || "homework",
            type: file.mimeType || "application/octet-stream",
          });
        }
      }
      await api.student.homework.submit(item.id, body);
      Alert.alert("Homework submitted", "Your teacher can now review your work.");
      await onSubmitted();
    } catch (nextError) {
      setError(nextError?.message || "Unable to submit homework.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={Boolean(item)}
    >
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
            <View style={styles.assignmentMeta}>
              <Meta icon="book-outline" label="Subject" value={item?.subject_name} />
              <Meta icon="person-outline" label="Teacher" value={item?.teacher_name} />
              <Meta icon="calendar-outline" label="Due" value={dateLabel(item?.due_date)} />
            </View>

            {item?.description ? (
              <Detail label="Assignment" value={item.description} />
            ) : null}
            {item?.lecture_title ? (
              <Detail label="Related lecture" value={item.lecture_title} />
            ) : null}

            {pending ? (
              <>
                {item?.review_action === "homework_rejected" ? (
                  <View style={styles.feedback}>
                    <Ionicons color={colors.error} name="return-down-back-outline" size={20} />
                    <View style={styles.feedbackBody}>
                      <AppText style={styles.feedbackTitle}>Returned by teacher</AppText>
                      <AppText style={styles.feedbackText}>
                        {item.teacher_remarks || "Please update and submit your work again."}
                      </AppText>
                    </View>
                  </View>
                ) : null}
                <AppText style={styles.inputLabel}>Submission note *</AppText>
                <TextInput
                  multiline
                  onChangeText={(value) => {
                    setNote(value);
                    setError("");
                  }}
                  placeholder="Explain what you completed or add a message for your teacher..."
                  placeholderTextColor={colors.outline}
                  style={styles.textarea}
                  textAlignVertical="top"
                  value={note}
                />
                <Pressable onPress={chooseFile} style={styles.filePicker}>
                  <Ionicons color={colors.secondary} name="attach-outline" size={22} />
                  <View style={styles.fileCopy}>
                    <AppText numberOfLines={1} style={styles.fileTitle}>
                      {file?.name || "Attach completed work"}
                    </AppText>
                    <AppText style={styles.fileHint}>
                      PDF, Word, or image · maximum 10 MB
                    </AppText>
                  </View>
                  {file ? (
                    <Pressable accessibilityLabel="Remove attachment" onPress={() => setFile(null)}>
                      <Ionicons color={colors.error} name="close-circle" size={21} />
                    </Pressable>
                  ) : (
                    <Ionicons color={colors.outline} name="add-circle-outline" size={21} />
                  )}
                </Pressable>
                {error ? (
                  <View style={styles.formError}>
                    <Ionicons color={colors.error} name="alert-circle-outline" size={18} />
                    <AppText style={styles.formErrorText}>{error}</AppText>
                  </View>
                ) : null}
                <PillButton
                  icon={<Ionicons color={colors.white} name="send-outline" size={18} />}
                  loading={saving}
                  onPress={submit}
                  style={styles.submit}
                >
                  Submit Homework
                </PillButton>
              </>
            ) : (
              <View style={styles.submitted}>
                <View style={styles.submittedTitle}>
                  <Ionicons color={colors.emeraldMid} name="checkmark-circle" size={23} />
                  <AppText style={styles.submittedHeading}>Work submitted</AppText>
                </View>
                <Detail label="Your note" value={item?.submission_note || "No note"} />
                {item?.submitted_at ? (
                  <AppText style={styles.submittedAt}>
                    Submitted {new Date(item.submitted_at).toLocaleString()}
                  </AppText>
                ) : null}
                {item?.submission_attachment_url ? (
                  <PillButton
                    onPress={() => Linking.openURL(item.submission_attachment_url)}
                    style={styles.attachment}
                    variant="outline"
                  >
                    Open Attachment
                  </PillButton>
                ) : null}
                {item?.review_action === "homework_approved" ? (
                  <View style={styles.approved}>
                    <AppText style={styles.approvedTitle}>Approved by teacher</AppText>
                    {item.teacher_remarks ? (
                      <AppText style={styles.approvedText}>{item.teacher_remarks}</AppText>
                    ) : null}
                  </View>
                ) : (
                  <AppText style={styles.awaiting}>Awaiting teacher review</AppText>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Summary({ danger, label, value }) {
  return (
    <View style={styles.summaryItem}>
      <AppText style={[styles.summaryValue, danger && Number(value) > 0 && styles.summaryDanger]}>
        {String(value)}
      </AppText>
      <AppText style={styles.summaryLabel}>{label}</AppText>
    </View>
  );
}

function Filter({ active, count, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]}>
      <AppText style={[styles.filterText, active && styles.filterTextActive]}>
        {label} {count}
      </AppText>
    </Pressable>
  );
}

function Meta({ icon, label, value }) {
  return (
    <View style={styles.meta}>
      <Ionicons color={colors.secondary} name={icon} size={18} />
      <View style={styles.metaCopy}>
        <AppText style={styles.metaLabel}>{label}</AppText>
        <AppText numberOfLines={2} style={styles.metaValue}>{value || "Not available"}</AppText>
      </View>
    </View>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.detail}>
      <AppText style={styles.detailLabel}>{label}</AppText>
      <AppText style={styles.detailText}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.lg },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  summary: { flexDirection: "row", marginBottom: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: space.md },
  summaryValue: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  summaryDanger: { color: colors.error },
  summaryLabel: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: 8, textTransform: "uppercase" },
  filters: { gap: space.sm, paddingVertical: space.sm, marginBottom: space.md },
  filter: {
    width: 108,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  filterActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  filterText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  card: { flexDirection: "row", alignItems: "center", marginBottom: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.72 },
  cardIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.goldPale },
  cardBody: { flex: 1, marginHorizontal: space.sm },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.xs },
  cardTitle: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  subject: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: 10 },
  due: { flexDirection: "row", alignItems: "center", marginTop: space.xs },
  dueText: { marginLeft: 4, color: colors.outline, fontSize: 9 },
  dueOverdue: { color: colors.error, fontFamily: fonts.bodySemibold },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { maxHeight: "90%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background, ...shadows.modal },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetHeading: { flex: 1 },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  assignmentMeta: { gap: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  meta: { flexDirection: "row", alignItems: "center" },
  metaCopy: { flex: 1, marginLeft: space.sm },
  metaLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 8, textTransform: "uppercase" },
  metaValue: { color: colors.primary, fontSize: fontSize.xs },
  detail: { marginTop: space.lg },
  detailLabel: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.base },
  detailText: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 19 },
  feedback: { flexDirection: "row", marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.errorContainer },
  feedbackBody: { flex: 1, marginLeft: space.sm },
  feedbackTitle: { color: colors.error, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  feedbackText: { marginTop: 2, color: colors.error, fontSize: fontSize.xs },
  inputLabel: { marginTop: space.lg, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  textarea: { minHeight: 120, marginTop: space.sm, padding: space.md, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, fontSize: fontSize.sm, backgroundColor: colors.surface },
  filePicker: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.secondary, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  fileCopy: { flex: 1, marginHorizontal: space.sm },
  fileTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  fileHint: { color: colors.outline, fontSize: 9 },
  formError: { flexDirection: "row", marginTop: space.md, padding: space.sm, borderRadius: radius.lg, backgroundColor: colors.errorContainer },
  formErrorText: { flex: 1, marginLeft: space.sm, color: colors.error, fontSize: fontSize.xs },
  submit: { marginTop: space.lg },
  submitted: { marginTop: space.lg, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface },
  submittedTitle: { flexDirection: "row", alignItems: "center" },
  submittedHeading: { marginLeft: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  submittedAt: { marginTop: space.sm, color: colors.outline, fontSize: 9 },
  attachment: { marginTop: space.md },
  approved: { marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: "#D1FAE5" },
  approvedTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  approvedText: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  awaiting: { marginTop: space.md, color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
});
