/** Shared protected-screen chrome with header, content, and role navigation. */
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";
import PortalHeader from "./PortalHeader";
import RoleBottomNavigation from "./RoleBottomNavigation";

/**
 * Shared authenticated-screen frame. Navigation and the portal header will be
 * mounted here in later steps, while individual screens only provide content.
 */
export default function AppShell({ children }) {
  return (
    <SafeAreaView edges={["top", "right", "left"]} style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <PortalHeader />
      <View style={styles.content}>{children}</View>
      <RoleBottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
