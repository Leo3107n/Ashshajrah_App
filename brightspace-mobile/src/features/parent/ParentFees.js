/**
 * Parent Fees and Payments. Shows fee vouchers for all enrolled children,
 * grouped by child with a combined outstanding balance. Parents can view
 * voucher details and submit payment proof for unpaid or rejected vouchers
 * through the shared payment endpoint.
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
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const FILTERS = ["all", "due", "submitted", "paid"];

const normalized = (value) => String(value || "").toLowerCase();
const money = (value) => `PKR ${Number(value || 0).toLocaleString()}`;
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not available";

function stateOf(item) {
  const submission = normalized(item.submission_status);
  const voucher = normalized(item.status);
  if (["approved", "verified", "paid"].includes(submission) || voucher === "paid") return "paid";
  if (submission === "rejected" || voucher === "rejected") return "rejected";
  if (["pending", "submitted"].includes(submission) || voucher === "submitted") return "submitted";
  return item.due_date && new Date(item.due_date) < new Date() ? "overdue" : "unpaid";
}

function toneFor(state) {
  if (state === "paid") return "success";
  if (state === "submitted") return "warning";
  if (state === "overdue" || state === "rejected") return "danger";
  return "neutral";
}

function labelFor(state) {
  const map = { paid: "Paid", submitted: "Submitted", overdue: "Overdue", rejected: "Rejected", unpaid: "Unpaid" };
  return map[state] || "Pending";
}

export default function ParentFees() {
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
      const response = await api.parent.fees();
      setItems(response?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load fee records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          const state = stateOf(item);
          acc.total += Number(item.amount || 0);
          if (state === "paid") acc.paid += Number(item.paid_amount || item.amount || 0);
          if (["unpaid", "overdue", "rejected"].includes(state)) acc.due += Number(item.amount || 0);
          return acc;
        },
        { total: 0, paid: 0, due: 0 }
      ),
    [items]
  );

  const visible = useMemo(
    () =>
      items.filter((item) => {
        const state = stateOf(item);
        if (filter === "all") return true;
        if (filter === "due") return ["unpaid", "overdue", "rejected"].includes(state);
        return state === filter;
      }),
    [filter, items]
  );

  // Group visible items by child name for display
  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of visible) {
      const key = item.student_name || "Unknown Student";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map.entries()];
  }, [visible]);

  if (loading) return <DashboardSkeleton message="Loading fee records..." />;

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
        <AppText style={styles.eyebrow}>FINANCE</AppText>
        <AppText variant="display">Fees & Payments</AppText>
        <AppText style={styles.subtitle}>
          Track fee vouchers and payment status for your children.
        </AppText>

        {/* Balance hero */}
        <View style={styles.hero}>
          <AppText style={styles.heroLabel}>OUTSTANDING BALANCE</AppText>
          <AppText style={styles.heroValue}>{money(summary.due)}</AppText>
          <View style={styles.heroFooter}>
            <AmountStat label="Total billed" value={summary.total} />
            <View style={styles.heroDivider} />
            <AmountStat label="Paid" value={summary.paid} />
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          contentContainerStyle={styles.filters}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {FILTERS.map((item) => (
            <Filter
              active={filter === item}
              key={item}
              label={
                item === "due"
                  ? "Due"
                  : item[0].toUpperCase() + item.slice(1)
              }
              onPress={() => setFilter(item)}
            />
          ))}
        </ScrollView>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={30} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : grouped.length ? (
          grouped.map(([childName, vouchers]) => (
            <View key={childName}>
              <View style={styles.childRow}>
                <View style={styles.childAvatar}>
                  <AppText style={styles.childInitial}>
                    {String(childName)[0].toUpperCase()}
                  </AppText>
                </View>
                <AppText style={styles.childName}>{childName}</AppText>
              </View>
              {vouchers.map((item) => (
                <VoucherCard
                  item={item}
                  key={item.id}
                  onPress={() => setSelected(item)}
                />
              ))}
            </View>
          ))
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="receipt-outline" size={32} />
            <AppText style={styles.stateTitle}>No vouchers here</AppText>
            <AppText style={styles.stateText}>
              Fee vouchers matching this status will appear here.
            </AppText>
          </SurfaceCard>
        )}
      </Screen>

      <VoucherSheet
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

function AmountStat({ label, value }) {
  return (
    <View style={styles.amountStat}>
      <AppText style={styles.amountLabel}>{label}</AppText>
      <AppText style={styles.amountValue}>{money(value)}</AppText>
    </View>
  );
}

function Filter({ active, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filter, active && styles.filterActive]}
    >
      <AppText style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </AppText>
    </Pressable>
  );
}

function VoucherCard({ item, onPress }) {
  const state = stateOf(item);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardIcon}>
        <Ionicons color={colors.secondary} name="receipt-outline" size={22} />
      </View>
      <View style={styles.cardCopy}>
        <View style={styles.cardTop}>
          <AppText numberOfLines={1} style={styles.voucher}>
            {item.voucher_no}
          </AppText>
          <StatusChip tone={toneFor(state)}>{labelFor(state)}</StatusChip>
        </View>
        <AppText style={styles.cardAmount}>{money(item.amount)}</AppText>
        <View style={styles.cardMeta}>
          <AppText style={styles.metaText}>Due {date(item.due_date)}</AppText>
          {item.transaction_id ? (
            <AppText numberOfLines={1} style={styles.metaText}>
              TX: {item.transaction_id}
            </AppText>
          ) : null}
        </View>
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function VoucherSheet({ item, onClose, onSubmitted }) {
  const [formOpen, setFormOpen] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [proof, setProof] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFormOpen(false);
    setPayerName("");
    setTransactionId("");
    setPaidAmount(item?.amount ? String(item.amount) : "");
    setProof(null);
    setError("");
  }, [item]);

  if (!item) return null;
  const state = stateOf(item);
  const canSubmit = ["unpaid", "overdue", "rejected"].includes(state);

  async function chooseProof() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ["image/*", "application/pdf"],
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    if (Number(asset.size || 0) > MAX_PROOF_BYTES) {
      setError("Payment proof must be 10 MB or smaller.");
      return;
    }
    setProof(asset);
    setError("");
  }

  async function submit() {
    if (!payerName.trim() || payerName.trim().split(/\s+/).length < 2) {
      setError("Enter the payer's full name (first and last).");
      return;
    }
    if (!transactionId.trim() || !Number(paidAmount) || !proof) {
      setError("Transaction ID, paid amount, and payment proof are all required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.append("voucherNo", item.voucher_no);
      body.append("payerName", payerName.trim());
      body.append("transactionId", transactionId.trim());
      body.append("paidAmount", String(Number(paidAmount)));
      body.append("paidAt", new Date().toISOString());
      if (Platform.OS === "web" && proof.file) {
        body.append("proofFile", proof.file, proof.name);
      } else {
        body.append("proofFile", {
          uri: proof.uri,
          name: proof.name || "payment-proof",
          type: proof.mimeType || "application/octet-stream",
        });
      }
      await api.payment.submit(body);
      Alert.alert(
        "Payment submitted",
        "Your payment proof has been sent for administrative verification."
      );
      await onSubmitted();
    } catch (nextError) {
      setError(nextError?.message || "Unable to submit payment proof.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeading}>
              <AppText style={styles.eyebrow}>VOUCHER DETAILS</AppText>
              <AppText variant="heading">{item.voucher_no}</AppText>
              {item.student_name ? (
                <AppText style={styles.sheetChild}>{item.student_name}</AppText>
              ) : null}
            </View>
            <Pressable accessibilityLabel="Close voucher" onPress={onClose}>
              <Ionicons color={colors.onSurfaceVariant} name="close" size={26} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.detailTop}>
              <AppText style={styles.detailAmount}>{money(item.amount)}</AppText>
              <StatusChip tone={toneFor(state)}>{labelFor(state)}</StatusChip>
            </View>

            <Detail label="Due date" value={date(item.due_date)} />
            <Detail label="Submission status" value={item.submission_status || "No submission yet"} />
            {item.paid_amount ? (
              <Detail label="Paid amount" value={money(item.paid_amount)} />
            ) : null}
            {item.paid_at ? (
              <Detail label="Paid on" value={date(item.paid_at)} />
            ) : null}
            {item.transaction_id ? (
              <Detail label="Transaction ID" value={item.transaction_id} />
            ) : null}

            {item.proof_url ? (
              <PillButton
                onPress={() => Linking.openURL(item.proof_url)}
                style={styles.proofButton}
                variant="outline"
              >
                View Payment Proof
              </PillButton>
            ) : null}

            {canSubmit && !formOpen ? (
              <PillButton
                icon={
                  <Ionicons color={colors.white} name="cloud-upload-outline" size={18} />
                }
                onPress={() => setFormOpen(true)}
                style={styles.submitButton}
              >
                Submit Payment Proof
              </PillButton>
            ) : null}

            {formOpen ? (
              <View style={styles.form}>
                <AppText style={styles.formTitle}>Payment details</AppText>
                <Field
                  label="Payer full name"
                  onChangeText={setPayerName}
                  placeholder="e.g. Muhammad Adeel Khan"
                  value={payerName}
                />
                <Field
                  label="Transaction ID"
                  onChangeText={setTransactionId}
                  placeholder="Bank or wallet reference number"
                  value={transactionId}
                />
                <Field
                  keyboardType="decimal-pad"
                  label="Paid amount (PKR)"
                  onChangeText={setPaidAmount}
                  placeholder="0"
                  value={paidAmount}
                />
                <Pressable onPress={chooseProof} style={styles.proofPicker}>
                  <Ionicons
                    color={colors.secondary}
                    name={proof ? "checkmark-circle-outline" : "attach-outline"}
                    size={21}
                  />
                  <AppText numberOfLines={1} style={styles.proofPickerText}>
                    {proof?.name || "Attach image or PDF proof"}
                  </AppText>
                </Pressable>
                {error ? (
                  <AppText style={styles.inlineError}>{error}</AppText>
                ) : null}
                <PillButton loading={saving} onPress={submit}>
                  Send for Verification
                </PillButton>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <AppText style={styles.detailLabel}>{label}</AppText>
      <AppText style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

function Field({ label, ...props }) {
  return (
    <View>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <TextInput
        placeholderTextColor={colors.outline}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  hero: { marginTop: space.lg, padding: space.lg, borderRadius: radius["2xl"], backgroundColor: colors.primary },
  heroLabel: { color: "#B9EEDB", fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  heroValue: { marginTop: space.xs, color: colors.white, fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 42 },
  heroFooter: { flexDirection: "row", marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" },
  amountStat: { flex: 1 },
  amountLabel: { color: "#B9EEDB", fontSize: 9 },
  amountValue: { marginTop: 2, color: colors.secondaryContainer, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  heroDivider: { width: 1, marginHorizontal: space.md, backgroundColor: "rgba(255,255,255,0.15)" },
  filters: { gap: space.sm, paddingVertical: space.lg },
  filter: { width: 96, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.white },
  childRow: { flexDirection: "row", alignItems: "center", marginBottom: space.sm, marginTop: space.md },
  childAvatar: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#B9EEDB" },
  childInitial: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  childName: { flex: 1, marginLeft: space.sm, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.base },
  card: { flexDirection: "row", alignItems: "center", marginBottom: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.72 },
  cardIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.goldPale },
  cardCopy: { flex: 1, marginHorizontal: space.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  voucher: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  cardAmount: { marginTop: 3, color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", gap: space.sm, marginTop: 4 },
  metaText: { flexShrink: 1, color: colors.outline, fontSize: 9 },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { maxHeight: "90%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "center", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetHeading: { flex: 1 },
  sheetChild: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  detailTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.lg },
  detailAmount: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.xl },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  detailLabel: { color: colors.outline, fontSize: fontSize.xs },
  detailValue: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs, textAlign: "right", textTransform: "capitalize" },
  proofButton: { marginTop: space.lg },
  submitButton: { marginTop: space.lg },
  form: { gap: space.md, marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.borderGreen },
  formTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  fieldLabel: { marginBottom: space.xs, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  input: { height: 48, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface },
  proofPicker: { height: 52, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.gold, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  proofPickerText: { flex: 1, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  inlineError: { color: colors.error, fontSize: fontSize.xs },
});
