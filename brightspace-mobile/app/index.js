import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { colors, fonts, fontSize, fontWeight, space } from "../src/theme";

export default function Index() {
  const { homeRoute, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.emeraldLight} size="large" />
        <Text style={styles.title}>Ash-Shajrah LMS</Text>
        <Text style={styles.message}>Restoring your session...</Text>
      </View>
    );
  }

  return (
    <Redirect
      href={isAuthenticated ? homeRoute : "/(auth)/login"}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
    padding: space.xl,
  },
  title: {
    marginTop: space.lg,
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
  },
  message: {
    marginTop: space.sm,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
});
