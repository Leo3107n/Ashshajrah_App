/**
 * Parent Timeline. A read-only, chronological feed of each child's academic
 * milestones (admission, fees, lectures, homework, notes) pulled from the
 * shared parent timeline endpoint.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function readable(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTime(value) {
  if (!value) return "Time unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Time unavailable"
    : parsed.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function iconFor(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("fee") || value.includes("payment") || value.includes("voucher")) return "wallet-outline";
  if (value.includes("homework")) return "book-outline";
  if (value.includes("attendance") || value.includes("lecture")) return "videocam-outline";
  if (value.includes("note") || value.includes("message")) return "chatbubble-ellipses-outline";
  if (value.includes("admission") || value.includes("registration") || value.includes("enroll")) return "person-add-outline";
  return "leaf-outline";
}

export default function ParentTimeline() {
  const [data, setData] = useState({ items: [], children: [] });
  const [childId, setChildId] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.parent.timeline({ childId: childId || undefined });
      setData({ items: response?.items || [], children: response?.children || [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load the timeline.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelected(null);
  }, [childId, type]);

  const types = useMemo(
    () => [...new Set(data.items.map((item) => item.type || item.event_type).filter(Boolean))],
    [data.items]
  );
  const visible = useMemo(
    () => (type ? data.items.filter((item) => (item.type || item.event_type) === type) : data.items),
    [data.items, type]
  );

  if (loading) return <DashboardSkeleton message="Building the timeline..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.headingRow}>
          <View style={styles.headingBody}>
            <AppText style={styles.eyebrow}>YOUR CHILDREN</AppText>
            <AppText variant="display">Timeline</AppText>
            <AppText style={styles.subtitle}>A chronological record of key academic events.</AppText>
          </View>
          <View style={styles.readOnly}><Ionicons color={colors.secondary} name="eye-outline" size={13} /><AppText style={styles.readOnlyText}>READ ONLY</AppText></View>
        </View>

        {data.children.length > 1 ? (
          <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
            <Chip active={!childId} label="All Children" onPress={() => setChildId("")} />
            {data.children.map((child) => (
              <Chip active={childId === child.id} key={child.id} label={child.full_name || child.name} onPress={() => setChildId(child.id)} />
            ))}
          </ScrollView>
        ) : null}
        {types.length ? (
          <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
            <Chip active={!type} label="All Events" onPress={() => setType("")} />
            {types.map((item) => <Chip active={type === item} key={item} label={readable(item)} onPress={() => setType(item)} />)}
          </ScrollView>
        ) : null}

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={28} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : visible.length ? (
          <View style={styles.rail}>
            {visible.map((item, index) => (
              <TimelineRow isLast={index === visible.length - 1} item={item} key={item.id || index} onPress={() => setSelected(item)} />
            ))}
          </View>
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="time-outline" size={30} />
            <AppText style={styles.stateTitle}>Nothing recorded yet</AppText>
            <AppText style={styles.stateText}>Events will appear here as they happen.</AppText>
          </SurfaceCard>
        )}
      </Screen>

      <Detail item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function TimelineRow({ isLast, item, onPress }) {
  const type = item.type || item.event_type;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rail}>
        <View style={styles.dot}><Ionicons color={colors.secondary} name={iconFor(type)} size={16} /></View>
        {!isLast ? <View style={styles.line} /> : null}
      </View>
      <View style={styles.rowBody}>
        <AppText numberOfLines={2} style={styles.rowTitle}>{item.title || readable(type) || "Update"}</AppText>
        {item.student_name ? <AppText style={styles.childName}>{item.student_name}</AppText> : null}
        {item.summary || item.description ? (
          <AppText numberOfLines={2} style={styles.rowSummary}>{item.summary || item.description}</AppText>
        ) : null}
        <AppText style={styles.rowDate}>{dateTime(item.created_at || item.occurred_at || item.date)}</AppText>
      </View>
    </Pressable>
  );
}

function Detail({ item, onClose }) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeading}>
              <AppText style={styles.eyebrow}>EVENT DETAILS</AppText>
              <AppText variant="heading">{item?.title || readable(item?.type || item?.event_type) || "Update"}</AppText>
            </View>
            <Pressable accessibilityLabel="Close event details" onPress={onClose}>
              <Ionicons color={colors.onSurfaceVariant} name="close" size={26} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            {item?.student_name ? <DetailRow label="Child" value={item.student_name} /> : null}
            <DetailRow label="Type" value={readable(item?.type || item?.event_type) || "Update"} />
            <DetailRow label="Date and time" value={dateTime(item?.created_at || item?.occurred_at || item?.date)} />
            {item?.summary || item?.description ? <DetailRow label="Details" value={item.summary || item.description} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detail}>
      <AppText style={styles.detailLabel}>{label}</AppText>
      <AppText style={styles.detailValue}>{value || "Not available"}</AppText>
    </View>
  );
}

function Chip({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><AppText numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  headingRow: { flexDirection: "row", alignItems: "flex-start" },
  headingBody: { flex: 1 },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  readOnly: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: space.sm, paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  readOnlyText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 8 },
  filters: { gap: space.sm, paddingTop: space.md },
  chip: { minWidth: 92, height: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  chipText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  chipTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  state: { alignItems: "center", paddingVertical: space.xl, marginTop: space.lg },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  row: { flexDirection: "row", marginTop: space.lg },
  pressed: { opacity: 0.75 },
  rail: { marginTop: space.lg, width: 32, alignItems: "center" },
  dot: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.goldPale },
  line: { width: 2, flex: 1, minHeight: 24, marginTop: 4, backgroundColor: colors.borderGreen },
  rowBody: { flex: 1, marginLeft: space.sm, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  rowTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  childName: { color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: 10, marginTop: 1 },
  rowSummary: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  rowDate: { marginTop: 4, color: colors.outline, fontSize: 9 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { maxHeight: "72%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetHeading: { flex: 1 },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  detail: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { marginTop: 3, color: colors.onSurface, fontSize: fontSize.xs, lineHeight: 18 },
});

