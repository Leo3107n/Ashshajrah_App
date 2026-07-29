import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import api from "../../../src/api";
import { AppText, PillButton, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

const FILTERS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
  ["monthly", "Monthly"],
];

function money(value) {
  const amount = Number(value || 0);
  return `PKR ${amount.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

function date(value) {
  if (!value) return "Date not provided";
  return new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function tone(status) {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

export default function CoordinatorPayments() {
  const [filter, setFilter] = useState("all");
  const [data, setData] = useState({ counts: {}, items: [] });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false, status = filter } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.coordinator.payments.list(status === "all" ? undefined : { status });
      setData({ counts: response?.counts || {}, items: response?.items || [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load payments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function chooseFilter(value) {
    setFilter(value);
  }

  async function verify(item, action, rejectionReason = "") {
    setActing(true);
    try {
      await api.coordinator.payments.verify(item.id, { action, rejectionReason });
      setSelected(null);
      await load({ refresh: true });
      Alert.alert(action === "approve" ? "Payment approved" : "Payment rejected", action === "approve" ? "The payment was verified successfully." : "The rejection decision was saved.");
    } catch (nextError) {
      Alert.alert("Verification failed", nextError?.message || "Please try again.");
    } finally {
      setActing(false);
    }
  }

  function approve(item) {
    Alert.alert("Approve payment?", `Verify ${money(item.paid_amount)} for voucher ${item.voucher_no || "this submission"}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => verify(item, "approve") },
    ]);
  }

  if (loading) return <View style={styles.center}><Ionicons color={colors.gold} name="wallet-outline" size={34} /><AppText style={styles.loading}>Loading payments...</AppText></View>;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View style={styles.intro}>
          <View><AppText style={styles.eyebrow}>PAYMENT VERIFICATION</AppText><AppText variant="heading">Payment Queue</AppText></View>
          <View style={styles.count}><AppText style={styles.countText}>{data.items.length}</AppText></View>
        </View>

        <View style={styles.summary}>
          <Summary label="Pending" toneName="warning" value={data.counts.pending || 0} />
          <Summary label="Verified" toneName="success" value={data.counts.verified || 0} />
          <Summary label="Rejected" toneName="danger" value={data.counts.rejected || 0} />
        </View>

        <View style={styles.filters}>
          {FILTERS.map(([value, label]) => (
            <Pressable key={value} onPress={() => chooseFilter(value)} style={[styles.filter, filter === value ? styles.filterActive : null]}>
              <AppText style={[styles.filterText, filter === value ? styles.filterTextActive : null]}>{label}</AppText>
            </Pressable>
          ))}
        </View>

        {error ? <SurfaceCard style={styles.error}><Ionicons color={colors.error} name="alert-circle-outline" size={22} /><AppText style={styles.errorText}>{error}</AppText><Pressable onPress={() => load()}><AppText style={styles.retry}>Retry</AppText></Pressable></SurfaceCard> : null}

        <View style={styles.list}>
          {data.items.length ? data.items.map((item) => <PaymentCard item={item} key={item.id} onPress={() => setSelected(item)} />) : <View style={styles.empty}><Ionicons color={colors.outline} name="receipt-outline" size={34} /><AppText style={styles.emptyTitle}>No payments in this view</AppText><AppText style={styles.emptyBody}>New submissions will appear here.</AppText></View>}
        </View>
      </Screen>

      <PaymentDetail acting={acting} item={selected} onApprove={approve} onClose={() => !acting && setSelected(null)} onReject={(item, reason) => verify(item, "reject", reason)} />
    </>
  );
}

function Summary({ label, toneName, value }) {
  return <View style={[styles.summaryCard, styles[`${toneName}Summary`]]}><AppText style={styles.summaryValue}>{String(value)}</AppText><AppText style={styles.summaryLabel}>{label}</AppText></View>;
}

function PaymentCard({ item, onPress }) {
  const status = String(item.status || "pending").toLowerCase();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <View style={[styles.cardIcon, item.is_monthly_voucher ? styles.monthlyIcon : null]}><Ionicons color={colors.primary} name={item.is_monthly_voucher ? "calendar-outline" : "receipt-outline"} size={21} /></View>
      <View style={styles.cardBody}>
        <AppText numberOfLines={1} style={styles.student}>{item.student_name || item.payer_name || "Payment submission"}</AppText>
        <AppText numberOfLines={1} style={styles.voucher}>{item.voucher_no || "No voucher"} · {date(item.paid_at)}</AppText>
        <AppText style={styles.amount}>{money(item.paid_amount)}</AppText>
      </View>
      <View style={styles.cardEnd}><StatusChip tone={tone(status)}>{status}</StatusChip><Ionicons color={colors.outline} name="chevron-forward" size={18} /></View>
    </Pressable>
  );
}

function DetailRow({ icon, label, value }) {
  return <View style={styles.detailRow}><Ionicons color={colors.secondary} name={icon} size={18} /><View style={styles.detailText}><AppText style={styles.detailLabel}>{label}</AppText><AppText style={styles.detailValue}>{value || "Not provided"}</AppText></View></View>;
}

function PaymentDetail({ acting, item, onApprove, onClose, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => { setRejecting(false); setReason(""); }, [item?.id]);
  if (!item) return null;
  const status = String(item.status || "pending").toLowerCase();

  function submitRejection() {
    if (!reason.trim()) {
      Alert.alert("Reason required", "Enter a clear rejection reason for the family.");
      return;
    }
    Alert.alert("Reject payment?", "The payer will be notified of this decision.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => onReject(item, reason.trim()) },
    ]);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}><View><AppText style={styles.sheetEyebrow}>PAYMENT DETAILS</AppText><AppText variant="heading">{item.student_name || item.payer_name || "Submission"}</AppText></View><Pressable hitSlop={12} onPress={onClose}><Ionicons color={colors.onSurfaceVariant} name="close" size={25} /></Pressable></View>
          <Screen contentContainerStyle={styles.sheetContent}>
            <View style={styles.statusRow}><StatusChip tone={tone(status)}>{status}</StatusChip>{item.is_monthly_voucher ? <StatusChip tone="gold">monthly fee</StatusChip> : null}</View>
            <SurfaceCard elevated={false}>
              <DetailRow icon="cash-outline" label="Paid amount" value={money(item.paid_amount)} />
              <DetailRow icon="receipt-outline" label="Voucher" value={`${item.voucher_no || "-"} · ${money(item.voucher_amount)}`} />
              <DetailRow icon="person-outline" label="Payer" value={item.payer_name} />
              <DetailRow icon="key-outline" label="Transaction ID" value={item.transaction_id} />
              <DetailRow icon="calendar-outline" label="Paid on" value={date(item.paid_at)} />
              <DetailRow icon="school-outline" label="Class" value={item.class_title} />
              <DetailRow icon="mail-outline" label="Email" value={item.email} />
              <DetailRow icon="call-outline" label="Phone" value={item.phone} />
            </SurfaceCard>

            {item.proof_file_url ? <PillButton icon={<Ionicons color={colors.secondary} name="document-attach-outline" size={18} />} onPress={() => Linking.openURL(item.proof_file_url)} style={styles.proof} variant="outline">View Payment Proof</PillButton> : <View style={styles.noProof}><Ionicons color={colors.outline} name="document-outline" size={20} /><AppText style={styles.noProofText}>No payment proof attached</AppText></View>}

            {status === "pending" && !rejecting ? <View style={styles.actions}><PillButton icon={<Ionicons color={colors.white} name="checkmark-circle-outline" size={18} />} loading={acting} onPress={() => onApprove(item)}>Approve Payment</PillButton><Pressable disabled={acting} onPress={() => setRejecting(true)} style={styles.rejectButton}><Ionicons color={colors.error} name="close-circle-outline" size={18} /><AppText style={styles.rejectText}>Reject Payment</AppText></Pressable></View> : null}

            {status === "pending" && rejecting ? <SurfaceCard elevated={false} style={styles.rejectPanel}><AppText style={styles.rejectTitle}>Rejection reason</AppText><TextInput multiline onChangeText={setReason} placeholder="Explain what needs to be corrected..." placeholderTextColor={colors.outline} style={styles.reasonInput} value={reason} /><PillButton loading={acting} onPress={submitRejection}>Confirm Rejection</PillButton><Pressable disabled={acting} onPress={() => setRejecting(false)} style={styles.cancelReject}><AppText style={styles.cancelText}>Cancel</AppText></Pressable></SurfaceCard> : null}
          </Screen>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.md },
  intro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  count: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.secondaryContainer },
  countText: { color: colors.onSecondaryContainer, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  summary: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  summaryCard: { flex: 1, minHeight: 74, alignItems: "center", justifyContent: "center", borderRadius: radius.xl },
  warningSummary: { backgroundColor: colors.statusPendingBg }, successSummary: { backgroundColor: colors.statusApprovedBg }, dangerSummary: { backgroundColor: colors.statusRejectedBg },
  summaryValue: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.xl },
  summaryLabel: { color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginVertical: space.md },
  filter: { minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.full, backgroundColor: colors.surfaceHigh },
  filterActive: { backgroundColor: colors.secondaryContainer },
  filterText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.onSecondaryContainer, fontFamily: fonts.bodyBold },
  list: { gap: space.sm },
  card: { minHeight: 96, flexDirection: "row", alignItems: "center", padding: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  cardIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: colors.goldPale },
  monthlyIcon: { backgroundColor: "#DDF4EA" },
  cardBody: { flex: 1, marginHorizontal: space.sm },
  student: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  voucher: { color: colors.outline, fontSize: 10 },
  amount: { marginTop: 2, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardEnd: { alignItems: "flex-end", gap: space.sm },
  error: { flexDirection: "row", alignItems: "center", marginBottom: space.md, backgroundColor: colors.errorContainer },
  errorText: { flex: 1, marginHorizontal: space.sm, color: colors.error, fontSize: fontSize.xs },
  retry: { color: colors.error, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  empty: { alignItems: "center", paddingVertical: space["3xl"] },
  emptyTitle: { marginTop: space.md, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyBody: { marginTop: space.xs, color: colors.outline, fontSize: fontSize.xs },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,39,30,0.42)" },
  sheet: { maxHeight: "91%", overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.background, ...shadows.modal },
  handle: { width: 42, height: 5, alignSelf: "center", marginTop: space.sm, borderRadius: 3, backgroundColor: colors.outlineVariant },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetEyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  sheetContent: { paddingTop: space.md },
  statusRow: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  detailRow: { minHeight: 54, flexDirection: "row", alignItems: "center" },
  detailText: { flex: 1, marginLeft: space.md },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { color: colors.onSurface, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm },
  proof: { marginTop: space.lg },
  noProof: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceHigh },
  noProofText: { marginLeft: space.sm, color: colors.outline, fontSize: fontSize.xs },
  actions: { marginTop: space.lg },
  rejectButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: space.sm },
  rejectText: { marginLeft: space.sm, color: colors.error, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  rejectPanel: { marginTop: space.lg, backgroundColor: colors.errorContainer },
  rejectTitle: { color: colors.error, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  reasonInput: { minHeight: 112, marginVertical: space.md, padding: space.md, borderWidth: 1, borderColor: colors.roseBorder, borderRadius: radius.lg, backgroundColor: colors.surface, color: colors.onSurface, fontFamily: fonts.body, fontSize: fontSize.sm, textAlignVertical: "top" },
  cancelReject: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: space.sm },
  cancelText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
});
