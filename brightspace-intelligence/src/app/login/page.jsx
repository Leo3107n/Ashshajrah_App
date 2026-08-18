"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, X } from "lucide-react";

const initialErrors = {
  identifier: "",
  password: "",
  form: "",
};

const container = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState(initialErrors);
  const [pending, setPending] = useState(false);
  const [roleOptions, setRoleOptions] = useState([]);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [rolePending, setRolePending] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");

  async function completeSignIn(selectedRole) {
    // The web selector is only a pre-session chooser. The actual NextAuth
    // session is created here, after the user picks one portal role.
    setRolePending(true);
    setSelectedRole(String(selectedRole || ""));
    setErrors(initialErrors);

    try {
      const result = await signIn("credentials", {
        identifier,
        password,
        selectedRole,
        redirect: false,
      });

      if (!result || result.error) {
        throw new Error("Invalid credentials.");
      }

      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const session = await sessionResponse.json();
      const role = String(session?.user?.role || "").toLowerCase();
      const target =
        role === "superadmin"
          ? "/superadmin/dashboard"
          : role === "admin"
            ? "/admin/dashboard"
          : role === "coordinator"
            ? "/coordinator/dashboard"
            : role === "teacher"
              ? "/teacher/dashboard"
              : role === "parent"
                ? "/parent/dashboard"
                : "/student/dashboard";

      router.replace(target);
    } catch {
      setErrors((current) => ({
        ...current,
        form: "Sign in failed. Please try again.",
      }));
      setRoleModalOpen(false);
      setRoleOptions([]);
    } finally {
      setPending(false);
      setRolePending(false);
      setSelectedRole("");
    }
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const prefillIdentifier = searchParams.get("identifier") || searchParams.get("email") || "";
    const prefillPassword = searchParams.get("password") || "";

    if (prefillIdentifier) {
      setIdentifier(prefillIdentifier);
    }

    if (prefillPassword) {
      setPassword(prefillPassword);
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = { ...initialErrors };
    if (!identifier.trim()) {
      nextErrors.identifier = "Email is required.";
    }
    if (!password.trim()) {
      nextErrors.password = "Password is required.";
    }

    if (nextErrors.identifier || nextErrors.password) {
      setErrors(nextErrors);
      return;
    }

    setPending(true);
    setErrors(initialErrors);

    try {
      // First ask the backend which roles these credentials unlock. This keeps
      // the role-picker flow aligned with mobile and avoids creating a session
      // until the user has explicitly chosen a portal when multiple roles are
      // available.
      const response = await fetch("/api/auth/role-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.user) {
        throw new Error("Invalid credentials.");
      }

      const roles = Array.isArray(payload.user.roles) ? payload.user.roles : [];

      if (roles.length > 1) {
        setRoleOptions(roles);
        setRoleModalOpen(true);
        return;
      }

      await completeSignIn(payload.user.defaultRole || roles[0] || "");
    } catch {
      setErrors((current) => ({
        ...current,
        form: "Sign in failed. Please try again.",
      }));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FAF7F0] text-[#063F32]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,138,106,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(201,162,39,0.12),_transparent_30%),radial-gradient(circle_at_center,_rgba(101,184,145,0.08),_transparent_42%)]" />
      <div className="absolute left-[-6rem] top-20 h-72 w-72 rounded-full bg-[#2D8A6A]/10 blur-3xl" />
      <div className="absolute bottom-[-5rem] right-[-4rem] h-80 w-80 rounded-full bg-[#C9A227]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="w-full max-w-6xl"
        >
          <div className="grid gap-6 rounded-[2.2rem] border border-[rgba(13,59,46,0.12)] bg-white/70 p-3 shadow-[0_24px_60px_rgba(13,59,46,0.12)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr] lg:p-4">
            <motion.div
              variants={item}
              className="relative flex min-h-[480px] flex-col justify-between overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,_#063F32_0%,_#0D5C48_45%,_#236B51_100%)] p-8 text-[#FAF7F0] sm:p-10"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.2),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(201,162,39,0.24),_transparent_28%)]" />

              <div className="relative">
                <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#F7EFCF]">
                  Ash-Shajrah Learning Hub (ALH)
                </div>
                <h1 className="mt-6 max-w-lg font-display text-4xl font-semibold leading-tight sm:text-5xl">
                  Welcome back to your academic portal
                </h1>
                <p className="mt-4 max-w-md text-base leading-7 text-[#F3EEDB]/85">
                  Continue learning with a streamlined experience for attendance, lessons, fees, and student progress.
                </p>
              </div>

              <div className="relative mt-10 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.15rem] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F7EFCF]">
                    Live updates
                  </p>
                  <p className="mt-2 text-sm text-[#F3EEDB]">
                    Stay on top of lessons, schedules, and announcements.
                  </p>
                </div>
                <div className="rounded-[1.15rem] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F7EFCF]">
                    Secure access
                  </p>
                  <p className="mt-2 text-sm text-[#F3EEDB]">
                    Sign in safely to view your dashboards and records.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={item}
              className="relative overflow-hidden rounded-[1.75rem] border border-[rgba(13,59,46,0.12)] bg-[#FCFAF5] p-6 shadow-[0_16px_40px_rgba(13,59,46,0.08)] sm:p-8"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C9A227] via-[#E4C766] to-[#2D8A6A]" />

              <div className="mb-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#0D5C48]">
                  Secure sign in
                </p>
                <h2 className="mt-3 font-display text-[1.9rem] font-semibold leading-tight text-[#063F32] sm:text-[2.1rem]">
                  Sign in to your account
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#245C4F]/80">
                  Access your dashboard, lessons, and updates in one place.
                </p>
              </div>

              {errors.form ? (
                <div
                  className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  aria-live="polite"
                >
                  {errors.form}
                </div>
              ) : null}

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label
                    htmlFor="identifier"
                    className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]"
                  >
                    Email or Phone Number
                  </label>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    className={`w-full rounded-[14px] border bg-white px-4 py-3 text-[#063F32] shadow-[inset_0_1px_2px_rgba(13,59,46,0.04)] outline-none transition placeholder:text-[#245C4F]/60 focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#2D8A6A]/10 ${
                      errors.identifier
                        ? "border-rose-300 bg-rose-50 focus:ring-rose-100"
                        : "border-[rgba(13,59,46,0.12)]"
                    }`}
                    placeholder="name@example.com or +92..."
                  />
                  {errors.identifier ? (
                    <p className="mt-2 text-sm text-rose-600">{errors.identifier}</p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={`w-full rounded-[14px] border bg-white px-4 py-3 pr-12 text-[#063F32] shadow-[inset_0_1px_2px_rgba(13,59,46,0.04)] outline-none transition placeholder:text-[#245C4F]/60 focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#2D8A6A]/10 ${
                        errors.password
                          ? "border-rose-300 bg-rose-50 focus:ring-rose-100"
                          : "border-[rgba(13,59,46,0.12)]"
                      }`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-3 flex items-center text-[#245C4F] transition hover:text-[#063F32]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="mt-2 text-sm text-rose-600">{errors.password}</p>
                  ) : null}
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={pending}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#236B51] px-4 py-3.5 text-sm font-semibold text-[#FAF7F0] shadow-[0_12px_28px_rgba(45,138,106,0.25)] transition hover:bg-[#184A38] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending ? "Signing in..." : "Sign in"}
                </motion.button>
              </form>
            </motion.div>
          </div>
        </motion.section>

        {roleModalOpen ? (
          // This modal mirrors the mobile flow: one account may map to multiple
          // portals, but one authenticated session should still open exactly
          // one selected role dashboard at a time.
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#F7F3E9]/70 px-4 backdrop-blur-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,_rgba(45,138,106,0.16),_transparent_24%),radial-gradient(circle_at_right,_rgba(201,162,39,0.12),_transparent_26%)]" />
            <div className="relative w-full max-w-[33.5rem] rounded-[2rem] border border-[rgba(13,59,46,0.12)] bg-white/94 px-6 py-6 shadow-[0_36px_80px_rgba(13,59,46,0.18)] sm:px-7 sm:py-7">
              <button
                type="button"
                onClick={() => {
                  if (rolePending) return;
                  setRoleModalOpen(false);
                  setRoleOptions([]);
                  setPending(false);
                  setSelectedRole("");
                }}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(13,59,46,0.1)] bg-[#FCFAF5] text-[#245C4F] transition hover:bg-[#F6F2E8]"
                aria-label="Close role selection"
              >
                <X className="h-4 w-4" />
              </button>

              <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#0D5C48]">
                Select your role
              </p>
              <h3 className="mt-3 max-w-[26rem] text-[1.7rem] font-semibold leading-tight text-[#063F32] sm:text-[1.85rem]">
                This account has multiple portals
              </h3>
              <p className="mt-2 text-[1rem] leading-7 text-[#245C4F]/85">
                Choose the role you want to continue with.
              </p>

              <div className="mt-6 space-y-3">
                {roleOptions.map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={rolePending}
                    onClick={() => completeSignIn(role)}
                    className="flex min-h-[3.25rem] w-full items-center justify-center rounded-[1rem] border border-[rgba(13,59,46,0.12)] bg-white px-4 py-3 text-base font-semibold capitalize text-[#245C4F] transition hover:border-[#2D8A6A] hover:bg-[#FCFAF5] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {rolePending && selectedRole === role ? "Opening..." : role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
