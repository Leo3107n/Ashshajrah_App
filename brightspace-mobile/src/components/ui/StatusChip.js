import { StyleSheet, View } from "react-native";
import { colors, fonts, fontSize, radius, space } from "../../theme";
import AppText from "./AppText";

const tones = {
  neutral: [colors.surfaceHighest, colors.onSurfaceVariant],
  success: [colors.statusApprovedBg, colors.statusApprovedText],
  warning: [colors.statusPendingBg, colors.statusPendingText],
  danger: [colors.statusRejectedBg, colors.statusRejectedText],
  gold: [colors.secondaryContainer, colors.onSecondaryContainer],
};

export default function StatusChip({ children, style, tone = "neutral" }) {
  const [backgroundColor, color] = tones[tone] || tones.neutral;
  return <View style={[styles.chip, { backgroundColor }, style]}><AppText style={[styles.text, { color }]}>{children}</AppText></View>;
}

const styles = StyleSheet.create({
  chip: { minHeight: 32, alignSelf: "flex-start", alignItems: "center", justifyContent: "center", borderRadius: radius.full, paddingHorizontal: space.md },
  text: { fontFamily: fonts.bodyBold, fontSize: fontSize.xs, lineHeight: 16 },
});
