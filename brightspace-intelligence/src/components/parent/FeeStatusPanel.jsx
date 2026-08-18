"use client";

import { useMemo, useState } from "react";
import PaginationControls from "@/components/parent/PaginationControls";

export default function FeeStatusPanel({ items = [] }) {
  const pageSize = 7;
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = useMemo(() => {
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page, totalPages]);

  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Fees</p>
        <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">Voucher and payment status</h2>
      </div>
      <div className="grid gap-4">
        {visibleItems.length ? visibleItems.map((item, index) => (
          <article key={`${item.id || "fee"}-${item.transaction_id || "voucher"}-${index}`} className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4  ">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#063F32]">{item.voucher_no || "No voucher number"}</p>
                  {item.is_monthly_voucher ? (
                    <span className="inline-flex rounded-full bg-[#E9F8F1] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                      Monthly
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[#245C4F]">Student: {item.student_name || "-"}</p>
                <p className="mt-1 text-sm text-[#245C4F]">Amount: PKR {item.amount || item.paid_amount || "0"}</p>
                <p className="mt-1 text-sm text-[#0D5C48]">Transaction: {item.transaction_id || "Not submitted"}</p>
                {item.paid_amount ? <p className="mt-1 text-sm text-[#0D5C48]">Paid amount: {item.paid_amount}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 text-right">
                <div className="rounded-2xl border border-[#2D8A6A]/10 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0D5C48]">Voucher status</p>
                  <p className="mt-2 text-sm font-semibold text-[#063F32]">{item.voucher_status || "not_available"}</p>
                </div>
                <div className="rounded-2xl border border-[#2D8A6A]/10 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0D5C48]">Payment status</p>
                  <p className="mt-2 text-sm font-semibold text-[#063F32]">{item.submission_status || "not submitted"}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Payment proof</p>
              {item.proof_url ? (
                <a href={item.proof_url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl border border-[#F1EADC] bg-[#FAF7F0]">
                  <img src={item.proof_url} alt={`Payment proof for ${item.voucher_no}`} className="h-48 w-full object-contain" />
                </a>
              ) : (
                <p className="mt-3 rounded-xl bg-[#FAF7F0] p-4 text-xs text-[#245C4F]">Payment proof has not been uploaded yet.</p>
              )}
            </div>
          </article>
        )) : (
          <p className="rounded-2xl border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-5 text-sm text-[#245C4F]">
            No fee records are available yet.
          </p>
        )}
      </div>
      {items.length > pageSize ? (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalItems={items.length}
          onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
        />
      ) : null}
    </section>
  );
}
