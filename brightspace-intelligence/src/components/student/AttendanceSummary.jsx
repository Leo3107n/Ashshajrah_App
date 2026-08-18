"use client";

export default function AttendanceSummary({ summary = {}, items = [] }) {
  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/18 bg-[linear-gradient(135deg,rgba(13,59,46,0.95)_0%,rgba(13,92,72,0.92)_100%)] p-5 text-[#FAF7F0] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.22)] backdrop-blur-xl">
      <p className="mt-3 text-4xl font-semibold text-[#FFF5D6]">{summary.total_conducted ? `${summary.attendance_percentage || 0}%` : "0%"}</p>
      <p className="mt-2 text-sm text-[#F1EADC]">
        {summary.total_conducted ? `Conducted lectures: ${summary.total_conducted}` : "No conducted lectures yet."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.5rem] border border-[#65B891]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.06)_100%)] p-4 text-sm text-[#F1EADC]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E4C766]">Attended</p>
          <p className="mt-2 text-2xl font-semibold text-[#FFF5D6]">{summary.attended_classes || 0}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[#65B891]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.06)_100%)] p-4 text-sm text-[#F1EADC]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E4C766]">Absent</p>
          <p className="mt-2 text-2xl font-semibold text-[#FFF5D6]">{summary.absent_classes || 0}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[#65B891]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.06)_100%)] p-4 text-sm text-[#F1EADC]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E4C766]">Percentage</p>
          <p className="mt-2 text-2xl font-semibold text-[#FFF5D6]">{summary.total_conducted ? `${summary.attendance_percentage || 0}%` : "0%"}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-[1.5rem] border border-[#65B891]/22 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.05)_100%)] p-4 text-sm text-[#F1EADC]">
            <p className="font-semibold text-[#FFF5D6]">{item.title}</p>
            <p className="mt-1">
              {item.subject_name} · {item.teacher_name}
            </p>
            <p className="mt-1 text-xs text-[#E4C766]">{item.scheduled_start}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#E4C766]">{item.attendance_status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
