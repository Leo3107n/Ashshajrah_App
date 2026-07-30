/**
 * Root layout. Loads brand fonts, mounts global authentication state, and
 * keeps the native splash visible until the application is ready.
 */
import { Slot } from "expo-router";
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts as usePlayfairFonts,
} from "@expo-google-fonts/playfair-display";
import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts as useQuicksandFonts,
} from "@expo-google-fonts/quicksand";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  const [playfairLoaded, playfairError] = usePlayfairFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });
  const [quicksandLoaded, quicksandError] = useQuicksandFonts({
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  if (playfairError || quicksandError) {
    throw playfairError || quicksandError;
  }

  if (!playfairLoaded || !quicksandLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Slot />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
