import { StyleSheet, Text } from "react-native";
import { colors, fonts, fontSize, letterSpacing, lineHeight } from "../../theme";

const variants = StyleSheet.create({
  display: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: fontSize["4xl"], lineHeight: lineHeight.displayMobile, letterSpacing: letterSpacing.tight },
  heading: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize["2xl"], lineHeight: lineHeight.headlineMd },
  title: { color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: fontSize.xl, lineHeight: lineHeight.titleLg },
  body: { color: colors.onSurface, fontFamily: fonts.body, fontSize: fontSize.base, lineHeight: lineHeight.bodyMd },
  label: { color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm, lineHeight: lineHeight.labelMd },
  caption: { color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: fontSize.xs, lineHeight: lineHeight.labelSm, letterSpacing: letterSpacing.wider },
});

export default function AppText({ children, style, variant = "body", ...props }) {
  return <Text style={[variants[variant] || variants.body, style]} {...props}>{children}</Text>;
}
