/**
 * Parent Fees and Payments. Shows fee vouchers for all enrolled children,
 * grouped by child with a combined outstanding balance. Parents can view
 * voucher details and current payment status only, while payment submission
 * remains part of the administrative workflow.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
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
  StatusChip,
  SurfaceCard,
} from "../../components/ui";
import ChildDropdown from "./components/ChildDropdown";
import ChildSelectionState from "./components/ChildSelectionState";
import useParentChildSelection from "./useParentChildSelection";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

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

function voucherType(item) {
  return item?.is_monthly_voucher ? "Monthly Fee" : "Fee Voucher";
}

export default function ParentFees() {
  const [items, setItems] = useState([]);
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useParentChildSelection(children);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.parent.fees({ childId: childId || undefined });
      setItems(response?.items || []);
      setChildren(response?.children || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load fee records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [childId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setSelected(null);
  }, [childId, filter]);

  const requiresChildSelection = children.length > 1 && !childId;

  const summary = useMemo(
    () =>
      requiresChildSelection
        ? { total: 0, paid: 0, due: 0 }
        :
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
    [items, requiresChildSelection]
  );

  const visible = useMemo(
    () =>
      requiresChildSelection
        ? []
        :
      items.filter((item) => {
        const state = stateOf(item);
        if (filter === "all") return true;
        if (filter === "due") return ["unpaid", "overdue", "rejected"].includes(state);
        return state === filter;
      }),
    [filter, items, requiresChildSelection]
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
            onRefresh={() => {
              setChildId("");
              if (!childId) load({ refresh: true });
            }}
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

        {children.length > 1 ? (
          <ChildDropdown
            children={children}
            label="SELECT CHILD"
            onChange={setChildId}
            placeholder="Choose a child to view fee records"
            selectedId={childId}
          />
        ) : null}

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
        ) : requiresChildSelection ? (
          <ChildSelectionState message="Choose a child from the dropdown to view that child’s fee records." />
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
        <AppText style={styles.typeLabel}>{voucherType(item)}</AppText>
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

function VoucherSheet({ item, onClose }) {
  if (!item) return null;
  const state = stateOf(item);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeading}>
              <AppText style={styles.eyebrow}>VOUCHER DETAILS</AppText>
              <AppText variant="heading">{item.voucher_no}</AppText>
              <AppText style={styles.sheetType}>{voucherType(item)}</AppText>
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

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  subtitle: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  hero: { marginTop: space.lg, padding: space.lg, borderRadius: radius["2xl"], backgroundColor: colors.primary },
  childFilters: { gap: space.sm, paddingTop: space.lg },
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
  typeLabel: { marginTop: 3, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
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
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  sheetHeading: { flex: 1 },
  sheetType: { marginTop: 3, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  sheetChild: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  detailTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.lg },
  detailAmount: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.xl },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  detailLabel: { color: colors.outline, fontSize: fontSize.xs },
  detailValue: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs, textAlign: "right", textTransform: "capitalize" },
  proofButton: { marginTop: space.lg },
});
