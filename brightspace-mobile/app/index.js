/**
 * App entry route. Restores the session, then redirects authenticated users to
 * their role home and unauthenticated users to login.
 */
import { Redirect } from "expo-router";
import AuthGateScreen from "../src/components/AuthGateScreen";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { homeRoute, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthGateScreen />;
  }

  return (
    <Redirect
      href={isAuthenticated ? homeRoute : "/(auth)/login"}
    />
  );
}
