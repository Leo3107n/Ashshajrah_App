import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CoordinatorLayout({ children }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <div id="coordinator-page-portal-root" className="relative min-h-screen">{children}</div>;
}
