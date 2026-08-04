/**
 * Student Notifications and Announcements.
 *
 * This screen uses the shared, user-scoped notification service so students
 * can only read and update their own alerts. Announcements remain read-only.
 * The shared presentation is configured with student-specific language while
 * preserving identical loading, retry, refresh, and session-safe behavior.
 */
import TeacherNotifications from "../teacher/TeacherNotifications";

export default function StudentNotifications() {
  return <TeacherNotifications audience="student" />;
}
