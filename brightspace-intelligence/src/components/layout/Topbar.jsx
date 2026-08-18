"use client";

function getRoleLabel(role) {
  const value = String(role || "").toLowerCase();
  if (value === "superadmin") return "Super Admin";
  if (value === "admin") return "Admin";
  if (value === "coordinator") return "Coordinator";
  if (value === "teacher") return "Teacher";
  if (value === "parent") return "Parent";
  if (value === "student") return "Student";
  return value ? value[0].toUpperCase() + value.slice(1) : "User";
}

function getInitials(value) {
  return String(value || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function Topbar({ session, onMenuClick, onToggleCollapsed, collapsed }) {
  const userName =
  session?.user?.full_name ||
  session?.user?.name ||
  session?.user?.username ||
  session?.user?.email ||
  "User";
  const role = getRoleLabel(session?.user?.dbRole || session?.user?.role);

  return (
    <header
      className={`fixed right-0 top-0 z-20 border-b border-white/10 bg-[linear-gradient(180deg,rgba(250,247,240,0.92)_0%,rgba(255,255,255,0.84)_100%)] backdrop-blur-xl shadow-[0_10px_30px_rgba(6,63,50,0.08)] ${
        collapsed ? "lg:left-20" : "lg:left-72"
      } left-0`}
    >
      <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(13,59,46,0.12)] bg-white/90 text-[#063F32] shadow-sm transition hover:bg-[#FAF7F0] lg:hidden"
            aria-label="Open navigation menu"
          >
            <span className="flex h-4 w-4 flex-col justify-between">
              <span className="h-0.5 w-full rounded-full bg-current" />
              <span className="h-0.5 w-full rounded-full bg-current" />
              <span className="h-0.5 w-full rounded-full bg-current" />
            </span>
          </button>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#0D5C48]">
              Dashboard
            </p>
            <h1 className="font-body text-lg font-semibold text-[#063F32] sm:text-xl">
              Welcome back, {userName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 rounded-full border border-[rgba(13,59,46,0.12)] bg-white/80 px-4 py-2 shadow-[0_8px_24px_rgba(13,59,46,0.06)] lg:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#063F32] text-xs font-semibold text-[#FAF7F0]">
              {getInitials(userName)}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-[#063F32]">{session?.user?.email}</p>
              <p className="text-xs text-[#245C4F]">{role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
