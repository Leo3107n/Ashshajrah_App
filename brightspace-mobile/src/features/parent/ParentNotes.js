/**
 * Parent Notes & Messages. Read-only teacher feedback plus reply-capable
 * subject conversations, scoped to the parent's children. Unlike the Student
 * screen, parents cannot start a new conversation here — that thread is
 * opened by the teacher first; parents only reply.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
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
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function dateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ParentNotes() {
  const [tab, setTab] = useState("notes");
  const [data, setData] = useState({ notes: [], threads: [], children: [] });
  const [childId, setChildId] = useState("");
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [timeline, threads] = await Promise.all([
        api.parent.timeline({ childId: childId || undefined }),
        api.shared.notes.threads({ childId: childId || undefined }),
      ]);
      setData({
        notes: timeline?.notes || [],
        threads: threads?.items || [],
        children: timeline?.children || data.children,
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load communications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DashboardSkeleton message="Opening communications..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <AppText style={styles.eyebrow}>STAY CONNECTED</AppText>
          <AppText variant="display">Notes & Messages</AppText>
          <AppText style={styles.subtitle}>Read teacher feedback and reply to open conversations.</AppText>
        </View>

        {data.children.length > 1 ? (
          <ScrollView contentContainerStyle={styles.childFilters} horizontal showsHorizontalScrollIndicator={false}>
            <Chip active={!childId} label="All Children" onPress={() => setChildId("")} />
            {data.children.map((child) => (
              <Chip active={childId === child.id} key={child.id} label={child.full_name || child.name} onPress={() => setChildId(child.id)} />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.tabs}>
          <Tab active={tab === "notes"} count={data.notes.length} icon="document-text-outline" label="Teacher Notes" onPress={() => setTab("notes")} />
          <Tab active={tab === "messages"} count={data.threads.length} icon="chatbubbles-outline" label="Conversations" onPress={() => setTab("messages")} />
        </View>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={28} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : tab === "notes" ? (
          <NotesList items={data.notes} />
        ) : data.threads.length ? (
          data.threads.map((thread) => <ThreadCard item={thread} key={thread.id} onPress={() => setSelectedThread(thread)} />)
        ) : (
          <Empty icon="chatbubble-ellipses-outline" text="Conversations a teacher starts about your child will appear here." title="No conversations yet" />
        )}
      </Screen>

      <ThreadSheet onClose={() => setSelectedThread(null)} onSent={load} thread={selectedThread} />
    </>
  );
}

function NotesList({ items }) {
  if (!items.length) {
    return <Empty icon="document-text-outline" text="Teacher feedback shared about your child will appear here." title="No teacher notes" />;
  }
  return items.slice().reverse().map((item) => (
    <SurfaceCard key={item.id} style={styles.note}>
      <View style={styles.noteTop}>
        <View style={styles.avatar}><AppText style={styles.avatarText}>{String(item.teacher_name || "T")[0].toUpperCase()}</AppText></View>
        <View style={styles.noteHeading}>
          <AppText style={styles.noteTeacher}>{item.teacher_name || "Teacher"}</AppText>
          {item.student_name ? <AppText style={styles.noteChild}>{item.student_name}</AppText> : null}
          <AppText style={styles.noteDate}>{dateTime(item.created_at)}</AppText>
        </View>
        <View style={styles.readOnly}>
          <Ionicons color={colors.secondary} name="eye-outline" size={13} />
          <AppText style={styles.readOnlyText}>Feedback</AppText>
        </View>
      </View>
      <AppText style={styles.noteText}>{item.note}</AppText>
    </SurfaceCard>
  ));
}

function ThreadCard({ item, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.thread, pressed && styles.pressed]}>
      <View style={styles.threadIcon}><Ionicons color={colors.secondary} name="chatbubbles-outline" size={21} /></View>
      <View style={styles.threadCopy}>
        <View style={styles.threadTop}>
          <AppText numberOfLines={1} style={styles.threadTitle}>{item.subject_name || "Learning conversation"}</AppText>
          <AppText style={styles.threadDate}>{dateTime(item.last_message_at || item.updated_at)}</AppText>
        </View>
        <AppText style={styles.threadTeacher}>
          {item.teacher_name || "Teacher"} · {item.student_name || item.course_title || item.class_level}
        </AppText>
        <AppText numberOfLines={2} style={styles.lastMessage}>{item.last_message || "Open this conversation"}</AppText>
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function ThreadSheet({ onClose, onSent, thread }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async () => {
    if (!thread?.id) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.shared.notes.messages(thread.id);
      setMessages(response?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  }, [thread?.id]);

  useEffect(() => {
    setText("");
    loadMessages();
  }, [loadMessages]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await api.shared.notes.sendMessage(thread.id, { message: text.trim() });
      setText("");
      await loadMessages();
      await onSent({ refresh: true });
    } catch (nextError) {
      setError(nextError?.message || "Unable to send your reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(thread)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <View style={styles.threadSheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeading}>
              <AppText style={styles.eyebrow}>CONVERSATION</AppText>
              <AppText variant="heading">{thread?.subject_name || "Teacher Messages"}</AppText>
              <AppText style={styles.sheetMeta}>{thread?.teacher_name || "Teacher"} · {thread?.student_name || thread?.course_title}</AppText>
            </View>
            <Pressable accessibilityLabel="Close conversation" onPress={onClose}>
              <Ionicons color={colors.onSurfaceVariant} name="close" size={26} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.messages}>
            {loading ? (
              <AppText style={styles.loadingText}>Loading messages...</AppText>
            ) : messages.length ? (
              messages.map((message) => {
                const mine = message.sender_role === "parent";
                return (
                  <View key={message.id} style={[styles.bubble, mine ? styles.myBubble : styles.teacherBubble]}>
                    <AppText style={[styles.sender, mine && styles.myText]}>{mine ? "You" : message.full_name || "Teacher"}</AppText>
                    <AppText style={[styles.messageText, mine && styles.myText]}>{message.message}</AppText>
                    <AppText style={[styles.messageDate, mine && styles.myDate]}>{dateTime(message.created_at)}</AppText>
                  </View>
                );
              })
            ) : (
              <AppText style={styles.loadingText}>No messages in this conversation.</AppText>
            )}
          </ScrollView>
          {error ? <AppText style={styles.inlineError}>{error}</AppText> : null}
          <View style={styles.composer}>
            <TextInput
              multiline
              onChangeText={setText}
              placeholder="Write a reply..."
              placeholderTextColor={colors.outline}
              style={styles.composerInput}
              value={text}
            />
            <Pressable
              accessibilityLabel="Send reply"
              disabled={!text.trim() || sending}
              onPress={send}
              style={[styles.send, (!text.trim() || sending) && styles.sendDisabled]}
            >
              <Ionicons color={colors.white} name="send" size={19} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Tab({ active, count, icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Ionicons color={active ? colors.white : colors.secondary} name={icon} size={17} />
      <AppText style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</AppText>
      {count ? <View style={[styles.badge, active && styles.badgeActive]}><AppText style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</AppText></View> : null}
    </Pressable>
  );
}

function Chip({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><AppText style={[styles.chipText, active && styles.chipTextActive]}>{label}</AppText></Pressable>;
}

function Empty({ icon, text, title }) {
  return (
    <SurfaceCard style={styles.state}>
      <Ionicons color={colors.secondary} name={icon} size={30} />
      <AppText style={styles.stateTitle}>{title}</AppText>
      <AppText style={styles.stateText}>{text}</AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.md },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  childFilters: { gap: space.sm, paddingTop: space.md },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  chipText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  chipTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  tabs: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.full, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  tabLabel: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  tabLabelActive: { color: colors.white },
  badge: { minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.goldPale },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  badgeText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  badgeTextActive: { color: colors.white },
  state: { alignItems: "center", paddingVertical: space.xl, marginTop: space.md },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  note: { marginTop: space.md },
  noteTop: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.goldPale },
  avatarText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  noteHeading: { flex: 1, marginLeft: space.sm },
  noteTeacher: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  noteChild: { color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: 10 },
  noteDate: { color: colors.outline, fontSize: 9 },
  readOnly: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  readOnlyText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 8 },
  noteText: { marginTop: space.sm, color: colors.onSurface, fontSize: fontSize.xs, lineHeight: 18 },
  thread: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.75 },
  threadIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.goldPale },
  threadCopy: { flex: 1, marginHorizontal: space.sm },
  threadTop: { flexDirection: "row", alignItems: "center", gap: space.xs },
  threadTitle: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  threadDate: { color: colors.outline, fontSize: 9 },
  threadTeacher: { marginTop: 2, color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: 10 },
  lastMessage: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  threadSheet: { maxHeight: "88%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetHeading: { flex: 1 },
  sheetMeta: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  messages: { padding: space.lg, gap: space.sm },
  loadingText: { textAlign: "center", color: colors.outline, fontSize: fontSize.xs },
  bubble: { maxWidth: "82%", padding: space.md, borderRadius: radius.lg },
  myBubble: { alignSelf: "flex-end", backgroundColor: colors.primaryContainer },
  teacherBubble: { alignSelf: "flex-start", backgroundColor: colors.surfaceLow },
  sender: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9 },
  myText: { color: colors.white },
  messageText: { marginTop: 3, color: colors.onSurface, fontSize: fontSize.xs, lineHeight: 18 },
  messageDate: { marginTop: 4, color: colors.outline, fontSize: 8 },
  myDate: { color: "#D6E9E2" },
  inlineError: { marginHorizontal: space.lg, color: colors.error, fontSize: fontSize.xs },
  composer: { flexDirection: "row", alignItems: "flex-end", padding: space.lg, borderTopWidth: 1, borderTopColor: colors.borderGreen },
  composerInput: { flex: 1, maxHeight: 110, marginRight: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body },
  send: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.secondary },
  sendDisabled: { opacity: 0.5 },
});
