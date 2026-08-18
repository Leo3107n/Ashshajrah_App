"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePathname } from "next/navigation";

const ROLE_STYLES = {
  admin: "bg-[#FAF7F0] text-[#063F32]",
  coordinator: "bg-[#FFF5D6] text-[#8A6B00]",
  teacher: "bg-[#F1EADC] text-[#245C4F]",
  parent: "bg-[#FAF7F0] text-[#0D5C48]",
  student: "bg-[#EAF6EF] text-[#0D5C48]",
};

const STATUS_STYLES = {
  active: "bg-[#EAF6EF] text-[#0D5C48]",
  suspended: "bg-rose-50 text-rose-700",
  inactive: "bg-[#F1EADC] text-[#245C4F]",
};

function formatLabel(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "Unknown";
}

export default function UserTable({ users }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const isAdminReadonlyPortal = pathname.startsWith("/admin") && !pathname.startsWith("/superadmin");
  const [pendingId, setPendingId] = useState("");

  async function updateStatus(userId, status) {
    setPendingId(`${userId}:${status}`);

    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Status update failed.");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Status update failed.");
    } finally {
      setPendingId("");
    }
  }

  async function resetPassword(userId) {
    const customPassword = window.prompt("Enter a new password. Leave blank to generate a temporary one.");
    if (customPassword === null) return;

    setPendingId(`${userId}:password`);
    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: customPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Password reset failed.");
      window.alert(`Password reset successful. Temporary password: ${data.temporaryPassword}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setPendingId("");
    }
  }

  if (!users.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-white/85 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
        No users match the current filters.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="hidden overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className="bg-[#FAF7F0]/90">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                {!isAdminReadonlyPortal ? <th className="px-6 py-4">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {users.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.02 }}
                >
                  <td className="px-6 py-5">
                    <p className="font-semibold text-[#063F32]">{user.name}</p>
                    <p className="mt-1 text-sm text-[#245C4F]">{user.email || "No email"}</p>
                    <p className="mt-1 text-sm text-[#245C4F]">{user.phone || "No phone"}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ROLE_STYLES[user.role] || "bg-[#FAF7F0] text-[#063F32]"}`}>
                      {formatLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[user.status] || "bg-[#FAF7F0] text-[#063F32]"}`}>
                      {formatLabel(user.status)}
                    </span>
                  </td>
                  {!isAdminReadonlyPortal ? (
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-2">
                        {user.status === "active" ? (
                          <button
                            type="button"
                            disabled={pendingId === `${user.id}:suspended`}
                            onClick={() => updateStatus(user.id, "suspended")}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pendingId === `${user.id}:active`}
                            onClick={() => updateStatus(user.id, "active")}
                            className="rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7] disabled:opacity-60"
                          >
                            Activate
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={pendingId === `${user.id}:password`}
                          onClick={() => resetPassword(user.id)}
                          className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-60"
                        >
                          Reset password
                        </button>
                      </div>
                    </td>
                  ) : null}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:hidden">
        {users.map((user, index) => (
          <motion.article
            key={user.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: index * 0.02 }}
            className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[#063F32]">{user.name}</p>
                <p className="mt-1 text-sm text-[#245C4F]">{user.email || "No email"}</p>
                <p className="mt-1 text-sm text-[#245C4F]">{user.phone || "No phone"}</p>
              </div>
              <div className="flex gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ROLE_STYLES[user.role] || "bg-[#FAF7F0] text-[#063F32]"}`}>
                  {formatLabel(user.role)}
                </span>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[user.status] || "bg-[#FAF7F0] text-[#063F32]"}`}>
                  {formatLabel(user.status)}
                </span>
              </div>
            </div>

              {!isAdminReadonlyPortal ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {user.status === "active" ? (
                <button
                  type="button"
                  disabled={pendingId === `${user.id}:suspended`}
                  onClick={() => updateStatus(user.id, "suspended")}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  Suspend
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pendingId === `${user.id}:active`}
                  onClick={() => updateStatus(user.id, "active")}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7] disabled:opacity-60"
                >
                  Activate
                </button>
              )}

              <button
                type="button"
                disabled={pendingId === `${user.id}:password`}
                onClick={() => resetPassword(user.id)}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-60"
              >
                Reset password
              </button>
            </div>
              ) : null}
          </motion.article>
        ))}
      </div>
    </section>
  );
}
