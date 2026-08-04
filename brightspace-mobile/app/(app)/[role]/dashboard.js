/**
 * Protected dashboard dispatcher. Completed roles use isolated feature
 * components so their APIs, permissions, and UI cannot leak across portals.
 */
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";
import AdminHome from "../../../src/features/admin/AdminHome";
import CoordinatorHome from "../../../src/features/coordinator/CoordinatorHome";
import ParentHome from "../../../src/features/parent/ParentHome";
import StudentHome from "../../../src/features/student/StudentHome";
import SuperAdminHome from "../../../src/features/superadmin/SuperAdminHome";
import TeacherHome from "../../../src/features/teacher/TeacherHome";
import { AppText, Screen, SurfaceCard } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { colors, fontSize, radius, shadows, space } from "../../../src/theme";

function firstName(user) {
  return String(user?.name || user?.full_name || "Learner")
    .trim()
    .split(/\s+/)[0];
}

function OtherRoleHome() {
  const { role, user } = useAuth();
  return (
    <Screen contentContainerStyle={styles.content}>
      <LinearGradient
        colors={[colors.primaryContainer, "#0D5C48"]}
        style={styles.hero}
      >
        <AppText style={styles.eyebrow}>{role.toUpperCase()} PORTAL</AppText>
        <AppText style={styles.greeting} variant="display">
          Salaam, {firstName(user)}!
        </AppText>
        <AppText style={styles.heroBody}>
          Your workspace is rooted in clarity and growth.
        </AppText>
      </LinearGradient>
      <SurfaceCard>
        <AppText variant="heading">Welcome to Ash-Shajrah</AppText>
        <AppText style={styles.body}>
          Use the navigation below to continue through your portal.
        </AppText>
      </SurfaceCard>
    </Screen>
  );
}

export default function Dashboard() {
  const { role } = useAuth();

  if (role === "student") return <StudentHome />;
  if (role === "coordinator") return <CoordinatorHome />;
  if (role === "superadmin") return <SuperAdminHome />;
  if (role === "admin") return <AdminHome />;
  if (role === "teacher") return <TeacherHome />;
  if (role === "parent") return <ParentHome />;
  return <OtherRoleHome />;
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingTop: space.md },
  hero: { padding: space.xl, borderRadius: radius["2xl"], ...shadows.hero },
  eyebrow: { color: "#B9EEDB", fontSize: 10, letterSpacing: 1.2 },
  greeting: {
    marginTop: space.xs,
    color: colors.white,
    fontSize: 27,
    lineHeight: 34,
  },
  heroBody: { marginTop: space.xs, color: "#D6E9E2", fontSize: fontSize.sm },
  body: { marginTop: space.sm, color: colors.onSurfaceVariant },
});
