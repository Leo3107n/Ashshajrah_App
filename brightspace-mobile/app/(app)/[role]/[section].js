/** Dynamic fallback that describes supported role sections safely. */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import api from "../../../src/api";
import { useAuth } from "../../../src/context/AuthContext";
import { sectionTitle } from "../../../src/navigation/roleNavigation";
import { colors, space } from "../../../src/theme";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../../src/components/ui";
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
import MonthlyPlans from "../../../src/features/shared/MonthlyPlans";
import ParentCalendar from "../../../src/features/parent/ParentCalendar";
import ParentFees from "../../../src/features/parent/ParentFees";
import ParentAttendance from "../../../src/features/parent/ParentAttendance";
import ParentHomework from "../../../src/features/parent/ParentHomework";
import ParentLectures from "../../../src/features/parent/ParentLectures";
import ParentNotes from "../../../src/features/parent/ParentNotes";

export default function PortalSection() {
  const { role, section } = useLocalSearchParams();
  if (String(role) === "student" && String(section) === "classes") {
    return <StudentAccessGate section="classes"><StudentClasses /></StudentAccessGate>;
  }
  if (String(role) === "student" && String(section) === "calendar") {
    return <StudentAccessGate section="calendar"><StudentCalendar /></StudentAccessGate>;
  }
  if (String(role) === "student" && String(section) === "lectures") {
    return <StudentAccessGate section="lectures"><StudentLectures /></StudentAccessGate>;
  }
  if (String(role) === "student" && String(section) === "homework") {
    return <StudentAccessGate section="homework"><StudentHomework /></StudentAccessGate>;
  }
  if (String(role) === "student" && String(section) === "attendance") {
    return <StudentAccessGate section="attendance"><StudentAttendance /></StudentAccessGate>;
  }
  if (String(role) === "student" && String(section) === "progress") {
    return <StudentAccessGate section="progress"><StudentProgress /></StudentAccessGate>;
  }
  if (String(role) === "student" && String(section) === "notes") {
    return <StudentAccessGate section="notes"><StudentNotes /></StudentAccessGate>;
  }
  if (String(role) === "student" && String(section) === "notifications") {
    return <StudentAccessGate section="notifications"><StudentNotifications /></StudentAccessGate>;
  }
  if (String(role) === "student" && String(section) === "monthly-plans") {
    return <StudentAccessGate section="monthly-plans"><MonthlyPlans audience="student" /></StudentAccessGate>;
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
  if (String(role) === "parent" && String(section) === "monthly-plans") {
    return <MonthlyPlans audience="parent" />;
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

function feeDueLabel(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function StudentAccessGate({ children, section }) {
  const router = useRouter();
  const { isAuthenticating, logout } = useAuth();
  const [status, setStatus] = useState({ loading: true, locked: false, message: "" });

  useEffect(() => {
    let mounted = true;
    api.payment.monthlyFeeStatus()
      .then((result) => {
        if (!mounted) return;
        if (!result?.overdue) {
          setStatus({ loading: false, locked: false, message: "" });
          return;
        }
        const dueLabel = feeDueLabel(result.due_date);
        setStatus({
          loading: false,
          locked: true,
          message: dueLabel
            ? `Fee Deadline was ${dueLabel}. This student section is locked until payment is cleared.`
            : "Fee Deadline is missed. This student section is locked until payment is cleared.",
        });
      })
      .catch(() => {
        if (mounted) setStatus({ loading: false, locked: false, message: "" });
      });

    return () => {
      mounted = false;
    };
  }, [section]);

  if (status.loading) return <DashboardSkeleton message="Checking fee access..." />;
  if (!status.locked) return children;

  return (
    <Screen contentContainerStyle={styles.content}>
      <SurfaceCard style={styles.lockCard}>
        <View style={styles.icon}>
          <Ionicons color={colors.error} name="lock-closed-outline" size={26} />
        </View>
        <AppText variant="heading">Student portal locked</AppText>
        <AppText style={styles.body}>{status.message}</AppText>
        <PillButton
          icon={<Ionicons color={colors.white} name="wallet-outline" size={18} />}
          onPress={() => router.push("/(app)/student/fees")}
          style={styles.lockButton}
        >
          View Fees
        </PillButton>
        <PillButton
          icon={<Ionicons color={colors.white} name="log-out-outline" size={18} />}
          loading={isAuthenticating}
          onPress={logout}
          style={styles.lockButton}
        >
          Log Out
        </PillButton>
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.xl },
  card: { alignItems: "flex-start" },
  lockCard: { alignItems: "flex-start", borderWidth: 1, borderColor: colors.error, backgroundColor: colors.errorContainer },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginBottom: space.md, borderRadius: 24, backgroundColor: colors.goldPale },
  body: { marginTop: space.sm, color: colors.onSurfaceVariant },
  lockButton: { marginTop: space.lg },
});
