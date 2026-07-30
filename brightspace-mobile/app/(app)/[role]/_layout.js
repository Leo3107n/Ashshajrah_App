/** Validates session, role ownership, and section permission before rendering. */
import { Redirect, Slot, useLocalSearchParams, usePathname } from "expo-router";
import AuthGateScreen from "../../../src/components/AuthGateScreen";
import { getRoleHomeRoute, useAuth } from "../../../src/context/AuthContext";
import {
  isSectionAllowed,
  isSupportedRole,
  normalizeRole,
} from "../../../src/navigation/roleNavigation";

export default function RoleLayout() {
  const { role: routeRole } = useLocalSearchParams();
  const { isAuthenticated, isLoading, role } = useAuth();
  const pathname = usePathname();
  const requestedRole = normalizeRole(
    Array.isArray(routeRole) ? routeRole[0] : routeRole
  );
  const requestedSection =
    String(pathname || "").split("/").filter(Boolean).at(-1)?.toLowerCase() ||
    "dashboard";

  if (isLoading) {
    return <AuthGateScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (
    !isSupportedRole(requestedRole) ||
    requestedRole !== role ||
    !isSupportedRole(role)
  ) {
    return <Redirect href={getRoleHomeRoute(role)} />;
  }

  if (!isSectionAllowed(role, requestedSection)) {
    return <Redirect href={getRoleHomeRoute(role)} />;
  }

  return <Slot />;
}
