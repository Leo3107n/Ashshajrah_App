/** Shared identity, secure-session information, and confirmed logout screen. */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import api from "../../../src/api";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import TeacherProfile from "../../../src/features/teacher/TeacherProfile";
import StudentProfile from "../../../src/features/student/StudentProfile";
import ParentProfile from "../../../src/features/parent/ParentProfile";
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

function feeDueLabel(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function StudentProfileAccessGate({ children }) {
  const router = useRouter();
  const { isAuthenticating, logout } = useAuth();
  const [status, setStatus] = useState({ loading: true, locked: false, message: "" });

  useEffect(() => {
    let mounted = true;
    api.payment.monthlyFeeStatus()
      .then((result) => {
        if (!mounted) return;
        if (!result?.overdue) {
          setStatus({ loading: false, locked: false, message: "" });
          return;
        }
        const dueLabel = feeDueLabel(result.due_date);
        setStatus({
          loading: false,
          locked: true,
          message: dueLabel
            ? `Fee Deadline was ${dueLabel}. Your student profile is locked until payment is cleared.`
            : "Fee Deadline is missed. Your student profile is locked until payment is cleared.",
        });
      })
      .catch(() => {
        if (mounted) setStatus({ loading: false, locked: false, message: "" });
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (status.loading) return <DashboardSkeleton message="Checking fee access..." />;
  if (!status.locked) return children;

  return (
    <Screen contentContainerStyle={styles.content}>
      <SurfaceCard style={styles.lockCard}>
        <View style={styles.lockIcon}>
          <Ionicons color={colors.error} name="lock-closed-outline" size={26} />
        </View>
        <AppText variant="heading">Student profile locked</AppText>
        <AppText style={styles.body}>{status.message}</AppText>
        <PillButton
          icon={<Ionicons color={colors.white} name="wallet-outline" size={18} />}
          onPress={() => router.push("/(app)/student/fees")}
          style={styles.lockButton}
        >
          View Fees
        </PillButton>
        <PillButton
          icon={<Ionicons color={colors.white} name="log-out-outline" size={18} />}
          loading={isAuthenticating}
          onPress={logout}
          style={styles.lockButton}
        >
          Log Out
        </PillButton>
      </SurfaceCard>
    </Screen>
  );
}

export default function ProfileScreen() {
  const { isAuthenticating, logout, role, user } = useAuth();
  // Teacher has a dedicated professional profile and assignment view. Other
  // roles retain the shared identity/session screen below.
  if (role === "teacher") return <TeacherProfile />;
  if (role === "student") {
    return (
      <StudentProfileAccessGate>
        <StudentProfile />
      </StudentProfileAccessGate>
    );
  }
  if (role === "parent") return <ParentProfile />;

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
  lockCard: { alignItems: "flex-start", borderWidth: 1, borderColor: colors.error, backgroundColor: colors.errorContainer },
  lockIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginBottom: space.md, borderRadius: 24, backgroundColor: colors.surface },
  lockButton: { marginTop: space.lg },
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
