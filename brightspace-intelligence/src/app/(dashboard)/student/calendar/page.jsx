import { redirect } from "next/navigation";

export default function StudentCalendarPage() {
  redirect("/student/dashboard#calendar");
}
