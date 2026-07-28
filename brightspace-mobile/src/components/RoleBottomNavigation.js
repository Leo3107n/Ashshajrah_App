import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { navigationForRole } from "../navigation/roleNavigation";
import { colors, fonts, fontSize, shadows, space } from "../theme";
import { AppText } from "./ui";

export default function RoleBottomNavigation() {
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {navigationForRole(role).map(([key, label, icon, activeIcon]) => {
        const active = pathname.endsWith(`/${key}`);
        return (
          <Pressable key={key} onPress={() => router.replace(`/(app)/${role}/${key}`)} style={styles.item}>
            <View style={[styles.iconWrap, active ? styles.active : null]}>
              <Ionicons color={active ? colors.onSecondaryContainer : colors.onSurfaceVariant} name={active ? activeIcon : icon} size={21} />
            </View>
            <AppText numberOfLines={1} style={[styles.label, active ? styles.activeLabel : null]}>{label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", paddingTop: 7, paddingHorizontal: space.xs, borderTopWidth: 1, borderTopColor: colors.borderGreen, backgroundColor: colors.surface, ...shadows.subtle },
  item: { minWidth: 58, minHeight: 50, flex: 1, alignItems: "center" },
  iconWrap: { minWidth: 38, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  active: { paddingHorizontal: 13, backgroundColor: colors.secondaryContainer },
  label: { marginTop: 1, color: colors.onSurfaceVariant, fontFamily: fonts.bodySemibold, fontSize: 10, lineHeight: 14 },
  activeLabel: { color: colors.secondary, fontFamily: fonts.bodyBold },
});
