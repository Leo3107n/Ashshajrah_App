/**
 * Student Homework workspace. Assignments are categorized locally from the
 * Student-scoped API and pending work can be submitted with a note and file.
 */
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
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

function fileSize(asset) {
  return Number(asset?.size || asset?.fileSize || 0);
}

function normalizeImageAsset(asset, fallbackName) {
  const extension = asset?.uri?.split(".").pop()?.split("?")[0] || "jpg";
  return {
    ...asset,
    mimeType: asset?.mimeType || "image/jpeg",
    name: asset?.fileName || `${fallbackName}.${extension}`,
    size: fileSize(asset),
  };
}

function isImageAttachment(item) {
  const name = normalized(item?.submission_attachment_name);
  const url = normalized(item?.submission_attachment_url);
  return /\.(png|jpe?g|webp|gif|heic|heif)(\?|$)/i.test(name) || /\.(png|jpe?g|webp|gif|heic|heif)(\?|$)/i.test(url);
}

export default function StudentHomework() {
  const [items, setItems] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [subject, setSubject] = useState("");
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [homework, classes] = await Promise.all([
        api.student.homework.list(),
        api.student.classes(),
      ]);
      setItems(homework?.items || []);
      const subjectMap = new Map();
      (classes?.items || []).forEach((course) => {
        (course.subjects || []).forEach((subjectItem) => {
          const label = subjectItem.name || "General";
          const key = normalized(label) || "general";
          if (!subjectMap.has(key)) {
            subjectMap.set(key, {
              key,
              label,
              count: 0,
            });
          }
        });
      });
      setClassSubjects(Array.from(subjectMap.values()));
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

  const subjects = useMemo(() => {
    const byKey = new Map(classSubjects.map((item) => [item.key, { ...item, count: 0 }]));
    items.forEach((item) => {
      const label = item.subject_name || "General";
      const key = normalized(label) || "general";
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          label,
          count: 0,
        });
      }
      byKey.get(key).count += 1;
    });
    return Array.from(byKey.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }, [items]);

  const subjectItems = useMemo(
    () =>
      subject
        ? items.filter((item) => (normalized(item.subject_name) || "general") === subject)
        : items,
    [items, subject]
  );

  const summary = useMemo(
    () => ({
      total: subjectItems.length,
      pending: subjectItems.filter((item) => normalized(item.status) === "pending").length,
      submitted: subjectItems.filter((item) => normalized(item.status) === "submitted").length,
      overdue: subjectItems.filter(isOverdue).length,
    }),
    [subjectItems]
  );

  const visible = useMemo(
    () =>
      subjectItems.filter((item) => {
        if (!subject) return false;
        if (filter === "overdue") return isOverdue(item);
        if (filter === "all") return true;
        return normalized(item.status) === filter;
      }),
    [filter, subject, subjectItems]
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
        <AppText style={styles.analyticsHint}>
          {subject
            ? `Showing analytics for ${subjects.find((item) => item.key === subject)?.label || "selected subject"}.`
            : "Overall homework analytics. Select a subject to view homework."}
        </AppText>

        <View style={styles.subjectSection}>
          <View style={styles.subjectHeader}>
            <AppText style={styles.subjectHeading}>Select Subject</AppText>
            {subject ? (
              <Pressable
                accessibilityLabel="Clear selected subject"
                onPress={() => {
                  setSubject("");
                  setFilter("all");
                }}
              >
                <AppText style={styles.clearSubject}>Clear</AppText>
              </Pressable>
            ) : null}
          </View>
          <SubjectDropdown
            onOpen={() => setSubjectPickerOpen(true)}
            selected={subjects.find((item) => item.key === subject)}
          />
        </View>

        {subject ? (
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
        ) : null}

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={30} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>
              Try Again
            </PillButton>
          </SurfaceCard>
        ) : !subject ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="book-outline" size={31} />
            <AppText style={styles.stateTitle}>Select a subject</AppText>
            <AppText style={styles.stateText}>
              Choose a subject above to view its homework and subject analytics.
            </AppText>
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
      <SubjectPicker
        items={subjects}
        onClose={() => setSubjectPickerOpen(false)}
        onSelect={(item) => {
          setSubject(item.key);
          setFilter("all");
          setSubjectPickerOpen(false);
        }}
        selectedKey={subject}
        visible={subjectPickerOpen}
      />
    </>
  );
}

function HomeworkCard({ item, onPress }) {
  const overdue = isOverdue(item);
  const canUpload = normalized(item.status) === "pending";
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
        {item.submission_attachment_url ? (
          <Pressable
            onPress={() => Linking.openURL(item.submission_attachment_url)}
            style={styles.uploadedFile}
          >
            <Ionicons color={colors.secondary} name="attach-outline" size={14} />
            <AppText numberOfLines={1} style={styles.uploadedFileText}>
              {item.submission_attachment_name || "Uploaded homework file"}
            </AppText>
            <Ionicons color={colors.secondary} name="open-outline" size={13} />
          </Pressable>
        ) : null}
        {canUpload ? (
          <View style={styles.uploadPrompt}>
            <Ionicons color={colors.secondary} name="image-outline" size={15} />
            <AppText style={styles.uploadPromptText}>
              Upload screenshot/image
            </AppText>
          </View>
        ) : null}
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
    if (fileSize(asset) > MAX_FILE_BYTES) {
      setError("The selected file must be 10 MB or smaller.");
      return;
    }
    setFile(asset);
    setError("");
  }

  async function chooseScreenshot() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to upload a homework screenshot or image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    if (fileSize(asset) > MAX_FILE_BYTES) {
      setError("The selected screenshot or image must be 10 MB or smaller.");
      return;
    }

    setFile(normalizeImageAsset(asset, "homework-image"));
    setError("");
  }

  async function takeHomeworkPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Allow camera access to take and upload homework images.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    if (fileSize(asset) > MAX_FILE_BYTES) {
      setError("The homework image must be 10 MB or smaller.");
      return;
    }

    setFile(normalizeImageAsset(asset, "homework-photo"));
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
            {item?.submission_attachment_url ? (
              <View style={styles.attachmentBlock}>
                {isImageAttachment(item) ? (
                  <Pressable onPress={() => Linking.openURL(item.submission_attachment_url)}>
                    <Image
                      resizeMode="cover"
                      source={{ uri: item.submission_attachment_url }}
                      style={styles.attachmentPreview}
                    />
                  </Pressable>
                ) : null}
                <PillButton
                  icon={<Ionicons color={colors.secondary} name="download-outline" size={18} />}
                  onPress={() => Linking.openURL(item.submission_attachment_url)}
                  style={styles.attachment}
                  variant="outline"
                >
                  View / Download Uploaded File
                </PillButton>
              </View>
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
                <Pressable onPress={chooseScreenshot} style={styles.screenshotPicker}>
                  <Ionicons color={colors.secondary} name="image-outline" size={22} />
                  <View style={styles.fileCopy}>
                    <AppText style={styles.fileTitle}>Upload screenshot or image</AppText>
                    <AppText style={styles.fileHint}>
                      Select an image from your gallery · maximum 10 MB
                    </AppText>
                  </View>
                  <Ionicons color={colors.outline} name="images-outline" size={21} />
                </Pressable>
                <Pressable onPress={takeHomeworkPhoto} style={styles.screenshotPicker}>
                  <Ionicons color={colors.secondary} name="camera-outline" size={22} />
                  <View style={styles.fileCopy}>
                    <AppText style={styles.fileTitle}>Take homework photo</AppText>
                    <AppText style={styles.fileHint}>
                      Capture a page or solved work · maximum 10 MB
                    </AppText>
                  </View>
                  <Ionicons color={colors.outline} name="camera-reverse-outline" size={21} />
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

function SubjectDropdown({ onOpen, selected }) {
  return (
    <Pressable onPress={onOpen} style={styles.subjectDropdown}>
      <View style={styles.subjectDropdownCopy}>
        <AppText style={styles.subjectDropdownLabel}>Subject</AppText>
        <AppText numberOfLines={1} style={[styles.subjectDropdownValue, !selected && styles.subjectDropdownPlaceholder]}>
          {selected ? `${selected.label} (${selected.count})` : "Choose a subject to view homework"}
        </AppText>
      </View>
      <Ionicons color={colors.outline} name="chevron-down-outline" size={22} />
    </Pressable>
  );
}

function SubjectPicker({ items, onClose, onSelect, selectedKey, visible }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.pickerOverlay}>
        <Pressable onPress={onClose} style={styles.pickerBackdrop} />
        <SurfaceCard style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <View>
              <AppText style={styles.eyebrow}>HOMEWORK FILTER</AppText>
              <AppText variant="heading">Select Subject</AppText>
            </View>
            <Pressable accessibilityLabel="Close subject selector" onPress={onClose}>
              <Ionicons color={colors.onSurfaceVariant} name="close" size={24} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.pickerList}>
            {items.length ? (
              items.map((item) => {
                const active = selectedKey === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => onSelect(item)}
                    style={[styles.pickerOption, active && styles.pickerOptionActive]}
                  >
                    <View style={styles.pickerOptionCopy}>
                      <AppText style={[styles.pickerOptionText, active && styles.pickerOptionTextActive]}>
                        {item.label}
                      </AppText>
                      <AppText style={[styles.pickerOptionCount, active && styles.pickerOptionTextActive]}>
                        {item.count} homework assigned
                      </AppText>
                    </View>
                    {active ? <Ionicons color={colors.white} name="checkmark-circle" size={20} /> : null}
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.pickerEmpty}>
                <Ionicons color={colors.outline} name="book-outline" size={28} />
                <AppText style={styles.stateText}>No subjects are available yet.</AppText>
              </View>
            )}
          </ScrollView>
        </SurfaceCard>
      </View>
    </Modal>
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
  analyticsHint: { marginTop: -space.xs, marginBottom: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  subjectSection: { marginBottom: space.sm },
  subjectHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.xs },
  subjectHeading: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs, textTransform: "uppercase", letterSpacing: 1 },
  clearSubject: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  subjectDropdown: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  subjectDropdownCopy: { flex: 1 },
  subjectDropdownLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 8, textTransform: "uppercase" },
  subjectDropdownValue: { marginTop: 3, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  subjectDropdownPlaceholder: { color: colors.outline },
  pickerOverlay: { flex: 1, justifyContent: "center", padding: space.lg, backgroundColor: "rgba(2,35,28,0.45)" },
  pickerBackdrop: { ...StyleSheet.absoluteFillObject },
  pickerCard: { maxHeight: "72%", padding: space.lg },
  pickerHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: space.md },
  pickerList: { gap: space.sm },
  pickerOption: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  pickerOptionActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  pickerOptionCopy: { flex: 1 },
  pickerOptionText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  pickerOptionCount: { marginTop: 2, color: colors.outline, fontSize: 9 },
  pickerOptionTextActive: { color: colors.white },
  pickerEmpty: { alignItems: "center", paddingVertical: space.xl },
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
  uploadedFile: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.xs, maxWidth: "100%" },
  uploadedFileText: { flex: 1, color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: 10 },
  uploadPrompt: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.sm, paddingHorizontal: space.sm, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.goldPale },
  uploadPromptText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { maxHeight: "90%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background, ...shadows.modal },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
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
  screenshotPicker: { flexDirection: "row", alignItems: "center", marginTop: space.sm, padding: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
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
  attachmentBlock: { marginTop: space.md },
  attachmentPreview: { width: "100%", height: 220, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  attachment: { marginTop: space.md },
  approved: { marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: "#D1FAE5" },
  approvedTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  approvedText: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  awaiting: { marginTop: space.md, color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
});
