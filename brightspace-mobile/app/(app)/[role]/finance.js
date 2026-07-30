/** Super Admin finance workspace with backend-enforced mutation boundaries. */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import api from "../../../src/api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

const PAYMENT_FILTERS = ["all", "pending", "verified", "rejected"];

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function money(value) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

function tone(status) {
  if (["active", "verified", "paid"].includes(String(status).toLowerCase())) return "success";
  if (["rejected", "inactive", "cancelled"].includes(String(status).toLowerCase())) return "danger";
  return "warning";
}

export default function SuperAdminFinance() {
  const [view, setView] = useState("payments");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState({ items: [], counts: {} });
  const [settings, setSettings] = useState({ settings: [], finance: {}, recentVouchers: [] });
  const [regularFees, setRegularFees] = useState({ items: [] });
  const [otherFees, setOtherFees] = useState({ items: [] });
  const [methods, setMethods] = useState({ items: [] });
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [settingForm, setSettingForm] = useState(null);
  const [financeForm, setFinanceForm] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [paymentData, feeData, regularData, otherData, methodData] = await Promise.all([
        api.admin.payments({ status: paymentFilter === "all" ? undefined : paymentFilter }),
        api.admin.feeSettings.get(),
        api.admin.regularFees.list(),
        api.admin.otherFees.list(),
        api.admin.paymentMethods.list(),
      ]);
      setPayments(paymentData || { items: [], counts: {} });
      setSettings(feeData || { settings: [], finance: {}, recentVouchers: [] });
      setRegularFees(regularData || { items: [] });
      setOtherFees(otherData || { items: [] });
      setMethods(methodData || { items: [] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load finance records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [paymentFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return payments.items || [];
    return (payments.items || []).filter((item) =>
      [item.student_name, item.parent_name, item.payer_name, item.transaction_id, item.voucher_no]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [payments.items, search]);

  async function decidePayment(action) {
    if (!selectedPayment) return;
    if (action === "reject" && !rejectReason.trim()) {
      Alert.alert("Reason required", "Enter a reason before rejecting this payment.");
      return;
    }
    setWorking(true);
    try {
      await api.coordinator.payments.verify(selectedPayment.id, {
        action,
        rejectionReason: action === "reject" ? rejectReason.trim() : "",
      });
      setSelectedPayment(null);
      setRejectReason("");
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Decision failed", nextError?.message || "Unable to update this payment.");
    } finally {
      setWorking(false);
    }
  }

  function confirmApproval() {
    Alert.alert("Verify payment?", "This confirms the payment and may trigger admission credentials.", [
      { text: "Cancel", style: "cancel" },
      { text: "Verify", onPress: () => decidePayment("approve") },
    ]);
  }

  async function saveSetting() {
    if (!settingForm?.id) return;
    setWorking(true);
    try {
      await api.admin.feeSettings.update({
        id: settingForm.id,
        value: settingForm.value,
        description: settingForm.description,
        status: settingForm.status,
      });
      setSettingForm(null);
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to save", nextError?.message || "Please review the setting.");
    } finally {
      setWorking(false);
    }
  }

  function openFinanceForm(kind, item = null) {
    setFinanceForm({
      kind,
      id: item?.id || "",
      name: item?.name || item?.title || "",
      classLevel: item?.class_level || "",
      amount: item?.amount == null ? "" : String(item.amount),
      feeType: item?.fee_type || "",
      description: item?.description || "",
      methodKey: item?.method_key || "",
      accountTitle: item?.account_title || "",
      accountNumber: item?.account_number || "",
      iban: item?.iban || "",
      bankName: item?.bank_name || "",
      instructions: item?.instructions || "",
      status: item?.status || "active",
    });
  }

  async function saveFinanceForm() {
    const form = financeForm;
    if (!form?.name.trim()) {
      Alert.alert("Name required", "Enter a name before saving.");
      return;
    }
    if (form.kind !== "method" && (!form.amount || Number(form.amount) < 0)) {
      Alert.alert("Amount required", "Enter a valid amount.");
      return;
    }
    if (form.kind === "regular" && !form.classLevel.trim()) {
      Alert.alert("Class required", "Enter the class level for this fee.");
      return;
    }
    if (form.kind === "other" && !form.feeType.trim()) {
      Alert.alert("Fee type required", "Enter a fee type.");
      return;
    }
    if (form.kind === "method" && !form.methodKey.trim()) {
      Alert.alert("Method key required", "Enter a unique method key.");
      return;
    }

    setWorking(true);
    try {
      if (form.kind === "regular") {
        const payload = { id: form.id, name: form.name, classLevel: form.classLevel, amount: Number(form.amount), status: form.status };
        if (form.id) await api.admin.regularFees.update(payload);
        else await api.admin.regularFees.create(payload);
      } else if (form.kind === "other") {
        const payload = { id: form.id, name: form.name, feeType: form.feeType, classLevel: form.classLevel, amount: Number(form.amount), description: form.description, status: form.status };
        if (form.id) await api.admin.otherFees.update(payload);
        else await api.admin.otherFees.create(payload);
      } else {
        const payload = { id: form.id, name: form.name, methodKey: form.methodKey, accountTitle: form.accountTitle, accountNumber: form.accountNumber, iban: form.iban, bankName: form.bankName, instructions: form.instructions, status: form.status };
        if (form.id) await api.admin.paymentMethods.update(payload);
        else await api.admin.paymentMethods.create(payload);
      }
      setFinanceForm(null);
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to save", nextError?.message || "Review the details and try again.");
    } finally {
      setWorking(false);
    }
  }

  function deleteFinanceItem() {
    if (!financeForm?.id || financeForm.kind === "regular") return;
    Alert.alert("Delete permanently?", "This finance configuration will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setWorking(true);
          try {
            if (financeForm.kind === "other") await api.admin.otherFees.delete(financeForm.id);
            else await api.admin.paymentMethods.delete(financeForm.id);
            setFinanceForm(null);
            await load({ refresh: true });
          } catch (nextError) {
            Alert.alert("Unable to delete", nextError?.message || "This item may still be in use.");
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return <DashboardSkeleton message="Balancing the finance workspace..." />;
  }

  const counts = payments.counts || {};

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <View>
          <AppText variant="display">Finance</AppText>
          <AppText style={styles.subtitle}>Oversee payments, fee plans, and collection methods.</AppText>
        </View>

        <View style={styles.tabs}>
          <Tab active={view === "payments"} icon="receipt-outline" label="Payments" onPress={() => setView("payments")} />
          <Tab active={view === "fees"} icon="pricetags-outline" label="Fee Plans" onPress={() => setView("fees")} />
          <Tab active={view === "methods"} icon="card-outline" label="Methods" onPress={() => setView("methods")} />
        </View>

        <View style={styles.stats}>
          <Stat label="Pending" tone="gold" value={counts.pending || 0} />
          <Stat label="Verified" tone="mint" value={counts.verified || settings.finance?.paymentsVerified || 0} />
          <Stat label="Rejected" tone="rose" value={counts.rejected || 0} />
        </View>

        {error ? <SurfaceCard style={styles.error}><Ionicons color={colors.error} name="cloud-offline-outline" size={25} /><View style={styles.errorBody}><AppText style={styles.errorTitle}>Finance unavailable</AppText><AppText style={styles.errorText}>{error}</AppText></View><Pressable onPress={() => load()}><AppText style={styles.retry}>Retry</AppText></Pressable></SurfaceCard> : null}

        {view === "payments" ? (
          <>
            <View style={styles.search}>
              <Ionicons color={colors.outline} name="search-outline" size={20} />
              <TextInput onChangeText={setSearch} placeholder="Search payment or voucher..." placeholderTextColor={colors.outline} style={styles.searchInput} value={search} />
              {search ? <Pressable onPress={() => setSearch("")}><Ionicons color={colors.outline} name="close-circle" size={20} /></Pressable> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {PAYMENT_FILTERS.map((item) => <FilterChip active={paymentFilter === item} key={item} label={readable(item)} onPress={() => setPaymentFilter(item)} />)}
            </ScrollView>
            <SectionTitle meta={`${filteredPayments.length} records`} title="Payment Submissions" />
            <View style={styles.list}>
              {filteredPayments.length ? filteredPayments.map((item) => (
                <Pressable key={item.id} onPress={() => { setSelectedPayment(item); setRejectReason(""); }} style={({ pressed }) => [styles.paymentCard, pressed && styles.pressed]}>
                  <View style={styles.paymentIcon}><Ionicons color={colors.secondary} name="receipt-outline" size={21} /></View>
                  <View style={styles.cardBody}>
                    <AppText numberOfLines={1} style={styles.cardTitle}>{item.student_name || item.payer_name || "Payment submission"}</AppText>
                    <AppText numberOfLines={1} style={styles.cardMeta}>{item.voucher_no || "No voucher"} · {item.transaction_id || "No transaction ID"}</AppText>
                    <AppText style={styles.amount}>{money(item.paid_amount)}</AppText>
                  </View>
                  <View style={styles.cardEnd}><StatusChip tone={tone(item.status)}>{readable(item.status)}</StatusChip><Ionicons color={colors.outline} name="chevron-forward" size={18} /></View>
                </Pressable>
              )) : <Empty icon="receipt-outline" text="No payment submissions match this filter." />}
            </View>
          </>
        ) : null}

        {view === "fees" ? (
          <>
            <SectionTitle meta={`${settings.settings?.length || 0} settings`} title="Fee Settings" />
            <View style={styles.list}>
              {(settings.settings || []).length ? settings.settings.map((item) => (
                <Pressable key={item.id} onPress={() => setSettingForm({ ...item, status: item.status || "active" })} style={({ pressed }) => [styles.settingCard, pressed && styles.pressed]}>
                  <View style={styles.settingIcon}><Ionicons color={colors.primary} name="options-outline" size={20} /></View>
                  <View style={styles.cardBody}><AppText style={styles.cardTitle}>{item.label || item.name}</AppText><AppText numberOfLines={1} style={styles.cardMeta}>{item.description || item.setting_key}</AppText><AppText style={styles.settingValue}>{item.value || "Not set"}</AppText></View>
                  <StatusChip tone={tone(item.status)}>{readable(item.status)}</StatusChip>
                </Pressable>
              )) : <Empty icon="options-outline" text="No fee settings are configured." />}
            </View>

            <SectionTitle action="Add +" onPress={() => openFinanceForm("regular")} meta={`${regularFees.items?.length || 0} plans`} title="Regular Fees" />
            <View style={styles.list}>
              {(regularFees.items || []).length ? regularFees.items.map((item) => <FeeRow item={item} key={item.id} onPress={() => openFinanceForm("regular", item)} />) : <Empty icon="calendar-outline" text="No regular fee plans." />}
            </View>

            <SectionTitle action="Add +" onPress={() => openFinanceForm("other")} meta={`${otherFees.items?.length || 0} fees`} title="Other Fees" />
            <View style={styles.list}>
              {(otherFees.items || []).length ? otherFees.items.map((item) => <FeeRow item={item} key={item.id} onPress={() => openFinanceForm("other", item)} />) : <Empty icon="pricetag-outline" text="No additional fees." />}
            </View>

            <SectionTitle meta={`${settings.recentVouchers?.length || 0} recent`} title="Recent Vouchers" />
            <SurfaceCard style={styles.compactList}>
              {(settings.recentVouchers || []).length ? settings.recentVouchers.slice(0, 6).map((item) => (
                <View key={item.id} style={styles.compactRow}><Ionicons color={colors.emeraldMid} name="document-text-outline" size={18} /><View style={styles.compactBody}><AppText style={styles.compactTitle}>{item.student_name || item.voucher_no}</AppText><AppText style={styles.cardMeta}>{item.voucher_no} · {money(item.amount)}</AppText></View><StatusChip tone={tone(item.status)}>{readable(item.status)}</StatusChip></View>
              )) : <AppText style={styles.cardMeta}>No recent vouchers.</AppText>}
            </SurfaceCard>
          </>
        ) : null}

        {view === "methods" ? (
          <>
            <SectionTitle action="Add +" onPress={() => openFinanceForm("method")} meta={`${methods.items?.length || 0} methods`} title="Collection Methods" />
            <View style={styles.list}>
              {(methods.items || []).length ? methods.items.map((item, index) => (
                <Pressable key={item.id} onPress={() => openFinanceForm("method", item)} style={({ pressed }) => [styles.methodCard, styles.methodSurface, pressed && styles.pressed]}>
                  <View style={[styles.methodIcon, index % 2 && styles.goldMethod]}><Ionicons color={colors.primary} name={item.iban ? "business-outline" : "phone-portrait-outline"} size={22} /></View>
                  <View style={styles.cardBody}>
                    <View style={styles.methodTop}><AppText style={styles.cardTitle}>{item.name || readable(item.method_key)}</AppText><StatusChip tone={tone(item.status)}>{readable(item.status)}</StatusChip></View>
                    <AppText style={styles.cardMeta}>{item.bank_name || item.account_title || "Payment account"}</AppText>
                    <AppText selectable style={styles.account}>{item.iban || item.account_number || "Account details pending"}</AppText>
                    {item.instructions ? <AppText numberOfLines={2} style={styles.instructions}>{item.instructions}</AppText> : null}
                  </View>
                </Pressable>
              )) : <Empty icon="card-outline" text="No payment methods configured." />}
            </View>
          </>
        ) : null}
      </Screen>

      <Modal animationType="slide" onRequestClose={() => !working && setSelectedPayment(null)} transparent visible={Boolean(selectedPayment)}>
        <Pressable onPress={() => !working && setSelectedPayment(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <SheetHeader onClose={() => setSelectedPayment(null)} title="Payment Review" />
            <SurfaceCard style={styles.details}>
              <Detail label="Student" value={selectedPayment?.student_name} />
              <Detail label="Parent / payer" value={selectedPayment?.parent_name || selectedPayment?.payer_name} />
              <Detail label="Voucher" value={selectedPayment?.voucher_no} />
              <Detail label="Transaction" value={selectedPayment?.transaction_id} />
              <Detail label="Paid amount" value={money(selectedPayment?.paid_amount)} />
              <Detail label="Voucher amount" value={money(selectedPayment?.voucher_amount)} />
              <Detail label="Status" value={readable(selectedPayment?.status)} />
            </SurfaceCard>
            {selectedPayment?.proof_file_url ? <PillButton onPress={() => Linking.openURL(selectedPayment.proof_file_url)} variant="secondary">View Payment Proof</PillButton> : <View style={styles.notice}><Ionicons color={colors.outline} name="image-outline" size={20} /><AppText style={styles.noticeText}>No payment proof is available.</AppText></View>}
            {selectedPayment?.status === "pending" ? (
              <>
                <AppText style={styles.fieldLabel}>REJECTION REASON</AppText>
                <TextInput multiline onChangeText={setRejectReason} placeholder="Required only when rejecting" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} textAlignVertical="top" value={rejectReason} />
                <View style={styles.actions}><PillButton disabled={working} onPress={confirmApproval}>{working ? "Please wait..." : "Verify Payment"}</PillButton><PillButton disabled={working} onPress={() => decidePayment("reject")} variant="secondary">Reject Payment</PillButton></View>
              </>
            ) : <View style={styles.notice}><Ionicons color={colors.secondary} name="checkmark-circle-outline" size={20} /><AppText style={styles.noticeText}>This payment has already been reviewed.</AppText></View>}
          </ScrollView>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => !working && setSettingForm(null)} transparent visible={Boolean(settingForm)}>
        <Pressable onPress={() => !working && setSettingForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <SheetHeader onClose={() => setSettingForm(null)} title="Edit Fee Setting" />
            <AppText style={styles.settingName}>{settingForm?.label || settingForm?.name}</AppText>
            <AppText style={styles.fieldLabel}>VALUE</AppText>
            <TextInput onChangeText={(value) => setSettingForm((current) => ({ ...current, value }))} placeholder="Setting value" placeholderTextColor={colors.outline} style={styles.input} value={settingForm?.value || ""} />
            <AppText style={styles.fieldLabel}>DESCRIPTION</AppText>
            <TextInput multiline onChangeText={(description) => setSettingForm((current) => ({ ...current, description }))} placeholder="Description" placeholderTextColor={colors.outline} style={[styles.input, styles.textarea]} textAlignVertical="top" value={settingForm?.description || ""} />
            <AppText style={styles.fieldLabel}>STATUS</AppText>
            <View style={styles.statusOptions}>{["active", "inactive"].map((item) => <FilterChip active={settingForm?.status === item} key={item} label={readable(item)} onPress={() => setSettingForm((current) => ({ ...current, status: item }))} />)}</View>
            <PillButton loading={working} onPress={saveSetting} style={styles.save}>Save Setting</PillButton>
          </ScrollView>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => !working && setFinanceForm(null)} transparent visible={Boolean(financeForm)}>
        <Pressable onPress={() => !working && setFinanceForm(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <SheetHeader onClose={() => setFinanceForm(null)} title={`${financeForm?.id ? "Edit" : "Create"} ${financeForm?.kind === "regular" ? "Regular Fee" : financeForm?.kind === "other" ? "Other Fee" : "Payment Method"}`} />
            <FormInput label="NAME" onChange={(name) => setFinanceForm((current) => ({ ...current, name }))} placeholder="Display name" value={financeForm?.name} />
            {financeForm?.kind === "regular" ? <FormInput label="CLASS LEVEL" onChange={(classLevel) => setFinanceForm((current) => ({ ...current, classLevel }))} placeholder="e.g. Grade 4" value={financeForm?.classLevel} /> : null}
            {financeForm?.kind === "other" ? <><FormInput label="FEE TYPE" onChange={(feeType) => setFinanceForm((current) => ({ ...current, feeType }))} placeholder="e.g. activity" value={financeForm?.feeType} /><FormInput label="CLASS LEVEL (OPTIONAL)" onChange={(classLevel) => setFinanceForm((current) => ({ ...current, classLevel }))} placeholder="All classes" value={financeForm?.classLevel} /></> : null}
            {financeForm?.kind !== "method" ? <FormInput keyboardType="decimal-pad" label="AMOUNT (PKR)" onChange={(amount) => setFinanceForm((current) => ({ ...current, amount }))} placeholder="0" value={financeForm?.amount} /> : null}
            {financeForm?.kind === "other" ? <FormInput label="DESCRIPTION" multiline onChange={(description) => setFinanceForm((current) => ({ ...current, description }))} placeholder="Fee description" value={financeForm?.description} /> : null}
            {financeForm?.kind === "method" ? (
              <>
                <FormInput autoCapitalize="none" label="METHOD KEY" onChange={(methodKey) => setFinanceForm((current) => ({ ...current, methodKey }))} placeholder="bank_transfer" value={financeForm?.methodKey} />
                <FormInput label="ACCOUNT TITLE" onChange={(accountTitle) => setFinanceForm((current) => ({ ...current, accountTitle }))} placeholder="Account holder" value={financeForm?.accountTitle} />
                <FormInput keyboardType="number-pad" label="ACCOUNT NUMBER" onChange={(accountNumber) => setFinanceForm((current) => ({ ...current, accountNumber }))} placeholder="Account number" value={financeForm?.accountNumber} />
                <FormInput autoCapitalize="characters" label="IBAN" onChange={(iban) => setFinanceForm((current) => ({ ...current, iban }))} placeholder="PK00..." value={financeForm?.iban} />
                <FormInput label="BANK / PROVIDER" onChange={(bankName) => setFinanceForm((current) => ({ ...current, bankName }))} placeholder="Bank or wallet name" value={financeForm?.bankName} />
                <FormInput label="INSTRUCTIONS" multiline onChange={(instructions) => setFinanceForm((current) => ({ ...current, instructions }))} placeholder="Payment instructions" value={financeForm?.instructions} />
              </>
            ) : null}
            <AppText style={styles.fieldLabel}>STATUS</AppText>
            <View style={styles.statusOptions}>{["active", "inactive"].map((item) => <FilterChip active={financeForm?.status === item} key={item} label={readable(item)} onPress={() => setFinanceForm((current) => ({ ...current, status: item }))} />)}</View>
            <View style={styles.actions}>
              <PillButton loading={working} onPress={saveFinanceForm}>Save Changes</PillButton>
              {financeForm?.id && financeForm?.kind !== "regular" ? <PillButton disabled={working} onPress={deleteFinanceItem} variant="secondary">Delete Permanently</PillButton> : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Tab({ active, icon, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><Ionicons color={active ? colors.white : colors.secondary} name={icon} size={18} /><AppText style={[styles.tabText, active && styles.activeTabText]}>{label}</AppText></Pressable>;
}
function Stat({ label, tone: colorTone, value }) {
  return <View style={[styles.stat, styles[`${colorTone}Stat`]]}><AppText style={styles.statValue}>{String(value)}</AppText><AppText style={styles.statLabel}>{label}</AppText></View>;
}
function FilterChip({ active, label, onPress }) {
  return <Pressable onPress={onPress} style={[styles.filter, active && styles.activeFilter]}><AppText style={[styles.filterText, active && styles.activeFilterText]}>{label}</AppText></Pressable>;
}
function SectionTitle({ action, meta, onPress, title }) {
  return <View style={styles.sectionHeader}><AppText style={styles.sectionTitle}>{title}</AppText><View style={styles.sectionEnd}><AppText style={styles.sectionMeta}>{meta}</AppText>{action ? <Pressable onPress={onPress}><AppText style={styles.sectionAction}>{action}</AppText></Pressable> : null}</View></View>;
}
function FeeRow({ item, onPress }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.feeRow, styles.feeSurface, pressed && styles.pressed]}><View style={styles.feeIcon}><Ionicons color={colors.secondary} name="pricetag-outline" size={19} /></View><View style={styles.cardBody}><AppText style={styles.cardTitle}>{item.name || item.title}</AppText><AppText style={styles.cardMeta}>{item.class_level || readable(item.fee_type) || "All classes"}</AppText></View><View style={styles.feeEnd}><AppText style={styles.feeAmount}>{money(item.net_amount ?? item.amount)}</AppText><StatusChip tone={tone(item.status)}>{readable(item.status)}</StatusChip></View></Pressable>;
}
function Empty({ icon, text }) {
  return <View style={styles.empty}><Ionicons color={colors.outline} name={icon} size={30} /><AppText style={styles.emptyText}>{text}</AppText></View>;
}
function SheetHeader({ onClose, title }) {
  return <View style={styles.sheetHeader}><AppText variant="heading">{title}</AppText><Pressable onPress={onClose} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable></View>;
}
function Detail({ label, value }) {
  if (!value) return null;
  return <View style={styles.detail}><AppText style={styles.detailLabel}>{label}</AppText><AppText selectable style={styles.detailValue}>{String(value)}</AppText></View>;
}
function FormInput({ autoCapitalize, keyboardType, label, multiline = false, onChange, placeholder, value }) {
  return <><AppText style={styles.fieldLabel}>{label}</AppText><TextInput autoCapitalize={autoCapitalize} keyboardType={keyboardType} multiline={multiline} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.outline} style={[styles.input, multiline && styles.textarea]} textAlignVertical={multiline ? "top" : "center"} value={value || ""} /></>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: space.md, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold },
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  tabs: { flexDirection: "row", gap: 4, marginTop: space.lg, padding: 4, borderRadius: radius.full, backgroundColor: colors.surfaceLow },
  tab: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.full },
  activeTab: { backgroundColor: colors.primary },
  tabText: { marginLeft: 4, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  activeTabText: { color: colors.white },
  stats: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  stat: { flex: 1, alignItems: "center", paddingVertical: space.md, borderRadius: radius.lg },
  goldStat: { backgroundColor: colors.goldPale }, mintStat: { backgroundColor: "#DDF4EA" }, roseStat: { backgroundColor: colors.roseBg },
  statValue: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  statLabel: { color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  error: { flexDirection: "row", alignItems: "center", marginTop: space.md },
  errorBody: { flex: 1, marginHorizontal: space.sm },
  errorTitle: { color: colors.error, fontFamily: fonts.bodyBold },
  errorText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  retry: { color: colors.secondary, fontFamily: fonts.bodyBold },
  search: { minHeight: 50, flexDirection: "row", alignItems: "center", marginTop: space.md, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface },
  searchInput: { flex: 1, marginHorizontal: space.sm, color: colors.onSurface, fontFamily: fonts.body, fontSize: fontSize.sm },
  filters: { gap: space.xs, marginTop: space.md, paddingRight: space.lg },
  filter: { paddingHorizontal: space.md, paddingVertical: 8, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: 18, backgroundColor: colors.surface },
  activeFilter: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: 11 },
  activeFilterText: { color: colors.white },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  sectionMeta: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  sectionEnd: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sectionAction: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  list: { gap: space.sm },
  paymentCard: { minHeight: 96, flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  paymentIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.goldPale },
  cardBody: { flex: 1, marginHorizontal: space.md },
  cardTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardMeta: { marginTop: 2, color: colors.outline, fontSize: fontSize.xs },
  amount: { marginTop: 4, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  cardEnd: { alignItems: "flex-end", gap: space.sm },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  settingCard: { minHeight: 82, flexDirection: "row", alignItems: "center" },
  settingIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#DDF4EA" },
  settingValue: { marginTop: 3, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  feeRow: { flexDirection: "row", alignItems: "center" },
  feeSurface: { minHeight: 76, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  feeIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.goldPale },
  feeEnd: { alignItems: "flex-end", gap: 4 },
  feeAmount: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  compactList: { paddingVertical: space.xs },
  compactRow: { minHeight: 56, flexDirection: "row", alignItems: "center" },
  compactBody: { flex: 1, marginHorizontal: space.sm },
  compactTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  methodCard: { flexDirection: "row", alignItems: "flex-start" },
  methodSurface: { padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  methodIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "#DDF4EA" },
  goldMethod: { backgroundColor: colors.goldPale },
  methodTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  account: { marginTop: space.xs, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  instructions: { marginTop: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  empty: { alignItems: "center", padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  emptyText: { marginTop: space.sm, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(3, 36, 27, 0.48)" },
  sheet: { maxHeight: "88%", borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", marginTop: space.sm, borderRadius: 2, backgroundColor: colors.borderGreen },
  sheetContent: { padding: space.lg, paddingBottom: 36 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surface },
  details: { marginTop: space.lg, paddingVertical: space.xs },
  detail: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 10, textTransform: "uppercase" },
  detailValue: { maxWidth: "62%", color: colors.onSurface, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs, textAlign: "right" },
  notice: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  noticeText: { flex: 1, marginLeft: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  fieldLabel: { marginTop: space.lg, marginBottom: space.xs, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  input: { minHeight: 50, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, color: colors.onSurface, fontFamily: fonts.body, backgroundColor: colors.surface },
  textarea: { minHeight: 88, paddingTop: space.md },
  actions: { gap: space.sm, marginTop: space.lg },
  settingName: { marginTop: space.lg, color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  statusOptions: { flexDirection: "row", gap: space.xs },
  save: { marginTop: space.xl },
});
