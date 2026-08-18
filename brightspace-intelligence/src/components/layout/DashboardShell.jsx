"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { DashboardSessionProvider } from "@/components/layout/DashboardSessionContext";

export default function DashboardShell({ session, children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const role = String(session?.user?.role || "").toLowerCase();
  const isStudent = role === "student";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <DashboardSessionProvider session={session}>
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
        {!isStudent ? (
          <>
            <Sidebar
              session={session}
              mobileOpen={mobileOpen}
              onMobileClose={() => setMobileOpen(false)}
              collapsed={collapsed}
              onToggleCollapsed={() => setCollapsed((value) => !value)}
            />

            <Topbar
              session={session}
              onMenuClick={() => setMobileOpen(true)}
              onToggleCollapsed={() => setCollapsed((value) => !value)}
              collapsed={collapsed}
            />
          </>
        ) : null}

        <main className={`transition-[padding] duration-200 ${isStudent ? "pt-0" : `pt-20 ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}`}>
          <div className="px-0 pb-0 sm:px-0 lg:px-0">
            {isStudent ? children : (
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="rounded-[2rem] border border-black/10 bg-white/85 p-0 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-0"
              >
                {children ?? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-semibold text-slate-950">Ready for role content</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        This shell is in place for authenticated dashboards. Add business modules under each role route when ready.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-semibold text-slate-950">Navigation scaffold</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Sidebar and topbar are responsive, role-aware, and ready to host future pages.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-semibold text-slate-950">Session protected</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Unauthenticated users are redirected to the login screen before they reach this layout.
                      </p>
                    </div>
                  </div>
                )}
              </motion.section>
            )}
          </div>
        </main>
      </div>
    </DashboardSessionProvider>
  );
}
