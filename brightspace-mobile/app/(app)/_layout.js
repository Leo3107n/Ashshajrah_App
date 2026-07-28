import { Redirect, Slot } from "expo-router";
import AppShell from "../../src/components/AppShell";
import AuthGateScreen from "../../src/components/AuthGateScreen";
import { useAuth } from "../../src/context/AuthContext";

export default function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthGateScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
