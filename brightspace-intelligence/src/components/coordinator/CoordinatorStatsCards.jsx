"use client";

import { motion } from "framer-motion";

export default function CoordinatorStatsCards({ items = [] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {items.map((item, index) => (
        <motion.article
          key={item.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          className="relative flex min-h-[150px] flex-col overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)] backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#C9A227_0%,#E4C766_45%,#2D8A6A_100%)]" />
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(201,162,39,0.16),transparent_65%)]" />
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#063F32] opacity-75">
            {item.label}
          </p>
          <p className="mt-auto pt-6 text-3xl font-semibold tracking-tight text-[#063F32]">
            {item.value}
          </p>
        </motion.article>
      ))}
    </div>
  );
}
