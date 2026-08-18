"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Download, Search, Trash2 } from "lucide-react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";
import AdminDataTable from "@/components/admin/AdminDataTable";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function CareerApplicationsPanel() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const response = await fetch("/api/admin/career-applications", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load career applications.");
        }

        if (active) {
          setState({ loading: false, error: "", items: Array.isArray(data.items) ? data.items : [] });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load career applications.",
            items: [],
          });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return state.items;
    return state.items.filter((item) => {
      return [
        item.full_name,
        item.email,
        item.whatsapp,
        item.interested_role,
        item.source,
        item.message,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [search, state.items]);

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/career-applications/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete application.");
      }
      setState((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== deleteTarget.id),
      }));
      setSelectedMessage((current) => (current?.id === deleteTarget.id ? null : current));
      setDeleteTarget(null);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unable to delete application.",
      }));
    } finally {
      setDeleting(false);
    }
  }

  const columns = useMemo(
    () => [
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "interested_role", label: "Interested Role" },
      {
        key: "message",
        label: "Message",
        render: (row) => (
          <div className="inline-block">
            <button
              type="button"
              onClick={() => setSelectedMessage((current) => (current?.id === row.id ? null : row))}
              className="inline-flex w-max whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-left text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7] hover:text-[#063F32]"
            >
              Message View
            </button>
          </div>
        ),
      },
      { key: "source", label: "Source" },
      { key: "submitted_at", label: "Submitted At", render: (row) => formatDate(row.submitted_at) },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}
      {!state.loading ? (
        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
          <label className="flex items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-white px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 text-[#0D5C48]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, role, source, or message"
              className="w-full bg-transparent text-sm text-[#063F32] outline-none placeholder:text-[#7A938B]"
            />
          </label>
        </section>
      ) : null}
      {state.loading ? (
        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-6 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <OpenBookLoader title="Loading career applications" subtitle="Fetching submitted applications..." />
        </section>
      ) : null}
      {!state.loading ? (
        <>
          <AdminDataTable
            columns={columns}
            rows={filteredItems}
            emptyMessage="No career applications found."
            actions={(row) => (
              <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
                <a
                  href={`/api/admin/career-applications/${encodeURIComponent(row.id)}/resume`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7]"
                >
                  <ExternalLink className="h-4 w-4" />
                  View PDF
                </a>
                <a
                  href={`/api/admin/career-applications/${encodeURIComponent(row.id)}/resume?download=1`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(row)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          />

          {selectedMessage ? (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/45 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                      Full message
                    </p>
                    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#063F32]">
                      {selectedMessage.full_name || "Career application"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-8 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                    Message
                  </p>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#245C4F]">
                    {selectedMessage.message || "-"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {deleteTarget ? (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/55 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_28px_90px_-40px_rgba(13,59,46,0.3)]">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Delete application</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#063F32]">
                  Remove this career application?
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#245C4F]">
                  This will permanently delete the application submitted by{" "}
                  <span className="font-semibold text-[#063F32]">{deleteTarget.full_name || "the applicant"}</span>.
                </p>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete now"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
