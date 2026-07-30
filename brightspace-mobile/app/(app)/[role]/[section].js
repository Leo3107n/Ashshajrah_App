/** Dynamic fallback that describes supported role sections safely. */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { sectionTitle } from "../../../src/navigation/roleNavigation";
import { colors, space } from "../../../src/theme";
import { AppText, Screen, SurfaceCard } from "../../../src/components/ui";
import TeacherClasses from "../../../src/features/teacher/TeacherClasses";
import TeacherLectures from "../../../src/features/teacher/TeacherLectures";
import TeacherAttendance from "../../../src/features/teacher/TeacherAttendance";
import TeacherHomework from "../../../src/features/teacher/TeacherHomework";
import TeacherCompletionReports from "../../../src/features/teacher/TeacherCompletionReports";
import TeacherNotes from "../../../src/features/teacher/TeacherNotes";
import TeacherNotifications from "../../../src/features/teacher/TeacherNotifications";

export default function PortalSection() {
  const { role, section } = useLocalSearchParams();
  if (String(role) === "teacher" && String(section) === "classes") {
    return <TeacherClasses />;
  }
  if (String(role) === "teacher" && String(section) === "lectures") {
    return <TeacherLectures />;
  }
  if (String(role) === "teacher" && String(section) === "attendance") {
    return <TeacherAttendance />;
  }
  if (String(role) === "teacher" && String(section) === "homework") {
    return <TeacherHomework />;
  }
  // This distinct route prevents the generic administrative Reports section
  // from becoming reachable merely because Teachers submit lecture reports.
  if (String(role) === "teacher" && String(section) === "completion-reports") {
    return <TeacherCompletionReports />;
  }
  if (String(role) === "teacher" && String(section) === "notes") {
    return <TeacherNotes />;
  }
  if (String(role) === "teacher" && String(section) === "notifications") {
    return <TeacherNotifications />;
  }
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
