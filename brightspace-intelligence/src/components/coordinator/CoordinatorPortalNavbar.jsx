"use client";

import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "interested-students", label: "Interested Students" },
  { id: "registration-leads", label: "Registration Leads" },
  { id: "payments", label: "Payments" },
  { id: "students", label: "Students" },
  { id: "parents", label: "Parents" },
  { id: "teacher-assignments", label: "Teacher Assignments" },
  { id: "lecture-scheduler", label: "Lecture Scheduler" },
  { id: "lecture-verification", label: "Lecture Verification" },
  { id: "reports", label: "Reports" },
];

export default function CoordinatorPortalNavbar({ profile = {} }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [activeId, setActiveId] = useState("dashboard");
  const ids = useMemo(() => NAV_ITEMS.map((item) => item.id), []);

  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);

    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveId(visible.target.id);

        const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
        if (nearBottom) setActiveId("reports");
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.12, 0.25, 0.5, 0.75] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1100) {
        setMenuOpen(false);
        setNavExpanded(false);
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleScroll() {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 8) {
        setActiveId("reports");
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    setMenuOpen(false);
  }

  return (
    <div className="sticky top-0 z-30 border-b border-[#2D8A6A]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(250,247,240,0.96)_100%)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => scrollToSection("dashboard")} className="flex min-w-0 items-center gap-3 text-left">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-transparent">
              <img src="/ash-shajrah-logo.webp" alt="Ash-Shajrah Learning Hub (ALH)" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#063F32]">Coordinator Portal</p>
              <p className="text-xs text-[#245C4F]">{profile?.email || "coordinator@lms.local"}</p>
            </div>
          </button>
          <div className="hidden min-[1100px]:flex min-[1100px]:flex-1 min-[1100px]:items-center min-[1100px]:justify-center min-[1100px]:gap-2">
            {NAV_ITEMS.slice(0, 4).map((item) => {
              const active = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow" : "bg-[#FAF7F0] text-[#245C4F] hover:bg-[#F1EADC]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNavExpanded((current) => !current)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  NAV_ITEMS.slice(4).some((item) => item.id === activeId)
                    ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow"
                    : "bg-[#FAF7F0] text-[#245C4F] hover:bg-[#F1EADC]"
                }`}
              >
                More
                <span aria-hidden="true">{navExpanded ? "▴" : "▾"}</span>
              </button>

              {navExpanded ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-64 rounded-3xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] p-2 shadow-xl">
                  {NAV_ITEMS.slice(4).map((item) => {
                    const active = activeId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          scrollToSection(item.id);
                          setNavExpanded(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                          active ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32]" : "bg-[#FAF7F0] text-[#245C4F] hover:bg-[#F1EADC]"
                        }`}
                      >
                        <span>{item.label}</span>
                        {active ? <span className="text-xs">Active</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="hidden items-center gap-3 min-[1100px]:flex">
            <div className="text-right">
              <p className="text-sm font-semibold text-[#063F32]">{profile?.full_name || profile?.name || "Coordinator"}</p>
              <p className="text-xs text-[#245C4F]">{profile?.email || profile?.role || "Operations"}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-2 text-sm font-semibold text-[#FAF7F0] shadow transition hover:bg-[#063F32]"
            >
              Logout
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#245C4F] transition hover:border-[#C9A227]/40 hover:bg-[#FFF5D6] min-[1100px]:hidden"
          >
            Menu
          </button>
        </div>

        {menuOpen ? (
          <div className="mt-3 grid gap-2 rounded-3xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-lg min-[1100px]:hidden">
            <div className="rounded-2xl bg-[#FAF7F0] p-3 sm:hidden">
              <p className="text-sm font-semibold text-[#063F32]">{profile?.full_name || profile?.name || "Coordinator"}</p>
              <p className="text-xs text-[#245C4F]">{profile?.email || "coordinator@lms.local"}</p>
            </div>
            {NAV_ITEMS.map((item) => {
              const active = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32]" : "bg-[#FAF7F0] text-[#245C4F] hover:bg-[#F1EADC]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="mt-2 rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-left text-sm font-semibold text-[#245C4F] transition hover:border-[#C9A227]/40 hover:bg-[#FFF5D6]"
            >
              Back to top
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-2xl bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-3 text-left text-sm font-semibold text-[#FAF7F0] shadow transition hover:bg-[#063F32] sm:hidden"
            >
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
