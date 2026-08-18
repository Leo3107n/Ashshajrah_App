import { redirect } from "next/navigation";

export default function StudentAttendancePage() {
  redirect("/student/dashboard#attendance");
}
