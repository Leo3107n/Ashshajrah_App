import { redirect } from "next/navigation";

export default function StudentTimelinePage() {
  redirect("/student/dashboard#attendance");
}
