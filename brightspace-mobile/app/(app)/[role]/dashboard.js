import { Redirect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../../src/context/AuthContext";
import {
  colors,
  fonts,
  fontSize,
  fontWeight,
  radius,
  shadows,
  space,
} from "../../../src/theme";

export default function DashboardPlaceholder() {
  const { role: routeRole } = useLocalSearchParams();
  const {
    isAuthenticated,
    isAuthenticating,
    isLoading,
    logout,
    role,
    user,
  } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.emeraldLight} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (String(routeRole) !== role) return <Redirect href="/" />;

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{role.toUpperCase()} PORTAL</Text>
        <Text style={styles.title}>Welcome, {user?.name || user?.full_name || "User"}</Text>
        <Text style={styles.body}>
          Your login is working. The complete {role} dashboard will be built in
          the next feature stage.
        </Text>
        <Pressable
          disabled={isAuthenticating}
          onPress={logout}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          {isAuthenticating ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <Text style={styles.buttonText}>Sign out</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: colors.cream,
    padding: space.xl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  card: {
    padding: space["2xl"],
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radius["3xl"],
    backgroundColor: colors.parchmentLight,
    ...shadows.card,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 2.5,
  },
  title: {
    marginTop: space.md,
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
  },
  body: {
    marginTop: space.md,
    color: colors.textSecondary,
    fontSize: fontSize.base,
    lineHeight: 23,
  },
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xl,
    borderRadius: radius.full,
    backgroundColor: colors.emerald,
  },
  buttonPressed: {
    backgroundColor: colors.emeraldDark,
  },
  buttonText: {
    color: colors.textOnDark,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
});
