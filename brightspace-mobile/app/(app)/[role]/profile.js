/** Shared identity, secure-session information, and confirmed logout screen. */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Alert, StyleSheet, View } from "react-native";
import { AppText, PillButton, Screen, SurfaceCard } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import TeacherProfile from "../../../src/features/teacher/TeacherProfile";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

function displayName(user) {
  return user?.name || user?.full_name || "Ash-Shajrah User";
}

function initials(user) {
  return String(displayName(user))
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function AccountRow({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons color={colors.secondary} name={icon} size={19} />
      </View>
      <View style={styles.rowText}>
        <AppText style={styles.rowLabel}>{label}</AppText>
        <AppText numberOfLines={2} style={styles.rowValue}>
          {value || "Not provided"}
        </AppText>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { isAuthenticating, logout, role, user } = useAuth();
  // Teacher has a dedicated professional profile and assignment view. Other
  // roles retain the shared identity/session screen below.
  if (role === "teacher") return <TeacherProfile />;

  function confirmLogout() {
    Alert.alert("Log out?", "You will need to sign in again to access your portal.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: logout },
    ]);
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <LinearGradient
        colors={[colors.primaryContainer, "#0D5C48"]}
        style={styles.hero}
      >
        <View style={styles.avatar}>
          <AppText style={styles.initials}>{initials(user)}</AppText>
        </View>
        <AppText style={styles.name} variant="heading">
          {displayName(user)}
        </AppText>
        <View style={styles.rolePill}>
          <Ionicons color={colors.secondaryContainer} name="leaf-outline" size={14} />
          <AppText style={styles.role}>{String(role).toUpperCase()}</AppText>
        </View>
      </LinearGradient>

      <AppText style={styles.sectionTitle}>Account Information</AppText>
      <SurfaceCard style={styles.details}>
        <AccountRow icon="mail-outline" label="Email" value={user?.email} />
        <View style={styles.divider} />
        <AccountRow
          icon="person-outline"
          label="Username"
          value={user?.username}
        />
        <View style={styles.divider} />
        <AccountRow icon="call-outline" label="Phone" value={user?.phone} />
      </SurfaceCard>

      <SurfaceCard elevated={false} style={styles.security}>
        <Ionicons color={colors.emeraldMid} name="shield-checkmark-outline" size={22} />
        <View style={styles.securityText}>
          <AppText style={styles.securityTitle}>Secure Session</AppText>
          <AppText style={styles.securityBody}>
            Your account is authenticated through Ash-Shajrah Learning Hub.
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

const styles = StyleSheet.create({
  content: { paddingTop: space.md },
  hero: {
    alignItems: "center",
    padding: space.xl,
    borderRadius: radius["2xl"],
    ...shadows.hero,
  },
  avatar: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.secondaryContainer,
    borderRadius: 41,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  initials: {
    color: colors.white,
    fontFamily: fonts.displayBold,
    fontSize: fontSize["2xl"],
  },
  name: { marginTop: space.md, color: colors.white, textAlign: "center" },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  role: {
    marginLeft: space.xs,
    color: colors.secondaryContainer,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  sectionTitle: {
    marginTop: space.xl,
    marginBottom: space.sm,
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
  },
  details: { paddingVertical: space.xs },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", padding: space.md },
  rowIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: colors.goldPale,
  },
  rowText: { flex: 1, marginLeft: space.md },
  rowLabel: {
    color: colors.outline,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: "uppercase",
  },
  rowValue: {
    color: colors.onSurface,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
  },
  divider: { height: 1, marginLeft: 66, backgroundColor: colors.borderGreen },
  security: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.md,
    backgroundColor: colors.surfaceLow,
  },
  securityText: { flex: 1, marginLeft: space.md },
  securityTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  securityBody: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  logout: { marginTop: space.xl },
  version: {
    marginTop: space.xl,
    color: colors.outline,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textAlign: "center",
  },
});
