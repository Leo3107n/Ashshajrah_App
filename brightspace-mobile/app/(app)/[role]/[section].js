import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { sectionTitle } from "../../../src/navigation/roleNavigation";
import { colors, space } from "../../../src/theme";
import { AppText, Screen, SurfaceCard } from "../../../src/components/ui";

export default function PortalSection() {
  const { role, section } = useLocalSearchParams();
  const title = sectionTitle(String(role), String(section));
  return (
    <Screen contentContainerStyle={styles.content}>
      <SurfaceCard style={styles.card}>
        <View style={styles.icon}><Ionicons color={colors.secondary} name="leaf-outline" size={26} /></View>
        <AppText variant="heading">{title}</AppText>
        <AppText style={styles.body}>This section is ready for its live data and detailed screen implementation.</AppText>
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.xl },
  card: { alignItems: "flex-start" },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginBottom: space.md, borderRadius: 24, backgroundColor: colors.goldPale },
  body: { marginTop: space.sm, color: colors.onSurfaceVariant },
});
