"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";
import StaffFormModal from "@/components/admin/StaffFormModal";
import { LeafSpinnerInline, OpenBookLoader } from "@/components/shared/AshShajrahLoaders";
import { useDashboardSession } from "@/components/layout/DashboardSessionContext";

const ROLE_OPTIONS = ["", "superadmin", "admin", "coordinator", "teacher", "parent", "student"];
const STAFF_ROLE_OPTIONS = ["", "superadmin", "admin", "coordinator", "teacher"];
const CACHE_TTL = 60 * 1000;
const DEFAULT_FILTERS = {
  search: "",
  role: "",
  status: "",
  classLevel: "",
};

function formatLabel(value) {
  const text = String(value || "");
  return text
    ? text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
}

function DetailBlock({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_14px_40px_-28px_rgba(13,59,46,0.18)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#063F32]">{value || "Not provided"}</p>
    </div>
  );
}

function getCacheKey(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.classLevel) params.set("class_level", filters.classLevel);
  return `admin-users:${params.toString()}`;
}

function getOverviewCacheKey(view) {
  return `admin-users:overview:${view}`;
}

function getStatusOptions(view) {
  if (view === "students" || view === "parents") {
    return ["", "active", "archived"];
  }

  return ["", "active", "suspended"];
}

function readCache(key) {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(key);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

function writeCache(key, payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

function dedupeUsersById(items = []) {
  const seen = new Map();

  for (const item of items) {
    const key = String(item?.id || "");
    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values());
}

export default function AdminUsersPage() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const session = useDashboardSession();
  const searchParams = useSearchParams();
  const view = String(searchParams.get("view") || "staff").toLowerCase();
  const rolePreset =
    view === "students"
      ? "student"
      : view === "parents"
        ? "parent"
        : "";
  const isStaffView = view === "staff";
  const isAdminReadonlyPortal = pathname.startsWith("/admin") && !pathname.startsWith("/superadmin");
  const isSuperAdminPortal = pathname.startsWith("/superadmin");
  const currentUserId = String(session?.user?.id || "");
  const [filters, setFilters] = useState({
    search: "",
    role: rolePreset,
    status: "",
    classLevel: "",
  });
  const [state, setState] = useState({
    loading: true,
    overviewLoading: true,
    error: "",
    items: [],
    allStaffItems: [],
    overviewItems: [],
    summary: null,
  });
  const [modal, setModal] = useState({ open: false, record: null });
  const [detailModal, setDetailModal] = useState({ open: false, record: null });
  const [resetModal, setResetModal] = useState({
    open: false,
    record: null,
    password: "",
    pending: false,
    error: "",
  });
  const [resetSuccess, setResetSuccess] = useState({
    open: false,
    password: "",
    userName: "",
  });
  const [confirmState, setConfirmState] = useState({
    open: false,
    record: null,
    action: "",
    status: "",
    pending: false,
  });
  const [roleOpen, setRoleOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const loadTableRequestRef = useRef(0);
  const loadOverviewRequestRef = useRef(0);

  function closeSelectState(setter) {
    window.setTimeout(() => setter(false), 0);
  }

  useEffect(() => {
    setFilters((current) => ({
      ...DEFAULT_FILTERS,
      search: current.search,
      role: rolePreset,
    }));
  }, [rolePreset, view]);

  const loadOverview = useCallback(async (options = {}) => {
    const requestId = ++loadOverviewRequestRef.current;
    const force = options.force === true || view === "parents";
    const cacheKey = getOverviewCacheKey(view);

    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        setState((current) => ({
          ...current,
          overviewLoading: false,
          overviewItems: cached.items || [],
          allStaffItems: view === "staff" ? cached.items || [] : current.allStaffItems,
          summary: cached.summary || null,
        }));
        return cached;
      }
    }

    setState((current) => ({ ...current, overviewLoading: true }));

    try {
      const params = new URLSearchParams();

      if (view === "students") {
        params.set("role", "student");
      } else if (view === "parents") {
        params.set("role", "parent");
      }

      if (view === "staff") {
        const rolesToLoad = ["superadmin", "admin", "coordinator", "teacher"];
        const responses = await Promise.all(
          rolesToLoad.map((roleValue) => fetch(`/api/admin/users?role=${roleValue}`, { cache: "no-store" }))
        );
        const payloads = await Promise.all(responses.map((response) => response.json()));
        const failed = responses.find((response) => !response.ok);

        if (failed) {
          const failPayload = payloads.find((payload, index) => !responses[index].ok);
          throw new Error(failPayload?.message || "Unable to load users.");
        }

        const items = dedupeUsersById(payloads.flatMap((payload) => payload.items || []));
        const staffRoles = new Set(["superadmin", "admin", "coordinator", "teacher"]);
        const staffOnlyItems = items.filter((item) =>
          staffRoles.has(String(item.role || "").toLowerCase())
        );
        const summary = {
          total: staffOnlyItems.length,
          active: staffOnlyItems.filter((item) => item.status === "active").length,
          suspended: staffOnlyItems.filter((item) => item.status === "suspended").length,
          archived: staffOnlyItems.filter((item) => item.status === "archived").length,
        };

        const payload = { items: staffOnlyItems, summary };
        writeCache(cacheKey, payload);
        if (requestId !== loadOverviewRequestRef.current) {
          return payload;
        }
        setState((current) => ({
          ...current,
          overviewLoading: false,
          overviewItems: staffOnlyItems,
          allStaffItems: staffOnlyItems,
          summary,
        }));
        return payload;
      }

      const response = await fetch(
        `/api/admin/users${params.toString() ? `?${params.toString()}` : ""}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load users.");
      }

      writeCache(cacheKey, data);
      if (requestId !== loadOverviewRequestRef.current) {
        return data;
      }
      setState((current) => ({
        ...current,
        overviewLoading: false,
        overviewItems: data.items || [],
        allStaffItems: view === "staff" ? data.items || [] : current.allStaffItems,
        summary: data.summary || null,
      }));
      return data;
    } catch (error) {
      if (requestId !== loadOverviewRequestRef.current) {
        return null;
      }
      setState((current) => ({
        ...current,
        overviewLoading: false,
        error: error instanceof Error ? error.message : "Unable to load users.",
      }));
      return null;
    }
  }, [view]);

  const loadTable = useCallback(async (options = {}) => {
    const requestId = ++loadTableRequestRef.current;
    const force = options.force === true || view === "parents";
    const cacheKey = getCacheKey(filters);
    setState((current) => ({ ...current, loading: true, error: "" }));

    if (isStaffView && !force && Array.isArray(state.allStaffItems) && state.allStaffItems.length) {
      const searchTerm = String(filters.search || "").trim().toLowerCase();
      const selectedRole = String(filters.role || "").toLowerCase();
      const selectedStatus = String(filters.status || "").toLowerCase();

      let items = state.allStaffItems;

      if (selectedRole) {
        items = items.filter((item) => String(item.role || "").toLowerCase() === selectedRole);
      }

      if (selectedStatus) {
        items = items.filter((item) => String(item.status || "").toLowerCase() === selectedStatus);
      }

      if (searchTerm) {
        items = items.filter((item) => {
          const haystack = [
            item.name,
            item.full_name,
            item.username,
            item.email,
            item.phone,
          ]
            .map((value) => String(value || "").toLowerCase())
            .join(" ");
          return haystack.includes(searchTerm);
        });
      }

      setState((current) => ({
        ...current,
        loading: false,
        error: "",
        items,
      }));
      return;
    }

    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        setState((current) => ({
          ...current,
          loading: false,
          error: "",
          items: cached.items || [],
          allStaffItems: isStaffView ? cached.items || [] : current.allStaffItems,
        }));
        return;
      }
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.role) params.set("role", filters.role);
      if (filters.status) params.set("status", filters.status);
      if (filters.classLevel) params.set("class_level", filters.classLevel);

      let items = [];
      let data = { items: [] };

      if (isStaffView) {
        const rolesToLoad =
          filters.role === "superadmin"
            ? ["superadmin"]
            : filters.role === "admin"
              ? ["admin"]
            : filters.role === "coordinator" || filters.role === "teacher"
              ? [filters.role]
              : ["superadmin", "admin", "coordinator", "teacher"];

        const responses = await Promise.all(
          rolesToLoad.map((roleValue) => {
            const roleParams = new URLSearchParams();
            roleParams.set("role", roleValue);
            if (filters.status) roleParams.set("status", filters.status);
            if (filters.classLevel) roleParams.set("class_level", filters.classLevel);
            return fetch(`/api/admin/users?${roleParams.toString()}`, { cache: "no-store" });
          })
        );

        const payloads = await Promise.all(responses.map((response) => response.json()));
        const failed = responses.find((response) => !response.ok);
        if (failed) {
          const failPayload = payloads.find((payload, index) => !responses[index].ok);
          throw new Error(failPayload?.message || "Unable to load users.");
        }

        const tableItems = dedupeUsersById(payloads.flatMap((payload) => payload.items || []));
        const staffRoles = new Set(["superadmin", "admin", "coordinator", "teacher"]);
        const staffOnlyItems = tableItems.filter((item) =>
          staffRoles.has(String(item.role || "").toLowerCase())
        );
        items = staffOnlyItems;
        data = { items };
      } else {
        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: "no-store",
        });
        data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load users.");
        }

        items = data.items || [];
      }

      writeCache(cacheKey, { items });
      if (requestId !== loadTableRequestRef.current) {
        return;
      }
      setState((current) => ({
        ...current,
        loading: false,
        error: "",
        items,
        allStaffItems: isStaffView ? items : current.allStaffItems,
      }));
    } catch (error) {
      if (requestId !== loadTableRequestRef.current) {
        return;
      }
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load users.",
        items: [],
        allStaffItems: [],
      }));
    }
  }, [filters, isStaffView]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
      void loadTable();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadOverview, loadTable]);

  const cards = useMemo(() => {
    if (isStaffView) {
      const items = state.overviewItems || [];
      const staffItems = items.filter((item) => ["superadmin", "admin", "coordinator", "teacher"].includes(String(item.role || "").toLowerCase()));
      return [
        {
          key: "superadmins",
          label: "Super admins",
          value: staffItems.filter((item) => item.role === "superadmin").length,
          tone: "bg-[#0D5C48] text-[#FAF7F0]",
        },
        {
          key: "admins",
          label: "Admins",
          value: staffItems.filter((item) => item.role === "admin").length,
          tone: "bg-[#FAF7F0] text-[#063F32]",
        },
        {
          key: "coordinators",
          label: "Coordinators",
          value: staffItems.filter((item) => item.role === "coordinator").length,
          tone: "bg-[#EAF6EF] text-[#0D5C48]",
        },
        {
          key: "teachers",
          label: "Teachers",
          value: staffItems.filter((item) => item.role === "teacher").length,
          tone: "bg-[#FFF5D6] text-[#8A6B00]",
        },
        {
          key: "suspendedSuperadmins",
          label: "Suspended super admins",
          value: staffItems.filter((item) => item.role === "superadmin" && item.status === "suspended").length,
          tone: "bg-rose-50 text-rose-800",
        },
        {
          key: "suspendedAdmins",
          label: "Suspended admins",
          value: staffItems.filter((item) => item.role === "admin" && item.status === "suspended").length,
          tone: "bg-rose-50 text-rose-800",
        },
        {
          key: "suspendedTeachers",
          label: "Suspended teachers",
          value: staffItems.filter((item) => item.role === "teacher" && item.status === "suspended").length,
          tone: "bg-rose-50 text-rose-800",
        },
      ];
    }

    if (view === "students") {
      return [
        {
          key: "students",
          label: "Total students",
          value: state.summary?.students ?? state.items.length ?? "...",
          tone: "bg-[#EAF6EF] text-[#0D5C48]",
        },
      ];
    }

    if (view === "parents") {
      return [
        {
          key: "parents",
          label: "Total parents",
          value: state.summary?.parents ?? state.items.length ?? "...",
          tone: "bg-emerald-50 text-emerald-800",
        },
      ];
    }

    return [
      {
        key: "coordinators",
        label: "Coordinators",
        value: state.summary?.coordinators ?? "...",
        tone: "bg-[#EAF6EF] text-[#0D5C48]",
      },
      {
        key: "teachers",
        label: "Teachers",
        value: state.summary?.teachers ?? "...",
        tone: "bg-[#FFF5D6] text-[#8A6B00]",
      },
    ];
  }, [state.overviewItems, state.summary, isStaffView, state.items.length, view]);

  const displayedItems = useMemo(() => {
    if (!isStaffView) {
      return state.items;
    }

    const searchTerm = String(filters.search || "").trim().toLowerCase();
    const selectedRole = String(filters.role || "").toLowerCase();
    const selectedStatus = String(filters.status || "").toLowerCase();

    let items = Array.isArray(state.allStaffItems) ? state.allStaffItems : [];

    if (selectedRole) {
      items = items.filter((item) => String(item.role || "").toLowerCase() === selectedRole);
    }

    if (selectedStatus) {
      items = items.filter((item) => String(item.status || "").toLowerCase() === selectedStatus);
    }

    if (searchTerm) {
      items = items.filter((item) => {
        const haystack = [
          item.name,
          item.full_name,
          item.username,
          item.email,
          item.phone,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        return haystack.includes(searchTerm);
      });
    }

    return items;
  }, [filters.role, filters.search, filters.status, isStaffView, state.allStaffItems, state.items]);

  const classOptions = useMemo(() => {
    if (view !== "students") {
      return [];
    }

    return Array.from(
      new Set(
        (state.overviewItems || [])
          .map((item) => String(item.class_level || "").trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right));
  }, [state.overviewItems, view]);

  const statusOptions = useMemo(() => getStatusOptions(view), [view]);

  async function submitSearch(event) {
    event.preventDefault();
    await loadTable();
  }

  async function resetPassword(record) {
    if (!record?.id) {
      return;
    }

    setResetModal({
      open: true,
      record,
      password: "",
      pending: false,
      error: "",
    });
  }

  async function submitResetPassword() {
    if (!resetModal.record?.id) {
      return;
    }

    if (!String(resetModal.password || "").trim()) {
      setResetModal((current) => ({
        ...current,
        error: "Password is required.",
      }));
      return;
    }

    setResetModal((current) => ({ ...current, pending: true, error: "" }));

    try {
      const response = await fetch(`/api/admin/users/${resetModal.record.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetModal.password.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to reset password.");
      }

      setResetModal({
        open: false,
        record: null,
        password: "",
        pending: false,
        error: "",
      });
      setResetSuccess({
        open: true,
        password: data.temporaryPassword || "",
        userName: resetModal.record?.name || resetModal.record?.full_name || "Selected user",
      });
    } catch (error) {
      setResetModal((current) => ({
        ...current,
        pending: false,
        error: error instanceof Error ? error.message : "Unable to reset password.",
      }));
    }
  }

  async function deleteUser(record) {
    if (!record?.id) {
      return;
    }

    setConfirmState({
      open: true,
      record,
      action: "archive",
      status: "archived",
      pending: false,
    });
  }

  async function activateUser(record) {
    if (!record?.id) {
      return;
    }

    setConfirmState({
      open: true,
      record,
      action: "activate",
      status: "active",
      pending: false,
    });
  }

  async function confirmStatusChange() {
    if (!confirmState.record?.id || !confirmState.action) {
      return;
    }

    setConfirmState((current) => ({ ...current, pending: true }));

    try {
      const isArchiveAction = confirmState.action === "archive";
      const isSuspendAction = confirmState.action === "suspend";
      const endpoint = `/api/admin/users/${confirmState.record.id}`;
      const response = await fetch(endpoint, {
        method: isArchiveAction ? "DELETE" : "PATCH",
        headers: isArchiveAction ? undefined : { "Content-Type": "application/json" },
        body: isArchiveAction
          ? undefined
          : JSON.stringify({
              status: isSuspendAction ? "suspended" : "active",
            }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to update user.");
      }

      setConfirmState({ open: false, record: null, action: "", status: "", pending: false });
      await Promise.all([loadOverview({ force: true }), loadTable({ force: true })]);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to update user."
      );
      setConfirmState((current) => ({ ...current, pending: false }));
    }
  }

  function openDetails(record) {
    setDetailModal({ open: true, record });
  }

  function closeDetails() {
    setDetailModal({ open: false, record: null });
  }

  async function loginAsParent(row) {
    const params = new URLSearchParams();
    if (row.username) params.set("identifier", row.username);
    else if (row.email) params.set("identifier", row.email);
    if (row.temporary_password) params.set("password", row.temporary_password);

    const loginUrl = `/login${params.toString() ? `?${params.toString()}` : ""}`;

    try {
      await signOut({ redirect: false });
    } catch {
      // Ignore sign-out errors and continue to the login page.
    }

    router.push(loginUrl);
  }

  async function loginAsStaff(row) {
    const params = new URLSearchParams();
    if (row.email) params.set("identifier", row.email);
    else if (row.username) params.set("identifier", row.username);
    if (row.temporary_password) params.set("password", row.temporary_password);

    const loginUrl = `/login${params.toString() ? `?${params.toString()}` : ""}`;

    try {
      await signOut({ redirect: false });
    } catch {
      // Ignore sign-out errors and continue to the login page.
    }

    router.push(loginUrl);
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.14),transparent_28%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-6xl">
              <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
                {isSuperAdminPortal ? "Super Admin management" : "Admin management"}
              </p>
              <h1 className="mb-3 mt-4 text-3xl font-bold text-white-deep sm:text-4xl lg:text-4xl font-display">
              {view === "students"
                ? "Students management"
                : view === "parents"
                  ? "Parents management"
                  : "Staff management"}
            </h1>
              <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
                {view === "students"
                  ? "Manage student accounts and keep their profiles organized."
                  : view === "parents"
                    ? "Manage parent accounts and keep their profiles organized."
                    : isSuperAdminPortal
                      ? "Create, update, suspend, and reset staff accounts while keeping the directory visible to super admin."
                      : "Create, update, suspend, and reset staff accounts while keeping the directory visible to admin."}
              </p>
            </div>

            {view === "staff" && !isAdminReadonlyPortal ? (
              <button
                type="button"
                onClick={() => setModal({ open: true, record: null })}
                className="inline-flex items-center justify-center rounded-2xl bg-[#FAF7F0] px-5 py-3 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DBD8D5]"
              >
                Create staff member
              </button>
            ) : null}
          </div>
        </section>

      {resetSuccess.open ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-end bg-[#063F32]/35 px-4 py-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.26)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">
              Password reset successful
            </p>
            <h3 className="mt-2 text-lg font-semibold text-[#063F32]">
              {resetSuccess.userName}
            </h3>
            <p className="mt-3 text-sm text-[#245C4F]">
              Password: <span className="font-semibold text-[#063F32]">{resetSuccess.password || "-"}</span>
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  setResetSuccess({ open: false, password: "", userName: "" });
                  await Promise.all([loadOverview({ force: true }), loadTable({ force: true })]);
                }}
                className="rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminDashboardCards items={cards} />

        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl sm:p-5">
        <form
          className={`grid gap-3 ${
            view === "staff"
              ? "lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]"
              : view === "students"
                ? "lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]"
                : "lg:grid-cols-[minmax(0,1.2fr)_220px_auto]"
          }`}
          onSubmit={submitSearch}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">
              Search users
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Name, email, or phone"
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
            />
          </label>

          {view === "students" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                Class
              </span>
              <div className="relative">
              <select
                value={filters.classLevel}
                onMouseDown={() => setClassOpen((current) => !current)}
                onFocus={() => setClassOpen(true)}
                onBlur={() => closeSelectState(setClassOpen)}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    classLevel: event.target.value,
                  }))
                }
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
              >
                <option value="">All classes</option>
                {classOptions.map((classLevel) => (
                  <option key={classLevel} value={classLevel}>
                    {classLevel}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${classOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </label>
          ) : null}

          {view === "staff" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                Role
              </span>
              <div className="relative">
              <select
                value={filters.role}
                onMouseDown={() => setRoleOpen((current) => !current)}
                onFocus={() => setRoleOpen(true)}
                onBlur={() => closeSelectState(setRoleOpen)}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
              >
                {(isStaffView ? STAFF_ROLE_OPTIONS : ROLE_OPTIONS).map((option) => (
                  <option key={option || "all"} value={option}>
                    {option ? formatLabel(option) : isStaffView ? "All staff roles" : "All roles"}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${roleOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </label>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">
              Status
            </span>
            <div className="relative">
              <select
                value={filters.status}
                onMouseDown={() => setStatusOpen((current) => !current)}
                onFocus={() => setStatusOpen(true)}
                onBlur={() => closeSelectState(setStatusOpen)}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
              >
              {statusOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option ? formatLabel(option) : "All statuses"}
                </option>
              ))}
            </select>
            <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${statusOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
          </label>

          <button
            type="submit"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
          >
            Apply
          </button>
        </form>
        </section>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      <AdminDataTable
        columns={[
          {
            key: "name",
            label: "User",
            render: (row) => (
              <div>
                <p className="font-semibold text-[#063F32]">
                  {view === "parents" || view === "students" || view === "staff"
                    ? row.name || row.full_name || row.username || "-"
                    : row.name}
                </p>
                {view === "admin" ? (
                  <div className="mt-1 text-xs text-[#245C4F]">
                    <p>{row.email || "No email"}</p>
                  </div>
                ) : null}
              </div>
            ),
          },
          ...(view === "staff"
            ? [
                {
                  key: "email",
                  label: "Email",
                  render: (row) => row.email || "-",
                },
                {
                  key: "temporary_password",
                  label: "Password",
                  render: (row) => row.temporary_password || "-",
                },
              ]
            : []),
          ...(view === "students"
            ? [
                {
                  key: "username",
                  label: "Username",
                  render: (row) => row.username || "-",
                },
                {
                  key: "temporary_password",
                  label: "Password",
                  render: (row) => row.temporary_password || "-",
                },
                {
                  key: "class_level",
                  label: "Class",
                  render: (row) => row.class_level || "-",
                },
                {
                  key: "admission_no",
                  label: "Admission No",
                  render: (row) => row.admission_no || "-",
                },
                {
                  key: "age",
                  label: "Age",
                  render: (row) => row.age || "-",
                },
                {
                  key: "course_title",
                  label: "Course",
                  render: (row) => row.course_title || "-",
                },
                {
                  key: "parent_name",
                  label: "Parent",
                  render: (row) => row.parent_name || "-",
                },
              ]
            : []),
          ...(view === "parents"
            ? [
                {
                  key: "email",
                  label: "Email",
                  render: (row) => row.email || "-",
                },
                {
                  key: "temporary_password",
                  label: "Password",
                  render: (row) => row.temporary_password || "-",
                },
                {
                  key: "relation",
                  label: "Relation",
                  render: (row) => row.relation || "-",
                },
                {
                  key: "student_names",
                  label: "Students",
                  cellClassName: "min-w-[18rem]",
                  render: (row) => row.student_names || "-",
                },
                {
                  key: "parent_status",
                  label: "Status",
                  render: (row) => formatLabel(row.status),
                },
              ]
            : []),
          {
            key: "phone",
            label: "Phone",
            render: (row) => row.phone || "-",
          },
          {
            key: "role",
            label: "Role",
            render: (row) => formatLabel(row.role),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => formatLabel(row.status),
          },
        ]}
        rows={state.loading ? [] : displayedItems}
        emptyMessage={
          state.loading ? "Loading users..." : "No users matched the current filters."
        }
        actions={(row) => (
          <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
            {view === "parents" || view === "students" || view === "staff" ? (
              <button
                type="button"
                onClick={() => (view === "staff" ? loginAsStaff(row) : loginAsParent(row))}
                className="whitespace-nowrap rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7]"
              >
                Login
              </button>
            ) : null}
            {!isAdminReadonlyPortal && view === "staff" && ["admin", "coordinator", "teacher"].includes(String(row.role || "").toLowerCase()) ? (
              <button
                type="button"
                onClick={() => setModal({ open: true, record: row })}
                className="whitespace-nowrap rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-1 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Edit
              </button>
            ) : null}
            {!isAdminReadonlyPortal && view === "staff" && ["admin", "coordinator", "teacher"].includes(String(row.role || "").toLowerCase()) && String(row.id || "") !== currentUserId ? (
              <button
                type="button"
                onClick={() =>
                  setConfirmState({
                    open: true,
                    record: row,
                    action: row.status === "suspended" ? "activate" : "suspend",
                    status: row.status === "suspended" ? "active" : "suspended",
                    pending: false,
                })
                }
                className="whitespace-nowrap rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                {row.status === "suspended" ? "Activate" : "Suspend"}
              </button>
            ) : null}
            {!isAdminReadonlyPortal && view === "staff" && ["admin", "coordinator", "teacher"].includes(String(row.role || "").toLowerCase()) ? (
              <button
                type="button"
                onClick={() => resetPassword(row)}
                className="whitespace-nowrap rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                {resetModal.pending ? (
                  <span className="inline-flex items-center gap-2">
                    <LeafSpinnerInline />
                    Resetting...
                  </span>
                ) : (
                  "Reset password"
                )}
              </button>
            ) : null}
            {!isAdminReadonlyPortal && view !== "staff" ? (
              <>
                <button
                  type="button"
                  onClick={() => openDetails(row)}
                  className="whitespace-nowrap rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ open: true, record: row })}
                  className="whitespace-nowrap rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Edit
                </button>
                {String(row.status || "").toLowerCase() === "archived" ? (
                  <button
                    type="button"
                    onClick={() => activateUser(row)}
                    className="whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Activate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => deleteUser(row)}
                    className="whitespace-nowrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Delete
                </button>
                )}
              </>
            ) : null}
            {view === "parents" || view === "students" ? (
              <button
                type="button"
                onClick={() => resetPassword(row)}
                className="whitespace-nowrap rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Reset password
              </button>
            ) : null}
          </div>
        )}
      />

      {!isAdminReadonlyPortal && modal.open ? (
        <StaffFormModal
          key={modal.record?.id || "create-staff"}
          open={modal.open}
          record={modal.record}
          mode={modal.record ? "edit" : "create"}
          roleOptions={
            view === "staff"
              ? [
                  { label: "Admin", value: "admin" },
                  { label: "Coordinator", value: "coordinator" },
                ]
              : [
                  { label: "Super Admin", value: "superadmin" },
                  { label: "Admin", value: "admin" },
                  { label: "Coordinator", value: "coordinator" },
                  { label: "Teacher", value: "teacher" },
                  { label: "Parent", value: "parent" },
                  { label: "Student", value: "student" },
                ]
          }
          onClose={() => setModal({ open: false, record: null })}
          onSuccess={() => Promise.all([loadOverview({ force: true }), loadTable({ force: true })])}
        />
      ) : null}

      {detailModal.open && detailModal.record ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-[2rem] border border-[#2D8A6A]/15 bg-white shadow-[0_30px_90px_-40px_rgba(13,59,46,0.24)]">
            <div className="flex items-center justify-between border-b border-[#2D8A6A]/15 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#063F32]">User Details</h2>
                <p className="mt-1 text-sm text-[#245C4F]">{detailModal.record.name || detailModal.record.full_name || "Selected user"}</p>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5">
                  <h3 className="text-lg font-semibold text-[#063F32]">Account</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 break-words">
                    {[
                      ["Name", detailModal.record.name || detailModal.record.full_name],
                      ["Email", detailModal.record.email],
                      ["Phone", detailModal.record.phone],
                      ["Role", formatLabel(detailModal.record.role)],
                      ["Status", formatLabel(detailModal.record.status)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-[#2D8A6A]/15 bg-white/90 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">{label}</p>
                        <p className="mt-2 text-sm font-semibold text-[#063F32]">{value || "Not provided"}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5">
                  <h3 className="text-lg font-semibold text-[#063F32]">
                    {detailModal.record.role === "parent" ? "Parent details" : "Student details"}
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {detailModal.record.role === "parent"
                      ? [
                          ["Relation", detailModal.record.relation],
                          ["Children", detailModal.record.student_names],
                        ].map(([label, value]) => (
                        <DetailBlock key={label} label={label} value={value} />
                      ))
                      : [
                          ["Admission no", detailModal.record.admission_no],
                          ["Age", detailModal.record.age],
                          ["Course", detailModal.record.course_title],
                          ["Program", detailModal.record.program_name],
                          ["City / country", detailModal.record.city_country],
                          ["Religion", detailModal.record.religion],
                          ["Gender", detailModal.record.gender],
                          ["Support person", detailModal.record.support_person_during_learning],
                          ["Device available", detailModal.record.device_available],
                        ].map(([label, value]) => (
                        <DetailBlock key={label} label={label} value={value} />
                      ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {resetModal.open && resetModal.record ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#063F32]/45 px-4 pt-10 pb-10 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-[#2D8A6A]/18 bg-[#FAF7F0] shadow-[0_30px_90px_-40px_rgba(13,59,46,0.28)]">
            <div className="flex items-center justify-between border-b border-[#2D8A6A]/15 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C9A227]">
                  Reset password
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#063F32]">
                  {resetModal.record.name || resetModal.record.full_name || "Selected user"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setResetModal({
                    open: false,
                    record: null,
                    password: "",
                    pending: false,
                    error: "",
                  })
                }
                className="rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>
            <div className="space-y-5 px-6 py-6">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">
                  New password
                </span>
                <input
                  type="text"
                  value={resetModal.password}
                  onChange={(event) =>
                    setResetModal((current) => ({
                      ...current,
                      password: event.target.value,
                      error: "",
                    }))
                  }
                  placeholder="Enter new password"
                  required
                  className="h-12 w-full rounded-2xl border border-[#2D8A6A]/18 bg-white px-4 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#2D8A6A]/10"
                />
              </label>
              {resetModal.error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {resetModal.error}
                </div>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setResetModal({
                      open: false,
                      record: null,
                      password: "",
                      pending: false,
                      error: "",
                    })
                  }
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-white px-5 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitResetPassword}
                  disabled={resetModal.pending}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-5 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {resetModal.pending ? (
                    <span className="inline-flex items-center gap-2">
                      <LeafSpinnerInline />
                      Resetting...
                    </span>
                  ) : (
                    "Reset password"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmDialog
        open={confirmState.open}
        pending={confirmState.pending}
        title={`${
          confirmState.action === "archive"
            ? "Archive"
            : confirmState.action === "suspend"
              ? "Suspend"
              : "Activate"
        } ${confirmState.record?.name || "user"}?`}
        description={
          confirmState.action === "archive"
            ? "This will move the record to archived status."
            : confirmState.action === "suspend"
              ? "This will move the record to suspended status."
              : "This will restore the record back to active status."
        }
        confirmLabel={
          confirmState.action === "archive"
            ? "Archive"
            : confirmState.action === "suspend"
              ? "Suspend"
              : "Activate"
        }
        tone={confirmState.action === "activate" ? "success" : "danger"}
        onClose={() =>
          setConfirmState({ open: false, record: null, action: "", status: "", pending: false })
        }
        onConfirm={confirmStatusChange}
      />
      </div>
    </div>
  );
}
