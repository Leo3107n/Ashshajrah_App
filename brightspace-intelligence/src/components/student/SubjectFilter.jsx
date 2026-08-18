"use client";

export default function SubjectFilter({ value = "", subjects = [], onChange }) {
  return (
    <select value={value} onChange={(event) => onChange?.(event.target.value)} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-medium text-[#063F32] outline-none transition focus:border-[#C9A227] focus:ring-4 focus:ring-[#FFF5D6]">
      <option value="">All subjects</option>
      {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  );
}
