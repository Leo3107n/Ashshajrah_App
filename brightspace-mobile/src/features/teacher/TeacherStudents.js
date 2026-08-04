/**
 * Teacher Students. A searchable roster of students the teacher is assigned
 * to teach, with a read-only detail sheet for contact and class information.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function initials(name) {
  return String(name || "S").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function TeacherStudents() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.teacher.students();
      setItems(response?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your students.");
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
      [item.full_name, item.student_name, item.class_level, item.course_title, item.subject_name, item.parent_name]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [items, search]);

  if (loading) return <DashboardSkeleton message="Gathering your students..." />;

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <AppText variant="display">My Students</AppText>
        <AppText style={styles.subtitle}>Everyone enrolled in your assigned classes and subjects.</AppText>

        <View style={styles.search}>
          <Ionicons color={colors.outline} name="search-outline" size={20} />
          <TextInput onChangeText={setSearch} placeholder="Search student, class, or subject..." placeholderTextColor={colors.outline} style={styles.input} value={search} />
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
            {visible.map((item, index) => (
              <Pressable key={item.id || index} onPress={() => setSelected(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.avatar}><AppText style={styles.avatarText}>{initials(item.full_name || item.student_name)}</AppText></View>
                <View style={styles.cardBody}>
                  <AppText numberOfLines={1} style={styles.cardTitle}>{item.full_name || item.student_name || "Student"}</AppText>
                  <AppText numberOfLines={1} style={styles.cardMeta}>{item.class_level || item.course_title || "Class"} · {item.subject_name || "Subject"}</AppText>
                </View>
                <Ionicons color={colors.outline} name="chevron-forward" size={19} />
              </Pressable>
            ))}
          </View>
        ) : (
          <SurfaceCard style={styles.state}>
            <Ionicons color={colors.secondary} name="people-outline" size={30} />
            <AppText style={styles.stateTitle}>No students found</AppText>
            <AppText style={styles.stateText}>Try another search term.</AppText>
          </SurfaceCard>
        )}
      </Screen>

      <Modal animationType="slide" onRequestClose={() => setSelected(null)} transparent visible={Boolean(selected)}>
        <Pressable onPress={() => setSelected(null)} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetTop}>
              <View style={styles.largeAvatar}><AppText style={styles.largeAvatarText}>{initials(selected?.full_name || selected?.student_name)}</AppText></View>
              <View style={styles.sheetIdentity}>
                <AppText style={styles.sheetName} variant="heading">{selected?.full_name || selected?.student_name}</AppText>
                <AppText style={styles.sheetMeta}>{selected?.class_level || selected?.course_title}</AppText>
              </View>
              <Pressable onPress={() => setSelected(null)} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable>
            </View>
            <SurfaceCard style={styles.details}>
              <Detail icon="book-outline" label="Subject" value={selected?.subject_name} />
              <Detail icon="mail-outline" label="Email" value={selected?.email || selected?.student_email} />
              <Detail icon="call-outline" label="Phone" value={selected?.phone || selected?.student_phone} />
              <Detail icon="person-outline" label="Parent" value={selected?.parent_name} />
            </SurfaceCard>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Detail({ icon, label, value }) {
  return (
    <View style={styles.detail}>
      <Ionicons color={colors.secondary} name={icon} size={17} />
      <View style={styles.detailCopy}>
        <AppText style={styles.detailLabel}>{label}</AppText>
        <AppText style={styles.detailValue}>{value || "Not available"}</AppText>
      </View>
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
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.goldPale },
  avatarText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardBody: { flex: 1, marginHorizontal: space.sm },
  cardTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  cardMeta: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { position: "absolute", right: 0, bottom: 0, left: 0, maxHeight: "80%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  sheetContent: { padding: space.lg, paddingBottom: space["3xl"] },
  sheetTop: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  largeAvatar: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: colors.goldPale },
  largeAvatarText: { color: colors.secondary, fontFamily: fonts.display, fontSize: fontSize.lg },
  sheetIdentity: { flex: 1, marginLeft: space.sm },
  sheetName: { color: colors.primary },
  sheetMeta: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceHigh },
  details: { gap: space.sm },
  detail: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingVertical: 4 },
  detailCopy: { flex: 1 },
  detailLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  detailValue: { marginTop: 2, color: colors.onSurface, fontSize: fontSize.xs },
});
