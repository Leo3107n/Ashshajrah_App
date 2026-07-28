import { ScrollView, StyleSheet, View } from "react-native";
import { colors, space } from "../../theme";

export default function Screen({ children, contentContainerStyle, padded = true, scroll = true, style, ...props }) {
  const contentStyle = [styles.content, padded ? styles.padded : null, contentContainerStyle];
  if (!scroll) return <View style={[styles.screen, style]} {...props}><View style={contentStyle}>{children}</View></View>;
  return <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={[styles.screen, style]} {...props}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingBottom: space["3xl"] },
  padded: { paddingHorizontal: space.lg },
});
