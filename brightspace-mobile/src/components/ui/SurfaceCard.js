/** Reusable rounded content surface with optional brand elevation. */
import { StyleSheet, View } from "react-native";
import { colors, radius, shadows, space } from "../../theme";

export default function SurfaceCard({ children, style, elevated = true }) {
  return <View style={[styles.card, elevated ? shadows.card : null, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { padding: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius["2xl"], backgroundColor: colors.surface },
});
