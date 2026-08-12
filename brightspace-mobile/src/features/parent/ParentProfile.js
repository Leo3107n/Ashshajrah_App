/**
 * Parent Profile and Account Management.
 *
 * Parents see their account information, enrolled children, and secure
 * session status. Most fields are read-only; parents may update basic
 * contact information through the parent-scoped profile API. Logout continues
 * through the centralized AuthContext session provider.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
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
  SurfaceCard,
} from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import ChildDropdown from "./components/ChildDropdown";
import ChildSelectionState from "./components/ChildSelectionState";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function initials(value) {
  return String(value || "Parent")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function isValidPhone(value) {
  const cleaned = String(value || "").replace(/\D/g, "");
  return !cleaned || (cleaned.length >= 7 && cleaned.length <= 20);
}

export default function ParentProfile() {
  const { isAuthenticating, logout, role, updateSessionUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [profileData, childData] = await Promise.all([
        api.parent.profile.get(),
        api.parent.children(),
      ]);
      setProfile(profileData?.profile || null);
      // The Parent children endpoint returns { children }, not { items }.
      // Read the contract directly so linked student cards render correctly
      // for both single-child and multi-child parent accounts.
      setChildren(childData?.children || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (children.length === 1) {
      setSelectedChildId(children[0]?.id || "");
      return;
    }
    if (selectedChildId && children.some((child) => child.id === selectedChildId)) return;
    setSelectedChildId("");
  }, [children, selectedChildId]);

  function edit() {
    setForm({
      fullName: profile?.full_name || "",
      phone: profile?.phone || "",
    });
  }

  async function save() {
    const nextFullName = String(form?.fullName || "").trim();
    const nextPhone = String(form?.phone || "").trim();

    if (!nextFullName) {
      Alert.alert("Full name required", "Enter your full name before saving.");
      return;
    }
    if (!isValidPhone(nextPhone)) {
      Alert.alert("Invalid phone number", "Enter a valid phone number before saving.");
      return;
    }
    setSaving(true);
    try {
      const result = await api.parent.profile.update({
        fullName: nextFullName,
        phone: nextPhone,
      });
      const updatedProfile = result?.profile || {};
      updateSessionUser({
        name: updatedProfile.full_name || nextFullName,
        full_name: updatedProfile.full_name || nextFullName,
        email: updatedProfile.email || profile?.email || "",
        phone: updatedProfile.phone || nextPhone,
        status: updatedProfile.status || profile?.status,
      });
      setProfile(updatedProfile.full_name ? updatedProfile : profile);
      setForm(null);
      Alert.alert(
        "Profile updated",
        result?.message || "Your contact information was saved."
      );
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert(
        "Unable to update profile",
        nextError?.message || "Please review the information."
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    Alert.alert(
      "Log out?",
      "You will need to sign in again to access your Parent portal.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: logout },
      ]
    );
  }

  if (loading) {
    return <DashboardSkeleton message="Preparing your profile..." />;
  }

  if (error && !profile) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <SurfaceCard>
          <Ionicons color={colors.error} name="cloud-offline-outline" size={32} />
          <AppText style={styles.errorTitle} variant="heading">
            Profile unavailable
          </AppText>
          <AppText style={styles.errorBody}>{error}</AppText>
          <PillButton onPress={() => load()} style={styles.retry}>
            Try Again
          </PillButton>
        </SurfaceCard>
      </Screen>
    );
  }

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
        <LinearGradient
          colors={[colors.primaryContainer, "#0D5C48"]}
          style={styles.hero}
        >
          <View style={styles.avatar}>
            <AppText style={styles.initials}>{initials(profile?.full_name)}</AppText>
          </View>
          <AppText style={styles.name}>{profile?.full_name || "Parent"}</AppText>
          <View style={styles.rolePill}>
            <Ionicons color={colors.secondaryContainer} name="people-outline" size={14} />
            <AppText style={styles.role}>{String(role).toUpperCase()}</AppText>
          </View>
          <Pressable onPress={edit} style={styles.edit}>
            <Ionicons color={colors.primary} name="create-outline" size={17} />
            <AppText style={styles.editText}>Edit Profile</AppText>
          </Pressable>
        </LinearGradient>

        {error ? (
          <SurfaceCard style={styles.warning}>
            <AppText style={styles.warningText}>{error}</AppText>
          </SurfaceCard>
        ) : null}

        <Section title="Account Information">
          <SurfaceCard style={styles.card}>
            <Row icon="mail-outline" label="Email" value={profile?.email} />
            <Divider />
            <Row icon="call-outline" label="Phone" value={profile?.phone} />
            <Divider />
            <Row
              icon="shield-checkmark-outline"
              label="Account Status"
              value={profile?.status ? String(profile.status).toUpperCase() : "Active"}
            />
          </SurfaceCard>
        </Section>

        <Section title={`Enrolled Children (${children.length})`}>
          {children.length ? (
            <>
              {children.length > 1 ? (
                <ChildDropdown
                  children={children}
                  label="SELECT CHILD"
                  onChange={setSelectedChildId}
                  placeholder="Choose a child to view profile details"
                  selectedId={selectedChildId}
                />
              ) : null}
              {children.length === 1 || selectedChildId ? (
                children
                  .filter((child) => (children.length === 1 ? true : child.id === selectedChildId))
                  .map((child) => (
                    <SurfaceCard key={child.id} style={styles.childCard}>
                      <View style={styles.childHeader}>
                        <View style={styles.childAvatar}>
                          <AppText style={styles.childInitial}>
                            {String(child.full_name || child.name || "C")[0].toUpperCase()}
                          </AppText>
                        </View>
                        <View style={styles.childCopy}>
                          <AppText style={styles.childName}>
                            {child.full_name || child.name}
                          </AppText>
                          <AppText style={styles.childClass}>
                            {child.course_title || child.class_level || "Enrolled"}
                          </AppText>
                        </View>
                      </View>
                    </SurfaceCard>
                  ))
              ) : (
                <ChildSelectionState message="Choose a child from the dropdown to view that child’s profile card." />
              )}
            </>
          ) : (
            <SurfaceCard elevated={false} style={styles.empty}>
              <Ionicons color={colors.outline} name="school-outline" size={26} />
              <AppText style={styles.emptyText}>
                No enrolled children are currently linked to your account.
              </AppText>
            </SurfaceCard>
          )}
        </Section>

        <SurfaceCard elevated={false} style={styles.security}>
          <Ionicons color={colors.emeraldMid} name="lock-closed-outline" size={22} />
          <View style={styles.securityCopy}>
            <AppText style={styles.securityTitle}>Secure Session</AppText>
            <AppText style={styles.securityText}>
              Your account is authenticated through Ash-Shajrah Learning Hub. Role,
              permissions, and student associations are managed by administration.
            </AppText>
          </View>
        </SurfaceCard>

        <PillButton
          icon={<Ionicons color={colors.white} name="log-out-outline" size={19} />}
          loading={isAuthenticating}
          onPress={confirmLogout}
          style={styles.logout}
        >
          Log Out
        </PillButton>

        <AppText style={styles.version}>ASH-SHAJRAH MOBILE · VERSION 1.0</AppText>
      </Screen>

      <EditProfile
        form={form}
        onChange={setForm}
        onClose={() => setForm(null)}
        onSave={save}
        saving={saving}
      />
    </>
  );
}

function Section({ children, title }) {
  return (
    <View>
      <AppText style={styles.sectionTitle}>{title}</AppText>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function Row({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons color={colors.secondary} name={icon} size={18} />
      </View>
      <View style={styles.rowCopy}>
        <AppText style={styles.rowLabel}>{label}</AppText>
        <AppText style={styles.rowValue}>{value || "Not provided"}</AppText>
      </View>
    </View>
  );
}

function EditProfile({ form, onChange, onClose, onSave, saving }) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={Boolean(form)}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <AppText style={styles.sheetTitle}>Edit Profile</AppText>
            <Pressable
              accessibilityLabel="Close profile editor"
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons color={colors.primary} name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Field
              label="Full Name"
              maxLength={150}
              onChange={(fullName) => onChange({ ...form, fullName })}
              value={form?.fullName}
            />
            <Field
              keyboardType="phone-pad"
              label="Phone"
              maxLength={50}
              onChange={(phone) => onChange({ ...form, phone })}
              value={form?.phone}
            />
            <View style={styles.readOnlyNotice}>
              <Ionicons color={colors.outline} name="information-circle-outline" size={18} />
              <AppText style={styles.readOnlyText}>
                Email, username, role, status, and enrolled children are read-only.
              </AppText>
            </View>
            <PillButton
              disabled={saving}
              loading={saving}
              onPress={onSave}
              style={styles.save}
            >
              Save Profile
            </PillButton>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({ keyboardType, label, maxLength, onChange, value }) {
  return (
    <View>
      <AppText style={styles.label}>{label}</AppText>
      <TextInput
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChange}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor={colors.outline}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.xl },
  hero: { alignItems: "center", padding: space.xl, borderRadius: radius["2xl"], ...shadows.hero },
  avatar: { width: 80, height: 80, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.secondaryContainer, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.12)" },
  initials: { color: colors.white, fontFamily: fonts.displayBold, fontSize: fontSize["2xl"] },
  name: { marginTop: space.md, color: colors.white, fontFamily: fonts.displayBold, fontSize: fontSize.xl, textAlign: "center" },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: space.sm, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.10)" },
  role: { color: colors.secondaryContainer, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  edit: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: space.md, paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.full, backgroundColor: colors.white },
  editText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 9 },
  sectionTitle: { marginTop: space.xl, marginBottom: space.sm, color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.lg },
  card: { paddingVertical: space.xs },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", padding: space.md },
  rowIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.goldPale },
  rowCopy: { flex: 1, marginLeft: space.md },
  rowLabel: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 8, textTransform: "uppercase" },
  rowValue: { marginTop: 2, color: colors.onSurface, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  divider: { height: 1, marginLeft: 66, backgroundColor: colors.borderGreen },
  childCard: { marginBottom: space.sm },
  childHeader: { flexDirection: "row", alignItems: "center" },
  childAvatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "#B9EEDB" },
  childInitial: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.base },
  childCopy: { flex: 1, marginLeft: space.md },
  childName: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  childClass: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  empty: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.surfaceLow },
  emptyText: { flex: 1, color: colors.outline, fontSize: fontSize.xs },
  security: { flexDirection: "row", alignItems: "flex-start", marginTop: space.lg, backgroundColor: colors.surfaceLow },
  securityCopy: { flex: 1, marginLeft: space.md },
  securityTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  securityText: { marginTop: 3, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  logout: { marginTop: space.xl },
  version: { marginTop: space.xl, color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1, textAlign: "center" },
  warning: { marginTop: space.md, backgroundColor: colors.statusPendingBg },
  warningText: { color: colors.statusPendingText, fontSize: fontSize.xs },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,39,30,0.35)" },
  sheet: { height: "70%", padding: space.lg, paddingBottom: space["2xl"], borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background },
  sheetHead: { flexDirection: "row", alignItems: "center", marginBottom: space.sm },
  sheetTitle: { flex: 1, color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize.xl },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceHigh },
  label: { marginTop: space.md, marginBottom: space.xs, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  input: { minHeight: 48, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, backgroundColor: colors.surface, color: colors.onSurface, fontFamily: fonts.body, fontSize: fontSize.xs },
  readOnlyNotice: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  readOnlyText: { flex: 1, color: colors.outline, fontSize: fontSize.xs },
  save: { marginTop: space.xl },
  errorScreen: { justifyContent: "center" },
  errorTitle: { marginTop: space.md },
  errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
  retry: { marginTop: space.lg },
});

