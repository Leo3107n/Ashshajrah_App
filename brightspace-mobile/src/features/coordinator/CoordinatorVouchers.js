/**
 * Coordinator Vouchers. Generates monthly regular-fee voucher batches per
 * class and reviews batch history. Ad hoc/scholarship voucher creation stays
 * contextual to a registration lead (see admission-review.js), since that
 * endpoint requires a registration_lead_id rather than standing alone.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(value) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

function dateLabel(value) {
  if (!value) return "No due date";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "No due date" : parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();
  if (["verified", "paid"].includes(value)) return "success";
  if (["submitted", "pending"].includes(value)) return "warning";
  if (["rejected", "overdue"].includes(value)) return "danger";
  return "neutral";
}

export default function CoordinatorVouchers() {
  const [data, setData] = useState({ classes: [], history: [], paymentMethods: [] });
  const [form, setForm] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.coordinator.regularFeeVouchers.list();
      setData({ classes: response?.classes || [], history: response?.history || [], paymentMethods: response?.paymentMethods || [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load fee vouchers.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openForm() {
    const firstClass = data.classes[0];
    setForm({
      classId: firstClass?.id || "",
      baseAmount: firstClass?.regular_fee_amount || 0,
      dueDate: "",
      monthLabel: "",
      paymentMethodId: data.paymentMethods[0]?.id || "",
    });
  }

  function selectClass(classId) {
    const course = data.classes.find((item) => item.id === classId);
    setForm((current) => ({ ...current, classId, baseAmount: course?.regular_fee_amount || 0 }));
  }

  async function createBatch() {
    if (!form?.classId || !form?.dueDate || !form?.monthLabel.trim()) {
      Alert.alert("Details required", "Choose a class and enter a due date and month label.");
      return;
    }
    setSaving(true);
    try {
      const response = await api.coordinator.regularFeeVouchers.create({
        classId: form.classId,
        dueDate: form.dueDate,
        monthLabel: form.monthLabel.trim(),
        baseAmount: form.baseAmount,
        paymentMethodId: form.paymentMethodId,
      });
      setForm(null);
      await load({ refresh: true });
      Alert.alert("Batch created", `${response?.count || 0} vouchers were generated and sent to families.`);
    } catch (nextError) {
      Alert.alert("Unable to create batch", nextError?.message || "Review the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardSkeleton message="Loading fee vouchers..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <AppText variant="display">Fee Vouchers</AppText>
            <AppText style={styles.subtitle}>Generate monthly voucher batches by class.</AppText>
          </View>
          <Pressable disabled={!data.classes.length} onPress={openForm} style={[styles.addButton, !data.classes.length && styles.addButtonDisabled]}>
            <Ionicons color={colors.white} name="add" size={22} />
          </Pressable>
        </View>

        {error ? (
          <SurfaceCard style={styles.errorCard}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={25} />
            <View style={styles.errorBody}><AppText style={styles.errorTitle}>Vouchers unavailable</AppText><AppText style={styles.errorText}>{error}</AppText></View>
            <Pressable onPress={() => load()}><AppText style={styles.retryText}>Retry</AppText></Pressable>
          </SurfaceCard>
        ) : null}

        <View style={styles.listHeader}>
          <AppText style={styles.sectionTitle}>Batch History</AppText>
          <AppText style={styles.resultCount}>{data.history.length} batches</AppText>
        </View>
        <View style={styles.list}>
          {data.history.length ? data.history.map((batch) => (
            <Pressable key={batch.id} onPress={() => setSelectedBatch(batch)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.icon}><Ionicons color={colors.secondary} name="document-text-outline" size={21} /></View>
              <View style={styles.cardBody}>
                <AppText numberOfLines={1} style={styles.cardTitle}>{batch.class_title || "Class"} · {batch.month_label}</AppText>
                <AppText style={styles.cardMeta}>{batch.batch_no} · {batch.student_count} students · Due {dateLabel(batch.due_date)}</AppText>
                <AppText style={styles.cardAmount}>{money(batch.total_amount)}</AppText>
              </View>
              <StatusChip tone={statusTone(batch.status)}>{readable(batch.status)}</StatusChip>
            </Pressable>
          )) : (
            <View style={styles.empty}>
              <Ionicons color={colors.outline} name="document-text-outline" size={30} />
              <AppText style={styles.emptyTitle}>No voucher batches yet</AppText>
              <AppText style={styles.emptyText}>Create a batch to bill an entire class at once.</AppText>
            </View>
          )}
        </View>
      </Screen>

      {/* Create batch */}
      <Modal animationType="slide" onRequestClose={() => !saving && setForm(null)} transparent visible={Boolean(form)}>
        <Pressable onPress={() => !saving && setForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetTop}>
              <AppText variant="heading">New Voucher Batch</AppText>
              <Pressable disabled={saving} onPress={() => setForm(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>

            <AppText style={styles.fieldLabel}>CLASS</AppText>
            <View style={styles.chips}>
              {data.classes.map((course) => (
                <Pressable key={course.id} onPress={() => selectClass(course.id)} style={[styles.chip, form?.classId === course.id && styles.chipActive]}>
                  <AppText style={[styles.chipText, form?.classId === course.id && styles.chipTextActive]}>{course.title}</AppText>
                </Pressable>
              ))}
            </View>

            <Field editable={false} label="MONTHLY FEE (AUTO)" value={money(form?.baseAmount)} />
            <Field label="MONTH LABEL" onChange={(monthLabel) => setForm((current) => ({ ...current, monthLabel }))} placeholder="e.g. August 2026" value={form?.monthLabel} />
            <Field label="DUE DATE (YYYY-MM-DD)" onChange={(dueDate) => setForm((current) => ({ ...current, dueDate }))} placeholder="2026-08-10" value={form?.dueDate} />

            {data.paymentMethods.length ? (
              <>
                <AppText style={styles.fieldLabel}>PAYMENT METHOD</AppText>
                <View style={styles.chips}>
                  {data.paymentMethods.map((method) => (
                    <Pressable key={method.id} onPress={() => setForm((current) => ({ ...current, paymentMethodId: method.id }))} style={[styles.chip, form?.paymentMethodId === method.id && styles.chipActive]}>
                      <AppText style={[styles.chipText, form?.paymentMethodId === method.id && styles.chipTextActive]}>{method.name}</AppText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <PillButton disabled={saving} loading={saving} onPress={createBatch} style={styles.saveButton}>Generate Batch</PillButton>
          </ScrollView>
        </View>
      </Modal>

      {/* Batch detail */}
      <Modal animationType="slide" onRequestClose={() => setSelectedBatch(null)} transparent visible={Boolean(selectedBatch)}>
        <Pressable onPress={() => setSelectedBatch(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetTop}>
              <View style={styles.sheetIdentity}>
                <AppText variant="heading">{selectedBatch?.class_title} · {selectedBatch?.month_label}</AppText>
                <AppText style={styles.sheetMeta}>{selectedBatch?.batch_no} · Due {dateLabel(selectedBatch?.due_date)}</AppText>
              </View>
              <Pressable onPress={() => setSelectedBatch(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <View style={styles.itemsList}>
              {(selectedBatch?.items || []).map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemBody}>
                    <AppText numberOfLines={1} style={styles.itemTitle}>{item.student_name}</AppText>
                    <AppText style={styles.itemMeta}>{item.voucher_no} · {item.student_phone || "No phone"}</AppText>
                  </View>
                  <View style={styles.itemEnd}>
                    <AppText style={styles.itemAmount}>{money(item.base_amount)}</AppText>
                    <StatusChip tone={statusTone(item.payment_status || item.voucher_status)}>{readable(item.payment_status || item.voucher_status)}</StatusChip>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Field({ editable = true, label, onChange, placeholder, value }) {
  return (
    <View style={styles.field}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <TextInput
        editable={editable}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        style={[styles.fieldInput, !editable && styles.fieldInputReadOnly]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  heading: { flexDirection: "row", alignItems: "flex-start" },
  headingCopy: { flex: 1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  addButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.secondary },
  addButtonDisabled: { opacity: 0.5 },
  errorCard: { flexDirection: "row", alignItems: "center", marginTop: space.md, gap: space.sm },
  errorBody: { flex: 1 },
  errorTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  errorText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  retryText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  resultCount: { color: colors.outline, fontSize: 10 },
  list: { gap: space.sm },
  card: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.75 },
  icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.goldPale },
  cardBody: { flex: 1, marginHorizontal: space.sm, gap: 3 },
  cardTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardMeta: { color: colors.onSurfaceVariant, fontSize: 10 },
  cardAmount: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  empty: { alignItems: "center", paddingVertical: space.xl },
  emptyTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { position: "absolute", right: 0, bottom: 0, left: 0, maxHeight: "88%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  sheetTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: space.md },
  sheetIdentity: { flex: 1 },
  sheetMeta: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceHigh },
  field: { marginTop: space.md },
  fieldLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase", marginBottom: 6 },
  fieldInput: { height: 48, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface },
  fieldInputReadOnly: { color: colors.onSurfaceVariant, backgroundColor: colors.surfaceLow },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  chipText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  chipTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  saveButton: { marginTop: space.lg },
  itemsList: { gap: space.sm },
  itemRow: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  itemBody: { flex: 1, marginRight: space.sm },
  itemTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  itemMeta: { marginTop: 2, color: colors.outline, fontSize: 9 },
  itemEnd: { alignItems: "flex-end", gap: 4 },
  itemAmount: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
});
