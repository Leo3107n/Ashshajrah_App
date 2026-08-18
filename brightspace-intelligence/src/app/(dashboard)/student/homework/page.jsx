import { redirect } from "next/navigation";

export default function StudentHomeworkPage() {
  redirect("/student/dashboard#homework");
}
