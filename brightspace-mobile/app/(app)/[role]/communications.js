import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../../src/api";
import { AppText, PillButton, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function Communications() {
  const [view, setView] = useState("headlines");
  const [headlines, setHeadlines] = useState([]);
  const [events, setEvents] = useState([]);
  const [threads, setThreads] = useState([]);
  const [eventOptions, setEventOptions] = useState([]);
  const [form, setForm] = useState(null);
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
    if (!form?.title.trim() || !form?.attendeeUserId || !form?.scheduledStart || !form?.scheduledEnd) {
      Alert.alert("Details required", "Title, attendee, start, and end are required.");
      return;
    }
    setSaving(true);
    try {
      await api.shared.internalEvents.create({
        title: form.title,
        description: form.description,
        attendeeUserId: form.attendeeUserId,
        scheduledStart: form.scheduledStart,
        scheduledEnd: form.scheduledEnd,
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

  if (loading) return <View style={styles.center}><Ionicons color={colors.gold} name="chatbubbles-outline" size={34} /><AppText style={styles.loading}>Gathering communications...</AppText></View>;

  const items = view === "headlines" ? headlines : view === "events" ? events : threads;

  return (
    <>
      <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
        <View style={styles.heading}><View><AppText variant="display">Communications</AppText><AppText style={styles.subtitle}>Announcements, internal events, and learning notes.</AppText></View>{view !== "notes" ? <Pressable onPress={() => view === "headlines" ? setForm({ kind: "headline", id: "", headline: "", startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) }) : setForm({ kind: "event", title: "", description: "", attendeeUserId: "", scheduledStart: "", scheduledEnd: "" })} style={styles.add}><Ionicons color={colors.white} name="add" size={22} /></Pressable> : null}</View>
        <View style={styles.tabs}><Tab active={view === "headlines"} label="Headlines" onPress={() => setView("headlines")} /><Tab active={view === "events"} label="Events" onPress={() => setView("events")} /><Tab active={view === "notes"} label="Notes" onPress={() => setView("notes")} /></View>
        {error ? <SurfaceCard style={styles.error}><Ionicons color={colors.error} name="cloud-offline-outline" size={24} /><AppText style={styles.errorText}>{error}</AppText></SurfaceCard> : null}
        <View style={styles.section}><AppText style={styles.sectionTitle}>{readable(view)}</AppText><AppText style={styles.count}>{items.length} records</AppText></View>
        <View style={styles.list}>
          {items.length ? items.map((item, index) => (
            <Pressable disabled={view !== "headlines"} key={item.id || index} onPress={() => setForm({ kind: "headline", id: item.id, headline: item.headline, startDate: item.start_date, endDate: item.end_date })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={[styles.icon, index % 2 && styles.goldIcon]}><Ionicons color={colors.primary} name={view === "headlines" ? "megaphone-outline" : view === "events" ? "calendar-outline" : "chatbox-ellipses-outline"} size={22} /></View>
              <View style={styles.body}>
                <AppText numberOfLines={2} style={styles.title}>{item.headline || item.title || item.subject_name || item.body_text || "Communication"}</AppText>
                <AppText numberOfLines={1} style={styles.meta}>{view === "headlines" ? `${item.start_date} → ${item.end_date}` : view === "events" ? item.scheduled_start || item.scheduledStart || "Date pending" : item.teacher_name || item.class_level || "Learning note"}</AppText>
              </View>
              <StatusChip tone={["active", "completed"].includes(item.display_status || item.status) ? "success" : "neutral"}>{readable(item.display_status || item.status || "open")}</StatusChip>
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
            <AppText style={styles.label}>ATTENDEE</AppText><View style={styles.attendees}>{eventOptions.map((item) => <Pressable key={item.id} onPress={() => setForm((current) => ({ ...current, attendeeUserId: item.id }))} style={[styles.attendee, form?.attendeeUserId === item.id && styles.activeAttendee]}><AppText style={[styles.attendeeText, form?.attendeeUserId === item.id && styles.activeAttendeeText]}>{item.full_name}</AppText></Pressable>)}</View>
            <AppText style={styles.label}>START</AppText><TextInput onChangeText={(scheduledStart) => setForm((current) => ({ ...current, scheduledStart }))} placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={colors.outline} style={styles.input} value={form?.scheduledStart || ""} />
            <AppText style={styles.label}>END</AppText><TextInput onChangeText={(scheduledEnd) => setForm((current) => ({ ...current, scheduledEnd }))} placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={colors.outline} style={styles.input} value={form?.scheduledEnd || ""} />
            <PillButton loading={saving} onPress={saveEvent} style={styles.eventSave}>Create Event</PillButton>
          </> : <>
            <AppText style={styles.label}>HEADLINE</AppText><TextInput multiline onChangeText={(headline) => setForm((current) => ({ ...current, headline }))} placeholder="Portal announcement" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} value={form?.headline || ""} />
            <AppText style={styles.label}>START DATE</AppText><TextInput onChangeText={(startDate) => setForm((current) => ({ ...current, startDate }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.outline} style={styles.input} value={form?.startDate || ""} />
            <AppText style={styles.label}>END DATE</AppText><TextInput onChangeText={(endDate) => setForm((current) => ({ ...current, endDate }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.outline} style={styles.input} value={form?.endDate || ""} />
            <View style={styles.actions}><PillButton loading={saving} onPress={saveHeadline}>Save Headline</PillButton>{form?.id ? <PillButton disabled={saving} onPress={deleteHeadline} variant="secondary">Delete Headline</PillButton> : null}</View>
          </>}
        </ScrollView></View>
      </Modal>
    </>
  );
}

function Tab({ active, label, onPress }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><AppText style={[styles.tabText, active && styles.activeTabText]}>{label}</AppText></Pressable>; }

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }, loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.lg, paddingBottom: space.xl }, heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  add: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.primary }, tabs: { flexDirection: "row", gap: 4, marginTop: space.lg, padding: 4, borderRadius: radius.full, backgroundColor: colors.surfaceLow },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: radius.full }, activeTab: { backgroundColor: colors.primary }, tabText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 }, activeTabText: { color: colors.white },
  error: { flexDirection: "row", alignItems: "center", marginTop: space.md }, errorText: { flex: 1, marginLeft: space.sm, color: colors.error, fontSize: fontSize.xs },
  section: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm }, sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg }, count: { color: colors.outline, fontSize: fontSize.xs },
  list: { gap: space.sm }, card: { minHeight: 82, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle }, icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "#DDF4EA" }, goldIcon: { backgroundColor: colors.goldPale },
  body: { flex: 1, marginHorizontal: space.md }, title: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm }, meta: { marginTop: 2, color: colors.outline, fontSize: fontSize.xs }, pressed: { opacity: 0.75 }, empty: { alignItems: "center", padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  backdrop: { flex: 1, backgroundColor: "rgba(3,36,27,.48)" }, sheet: { maxHeight: "86%", borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background }, handle: { width: 42, height: 4, alignSelf: "center", marginTop: space.sm, borderRadius: 2, backgroundColor: colors.borderGreen }, sheetContent: { padding: space.lg, paddingBottom: 36 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surface },
  label: { marginTop: space.lg, marginBottom: space.xs, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 }, input: { minHeight: 50, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface }, textarea: { minHeight: 90, paddingTop: space.md, textAlignVertical: "top" }, actions: { gap: space.sm, marginTop: space.xl },
  attendees: { flexDirection: "row", flexWrap: "wrap", gap: space.xs }, attendee: { paddingHorizontal: space.md, paddingVertical: 8, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: 18, backgroundColor: colors.surface }, activeAttendee: { backgroundColor: colors.primary }, attendeeText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: 10 }, activeAttendeeText: { color: colors.white }, eventSave: { marginTop: space.xl },
});
