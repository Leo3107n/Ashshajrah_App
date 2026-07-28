import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { colors, fonts, fontSize, letterSpacing, space } from "../theme";
import { AppText } from "./ui";

export default function AuthGateScreen({ message = "Restoring your session..." }) {
  return (
    <View accessibilityRole="progressbar" style={styles.screen}>
      <View style={styles.center}>
        <View style={styles.logoFrame}>
          <Image
            resizeMode="contain"
            source={require("../../assets/logo.webp")}
            style={styles.logo}
          />
        </View>
        <View style={styles.ornament}>
          <View style={styles.line} />
          <View style={styles.diamond} />
          <View style={styles.line} />
        </View>
        <ActivityIndicator color={colors.gold} size="small" />
        <AppText style={styles.message}>{message}</AppText>
      </View>
      <AppText style={styles.tagline}>NURTURING KNOWLEDGE</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "space-between",
    backgroundColor: colors.cream,
    paddingHorizontal: space.xl,
    paddingTop: 120,
    paddingBottom: space["3xl"],
  },
  center: {
    alignItems: "center",
  },
  logoFrame: {
    width: 184,
    height: 184,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: 26,
    backgroundColor: colors.surface,
  },
  logo: {
    width: 166,
    height: 154,
  },
  ornament: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: space.xl,
  },
  line: {
    width: 38,
    height: 1,
    backgroundColor: colors.goldLight,
  },
  diamond: {
    width: 7,
    height: 7,
    marginHorizontal: space.sm,
    backgroundColor: colors.gold,
    transform: [{ rotate: "45deg" }],
  },
  message: {
    marginTop: space.md,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontFamily: fonts.body,
    textAlign: "center",
  },
  tagline: {
    color: colors.outline,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: letterSpacing.brand,
    textAlign: "center",
  },
});
