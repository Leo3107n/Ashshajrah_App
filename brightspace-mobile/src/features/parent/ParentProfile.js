/**
 * Parent Profile and Account Management.
 *
 * Parents see their account information, enrolled children, and secure
 * session status. The profile is intentionally read-only so account details
 * remain managed by authorized staff. Logout continues through the
 * centralized AuthContext session provider.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  StyleSheet,
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

export default function ParentProfile() {
  const { isAuthenticating, logout, role } = useAuth();
  const [profile, setProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
              <ChildSelectionState message="Choose a child from the dropdown to view that child's profile card." />
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

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.xl },
  hero: { alignItems: "center", padding: space.xl, borderRadius: radius["2xl"], ...shadows.hero },
  avatar: { width: 80, height: 80, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.secondaryContainer, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.12)" },
  initials: { color: colors.white, fontFamily: fonts.displayBold, fontSize: fontSize["2xl"] },
  name: { marginTop: space.md, color: colors.white, fontFamily: fonts.displayBold, fontSize: fontSize.xl, textAlign: "center" },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: space.sm, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.10)" },
  role: { color: colors.secondaryContainer, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
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
  errorScreen: { justifyContent: "center" },
  errorTitle: { marginTop: space.md },
  errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
  retry: { marginTop: space.lg },
});
