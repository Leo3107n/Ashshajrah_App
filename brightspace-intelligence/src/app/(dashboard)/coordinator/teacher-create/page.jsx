"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import StaffFormModal from "@/components/admin/StaffFormModal";
import AdminDataTable from "@/components/admin/AdminDataTable";

export default function CoordinatorTeacherCreatePage() {
  const [open, setOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/coordinator/teachers", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load teachers.");
      }

      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load teachers.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.full_name, item.email, item.phone, item.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [items, search]);

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
              Coordinator portal
            </p>
            <h1 className="mb-3 mt-4 text-3xl font-bold text-white-deep sm:text-4xl lg:text-4xl font-display">
              Create teacher
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
              Create a teacher account from the coordinator portal and use it for lecture assignment and attendance workflows.
            </p>
          </div>
        </section>

        {error ? (
          <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Teacher account</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">Create teacher</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
            >
              Open form
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Teachers</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">Created teachers</h2>
          </div>

          <label className="mb-4 flex items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-white px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 text-[#0D5C48]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, phone, or status"
              className="w-full bg-transparent text-sm text-[#063F32] outline-none placeholder:text-[#7A938B]"
            />
          </label>

          <AdminDataTable
            loading={loading}
            loadingTitle="Loading teachers"
            loadingSubtitle="Preparing the teacher list..."
            columns={[
              { key: "full_name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "status", label: "Status" },
            ]}
            rows={filteredItems}
            emptyMessage="No teachers created yet."
            actions={(row) => (
              <button
                type="button"
                onClick={() => {
                  setEditingTeacher(row);
                  setOpen(true);
                }}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Edit
              </button>
            )}
          />
        </section>
      </div>

        <StaffFormModal
        open={open}
        mode={editingTeacher ? "edit" : "create"}
        record={editingTeacher}
        onClose={() => {
          setOpen(false);
          setEditingTeacher(null);
        }}
        onSuccess={() => {
          setOpen(false);
          setEditingTeacher(null);
          void loadTeachers();
        }}
        roleOptions={[{ label: "Teacher", value: "teacher" }]}
        createEndpoint="/api/coordinator/teachers"
        updateEndpoint="/api/coordinator/teachers"
        badgeLabel="Coordinator teacher create"
      />
    </div>
  );
}
