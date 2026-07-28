import { Redirect, Slot, useLocalSearchParams } from "expo-router";
import AuthGateScreen from "../../../src/components/AuthGateScreen";
import { getRoleHomeRoute, useAuth } from "../../../src/context/AuthContext";

export default function RoleLayout() {
  const { role: routeRole } = useLocalSearchParams();
  const { isAuthenticated, isLoading, role } = useAuth();
  const requestedRole = Array.isArray(routeRole) ? routeRole[0] : routeRole;

  if (isLoading) {
    return <AuthGateScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (String(requestedRole || "").toLowerCase() !== role) {
    return <Redirect href={getRoleHomeRoute(role)} />;
  }

  return <Slot />;
}
