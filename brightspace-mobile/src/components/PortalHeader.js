import { Image, StyleSheet, View } from "react-native";
import { usePathname } from "expo-router";
import { colors, fonts, fontSize, shadows, space } from "../theme";
import { useAuth } from "../context/AuthContext";
import { sectionTitle } from "../navigation/roleNavigation";
import { AppText } from "./ui";

export default function PortalHeader() {
  const pathname = usePathname();
  const { role, user } = useAuth();
  const section = pathname.split("/").filter(Boolean).at(-1) || "dashboard";
  const initials = String(user?.name || user?.full_name || "A S")
    .split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Image source={require("../../assets/logo.webp")} style={styles.logo} resizeMode="contain" />
        <AppText numberOfLines={1} style={styles.title}>{sectionTitle(role, section)}</AppText>
      </View>
      <View accessibilityLabel="Profile" style={styles.avatar}>
        <AppText style={styles.initials}>{initials}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen, backgroundColor: colors.surface, ...shadows.subtle },
  identity: { flex: 1, flexDirection: "row", alignItems: "center" },
  logo: { width: 34, height: 38, marginRight: space.sm },
  title: { flex: 1, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.secondaryContainer, borderRadius: 19, backgroundColor: colors.primaryContainer },
  initials: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
});
