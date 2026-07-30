/** Branded tree loader displayed while authentication state is unresolved. */
import { StyleSheet, View } from "react-native";
import { colors, fonts, letterSpacing, space } from "../theme";
import { AppText, TreeGrowingLoader } from "./ui";

export default function AuthGateScreen({ message = "Restoring your session..." }) {
  return (
    <View accessibilityRole="progressbar" style={styles.screen}>
      <View style={styles.center}>
        <TreeGrowingLoader message={message} />
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
  tagline: {
    color: colors.outline,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: letterSpacing.brand,
    textAlign: "center",
  },
});
