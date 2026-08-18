"use client";

export default function TeacherNotesList({ items = [] }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,234,220,0.58)_100%)] p-4 text-sm text-[#245C4F] shadow-[0_14px_40px_-28px_rgba(13,59,46,0.14)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
            {item.source_role || "Teacher"} note
            {item.visibility ? ` · Visible to ${String(item.visibility).replaceAll("_", " ")}` : ""}
          </p>
          <p className="mt-2 leading-6 text-[#245C4F]">{item.note}</p>
          {item.teacher_name ? <p className="mt-2 text-xs font-medium text-[#245C4F]">From {item.teacher_name}</p> : null}
        </article>
      ))}
      {!items.length ? <p className="rounded-2xl border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-6 text-sm text-[#245C4F]">No teacher notes available.</p> : null}
    </div>
  );
}
