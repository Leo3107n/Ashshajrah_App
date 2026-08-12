/**
 * Teacher Notes and Student Communication.
 *
 * Private student observations and visible conversation threads intentionally
 * remain separate. Notes can be edited/deleted only by their owning teacher;
 * thread messages use the shared participant-checked messaging endpoints.
 *
 * Student recipient lists now use dropdown-style pickers instead of long
 * horizontal chip rails so large class name lists remain manageable.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const NOTE_VISIBILITY = [
  ["teacher_only", "Only Me"],
  ["student", "Student"],
  ["parent", "Parent"],
];

const THREAD_VISIBILITY = [
  ["student", "Students"],
  ["parent", "Parents"],
];

const readable = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

function groupNoteRecipients(items) {
  const groups = new Map();

  for (const item of items || []) {
    const key = [item.note, item.visibility, item.lecture_title, item.created_at].join("::");
    if (!groups.has(key)) groups.set(key, { ...item, ids: [], studentNames: [] });
    const group = groups.get(key);
    group.ids.push(item.id);
    if (item.student_name) group.studentNames.push(item.student_name);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    recipientCount: group.ids.length,
    student_name:
      group.studentNames.length > 1
        ? `All Students (${group.studentNames.length})`
        : group.studentNames[0] || "",
  }));
}

export default function TeacherNotes() {
  const { user } = useAuth();
  const [tab, setTab] = useState("notes");
  const [notes, setNotes] = useState([]);
  const [threads, setThreads] = useState([]);
  const [students, setStudents] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [form, setForm] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const [noteData, threadData, studentData, lectureData] = await Promise.all([
        api.teacher.notes.list(),
        api.shared.notes.threads(),
        api.teacher.students(),
        api.teacher.lectures.list(),
      ]);
      setNotes(noteData?.items || []);
      setThreads(threadData?.items || []);
      setStudents(studentData?.items || []);
      setLectures(lectureData?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load notes and conversations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const eligibleStudents = useMemo(() => {
    const lecture = lectures.find((item) => item.id === form?.lectureId);
    if (!lecture) return [];
    const className = String(lecture.class_level || lecture.course_title || "").toLowerCase();
    const subjectName = String(lecture.subject_name || "").toLowerCase();

    return students.filter(
      (student) =>
        String(student.course_title || "").toLowerCase() === className &&
        String(student.subject_name || "").toLowerCase() === subjectName
    );
  }, [form?.lectureId, lectures, students]);

  const displayedNotes = useMemo(() => groupNoteRecipients(notes), [notes]);

  function newNote() {
    setForm({
      kind: "note",
      id: "",
      lectureId: "",
      studentId: "",
      targetAll: false,
      note: "",
      visibility: "teacher_only",
    });
  }

  function newThread() {
    setForm({
      kind: "thread",
      lectureId: "",
      studentId: "",
      message: "",
      visibility: "parent",
    });
  }

  async function saveNote() {
    const needsRecipients = !form.id && form.visibility !== "teacher_only";

    if (
      !form.note.trim() ||
      (!form.id && !form.lectureId) ||
      (needsRecipients && !form.targetAll && !form.studentId)
    ) {
      Alert.alert(
        "Details required",
        needsRecipients
          ? "Select one student or all students, then enter the note."
          : "Select a lecture and enter the note."
      );
      return;
    }

    setSaving(true);

    try {
      const result = form.id
        ? await Promise.all(
            (form.ids || [form.id]).map((id) =>
              api.teacher.notes.update(id, {
                note: form.note.trim(),
                visibility: form.visibility,
              })
            )
          ).then((responses) => responses[0])
        : await api.teacher.notes.create({
            lectureId: form.lectureId,
            studentId: form.targetAll ? undefined : form.studentId,
            targetAll: form.targetAll,
            note: form.note.trim(),
            visibility: form.visibility,
          });

      setForm(null);
      Alert.alert("Teacher note", result?.message || "Note saved.");
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to save note", nextError?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function removeNote() {
    Alert.alert("Delete this note?", "This private record will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            await Promise.all((form.ids || [form.id]).map((id) => api.teacher.notes.delete(id)));
            setForm(null);
            await load({ refresh: true });
          } catch (nextError) {
            Alert.alert("Unable to delete note", nextError?.message || "Please try again.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  async function createThread() {
    const lecture = lectures.find((item) => item.id === form.lectureId);

    if (!lecture || !form.studentId || !form.message.trim()) {
      Alert.alert(
        "Details required",
        "Select the student who should receive this conversation and enter the first message."
      );
      return;
    }

    setSaving(true);

    try {
      const result = await api.shared.notes.createThread({
        lectureId: lecture.id,
        classLevel: lecture.class_level || lecture.course_title,
        subjectId: lecture.subject_id,
        studentId: form.studentId,
        visibility: form.visibility,
        message: form.message.trim(),
      });

      setForm(null);
      await load({ refresh: true });
      const created = result?.item?.id;
      if (created) {
        openThread({
          id: created,
          class_level: lecture.class_level,
          subject_name: lecture.subject_name,
          visibility: form.visibility,
        });
      }
    } catch (nextError) {
      Alert.alert("Unable to start conversation", nextError?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function openThread(item) {
    setThread(item);
    setMessages([]);
    setReply("");
    setThreadLoading(true);

    try {
      const result = await api.shared.notes.messages(item.id);
      setMessages(result?.items || []);
    } catch (nextError) {
      setThread(null);
      Alert.alert("Unable to open conversation", nextError?.message || "Please try again.");
    } finally {
      setThreadLoading(false);
    }
  }

  async function sendReply() {
    if (!reply.trim() || !thread?.id) return;
    setSaving(true);

    try {
      await api.shared.notes.sendMessage(thread.id, { message: reply.trim() });
      const result = await api.shared.notes.messages(thread.id);
      setMessages(result?.items || []);
      setReply("");
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to send message", nextError?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardSkeleton message="Opening notes and conversations..." />;

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
          <View style={styles.headingCopy}>
            <AppText variant="display">Notes</AppText>
            <AppText style={styles.subtitle}>
              Student observations and learning conversations.
            </AppText>
          </View>
          <Pressable
            accessibilityLabel={tab === "notes" ? "Create note" : "Start conversation"}
            onPress={tab === "notes" ? newNote : newThread}
            style={styles.add}
          >
            <Ionicons color={colors.white} name="add" size={24} />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <Tab
            active={tab === "notes"}
            count={notes.length}
            label="Private Notes"
            onPress={() => setTab("notes")}
          />
          <Tab
            active={tab === "threads"}
            count={threads.length}
            label="Conversations"
            onPress={() => setTab("threads")}
          />
        </View>

        {error ? (
          <SurfaceCard style={styles.error}>
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>
              Try Again
            </PillButton>
          </SurfaceCard>
        ) : null}

        <View style={styles.list}>
          {tab === "notes" ? (
            displayedNotes.length ? (
              displayedNotes.map((item) => (
                <NoteCard
                  item={item}
                  key={item.ids.join("-")}
                  onPress={() =>
                    setForm({
                      kind: "note",
                      id: item.id,
                      ids: item.ids,
                      note: item.note || "",
                      visibility: ["teacher_only", "student", "parent"].includes(item.visibility)
                        ? item.visibility
                        : "teacher_only",
                    })
                  }
                />
              ))
            ) : (
              <Empty icon="document-text-outline" text="No notes have been created yet." />
            )
          ) : threads.length ? (
            threads.map((item) => (
              <ThreadCard item={item} key={item.id} onPress={() => openThread(item)} />
            ))
          ) : (
            <Empty icon="chatbubbles-outline" text="No learning conversations have started yet." />
          )}
        </View>
      </Screen>

      <Editor
        eligibleStudents={eligibleStudents}
        form={form}
        lectures={lectures}
        onChange={setForm}
        onClose={() => setForm(null)}
        onDelete={removeNote}
        onSave={form?.kind === "note" ? saveNote : createThread}
        saving={saving}
      />

      <Conversation
        currentUserId={user?.id}
        item={thread}
        loading={threadLoading}
        messages={messages}
        onClose={() => setThread(null)}
        onReply={setReply}
        onSend={sendReply}
        reply={reply}
        saving={saving}
      />
    </>
  );
}

function Tab({ active, count, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}>
      <AppText style={[styles.tabText, active && styles.activeTabText]}>{label}</AppText>
      <View style={[styles.badge, active && styles.activeBadge]}>
        <AppText style={[styles.badgeText, active && styles.activeBadgeText]}>{count}</AppText>
      </View>
    </Pressable>
  );
}

function NoteCard({ item, onPress }) {
  const ownerOnly = item.visibility === "teacher_only";

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.noteIcon}>
        <Ionicons
          color={colors.secondary}
          name={ownerOnly ? "lock-closed-outline" : "reader-outline"}
          size={20}
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardLine}>
          <AppText style={styles.cardTitle}>
            {ownerOnly ? "Only Me" : item.student_name || "Student note"}
          </AppText>
          <AppText style={styles.date}>{dateTime(item.created_at)}</AppText>
        </View>
        <AppText numberOfLines={2} style={styles.noteText}>
          {item.note}
        </AppText>
        <AppText style={styles.context}>
          {item.subject_name || "General"} · {item.class_level || "Assigned class"} ·{" "}
          {readable(item.visibility)}
        </AppText>
      </View>
    </Pressable>
  );
}

function ThreadCard({ item, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.threadIcon}>
        <Ionicons color={colors.emeraldMid} name="chatbubble-ellipses-outline" size={20} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardLine}>
          <AppText style={styles.cardTitle}>{item.subject_name || "Learning conversation"}</AppText>
          <AppText style={styles.date}>{item.message_count || 0}</AppText>
        </View>
        <AppText numberOfLines={2} style={styles.noteText}>
          {item.last_message || "Open the conversation to send a message."}
        </AppText>
        <AppText style={styles.context}>
          {item.class_level || item.course_title || "Assigned class"} · {readable(item.visibility)}
        </AppText>
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function DropdownField({ disabled, label, onPress, value }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.dropdown, disabled && styles.dropdownDisabled]}
    >
      <AppText numberOfLines={1} style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
        {value || label}
      </AppText>
      <Ionicons color={colors.outline} name="chevron-down" size={18} />
    </Pressable>
  );
}

function OptionSheet({ onClose, onSelect, options, title, visible }) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.optionSheet}>
          <SheetHeader onClose={onClose} title={title} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.optionList}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  style={styles.optionRow}
                >
                  <AppText style={styles.optionText}>{option.label}</AppText>
                  <Ionicons color={colors.primary} name="chevron-forward" size={16} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Editor({ eligibleStudents, form, lectures, onChange, onClose, onDelete, onSave, saving }) {
  const isNote = form?.kind === "note";
  const editing = Boolean(form?.id);
  const [dropdown, setDropdown] = useState(null);

  const selectedStudentLabel =
    eligibleStudents.find((item) => item.id === form?.studentId)?.full_name || "";

  const recipientOptions = useMemo(
    () => [
      { value: "__all__", label: `All Students (${eligibleStudents.length})` },
      ...eligibleStudents.map((item) => ({ value: item.id, label: item.full_name })),
    ],
    [eligibleStudents]
  );

  const singleRecipientOptions = useMemo(
    () => eligibleStudents.map((item) => ({ value: item.id, label: item.full_name })),
    [eligibleStudents]
  );

  if (!form) return null;

  return (
    <>
      <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(form)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <SheetHeader
              onClose={onClose}
              title={isNote ? (editing ? "Edit Student Note" : "New Student Note") : "Start Conversation"}
            />

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {!editing ? (
                <>
                  <Label>{isNote ? "Lecture Context" : "Class and Subject"}</Label>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {lectures.map((item) => (
                      <Choice
                        active={form?.lectureId === item.id}
                        key={item.id}
                        label={`${item.subject_name || item.title} · ${item.class_level || item.course_title}`}
                        onPress={() => onChange({ ...form, lectureId: item.id, studentId: "", targetAll: false })}
                      />
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <Label>Visibility</Label>
              <View style={styles.visibility}>
                {(isNote ? NOTE_VISIBILITY : THREAD_VISIBILITY).map(([value, label]) => (
                  <Choice
                    active={form?.visibility === value}
                    key={value}
                    label={label}
                    onPress={() =>
                      onChange({
                        ...form,
                        visibility: value,
                        studentId: value === "teacher_only" ? "" : form.studentId,
                        targetAll: value === "teacher_only" ? false : form.targetAll,
                      })
                    }
                  />
                ))}
              </View>

              {isNote && !editing && form?.lectureId && form.visibility !== "teacher_only" ? (
                <>
                  <Label>Recipients</Label>
                  <DropdownField
                    disabled={!eligibleStudents.length}
                    label="Select recipients"
                    onPress={() => setDropdown("recipients")}
                    value={form.targetAll ? `All Students (${eligibleStudents.length})` : selectedStudentLabel}
                  />
                  {!eligibleStudents.length ? (
                    <AppText style={styles.hint}>No active students match this lecture assignment.</AppText>
                  ) : (
                    <AppText style={styles.hintNeutral}>
                      {form.visibility === "parent"
                        ? "The note will be shared with the selected students' parents."
                        : "Choose one learner or the entire class."}
                    </AppText>
                  )}
                </>
              ) : null}

              {!isNote && !editing && form?.lectureId ? (
                <>
                  <Label>Recipient Student</Label>
                  <DropdownField
                    disabled={!eligibleStudents.length}
                    label="Select student"
                    onPress={() => setDropdown("thread-student")}
                    value={selectedStudentLabel}
                  />
                  {!eligibleStudents.length ? (
                    <AppText style={styles.hint}>No active students match this lecture assignment.</AppText>
                  ) : (
                    <AppText style={styles.hintNeutral}>
                      {form.visibility === "parent"
                        ? "Only the selected student's parents will see this conversation."
                        : "Only the selected student will see this conversation."}
                    </AppText>
                  )}
                </>
              ) : null}

              <Label>{isNote ? "Observation" : "First Message"}</Label>
              <TextInput
                maxLength={2000}
                multiline
                onChangeText={(text) => onChange({ ...form, [isNote ? "note" : "message"]: text })}
                placeholder={isNote ? "Record a helpful student observation" : "Write a message for this class"}
                placeholderTextColor={colors.outline}
                style={styles.textarea}
                textAlignVertical="top"
                value={isNote ? form?.note : form?.message}
              />

              <PillButton disabled={saving} loading={saving} onPress={onSave} style={styles.save}>
                {editing ? "Save Changes" : isNote ? "Save Note" : "Start Conversation"}
              </PillButton>

              {editing ? (
                <PillButton disabled={saving} onPress={onDelete} style={styles.delete} variant="outline">
                  Delete Note
                </PillButton>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <OptionSheet
        onClose={() => setDropdown(null)}
        onSelect={(value) => {
          if (dropdown === "recipients") {
            onChange({
              ...form,
              targetAll: value === "__all__",
              studentId: value === "__all__" ? "" : value,
            });
          } else {
            onChange({ ...form, studentId: value });
          }
          setDropdown(null);
        }}
        options={dropdown === "recipients" ? recipientOptions : singleRecipientOptions}
        title={dropdown === "recipients" ? "Select Recipients" : "Select Student"}
        visible={Boolean(dropdown)}
      />
    </>
  );
}

function Conversation({ currentUserId, item, loading, messages, onClose, onReply, onSend, reply, saving }) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}>
      <View style={styles.backdrop}>
        <View style={styles.conversation}>
          <SheetHeader onClose={onClose} title={item?.subject_name || "Conversation"} />
          {loading ? (
            <DashboardSkeleton message="Loading conversation..." />
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
                {messages.length ? (
                  messages.map((message) => {
                    const mine = message.sender_user_id === currentUserId;
                    return (
                      <View key={message.id} style={[styles.message, mine ? styles.mine : styles.theirs]}>
                        <AppText style={[styles.sender, mine && styles.mineText]}>
                          {mine ? "You" : message.full_name || readable(message.sender_role)}
                        </AppText>
                        <AppText style={[styles.messageText, mine && styles.mineText]}>
                          {message.message}
                        </AppText>
                        <AppText style={[styles.messageTime, mine && styles.mineTime]}>
                          {dateTime(message.created_at)}
                        </AppText>
                      </View>
                    );
                  })
                ) : (
                  <Empty icon="chatbubble-outline" text="No messages are in this conversation yet." />
                )}
              </ScrollView>

              <View style={styles.composer}>
                <TextInput
                  multiline
                  onChangeText={onReply}
                  placeholder="Write a reply..."
                  placeholderTextColor={colors.outline}
                  style={styles.reply}
                  value={reply}
                />
                <Pressable
                  disabled={saving || !reply.trim()}
                  onPress={onSend}
                  style={[styles.send, (!reply.trim() || saving) && styles.sendDisabled]}
                >
                  <Ionicons color={colors.white} name="send" size={18} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Choice({ active, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.activeChoice]}>
      <AppText numberOfLines={1} style={[styles.choiceText, active && styles.activeChoiceText]}>
        {label}
      </AppText>
    </Pressable>
  );
}

function SheetHeader({ onClose, title }) {
  return (
    <View style={styles.sheetHead}>
      <AppText style={styles.sheetTitle}>{title}</AppText>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}>
        <Ionicons color={colors.primary} name="close" size={22} />
      </Pressable>
    </View>
  );
}

function Label({ children }) {
  return <AppText style={styles.label}>{children}</AppText>;
}

function Empty({ icon, text }) {
  return (
    <View style={styles.empty}>
      <Ionicons color={colors.outline} name={icon} size={30} />
      <AppText style={styles.emptyText}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { flexDirection: "row", alignItems: "center" },
  headingCopy: { flex: 1 },
  subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  add: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: colors.primary,
    ...shadows.subtle,
  },
  tabs: {
    flexDirection: "row",
    marginTop: space.lg,
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceLow,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.full,
  },
  activeTab: { backgroundColor: colors.surface, ...shadows.subtle },
  tabText: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  activeTabText: { color: colors.primary },
  badge: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.outlineVariant,
  },
  activeBadge: { backgroundColor: colors.gold },
  badgeText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 8 },
  activeBadgeText: { color: colors.primary },
  list: { gap: space.sm, marginTop: space.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  noteIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: colors.goldPale,
  },
  threadIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: colors.statusPresentBg,
  },
  cardBody: { flex: 1, marginLeft: space.md },
  cardLine: { flexDirection: "row", alignItems: "center" },
  cardTitle: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  date: { marginLeft: space.sm, color: colors.outline, fontSize: 8 },
  noteText: { marginTop: 4, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  context: { marginTop: 6, color: colors.emeraldMid, fontFamily: fonts.bodyBold, fontSize: 8 },
  error: { marginTop: space.md, backgroundColor: colors.errorContainer },
  errorText: { color: colors.error, fontSize: fontSize.xs },
  retry: { alignSelf: "flex-start", marginTop: space.sm },
  empty: {
    alignItems: "center",
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceLow,
  },
  emptyText: { marginTop: space.sm, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,39,30,.35)" },
  sheet: {
    height: "88%",
    padding: space.lg,
    paddingBottom: space["2xl"],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
  },
  conversation: {
    height: "90%",
    padding: space.lg,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
  },
  optionSheet: {
    height: "64%",
    padding: space.lg,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  sheetTitle: { flex: 1, color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.xl },
  close: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: colors.surfaceHigh,
  },
  label: {
    marginTop: space.md,
    marginBottom: space.xs,
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
  },
  rail: { gap: space.xs, paddingRight: space.md },
  visibility: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  choice: {
    maxWidth: 220,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  activeChoice: { backgroundColor: colors.primary },
  choiceText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: 9 },
  activeChoiceText: { color: colors.white },
  dropdown: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  dropdownDisabled: { opacity: 0.55 },
  dropdownText: {
    flex: 1,
    paddingRight: space.sm,
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  dropdownPlaceholder: { color: colors.outline },
  optionList: { gap: space.xs, paddingBottom: space.md },
  optionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  optionText: {
    flex: 1,
    paddingRight: space.sm,
    color: colors.primary,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
  },
  hint: { marginTop: space.xs, color: colors.error, fontSize: 9 },
  hintNeutral: { marginTop: space.xs, color: colors.outline, fontSize: 9 },
  textarea: {
    minHeight: 120,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  save: { marginTop: space.xl },
  delete: { marginTop: space.sm },
  messages: { gap: space.sm, paddingVertical: space.sm },
  message: { maxWidth: "82%", padding: space.md, borderRadius: radius.xl },
  mine: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
    backgroundColor: colors.primary,
  },
  theirs: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    backgroundColor: colors.surfaceLow,
  },
  sender: { color: colors.emeraldMid, fontFamily: fonts.bodyBold, fontSize: 8 },
  messageText: { marginTop: 3, color: colors.onSurface, fontSize: fontSize.xs, lineHeight: 18 },
  mineText: { color: colors.white },
  messageTime: { marginTop: 5, color: colors.outline, fontSize: 7 },
  mineTime: { color: "#B9EEDB" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderGreen,
  },
  reply: {
    flex: 1,
    maxHeight: 96,
    minHeight: 46,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: 23,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  send: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: colors.primary,
  },
  sendDisabled: { opacity: 0.45 },
});
