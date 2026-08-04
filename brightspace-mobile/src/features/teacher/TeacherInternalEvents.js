/**
 * Teacher Internal Events. Staff-only scheduling (not class lectures) —
 * teachers can view the event calendar and create their own meetings,
 * trimmed from the shared Communications Events tab pattern.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Calendar } from "react-native-calendars";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clockParts(value) {
  const [hourText = "09", minuteText = "00"] = String(value || "09:00").split(":");
  const hour24 = Number(hourText) || 0;
  return { hour: hour24 % 12 || 12, minute: Math.min(59, Math.max(0, Number(minuteText) || 0)), period: hour24 >= 12 ? "PM" : "AM" };
}

function clockValue(parts) {
  let hour = Number(parts.hour) % 12;
  if (parts.period === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export default function TeacherInternalEvents() {
  const [events, setEvents] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [eventData, optionData] = await Promise.all([
        api.shared.internalEvents.list(),
        api.shared.internalEvents.list({ mode: "options" }),
      ]);
      setEvents(eventData?.items || []);
      setAttendees(optionData?.attendees || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load internal events.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    const today = new Date().toISOString().slice(0, 10);
    setForm({ title: "", description: "", attendeeUserIds: [], startDate: today, endDate: today, startTime: "09:00", endTime: "10:00", picker: "" });
  }

  async function saveEvent() {
    if (!form?.title.trim() || !form?.attendeeUserIds?.length) {
      Alert.alert("Details required", "Title and at least one attendee are required.");
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

  if (loading) return <DashboardSkeleton message="Loading internal events..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <AppText variant="display">Internal Events</AppText>
            <AppText style={styles.subtitle}>Staff meetings and events outside your class schedule.</AppText>
          </View>
          <Pressable onPress={openCreate} style={styles.add}><Ionicons color={colors.white} name="add" size={22} /></Pressable>
        </View>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={28} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : events.length ? (
          <View style={styles.list}>
            {events.map((item, index) => (
              <View key={item.id || index} style={styles.card}>
                <View style={styles.icon}><Ionicons color={colors.primary} name="calendar-outline" size={21} /></View>
                <View style={styles.cardBody}>
                  <AppText numberOfLines={1} style={styles.cardTitle}>{item.title}</AppText>
                  <AppText style={styles.cardMeta}>{item.scheduled_start ? new Date(item.scheduled_start).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date pending"}</AppText>
                </View>
                <StatusChip tone={["active", "completed"].includes(item.status) ? "success" : "neutral"}>{readable(item.status || "scheduled")}</StatusChip>
              </View>
            ))}
          </View>
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="calendar-outline" size={30} />
            <AppText style={styles.stateTitle}>No events scheduled</AppText>
            <AppText style={styles.stateText}>Create a staff event to get started.</AppText>
          </SurfaceCard>
        )}
      </Screen>

      <Modal animationType="slide" onRequestClose={() => !saving && setForm(null)} transparent visible={Boolean(form)}>
        <Pressable onPress={() => !saving && setForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Create Internal Event</AppText>
              <Pressable onPress={() => setForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <AppText style={styles.label}>EVENT TITLE</AppText>
            <TextInput onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Staff meeting" placeholderTextColor={colors.outline} style={styles.input} value={form?.title || ""} />
            <AppText style={styles.label}>DESCRIPTION</AppText>
            <TextInput multiline onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Optional agenda" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} value={form?.description || ""} />
            <View style={styles.memberHeader}>
              <AppText style={styles.label}>ATTENDEES</AppText>
              <AppText style={styles.selectedCount}>{form?.attendeeUserIds?.length || 0} selected</AppText>
            </View>
            <View style={styles.attendees}>
              {attendees.map((item) => {
                const selected = form?.attendeeUserIds?.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setForm((current) => ({ ...current, attendeeUserIds: selected ? current.attendeeUserIds.filter((id) => id !== item.id) : [...current.attendeeUserIds, item.id] }))}
                    style={[styles.attendee, selected && styles.activeAttendee]}
                  >
                    <Ionicons color={selected ? colors.white : colors.outline} name={selected ? "checkmark-circle" : "ellipse-outline"} size={16} />
                    <AppText style={[styles.attendeeText, selected && styles.activeAttendeeText]}>{item.full_name}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.dateTimeGrid}>
              <PickerField icon="calendar-outline" label="START DATE" onPress={() => setForm((current) => ({ ...current, picker: current.picker === "startDate" ? "" : "startDate" }))} value={form?.startDate} />
              <PickerField icon="time-outline" label="START TIME" onPress={() => setForm((current) => ({ ...current, picker: current.picker === "startTime" ? "" : "startTime" }))} value={form?.startTime} />
              <PickerField icon="calendar-outline" label="END DATE" onPress={() => setForm((current) => ({ ...current, picker: current.picker === "endDate" ? "" : "endDate" }))} value={form?.endDate} />
              <PickerField icon="time-outline" label="END TIME" onPress={() => setForm((current) => ({ ...current, picker: current.picker === "endTime" ? "" : "endTime" }))} value={form?.endTime} />
            </View>
            {["startDate", "endDate"].includes(form?.picker) ? (
              <View style={styles.pickerPanel}>
                <Calendar
                  minDate={new Date().toISOString().slice(0, 10)}
                  markedDates={{ [form[form.picker]]: { selected: true, selectedColor: colors.primary } }}
                  onDayPress={({ dateString }) => setForm((current) => ({ ...current, [current.picker]: dateString, ...(current.picker === "startDate" && current.endDate < dateString ? { endDate: dateString } : {}), picker: "" }))}
                  theme={{ calendarBackground: colors.surface, selectedDayBackgroundColor: colors.primary, todayTextColor: colors.secondary, arrowColor: colors.secondary, textDayFontFamily: fonts.body, textMonthFontFamily: fonts.bodyBold, textDayHeaderFontFamily: fonts.bodyBold }}
                />
              </View>
            ) : null}
            {["startTime", "endTime"].includes(form?.picker) ? (
              <ClockPicker onChange={(time) => setForm((current) => ({ ...current, [current.picker]: time }))} onDone={() => setForm((current) => ({ ...current, picker: "" }))} value={form[form.picker]} />
            ) : null}
            <PillButton loading={saving} onPress={saveEvent} style={styles.saveButton}>Create Event</PillButton>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function PickerField({ icon, label, onPress, value }) {
  return (
    <Pressable onPress={onPress} style={styles.pickerField}>
      <Ionicons color={colors.secondary} name={icon} size={18} />
      <View style={styles.pickerText}>
        <AppText style={styles.pickerLabel}>{label}</AppText>
        <AppText style={styles.pickerValue}>{value || "Select"}</AppText>
      </View>
      <Ionicons color={colors.outline} name="chevron-down" size={16} />
    </Pressable>
  );
}

function ClockPicker({ onChange, onDone, value }) {
  const parts = clockParts(value);
  const change = (key, nextValue) => onChange(clockValue({ ...parts, [key]: nextValue }));
  return (
    <View style={styles.pickerPanel}>
      <View style={styles.clockHeader}>
        <View>
          <AppText style={styles.clockTitle}>Select a time</AppText>
          <AppText style={styles.clockPreview}>{`${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} ${parts.period}`}</AppText>
        </View>
        <Pressable onPress={onDone} style={styles.clockDone}><AppText style={styles.clockDoneText}>Done</AppText></Pressable>
      </View>
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
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { flexDirection: "row", alignItems: "flex-start" },
  headingCopy: { flex: 1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  add: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.primary },
  state: { alignItems: "center", paddingVertical: space.xl, marginTop: space.lg },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  list: { gap: space.sm, marginTop: space.lg },
  card: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "#DDF4EA" },
  cardBody: { flex: 1, marginHorizontal: space.sm },
  cardTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardMeta: { marginTop: 2, color: colors.outline, fontSize: fontSize.xs },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { position: "absolute", right: 0, bottom: 0, left: 0, maxHeight: "88%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceHigh },
  label: { marginTop: space.lg, marginBottom: space.xs, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  input: { minHeight: 50, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface },
  textarea: { minHeight: 90, paddingTop: space.md, textAlignVertical: "top" },
  memberHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  selectedCount: { marginBottom: space.xs, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  attendees: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  attendee: { minHeight: 36, flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: 18, backgroundColor: colors.surface },
  activeAttendee: { borderColor: colors.primary, backgroundColor: colors.primary },
  attendeeText: { marginLeft: 5, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: 10 },
  activeAttendeeText: { color: colors.white },
  dateTimeGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  pickerField: { width: "48.5%", minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, backgroundColor: colors.surface },
  pickerText: { flex: 1, marginHorizontal: space.xs },
  pickerLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 8 },
  pickerValue: { marginTop: 2, color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  pickerPanel: { marginTop: space.md, padding: space.sm, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface },
  clockHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.sm },
  clockTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  clockPreview: { marginTop: 2, color: colors.secondary, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  clockDone: { minWidth: 64, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: colors.primary },
  clockDoneText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  wheels: { height: 210, flexDirection: "row", gap: space.sm },
  wheel: { flex: 1, alignItems: "center" },
  wheelLabel: { marginBottom: space.xs, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  wheelScroll: { width: "100%", maxHeight: 180, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  wheelContent: { alignItems: "center", paddingVertical: 70 },
  wheelOption: { width: "88%", height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.lg },
  activeWheelOption: { backgroundColor: colors.primary },
  wheelText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm },
  activeWheelText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.lg },
  saveButton: { marginTop: space.xl },
});
