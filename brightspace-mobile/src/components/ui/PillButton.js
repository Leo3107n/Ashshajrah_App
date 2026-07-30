/** Rounded brand button with variants, async state, and leaf spinner feedback. */
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import { LeafSpinner } from "../LoadingAnimations";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";
import AppText from "./AppText";

export default function PillButton({ children, disabled = false, icon, loading = false, onPress, style, textStyle, variant = "primary" }) {
  const inactive = disabled || loading;
  const content = loading ? <LeafSpinner color={variant === "primary" ? colors.white : colors.secondary} /> : <>{icon ? <View style={styles.icon}>{icon}</View> : null}<AppText style={[variant === "primary" ? styles.primaryText : styles.secondaryText, textStyle]}>{children}</AppText></>;

  return (
    <Pressable accessibilityRole="button" disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.pressable, variant === "primary" ? shadows.button : null, pressed && !inactive ? styles.pressed : null, inactive ? styles.disabled : null, style]}>
      {variant === "primary" ? (
        <LinearGradient colors={[colors.emeraldDark, colors.emeraldMid]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.inner}>{content}</LinearGradient>
      ) : (
        <View style={[styles.inner, variant === "gold" ? styles.gold : styles.outline]}>{content}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { minHeight: 48, borderRadius: radius.full },
  inner: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.full, paddingHorizontal: space.lg },
  gold: { backgroundColor: colors.secondaryContainer },
  outline: { borderWidth: 2, borderColor: colors.gold, backgroundColor: colors.transparent },
  primaryText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  secondaryText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  icon: { marginRight: space.sm },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
});
