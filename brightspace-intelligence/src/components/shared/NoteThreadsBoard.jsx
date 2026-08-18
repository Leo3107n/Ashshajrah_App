"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { LeafSpinnerInline, OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

function groupLectureOptions(lectures) {
  const map = new Map();
  for (const item of lectures || []) {
    const classLevel = String(item.class_level || item.course_title || "").trim();
    const subjectId = String(item.subject_id || "").trim();
    const subjectName = String(item.subject_name || "").trim();
    if (!classLevel || !subjectId) continue;
    const key = `${classLevel}::${subjectId}`;
    if (!map.has(key)) map.set(key, { classLevel, subjectId, subjectName });
  }
  return Array.from(map.values());
}

function formatVisibilityLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "admin_only") return "Admin Only";
  if (normalized === "parent") return "Parent";
  if (normalized === "student") return "Student";
  if (normalized === "admin") return "Admin";
  return normalized
    ? normalized.replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
}

function MessageBubble({ message, mode }) {
  const senderRole = String(message.sender_role || "").toLowerCase();
  const mine =
    mode === "admin"
      ? senderRole === "admin" || senderRole === "superadmin"
      : mode === "student"
        ? senderRole === "student"
      : mode === "parent"
          ? senderRole === "parent"
          : ["teacher", "admin", "superadmin"].includes(senderRole);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine ? "bg-[#063F32] text-[#FAF7F0]" : "bg-[#FAF7F0] text-[#245C4F]"}`}>
        <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
          <span className="font-semibold">{message.full_name || message.username || message.sender_role || "User"}</span>
          <span>·</span>
          <span>{message.sender_role || "-"}</span>
        </div>
        <p className="whitespace-pre-line leading-6">{message.message}</p>
      </div>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, actions, showTopClose = true, portalTargetId }) {
  const insidePage = Boolean(portalTargetId);
  const content = (
    <div
      className={`${
        insidePage ? "absolute inset-0 z-40 flex items-start justify-center bg-[#063F32]/35 px-4 py-6 sm:py-8" : "fixed inset-0 z-[9999] isolate flex items-start justify-center bg-[#063F32]/45 px-4 pt-10 pb-8"
      }`}
    >
      <div className={`relative ${insidePage ? "z-50 max-w-3xl" : "z-[10000] max-w-3xl"} w-full rounded-[2rem] border border-[#2D8A6A]/15 bg-white shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]`}>
        <div className="border-b border-[#F1EADC] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">{title}</p>
              <h3 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">{subtitle}</h3>
            </div>
            {showTopClose ? (
              <button type="button" onClick={onClose} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]">
                Close
              </button>
            ) : null}
          </div>
        </div>
        <div className="space-y-4 p-6">{children}</div>
        {actions ? <div className="border-t border-[#F1EADC] px-6 py-4">{actions}</div> : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  const target = portalTargetId ? document.getElementById(portalTargetId) : null;
  return createPortal(content, target || document.body);
}

function SelectField({ value, onChange, onFocus, onBlur, className = "", children, ...props }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-full">
      <select
        {...props}
        value={value}
        onMouseDown={() => setOpen((current) => !current)}
        onChange={(event) => {
          setOpen(false);
          onChange?.(event);
        }}
        onFocus={(event) => {
          setOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setOpen(false);
          onBlur?.(event);
        }}
        className={`block w-full appearance-none pr-11 ${className}`}
      >
        {children}
      </select>
      <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`} />
    </div>
  );
}

export default function NoteThreadsBoard({ mode = "viewer", lectures = [], portalTargetId, allowReply = true }) {
  const canReply = allowReply && (mode === "teacher" || mode === "admin" || mode === "parent" || mode === "student");
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterColumn, setFilterColumn] = useState("all");
  const [filterText, setFilterText] = useState("");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyPending, setReplyPending] = useState(false);
  const [compose, setCompose] = useState({ classLevel: "", subjectId: "", visibility: "parent", message: "" });
  const [editingThread, setEditingThread] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [deletingThread, setDeletingThread] = useState(null);
  const activeThreadIdRef = useRef("");

  const lectureOptions = useMemo(() => groupLectureOptions(lectures), [lectures]);
  const subjectOptions = useMemo(() => lectureOptions.filter((item) => item.classLevel === String(compose.classLevel || "").trim()), [lectureOptions, compose.classLevel]);
  const selectedVisibility = String(selected?.visibility || "").toLowerCase();
  const isParentThread = ["parent", "parent_only"].includes(selectedVisibility);
  const isStudentThread = selectedVisibility === "student";
  const threadFilterOptions = useMemo(
    () => [
      { value: "all", label: "All columns" },
      { value: "class", label: "Class" },
      { value: "subject", label: "Subject" },
      { value: "teacher", label: "Teacher Name" },
      { value: "visibility", label: "For Role" },
      { value: "message", label: "Last Message" },
    ],
    []
  );
  const filteredThreads = useMemo(() => {
    const query = String(filterText || "").trim().toLowerCase();
    if (!query) return threads;

    const matches = (value) => String(value || "").toLowerCase().includes(query);

    return threads.filter((thread) => {
      const values = {
        class: thread.class_level || thread.course_title || "",
        subject: thread.subject_name || "",
        teacher: thread.teacher_name || "",
        visibility: formatVisibilityLabel(thread.visibility),
        message: thread.last_message || "",
      };

      if (filterColumn === "all") {
        return Object.values(values).some(matches);
      }

      return matches(values[filterColumn] || "");
    });
  }, [filterColumn, filterText, threads]);
  const canReplyToSelected =
    (mode === "student" && isStudentThread) ||
    (mode === "parent" && isParentThread) ||
    (mode === "teacher" && ["parent", "student", "admin_only", "admin"].includes(selectedVisibility)) ||
    (mode === "admin" && (selectedVisibility === "admin_only" || selectedVisibility === "admin"));

  async function loadThreads() {
    setLoading(true);
    try {
      const response = await fetch("/api/notes/threads", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load notes.");
      setThreads(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function openThread(thread) {
    setSelected(thread);
    setReplyText("");
    setMessages([]);
    setMessagesLoading(true);
    activeThreadIdRef.current = thread.id;
    const response = await fetch(`/api/notes/threads/${thread.id}/messages`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load messages.");
    if (String(activeThreadIdRef.current) === String(thread.id)) setMessages(data.items || []);
    setMessagesLoading(false);
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setReplyPending(true);
    try {
      const response = await fetch(`/api/notes/threads/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to send reply.");
      setReplyText("");
      await openThread(selected);
      await loadThreads();
    } finally {
      setReplyPending(false);
    }
  }

  async function submitCompose(event) {
    event.preventDefault();
    const response = await fetch("/api/notes/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classLevel: compose.classLevel, subjectId: compose.subjectId, visibility: compose.visibility, message: compose.message }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to add note.");
    setCompose({ classLevel: "", subjectId: "", visibility: "parent", message: "" });
    await loadThreads();
  }

  async function saveEdit() {
    const response = await fetch(`/api/notes/threads/${editingThread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: editingText }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to update note.");
    setEditingThread(null);
    setEditingText("");
    await loadThreads();
    if (selected?.id === editingThread.id) await openThread(selected);
  }

  async function deleteThread() {
    const response = await fetch(`/api/notes/threads/${deletingThread.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to delete note.");
    setDeletingThread(null);
    if (selected?.id === deletingThread.id) setSelected(null);
    await loadThreads();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadThreads().catch((err) => setError(err.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const panel = "rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl";
  const buttonBase = "rounded-xl border px-3 py-2 text-xs font-semibold transition";

  return (
    <div className="grid gap-5">
      {mode === "teacher" ? (
        <form onSubmit={submitCompose} className={`grid gap-4 p-5 ${panel}`}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#063F32]">Class</span>
              <SelectField value={compose.classLevel} onChange={(e) => setCompose((c) => ({ ...c, classLevel: e.target.value, subjectId: "" }))} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#245C4F] outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]" required>
                <option value="">Select class</option>
                {Array.from(new Map(lectureOptions.map((item) => [item.classLevel, item])).values()).map((item) => <option key={item.classLevel} value={item.classLevel}>{item.classLevel}</option>)}
              </SelectField>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#063F32]">Subject</span>
              <SelectField value={compose.subjectId} onChange={(e) => setCompose((c) => ({ ...c, subjectId: e.target.value }))} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#245C4F] outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]" required disabled={!compose.classLevel}>
                <option value="">Select subject</option>
                {subjectOptions.map((item) => <option key={item.subjectId} value={item.subjectId}>{item.subjectName}</option>)}
              </SelectField>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#063F32]">Visibility</span>
              <SelectField value={compose.visibility} onChange={(e) => setCompose((c) => ({ ...c, visibility: e.target.value }))} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#245C4F] outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]">
                <option value="parent">Parent</option>
                <option value="student">Student</option>
                <option value="admin_only">Admin only</option>
              </SelectField>
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#063F32]">Note / message</span>
            <textarea value={compose.message} onChange={(e) => setCompose((c) => ({ ...c, message: e.target.value }))} placeholder="Add note or message" className="min-h-[120px] w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]" required />
          </label>
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-2xl bg-[#FAF7F0] px-4 py-3 text-xs text-[#245C4F]">Select class and subject first, then write the note.</div>
            <button className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] hover:bg-[#063F32]">Add note</button>
          </div>
        </form>
      ) : null}

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <section className={`overflow-hidden ${panel}`}>
        <div className="border-b border-[#F1EADC] px-5 py-4">
          <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Filter column</span>
              <SelectField
                value={filterColumn}
                onChange={(e) => setFilterColumn(e.target.value)}
                className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#245C4F] outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]"
              >
                {threadFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Search</span>
              <input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter notes by selected column"
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#245C4F] outline-none transition placeholder:text-[#7A938B] focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]"
              />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
              <tr>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Teacher Name</th>
                <th className="px-6 py-4">For Role</th>
                <th className="px-6 py-4">Last Message</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10">
                    <OpenBookLoader title="Loading notes" subtitle="Preparing your notes threads..." />
                  </td>
                </tr>
              ) : filteredThreads.length ? filteredThreads.map((thread) => (
                <tr key={thread.id}>
                  <td className="px-6 py-4 font-semibold text-[#063F32]">{thread.class_level || thread.course_title || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{thread.subject_name || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{thread.teacher_name || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{formatVisibilityLabel(thread.visibility)}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{thread.last_message || "-"}</td>
                  <td className="px-6 py-4 text-[#245C4F]">{thread.last_message_at ? new Date(thread.last_message_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "-"}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openThread(thread).catch((err) => setError(err.message))} className={`${buttonBase} border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] hover:bg-[#F1EADC]`}>View</button>
                      {mode === "teacher" ? (
                        <>
                          <button type="button" onClick={() => { setEditingThread(thread); setEditingText(thread.last_message || ""); }} className={`${buttonBase} border-[#2D8A6A]/20 bg-[#0D5C48] text-[#FAF7F0] hover:bg-[#063F32]`}>Edit</button>
                          <button type="button" onClick={() => setDeletingThread(thread)} className={`${buttonBase} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}>Delete</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#245C4F]">No notes matched the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <Modal
          title="Thread"
          subtitle={`${selected.class_level || selected.course_title || "-"} · ${selected.subject_name || "-"}`}
          onClose={() => setSelected(null)}
          portalTargetId={portalTargetId}
          actions={
            canReply && canReplyToSelected ? (
              <div className="space-y-3">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={1}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]"
                  placeholder="Write a reply..."
                />
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setSelected(null)} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]">Close</button>
                  <button type="button" onClick={() => sendReply().catch((err) => setError(err.message))} disabled={replyPending} className="rounded-2xl bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-3 text-sm font-semibold text-[#FAF7F0] disabled:opacity-60">{replyPending ? "Sending..." : "Reply"}</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => setSelected(null)} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]">Close</button>
              </div>
            )
          }
          showTopClose={false}
        >
          {messagesLoading ? (
            <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-6 text-sm text-[#245C4F]">
              <LeafSpinnerInline className="h-6 w-6 border-2 border-[#2D8A6A]/20 border-t-[#C9A227]" />
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">
                  Loading chat
                </p>
                <p className="mt-2 text-sm text-[#245C4F]">Opening the conversation...</p>
              </div>
            </div>
          ) : (
            <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => <MessageBubble key={message.id} message={message} mode={mode} />)}
            </div>
          )}
        </Modal>
      ) : null}

      {editingThread ? (
        <Modal
          title="Edit note"
          subtitle={`${editingThread.class_level || editingThread.course_title || "-"} · ${editingThread.subject_name || "-"}`}
          onClose={() => { setEditingThread(null); setEditingText(""); }}
          portalTargetId={portalTargetId}
          actions={
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => { setEditingThread(null); setEditingText(""); }} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]">Cancel</button>
              <button type="button" onClick={() => saveEdit().catch((err) => setError(err.message))} className="rounded-2xl bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-3 text-sm font-semibold text-[#FAF7F0]">Save</button>
            </div>
          }
        >
          <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={6} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]" />
        </Modal>
      ) : null}

      {deletingThread ? (
        <Modal
          title="Delete note"
          subtitle={`${deletingThread.class_level || deletingThread.course_title || "-"} · ${deletingThread.subject_name || "-"}`}
          onClose={() => setDeletingThread(null)}
          portalTargetId={portalTargetId}
          actions={
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setDeletingThread(null)} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]">Cancel</button>
              <button type="button" onClick={() => deleteThread().catch((err) => setError(err.message))} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700">Delete</button>
            </div>
          }
        >
          <p className="text-sm text-[#245C4F]">This removes the thread and all replies.</p>
        </Modal>
      ) : null}
    </div>
  );
}
