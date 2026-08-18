"use client";

import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  BadgeDollarSign,
  CreditCard,
  GraduationCap,
  UserRound,
  CalendarDays,
  ClipboardCheck,
  FileText,
  UserPlus,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard / Overview", href: "/coordinator/dashboard", icon: LayoutDashboard, tone: "bg-[#FAF7F0] text-[#245C4F]" },
  { label: "Interested Students", href: "/coordinator/interested-students", icon: Users, tone: "bg-[#EAF6EF] text-[#0D5C48]" },
  { label: "Registration Leads", href: "/coordinator/registration-leads", icon: UserCog, tone: "bg-[#FFF5D6] text-[#8A6B00]" },
  { label: "Payments", href: "/coordinator/payments", icon: CreditCard, tone: "bg-[#FAF7F0] text-[#245C4F]" },
  { label: "Students", href: "/coordinator/students", icon: GraduationCap, tone: "bg-[#EAF6EF] text-[#0D5C48]" },
  { label: "Parents", href: "/coordinator/parents", icon: UserRound, tone: "bg-[#FAF7F0] text-[#245C4F]" },
  { label: "Create teacher", href: "/coordinator/teacher-create", icon: UserPlus, tone: "bg-[#EAF6EF] text-[#0D5C48]" },
  { label: "Teacher Assignments", href: "/coordinator/teacher-assignments", icon: UserCog, tone: "bg-[#FFF5D6] text-[#8A6B00]" },
  { label: "Lecture Scheduler", href: "/coordinator/lecture-schedules", icon: CalendarDays, tone: "bg-[#FAF7F0] text-[#245C4F]" },
  { label: "Lecture Verification", href: "/coordinator/lecture-verifications", icon: ClipboardCheck, tone: "bg-[#EAF6EF] text-[#0D5C48]" },
  { label: "Reports", href: "/coordinator/reports", icon: FileText, tone: "bg-[#FAF7F0] text-[#245C4F]" },
];

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitials(value) {
  return String(value || "C")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavIcon({ Icon, active, tone }) {
  const className = active ? "h-[18px] w-[18px] text-[#063F32]" : `h-[18px] w-[18px] ${tone?.split(" ").slice(1).join(" ") || "text-[#245C4F]"}`;
  return <Icon className={className} strokeWidth={2} />;
}

export default function CoordinatorDashboardSidebar({ profile }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1100) setMobileOpen(false);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const shell = (
    <aside className="flex h-full w-72 flex-col overflow-hidden border-r border-[#2D8A6A]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_18px_60px_-40px_rgba(13,59,46,0.28)] backdrop-blur-xl">
      <div className="border-b border-[#2D8A6A]/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-transparent">
            <Image src="/ash-shajrah-logo.webp" alt="Ash-Shajrah Learning Hub (ALH)" width={44} height={44} className="h-full w-full object-contain" priority />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#063F32]">Coordinator Portal</p>
            <p className="truncate text-xs text-[#245C4F]">{profile?.email || "coordinator@lms.local"}</p>
          </div>
        </div>
      </div>

      <nav className="scrollbar-thin scrollbar-thumb-white/20 min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-3 py-4 overscroll-contain">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`grid min-h-[52px] grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-2xl px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] ring-1 ring-inset ring-[#E4C766]/40"
                  : "text-[#245C4F] hover:bg-[#FAF7F0] hover:text-[#063F32]"
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition ${
                  active ? "bg-[#FFF5D6] text-[#063F32]" : item.tone
                }`}
              >
                <NavIcon Icon={item.icon} active={active} tone={item.tone} />
              </span>
              <span className="min-w-0 truncate whitespace-nowrap leading-5">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#2D8A6A]/10 p-4">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
        >
          Logout
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block">{shell}</div>

      <div className="sticky top-0 z-30 border-b border-[#2D8A6A]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(250,247,240,0.96)_100%)] backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/coordinator/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-transparent">
              <Image src="/ash-shajrah-logo.webp" alt="Ash-Shajrah Learning Hub (ALH)" width={44} height={44} className="h-full w-full object-contain" priority />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#063F32]">Coordinator Portal</p>
              <p className="text-xs text-[#245C4F]">{profile?.email || "coordinator@lms.local"}</p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#245C4F] transition hover:bg-[#F1EADC]"
          >
            Menu
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-[#063F32]/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 w-[84vw] max-w-sm lg:hidden"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            >
              {shell}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
