"use client";

import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getNavigationForRole } from "@/config/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  ReceiptText,
  CreditCard,
  GraduationCap,
  UserRound,
  CalendarDays,
  ClipboardCheck,
  FileText,
  BookOpen,
  NotebookPen,
  MessageSquareText,
  User,
  CalendarRange,
  Home,
  Activity,
  School,
  ShieldCheck,
  BookText,
  Layers3,
  PanelTop,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  Wallet,
  ChevronDown,
  UserPlus,
  BadgePercent,
} from "lucide-react";

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getIconForLabel(label) {
  const key = String(label || "").toLowerCase();
  if (key.includes("dashboard")) return LayoutDashboard;
  if (key.includes("staff")) return UserCog;
  if (key.includes("teacher create") || key.includes("create teacher")) return UserPlus;
  if (key.includes("interested students")) return Users;
  if (key.includes("admission records") || key.includes("registration")) return ClipboardList;
  if (key.includes("fee management")) return Wallet;
  if (key.includes("fee vouchers") || key.includes("fees")) return ReceiptText;
  if (key.includes("scholarship")) return BadgePercent;
  if (key.includes("payments")) return CreditCard;
  if (key.includes("student")) return GraduationCap;
  if (key.includes("parent")) return UserRound;
  if (key.includes("teacher assignments")) return UserCog;
  if (key.includes("class schedul")) return CalendarDays;
  if (key.includes("internal events")) return CalendarRange;
  if (key.includes("lecture schedule")) return CalendarDays;
  if (key.includes("lecture verification")) return ClipboardCheck;
  if (key.includes("reports")) return FileText;
  if (key.includes("lectures")) return BookOpen;
  if (key.includes("notes")) return MessageSquareText;
  if (key.includes("homework")) return NotebookPen;
  if (key.includes("calendar")) return CalendarRange;
  if (key.includes("attendance")) return Activity;
  if (key.includes("profile")) return User;
  if (key === "admin") return ShieldCheck;
  if (key.includes("class management")) return School;
  if (key.includes("subject")) return BookText;
  if (key.includes("headline")) return PanelTop;
  if (key.includes("audit")) return ShieldCheck;
  if (key.includes("career")) return FileText;
  if (key.includes("timeline")) return Layers3;
  if (key.includes("overview")) return PanelTop;
  return Home;
}

export default function Sidebar({
  session,
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapsed,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = String(session?.user?.role || "student").toLowerCase();
  const roleLabel = String(session?.user?.dbRole || session?.user?.role || "student")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/^Superadmin$/, "Super Admin")
    .replace(/^Admin$/, "Admin");
  const items = getNavigationForRole(role);
  const userManagementPathPrefix = role === "superadmin" ? "/superadmin/users" : "/admin/users";
  const [openGroups, setOpenGroups] = useState({
    userManagement: pathname.startsWith(userManagementPathPrefix),
  });

  const adminView = String(searchParams.get("view") || "").toLowerCase();
  const isUserManagementActive =
    pathname.startsWith(userManagementPathPrefix) || openGroups.userManagement;

  useEffect(() => {
    const currentUserManagementPathPrefix =
      role === "superadmin" ? "/superadmin/users" : "/admin/users";

    if (!pathname.startsWith(currentUserManagementPathPrefix)) {
      setOpenGroups((current) =>
        current.userManagement ? { ...current, userManagement: false } : current
      );
    }
  }, [pathname]);

  const shell = (
    <aside
      className={`flex h-full w-72 flex-col overflow-hidden border-r border-[#2D8A6A]/15 bg-[linear-gradient(180deg,#0D3B2E_0%,#063F32_100%)] shadow-[0_18px_60px_-40px_rgba(13,59,46,0.18)] backdrop-blur-xl transition-[width] duration-200 ${collapsed ? "lg:w-20" : "lg:w-72"
        }`}
    >
      <div
        className={`relative flex items-center gap-3 border-b border-white/10 px-5 py-4 ${collapsed ? "lg:justify-center" : ""
          }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 transition-all duration-200 ${collapsed
                ? "lg:pointer-events-none bg-[linear-gradient(180deg,#0D3B2E_0%,#063F32_100%)]"
                : "flex"
              }`}
          >
            <Image
              src="/ash-shajrah-logo.webp"
              alt="Ash-Shajrah Learning Hub (ALH)"
              width={44}
              height={44}
              className={`h-full w-full object-contain ${collapsed?  "hidden":"flex"}`}
              priority
            />
          </div>
          <div
            className={`min-w-0 transition-all duration-200 ${collapsed
                ? "lg:hidden lg:max-w-0 lg:overflow-hidden lg:opacity-0 lg:pointer-events-none"
                : "lg:max-w-full opacity-100"
              }`}
          >
            <p className="truncate text-sm font-semibold text-[#FAF7F0]">Learning Platform</p>
            <p className="truncate text-xs text-[#F1EADC]/60">{roleLabel}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#FAF7F0] transition lg:inline-flex ${collapsed
              ? "lg:absolute lg:left-1/2 lg:top-1/2 lg:z-10 lg:-translate-x-1/2 lg:-translate-y-1/2 bg-[rgb(255,245,214)] transition-all ease-in-out duration-200 hover:scale-110"
              : "lg:absolute lg:right-4 lg:top-1/2 lg:-translate-y-1/2 bg-white/10 hover:bg-white/15"
            }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 text-[#063F32]" strokeWidth={2.25} />
          ) : (
            <PanelLeftClose className="h-4 w-4 text-white" strokeWidth={2.25} />
          )}
        </button>
      </div>

      <nav
        className="scrollbar-thin scrollbar-thumb-white/20 min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-3 py-4 overscroll-contain"
      >
        {items.map((item) => {
          if (item.label === "User Management" && Array.isArray(item.children)) {
            return (
              <div key={item.label} className="space-y-2 overflow-hidden rounded-2xl bg-white/5 p-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      userManagement: !current.userManagement,
                    }))
                  }
                  className={`grid min-h-[52px] text-left w-full grid-cols-[40px_minmax(0,1fr)_24px] items-center gap-3 rounded-[18px] px-3 py-1.5 text-sm font-medium transition overflow-hidden ${isUserManagementActive
                      ? "bg-[linear-gradient(135deg,#C9A227_0%,#E4C766_100%)] text-[#063F32] shadow-[0_10px_24px_rgba(201,162,39,0.22)]"
                      : "text-[#F1EADC]/75 hover:bg-white/10 hover:text-[#FAF7F0]"
                    } ${collapsed ? "lg:grid-cols-[40px_0px_0px] lg:gap-0 lg:px-2 lg:place-content-center" : ""}`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition ${isUserManagementActive
                        ? "bg-[#FFF5D6] text-[#063F32]"
                        : "bg-white/10 text-[#FAF7F0]"
                      }`}
                  >
                    <Users className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <span
                    className={`min-w-0 truncate whitespace-nowrap leading-5 transition-opacity duration-150 ${collapsed
                        ? "lg:pointer-events-none lg:w-0 lg:overflow-hidden lg:opacity-0"
                        : "lg:max-w-full opacity-100"
                      }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-[#FAF7F0] transition-transform duration-200 ${openGroups.userManagement ? "rotate-180" : ""} ${collapsed ? "lg:hidden" : ""}`}
                  >
                    <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                </button>

                {openGroups.userManagement ? (
                  <div className="space-y-1 overflow-hidden">
                    {item.children.map((child) => {
                      const childHref = child.href.split("?")[0];
                      const childView = new URLSearchParams(child.href.split("?")[1] || "").get("view");
                      const active =
                        pathname === childHref &&
                        (adminView ? adminView === childView : true);
                      const ChildIcon = getIconForLabel(child.label);

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={active ? "page" : undefined}
                          className={`grid min-h-[46px] grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-[18px] px-3 py-1.5 text-sm font-medium transition overflow-hidden ${active
                              ? "bg-[linear-gradient(135deg,#C9A227_0%,#E4C766_100%)] text-[#063F32] shadow-[0_10px_24px_rgba(201,162,39,0.22)]"
                              : "text-[#F1EADC]/75 hover:bg-white/10 hover:text-[#FAF7F0]"
                            } ${collapsed ? "lg:grid-cols-[40px_0px] lg:gap-0 lg:px-2 lg:place-content-center" : ""}`}
                          onClick={onMobileClose}
                        >
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${active
                                  ? "bg-[#FFF5D6] text-[#063F32]"
                                  : "bg-white/10 text-[#FAF7F0]"
                                }`}
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
                          </span>
                          <span className="min-w-0 truncate whitespace-nowrap leading-5">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }

          const active = isActive(pathname, item.href);
          const Icon = getIconForLabel(item.label);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group grid min-h-[52px] border-box grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-[18px] px-3 py-1.5 text-sm font-medium transition overflow-hidden ${active
                  ? "bg-[linear-gradient(135deg,#C9A227_0%,#E4C766_100%)] text-[#063F32] shadow-[0_10px_24px_rgba(201,162,39,0.22)]"
                  : "text-[#F1EADC]/75 hover:bg-white/10 hover:text-[#FAF7F0]"
                } ${collapsed ? "lg:grid-cols-[40px_0px] lg:gap-0 lg:px-2 lg:place-content-center" : ""}`}
              onClick={onMobileClose}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[11px] font-semibold transition ${active ? "bg-[#FFF5D6] text-[#063F32]" : "bg-white/10 text-[#FAF7F0] group-hover:bg-white/15"
                  }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
              </span>
              <span
                className={`min-w-0 truncate whitespace-nowrap leading-5 transition-opacity duration-150 ${collapsed ? "lg:pointer-events-none lg:w-0 lg:overflow-hidden lg:opacity-0" : "opacity-100"
                  }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/login" })}
          className={`flex w-full items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#0D5C48_0%,#2D8A6A_55%,#C9A227_160%)] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_12px_28px_rgba(201,162,39,0.16)] transition hover:brightness-110 ${collapsed ? "lg:px-2" : ""
            }`}
        >
          <span
            className={`hidden h-9 w-9 items-center justify-center rounded-xl bg-[#FFF5D6] text-base font-semibold text-[#063F32] ${collapsed ? "lg:flex" : "lg:hidden"
              }`}
          >
            ↩
          </span>
          <span className={`transition-all duration-200 ${collapsed ? "lg:hidden" : "lg:inline"}`}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block">{shell}</div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-[#063F32]/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
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
