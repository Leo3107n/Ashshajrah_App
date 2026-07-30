/**
 * Communications workspace for headlines, internal events, and note threads.
 * Role checks preserve Admin read-only boundaries where required.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Calendar } from "react-native-calendars";
import api from "../../../src/api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function clockParts(value) {
  const [hourText = "09", minuteText = "00"] = String(value || "09:00").split(":");
  const hour24 = Number(hourText) || 0;
  return {
    hour: hour24 % 12 || 12,
    minute: Math.min(59, Math.max(0, Number(minuteText) || 0)),
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

function clockValue(parts) {
  let hour = Number(parts.hour) % 12;
  if (parts.period === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export default function Communications() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [view, setView] = useState("headlines");
  const [headlines, setHeadlines] = useState([]);
  const [events, setEvents] = useState([]);
  const [threads, setThreads] = useState([]);
  const [eventOptions, setEventOptions] = useState([]);
  const [form, setForm] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [loadingThread, setLoadingThread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [headlineData, eventData, eventOptionData, threadData] = await Promise.all([
        api.admin.headlines.list(),
        api.shared.internalEvents.list(),
        api.shared.internalEvents.list({ mode: "options" }),
        api.shared.notes.threads(),
      ]);
      setHeadlines(headlineData?.items || []);
      setEvents(eventData?.items || []);
      setEventOptions(eventOptionData?.attendees || []);
      setThreads(threadData?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load communications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveHeadline() {
    if (!form?.headline.trim() || !form?.startDate || !form?.endDate) {
      Alert.alert("Details required", "Headline text, start date, and end date are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { headline: form.headline, startDate: form.startDate, endDate: form.endDate };
      if (form.id) await api.admin.headlines.update(form.id, payload);
      else await api.admin.headlines.create(payload);
      setForm(null);
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to save headline", nextError?.message || "Review the dates and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEvent() {
    if (!form?.title.trim() || !form?.attendeeUserIds?.length || !form?.startDate || !form?.endDate || !form?.startTime || !form?.endTime) {
      Alert.alert("Details required", "Title, at least one member, start date/time, and end date/time are required.");
      return;
    }
    setSaving(true);
    try {
      await api.shared.internalEvents.create({
        title: form.title,
        description: form.description,
        attendeeUserIds: form.attendeeUserIds,
        scheduledStart: `${form.startDate} ${form.startTime}`,
        scheduledEnd: `${form.endDate} ${form.endTime}`,
      });
      setForm(null);
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to create event", nextError?.message || "Review the event details.");
    } finally {
      setSaving(false);
    }
  }

  function deleteHeadline() {
    Alert.alert("Delete headline?", "This announcement will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setSaving(true);
        try {
          await api.admin.headlines.delete(form.id);
          setForm(null);
          await load({ refresh: true });
        } catch (nextError) {
          Alert.alert("Unable to delete", nextError?.message || "Please try again.");
        } finally {
          setSaving(false);
        }
      } },
    ]);
  }

  async function openThread(thread) {
    setSelectedThread(thread);
    setMessages([]);
    setReply("");
    setLoadingThread(true);
    try {
      const response = await api.shared.notes.messages(thread.id);
      setMessages(response?.items || []);
    } catch (nextError) {
      Alert.alert("Unable to load thread", nextError?.message || "Please try again.");
      setSelectedThread(null);
    } finally {
      setLoadingThread(false);
    }
  }

  async function sendReply() {
    if (!reply.trim() || !selectedThread?.id) return;
    setSaving(true);
    try {
      await api.shared.notes.sendMessage(selectedThread.id, { message: reply.trim() });
      const response = await api.shared.notes.messages(selectedThread.id);
      setMessages(response?.items || []);
      setReply("");
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to send reply", nextError?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardSkeleton message="Gathering communications..." />;

  const items = view === "headlines" ? headlines : view === "events" ? events : threads;

  return (
    <>
      <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
        <View style={styles.heading}><View style={styles.headingCopy}><AppText variant="display">Communications</AppText><AppText style={styles.subtitle}>Announcements, internal events, and learning notes.</AppText></View>{(view === "events" || (view === "headlines" && !isAdmin)) ? <Pressable onPress={() => view === "headlines" ? setForm({ kind: "headline", id: "", headline: "", startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) }) : setForm({ kind: "event", title: "", description: "", attendeeUserIds: [], startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), startTime: "09:00", endTime: "10:00", picker: "" })} style={styles.add}><Ionicons color={colors.white} name="add" size={22} /></Pressable> : null}</View>
        <View style={styles.tabs}><Tab active={view === "headlines"} label="Headlines" onPress={() => setView("headlines")} /><Tab active={view === "events"} label="Events" onPress={() => setView("events")} /><Tab active={view === "notes"} label="Notes" onPress={() => setView("notes")} /></View>
        {isAdmin ? <View style={styles.permission}><Ionicons color={colors.secondary} name={view === "events" ? "create-outline" : view === "notes" ? "chatbubble-ellipses-outline" : "eye-outline"} size={20} /><AppText style={styles.permissionText}>{view === "events" ? "Admin may create internal events and review the event schedule." : view === "notes" ? "Admin may review learning-note threads and reply. Thread creation, editing, and deletion remain restricted." : "Headlines are read-only for Admin. Publishing and changes are controlled by Super Admin."}</AppText></View> : null}
        {error ? <SurfaceCard style={styles.error}><Ionicons color={colors.error} name="cloud-offline-outline" size={24} /><AppText style={styles.errorText}>{error}</AppText></SurfaceCard> : null}
        <View style={styles.section}><AppText style={styles.sectionTitle}>{readable(view)}</AppText><AppText style={styles.count}>{items.length} records</AppText></View>
        <View style={styles.list}>
          {items.length ? items.map((item, index) => (
            <Pressable disabled={view === "events" || (view === "headlines" && isAdmin)} key={item.id || index} onPress={() => view === "notes" ? openThread(item) : setForm({ kind: "headline", id: item.id, headline: item.headline, startDate: item.start_date, endDate: item.end_date })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={[styles.icon, index % 2 && styles.goldIcon]}><Ionicons color={colors.primary} name={view === "headlines" ? "megaphone-outline" : view === "events" ? "calendar-outline" : "chatbox-ellipses-outline"} size={22} /></View>
              <View style={styles.body}>
                <AppText numberOfLines={2} style={styles.title}>{item.headline || item.title || item.subject_name || item.body_text || "Communication"}</AppText>
                <AppText numberOfLines={1} style={styles.meta}>{view === "headlines" ? `${item.start_date} → ${item.end_date}` : view === "events" ? item.scheduled_start || item.scheduledStart || "Date pending" : item.teacher_name || item.class_level || "Learning note"}</AppText>
              </View>
              <StatusChip tone={["active", "completed"].includes(item.display_status || item.status) ? "success" : "neutral"}>{readable(item.display_status || item.status || "open")}</StatusChip>
              {view === "headlines" && isAdmin ? <Ionicons color={colors.outline} name="lock-closed-outline" size={17} /> : null}
            </Pressable>
          )) : <View style={styles.empty}><Ionicons color={colors.outline} name="chatbubbles-outline" size={30} /><AppText style={styles.meta}>No {view} available.</AppText></View>}
        </View>
      </Screen>
      <Modal animationType="slide" onRequestClose={() => !saving && setForm(null)} transparent visible={Boolean(form)}>
        <Pressable onPress={() => !saving && setForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}><View style={styles.handle} /><ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHeader}><AppText variant="heading">{form?.kind === "event" ? "Create Internal Event" : form?.id ? "Edit Headline" : "Create Headline"}</AppText><Pressable onPress={() => setForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable></View>
          {form?.kind === "event" ? <>
            <AppText style={styles.label}>EVENT TITLE</AppText><TextInput onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Internal meeting" placeholderTextColor={colors.outline} style={styles.input} value={form?.title || ""} />
            <AppText style={styles.label}>DESCRIPTION</AppText><TextInput multiline onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Optional agenda" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} value={form?.description || ""} />
            <View style={styles.memberHeader}><AppText style={styles.label}>MEMBERS</AppText><AppText style={styles.selectedCount}>{form?.attendeeUserIds?.length || 0} selected</AppText></View>
            <View style={styles.attendees}>{eventOptions.map((item) => {
              const selected = form?.attendeeUserIds?.includes(item.id);
              return <Pressable key={item.id} onPress={() => setForm((current) => ({ ...current, attendeeUserIds: selected ? current.attendeeUserIds.filter((id) => id !== item.id) : [...current.attendeeUserIds, item.id] }))} style={[styles.attendee, selected && styles.activeAttendee]}><Ionicons color={selected ? colors.white : colors.outline} name={selected ? "checkmark-circle" : "ellipse-outline"} size={16} /><AppText style={[styles.attendeeText, selected && styles.activeAttendeeText]}>{item.full_name}</AppText></Pressable>;
            })}</View>
            <View style={styles.dateTimeGrid}>
              <PickerField icon="calendar-outline" label="START DATE" onPress={() => setForm((current) => ({ ...current, picker: current.picker === "startDate" ? "" : "startDate" }))} value={form?.startDate} />
              <PickerField icon="time-outline" label="START TIME" onPress={() => setForm((current) => ({ ...current, picker: current.picker === "startTime" ? "" : "startTime" }))} value={form?.startTime} />
              <PickerField icon="calendar-outline" label="END DATE" onPress={() => setForm((current) => ({ ...current, picker: current.picker === "endDate" ? "" : "endDate" }))} value={form?.endDate} />
              <PickerField icon="time-outline" label="END TIME" onPress={() => setForm((current) => ({ ...current, picker: current.picker === "endTime" ? "" : "endTime" }))} value={form?.endTime} />
            </View>
            {["startDate", "endDate"].includes(form?.picker) ? <View style={styles.pickerPanel}><Calendar minDate={new Date().toISOString().slice(0, 10)} markedDates={{ [form[form.picker]]: { selected: true, selectedColor: colors.primary } }} onDayPress={({ dateString }) => setForm((current) => ({ ...current, [current.picker]: dateString, ...(current.picker === "startDate" && current.endDate < dateString ? { endDate: dateString } : {}), picker: "" }))} theme={{ calendarBackground: colors.surface, selectedDayBackgroundColor: colors.primary, todayTextColor: colors.secondary, arrowColor: colors.secondary, textDayFontFamily: fonts.body, textMonthFontFamily: fonts.bodyBold, textDayHeaderFontFamily: fonts.bodyBold }} /></View> : null}
            {["startTime", "endTime"].includes(form?.picker) ? <ClockPicker onChange={(time) => setForm((current) => ({ ...current, [current.picker]: time }))} onDone={() => setForm((current) => ({ ...current, picker: "" }))} value={form[form.picker]} /> : null}
            <PillButton loading={saving} onPress={saveEvent} style={styles.eventSave}>Create Event</PillButton>
          </> : <>
            <AppText style={styles.label}>HEADLINE</AppText><TextInput multiline onChangeText={(headline) => setForm((current) => ({ ...current, headline }))} placeholder="Portal announcement" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} value={form?.headline || ""} />
            <AppText style={styles.label}>START DATE</AppText><TextInput onChangeText={(startDate) => setForm((current) => ({ ...current, startDate }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.outline} style={styles.input} value={form?.startDate || ""} />
            <AppText style={styles.label}>END DATE</AppText><TextInput onChangeText={(endDate) => setForm((current) => ({ ...current, endDate }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.outline} style={styles.input} value={form?.endDate || ""} />
            <View style={styles.actions}><PillButton loading={saving} onPress={saveHeadline}>Save Headline</PillButton>{form?.id ? <PillButton disabled={saving} onPress={deleteHeadline} variant="secondary">Delete Headline</PillButton> : null}</View>
          </>}
        </ScrollView></View>
      </Modal>
      <Modal animationType="slide" onRequestClose={() => !saving && setSelectedThread(null)} transparent visible={Boolean(selectedThread)}>
        <View style={styles.threadOverlay}>
          <View style={styles.threadSheet}>
            <View style={styles.handle} />
            <View style={styles.threadHeader}><View style={styles.threadHeading}><AppText style={styles.threadEyebrow}>LEARNING NOTE</AppText><AppText numberOfLines={2} style={styles.threadTitle}>{selectedThread?.subject_name || selectedThread?.class_level || "Note Thread"}</AppText></View><Pressable disabled={saving} onPress={() => setSelectedThread(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable></View>
            <ScrollView contentContainerStyle={styles.threadContent}>
              {loadingThread ? <View style={styles.threadLoading}><Ionicons color={colors.gold} name="chatbubble-ellipses-outline" size={25} /><AppText style={styles.meta}>Loading messages...</AppText></View> : messages.length ? messages.map((message) => <View key={message.id} style={[styles.message, message.sender_role === "admin" && styles.adminMessage]}><View style={styles.messageTop}><AppText numberOfLines={1} style={styles.messageSender}>{message.full_name || readable(message.sender_role)}</AppText><View style={styles.messageRoleBadge}><AppText style={styles.messageRole}>{readable(message.sender_role)}</AppText></View></View><AppText style={styles.messageText}>{message.message}</AppText><AppText style={styles.messageDate}>{message.created_at ? new Date(message.created_at).toLocaleString() : ""}</AppText></View>) : <View style={styles.threadLoading}><AppText style={styles.meta}>No messages in this thread.</AppText></View>}
              {isAdmin ? <View style={styles.replyPanel}><AppText style={styles.label}>ADMIN REPLY</AppText><TextInput multiline onChangeText={setReply} placeholder="Write a clear operational reply..." placeholderTextColor={colors.outline} style={[styles.input, styles.replyInput]} value={reply} /><PillButton disabled={!reply.trim()} loading={saving} onPress={sendReply}>Send Reply</PillButton></View> : <View style={styles.readOnly}><Ionicons color={colors.secondary} name="eye-outline" size={19} /><AppText style={styles.readOnlyText}>Super Admin note access is oversight-only.</AppText></View>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Tab({ active, label, onPress }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><AppText style={[styles.tabText, active && styles.activeTabText]}>{label}</AppText></Pressable>; }

function PickerField({ icon, label, onPress, value }) {
  return <Pressable onPress={onPress} style={styles.pickerField}><Ionicons color={colors.secondary} name={icon} size={18} /><View style={styles.pickerText}><AppText style={styles.pickerLabel}>{label}</AppText><AppText style={styles.pickerValue}>{value || "Select"}</AppText></View><Ionicons color={colors.outline} name="chevron-down" size={16} /></Pressable>;
}

function ClockPicker({ onChange, onDone, value }) {
  const parts = clockParts(value);
  const change = (key, nextValue) => onChange(clockValue({ ...parts, [key]: nextValue }));
  return (
    <View style={styles.pickerPanel}>
      <View style={styles.clockHeader}><View><AppText style={styles.clockTitle}>Select a time</AppText><AppText style={styles.clockPreview}>{`${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} ${parts.period}`}</AppText></View><Pressable onPress={onDone} style={styles.clockDone}><AppText style={styles.clockDoneText}>Done</AppText></Pressable></View>
      <View style={styles.wheels}>
        <WheelColumn label="Hour" onSelect={(next) => change("hour", next)} options={Array.from({ length: 12 }, (_, index) => index + 1)} selected={parts.hour} />
        <WheelColumn label="Minute" onSelect={(next) => change("minute", next)} options={Array.from({ length: 60 }, (_, index) => index)} pad selected={parts.minute} />
        <WheelColumn label="Period" onSelect={(next) => change("period", next)} options={["AM", "PM"]} selected={parts.period} />
      </View>
    </View>
  );
}

function WheelColumn({ label, onSelect, options, pad, selected }) {
  return (
    <View style={styles.wheel}>
      <AppText style={styles.wheelLabel}>{label}</AppText>
      <ScrollView contentContainerStyle={styles.wheelContent} nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.wheelScroll}>
        {options.map((option) => {
          const active = option === selected;
          return <Pressable key={String(option)} onPress={() => onSelect(option)} style={[styles.wheelOption, active && styles.activeWheelOption]}><AppText style={[styles.wheelText, active && styles.activeWheelText]}>{pad ? String(option).padStart(2, "0") : String(option)}</AppText></Pressable>;
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }, loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.lg, paddingBottom: space.xl }, heading: { flexDirection: "row", alignItems: "center", gap: space.sm }, headingCopy: { flex: 1, minWidth: 0 }, subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  add: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.primary }, tabs: { flexDirection: "row", gap: 4, marginTop: space.lg, padding: 4, borderRadius: radius.full, backgroundColor: colors.surfaceLow },
  tab: { flex: 1, height: 42, minHeight: 42, maxHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.full }, activeTab: { backgroundColor: colors.primary }, tabText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 }, activeTabText: { color: colors.white },
  permission: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale }, permissionText: { flex: 1, marginLeft: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  error: { flexDirection: "row", alignItems: "center", marginTop: space.md }, errorText: { flex: 1, marginLeft: space.sm, color: colors.error, fontSize: fontSize.xs },
  section: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm }, sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg }, count: { color: colors.outline, fontSize: fontSize.xs },
  list: { gap: space.sm }, card: { minHeight: 82, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle }, icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "#DDF4EA" }, goldIcon: { backgroundColor: colors.goldPale },
  body: { flex: 1, marginHorizontal: space.md }, title: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm }, meta: { marginTop: 2, color: colors.outline, fontSize: fontSize.xs }, pressed: { opacity: 0.75 }, empty: { alignItems: "center", padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  backdrop: { flex: 1, backgroundColor: "rgba(3,36,27,.48)" }, sheet: { maxHeight: "86%", borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background }, handle: { width: 42, height: 4, alignSelf: "center", marginTop: space.sm, borderRadius: 2, backgroundColor: colors.borderGreen }, sheetContent: { padding: space.lg, paddingBottom: 36 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surface },
  label: { marginTop: space.lg, marginBottom: space.xs, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 }, input: { minHeight: 50, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface }, textarea: { minHeight: 90, paddingTop: space.md, textAlignVertical: "top" }, actions: { gap: space.sm, marginTop: space.xl },
  memberHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }, selectedCount: { marginBottom: space.xs, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 }, attendees: { flexDirection: "row", flexWrap: "wrap", gap: space.xs }, attendee: { minHeight: 36, flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: 18, backgroundColor: colors.surface }, activeAttendee: { borderColor: colors.primary, backgroundColor: colors.primary }, attendeeText: { marginLeft: 5, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: 10 }, activeAttendeeText: { color: colors.white },
  dateTimeGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg }, pickerField: { width: "48.5%", minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, backgroundColor: colors.surface }, pickerText: { flex: 1, marginHorizontal: space.xs }, pickerLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 8 }, pickerValue: { marginTop: 2, color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  pickerPanel: { marginTop: space.md, padding: space.sm, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface }, clockHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.sm }, clockTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm }, clockPreview: { marginTop: 2, color: colors.secondary, fontFamily: fonts.displayBold, fontSize: fontSize.lg }, clockDone: { minWidth: 64, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: colors.primary }, clockDoneText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  wheels: { height: 210, flexDirection: "row", gap: space.sm }, wheel: { flex: 1, alignItems: "center" }, wheelLabel: { marginBottom: space.xs, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" }, wheelScroll: { width: "100%", maxHeight: 180, borderRadius: radius.lg, backgroundColor: colors.surfaceLow }, wheelContent: { alignItems: "center", paddingVertical: 70 }, wheelOption: { width: "88%", height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.lg }, activeWheelOption: { backgroundColor: colors.primary }, wheelText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm }, activeWheelText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.lg }, eventSave: { marginTop: space.xl },
  threadOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,36,27,.48)" }, threadSheet: { maxHeight: "90%", overflow: "hidden", borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background }, threadHeader: { flexDirection: "row", alignItems: "center", marginHorizontal: space.md, marginTop: space.xs, paddingHorizontal: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.borderGreen, borderRadius: radius.lg, backgroundColor: colors.surfaceLow }, threadHeading: { flex: 1, minWidth: 0, marginRight: space.md }, threadEyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 }, threadTitle: { marginTop: 2, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg, lineHeight: 24 }, threadContent: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 40 }, threadLoading: { alignItems: "center", gap: space.sm, padding: space.xl },
  message: { marginBottom: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface }, adminMessage: { borderLeftWidth: 3, borderLeftColor: colors.secondary, backgroundColor: colors.goldPale }, messageTop: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: space.xs }, messageSender: { flexShrink: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs }, messageRoleBadge: { flexShrink: 0, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.surfaceHigh }, messageRole: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 8 }, messageText: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.sm, lineHeight: 20 }, messageDate: { marginTop: space.xs, color: colors.outline, fontSize: 9 },
  replyPanel: { marginTop: space.md }, replyInput: { minHeight: 100, marginBottom: space.md, paddingTop: space.md, textAlignVertical: "top" }, readOnly: { flexDirection: "row", marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale }, readOnlyText: { flex: 1, marginLeft: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
});
