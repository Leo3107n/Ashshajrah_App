/**
 * Student Teacher Notes. This screen is intentionally read-only for learners:
 * students only see class-wide teacher notes for their enrolled class, not
 * one-to-one/private notes addressed to an individual student.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
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

function dateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function StudentNotes() {
  const [data, setData] = useState({ notes: [] });
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const threads = await api.shared.notes.threads();
      setData({
        notes: (threads?.items || []).map((thread) => ({
          id: thread.id,
          note: thread.last_message || "No note content available.",
          created_at: thread.last_message_at || thread.updated_at || thread.created_at,
          teacher_name: thread.teacher_name,
          course_title: thread.course_title,
          class_level: thread.class_level,
          subject_name: thread.subject_name,
        })),
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load communications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DashboardSkeleton message="Opening communications..." />;

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
          <AppText style={styles.eyebrow}>STAY CONNECTED</AppText>
          <AppText variant="display">Teacher Notes</AppText>
          <AppText style={styles.subtitle}>
            Read teacher notes shared with your entire class.
          </AppText>
        </View>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={28} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>
              Try Again
            </PillButton>
          </SurfaceCard>
        ) : (
          <NotesList items={data.notes} />
        )}
      </Screen>

      <ThreadSheet
        onClose={() => setSelectedThread(null)}
        thread={selectedThread}
      />
    </>
  );
}

function NotesList({ items }) {
  if (!items.length) {
    return (
      <Empty
        icon="document-text-outline"
        text="Teacher feedback shared with you will appear here."
        title="No teacher notes"
      />
    );
  }
  return items
    .slice()
    .reverse()
    .map((item) => (
      <SurfaceCard key={item.id} style={styles.note}>
        <View style={styles.noteTop}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>
              {String(item.teacher_name || "T")[0].toUpperCase()}
            </AppText>
          </View>
          <View style={styles.noteHeading}>
            <AppText style={styles.noteTeacher}>
              {item.teacher_name || "Teacher"}
            </AppText>
            <AppText style={styles.noteDate}>{dateTime(item.created_at)}</AppText>
          </View>
          <View style={styles.readOnly}>
            <Ionicons color={colors.secondary} name="eye-outline" size={13} />
            <AppText style={styles.readOnlyText}>Feedback</AppText>
          </View>
        </View>
        <AppText style={styles.noteText}>{item.note}</AppText>
        <AppText style={styles.noteClass}>
          {[item.subject_name, item.course_title || item.class_level].filter(Boolean).join(" · ") || "Class note"}
        </AppText>
      </SurfaceCard>
    ));
}

function ThreadCard({ item, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.thread, pressed && styles.pressed]}
    >
      <View style={styles.threadIcon}>
        <Ionicons color={colors.secondary} name="chatbubbles-outline" size={21} />
      </View>
      <View style={styles.threadCopy}>
        <View style={styles.threadTop}>
          <AppText numberOfLines={1} style={styles.threadTitle}>
            {item.subject_name || "Teacher message"}
          </AppText>
          <AppText style={styles.threadDate}>
            {dateTime(item.last_message_at || item.updated_at)}
          </AppText>
        </View>
        <AppText style={styles.threadTeacher}>
          {item.teacher_name || "Teacher"} · {item.course_title || item.class_level}
        </AppText>
        <AppText numberOfLines={2} style={styles.lastMessage}>
          {item.last_message || "Open this conversation"}
        </AppText>
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function ThreadSheet({ onClose, thread }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
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
    loadMessages();
  }, [loadMessages]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(thread)}>
      <View style={styles.overlay}>
        <View style={styles.threadSheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeading}>
              <AppText style={styles.eyebrow}>CONVERSATION</AppText>
              <AppText variant="heading">{thread?.subject_name || "Teacher Messages"}</AppText>
              <AppText style={styles.sheetMeta}>
                {thread?.teacher_name || "Teacher"} · {thread?.course_title || thread?.class_level}
              </AppText>
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
                const mine = message.sender_role === "student";
                return (
                  <View
                    key={message.id}
                    style={[styles.bubble, mine ? styles.myBubble : styles.teacherBubble]}
                  >
                    <AppText style={[styles.sender, mine && styles.myText]}>
                      {mine ? "You" : message.full_name || "Teacher"}
                    </AppText>
                    <AppText style={[styles.messageText, mine && styles.myText]}>
                      {message.message}
                    </AppText>
                    <AppText style={[styles.messageDate, mine && styles.myDate]}>
                      {dateTime(message.created_at)}
                    </AppText>
                  </View>
                );
              })
            ) : (
              <AppText style={styles.loadingText}>No messages in this conversation.</AppText>
            )}
          </ScrollView>
          {error ? <AppText style={styles.inlineError}>{error}</AppText> : null}
          <View style={styles.readOnlyBanner}>
            <Ionicons color={colors.secondary} name="lock-closed-outline" size={16} />
            <AppText style={styles.readOnlyBannerText}>
              Students can view messages shared with them, but replies are disabled.
            </AppText>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Tab({ active, count, icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Ionicons color={active ? colors.white : colors.primary} name={icon} size={18} />
      <AppText style={[styles.tabText, active && styles.tabTextActive]}>{label}</AppText>
      <View style={[styles.tabCount, active && styles.tabCountActive]}>
        <AppText style={[styles.tabCountText, active && styles.tabCountTextActive]}>
          {count}
        </AppText>
      </View>
    </Pressable>
  );
}

function Empty({ icon, text, title }) {
  return (
    <SurfaceCard style={styles.state}>
      <Ionicons color={colors.secondary} name={icon} size={31} />
      <AppText style={styles.stateTitle}>{title}</AppText>
      <AppText style={styles.stateText}>{text}</AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { marginBottom: space.lg },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  tabs: { flexDirection: "row", gap: space.sm, marginBottom: space.lg },
  tab: { height: 48, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  tabActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  tabText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 10 },
  tabTextActive: { color: colors.white },
  tabCount: { minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.goldPale },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.15)" },
  tabCountText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 8 },
  tabCountTextActive: { color: colors.white },
  note: { marginBottom: space.sm },
  noteTop: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#DDF4EA" },
  avatarText: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.base },
  noteHeading: { flex: 1, marginLeft: space.sm },
  noteTeacher: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  noteDate: { color: colors.outline, fontSize: 9 },
  readOnly: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: space.sm, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.goldPale },
  readOnlyText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 8 },
  noteText: { marginTop: space.md, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 19 },
  noteClass: { marginTop: space.sm, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9 },
  thread: { flexDirection: "row", alignItems: "center", marginBottom: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.72 },
  threadIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.goldPale },
  threadCopy: { flex: 1, marginHorizontal: space.sm },
  threadTop: { flexDirection: "row", alignItems: "center" },
  threadTitle: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  threadDate: { color: colors.outline, fontSize: 8 },
  threadTeacher: { color: colors.onSurfaceVariant, fontSize: 9 },
  lastMessage: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  threadSheet: { height: "88%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background, ...shadows.modal },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetHeading: { flex: 1 },
  sheetMeta: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  messages: { flexGrow: 1, padding: space.lg, gap: space.sm },
  loadingText: { color: colors.outline, textAlign: "center" },
  bubble: { maxWidth: "84%", padding: space.md, borderRadius: radius.xl },
  myBubble: { alignSelf: "flex-end", borderBottomRightRadius: radius.sm, backgroundColor: colors.primaryContainer },
  teacherBubble: { alignSelf: "flex-start", borderBottomLeftRadius: radius.sm, backgroundColor: colors.surface },
  sender: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9 },
  messageText: { marginTop: 2, color: colors.onSurface, fontSize: fontSize.xs, lineHeight: 18 },
  myText: { color: colors.white },
  messageDate: { marginTop: 4, color: colors.outline, fontSize: 8 },
  myDate: { color: "#B9EEDB" },
  readOnlyBanner: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.borderGreen, backgroundColor: colors.goldPale },
  readOnlyBannerText: { flex: 1, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  inlineError: { marginHorizontal: space.lg, marginVertical: space.sm, color: colors.error, fontSize: fontSize.xs },
});
