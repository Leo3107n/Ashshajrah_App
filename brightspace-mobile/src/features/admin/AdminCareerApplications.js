/**
 * Admin Careers Applications. Read/list/delete workspace for job applications
 * submitted through the public careers form; resumes open via the signed
 * streaming endpoint rather than a static URL.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api, { API_BASE_URL } from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTime(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminCareerApplications() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.admin.careerApplications.list();
      setItems(response?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load careers applications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.full_name, item.email, item.whatsapp, item.interested_role, item.message, item.source]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [items, search]);

  function openResume(item) {
    if (!item?.id) return;
    Linking.openURL(`${API_BASE_URL}/api/admin/career-applications/${item.id}/resume`).catch(() => {
      Alert.alert("Unable to open resume", "Please try again.");
    });
  }

  function deleteApplication(item) {
    Alert.alert(
      "Delete this application?",
      `${item.full_name || "This application"} will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api.admin.careerApplications.delete(item.id);
              setSelected(null);
              await load({ refresh: true });
            } catch (nextError) {
              Alert.alert("Unable to delete", nextError?.message || "Please try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  if (loading) return <DashboardSkeleton message="Loading careers applications..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <AppText variant="display">Careers Applications</AppText>
        <AppText style={styles.subtitle}>Review candidates who applied through the public careers form.</AppText>

        <View style={styles.search}>
          <Ionicons color={colors.outline} name="search-outline" size={20} />
          <TextInput onChangeText={setSearch} placeholder="Search name, email, or role..." placeholderTextColor={colors.outline} style={styles.input} value={search} />
          {search ? <Pressable onPress={() => setSearch("")}><Ionicons color={colors.outline} name="close-circle" size={20} /></Pressable> : null}
        </View>

        {error ? (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.error} name="cloud-offline-outline" size={28} />
            <AppText style={styles.errorText}>{error}</AppText>
            <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
          </SurfaceCard>
        ) : visible.length ? (
          <View style={styles.list}>
            {visible.map((item) => (
              <Pressable key={item.id} onPress={() => setSelected(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.icon}><Ionicons color={colors.secondary} name="document-text-outline" size={20} /></View>
                <View style={styles.cardBody}>
                  <AppText numberOfLines={1} style={styles.cardTitle}>{item.full_name || "Unnamed applicant"}</AppText>
                  <AppText numberOfLines={1} style={styles.cardMeta}>{item.interested_role || "Role not specified"} · {item.email}</AppText>
                  <AppText style={styles.cardDate}>{dateTime(item.submitted_at)}</AppText>
                </View>
                <Ionicons color={colors.outline} name="chevron-forward" size={19} />
              </Pressable>
            ))}
          </View>
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="briefcase-outline" size={30} />
            <AppText style={styles.stateTitle}>No applications found</AppText>
            <AppText style={styles.stateText}>Try another search term.</AppText>
          </SurfaceCard>
        )}
      </Screen>

      <Modal animationType="slide" onRequestClose={() => !deleting && setSelected(null)} transparent visible={Boolean(selected)}>
        <Pressable onPress={() => !deleting && setSelected(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetTop}>
              <View style={styles.sheetIdentity}>
                <AppText variant="heading">{selected?.full_name}</AppText>
                <AppText style={styles.sheetMeta}>{selected?.interested_role || "Role not specified"}</AppText>
              </View>
              <Pressable disabled={deleting} onPress={() => setSelected(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <SurfaceCard style={styles.details}>
              <Detail label="Email" value={selected?.email} />
              <Detail label="WhatsApp" value={selected?.whatsapp} />
              <Detail label="Interested role" value={selected?.interested_role} />
              <Detail label="Source" value={readable(selected?.source)} />
              <Detail label="Submitted" value={dateTime(selected?.submitted_at)} />
              {selected?.message ? <Detail label="Message" value={selected.message} /> : null}
              {selected?.resume_file_name ? <Detail label="Resume file" value={selected.resume_file_name} /> : null}
            </SurfaceCard>
            <View style={styles.actions}>
              <PillButton disabled={!selected?.resume_file_name} onPress={() => openResume(selected)} variant="secondary">Open Resume</PillButton>
              <PillButton disabled={deleting} loading={deleting} onPress={() => deleteApplication(selected)} variant="danger">Delete Application</PillButton>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.detail}>
      <AppText style={styles.detailLabel}>{label}</AppText>
      <AppText selectable style={styles.detailValue}>{value || "Not provided"}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xl },
  subtitle: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.sm },
  search: { minHeight: 50, flexDirection: "row", alignItems: "center", marginTop: space.md, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surface },
  input: { flex: 1, marginLeft: space.sm, color: colors.onSurface, fontFamily: fonts.body },
  state: { alignItems: "center", paddingVertical: space.xl, marginTop: space.lg },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs },
  errorText: { marginTop: space.sm, color: colors.error, textAlign: "center" },
  retry: { marginTop: space.md },
  list: { gap: space.sm, marginTop: space.lg },
  card: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.subtle },
  pressed: { opacity: 0.75 },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.goldPale },
  cardBody: { flex: 1, marginHorizontal: space.sm },
  cardTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardMeta: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  cardDate: { marginTop: 3, color: colors.outline, fontSize: 9 },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { position: "absolute", right: 0, bottom: 0, left: 0, maxHeight: "85%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  sheetTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: space.md },
  sheetIdentity: { flex: 1 },
  sheetMeta: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceHigh },
  details: { gap: space.sm },
  detail: { paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { marginTop: 3, color: colors.onSurface, fontSize: fontSize.xs, lineHeight: 18 },
  actions: { gap: space.sm, marginTop: space.lg },
});
