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
import TeacherStudents from "../../../src/features/teacher/TeacherStudents";
import TeacherInternalEvents from "../../../src/features/teacher/TeacherInternalEvents";
import StudentClasses from "../../../src/features/student/StudentClasses";
import StudentCalendar from "../../../src/features/student/StudentCalendar";
import StudentLectures from "../../../src/features/student/StudentLectures";
import StudentHomework from "../../../src/features/student/StudentHomework";
import StudentAttendance from "../../../src/features/student/StudentAttendance";
import StudentProgress from "../../../src/features/student/StudentProgress";
import StudentNotes from "../../../src/features/student/StudentNotes";
import StudentNotifications from "../../../src/features/student/StudentNotifications";
import StudentFees from "../../../src/features/student/StudentFees";
import ParentCalendar from "../../../src/features/parent/ParentCalendar";
import ParentFees from "../../../src/features/parent/ParentFees";
import ParentAttendance from "../../../src/features/parent/ParentAttendance";
import ParentHomework from "../../../src/features/parent/ParentHomework";
import ParentLectures from "../../../src/features/parent/ParentLectures";
import ParentNotes from "../../../src/features/parent/ParentNotes";

export default function PortalSection() {
  const { role, section } = useLocalSearchParams();
  if (String(role) === "student" && String(section) === "classes") {
    return <StudentClasses />;
  }
  if (String(role) === "student" && String(section) === "calendar") {
    return <StudentCalendar />;
  }
  if (String(role) === "student" && String(section) === "lectures") {
    return <StudentLectures />;
  }
  if (String(role) === "student" && String(section) === "homework") {
    return <StudentHomework />;
  }
  if (String(role) === "student" && String(section) === "attendance") {
    return <StudentAttendance />;
  }
  if (String(role) === "student" && String(section) === "progress") {
    return <StudentProgress />;
  }
  if (String(role) === "student" && String(section) === "notes") {
    return <StudentNotes />;
  }
  if (String(role) === "student" && String(section) === "notifications") {
    return <StudentNotifications />;
  }
  if (String(role) === "student" && String(section) === "fees") {
    return <StudentFees />;
  }
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
  if (String(role) === "teacher" && String(section) === "students") {
    return <TeacherStudents />;
  }
  if (String(role) === "teacher" && String(section) === "internal-events") {
    return <TeacherInternalEvents />;
  }
  if (String(role) === "parent" && String(section) === "calendar") {
    return <ParentCalendar />;
  }
  if (String(role) === "parent" && String(section) === "fees") {
    return <ParentFees />;
  }
  if (String(role) === "parent" && String(section) === "attendance") {
    return <ParentAttendance />;
  }
  if (String(role) === "parent" && String(section) === "homework") {
    return <ParentHomework />;
  }
  if (String(role) === "parent" && String(section) === "lectures") {
    return <ParentLectures />;
  }
  if (String(role) === "parent" && String(section) === "notes") {
    return <ParentNotes />;
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
