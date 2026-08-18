import { redirect } from "next/navigation";

export default function StudentLecturesPage() {
  redirect("/student/dashboard#lectures");
}
