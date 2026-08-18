"use client";

export default function FeeStatusCard({ items = [] }) {
  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,234,220,0.55)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.14)] backdrop-blur-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#C9A227]">Fee status</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-white/80 p-4 text-sm text-[#245C4F]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-semibold text-[#063F32]">{item.voucher_no}</p>
                <p className="mt-1">
                  Voucher status: <span className="font-medium text-[#0D5C48]">{item.status || "-"}</span>
                </p>
                <p className="mt-1">
                  Payment status: <span className="font-medium text-[#0D5C48]">{item.submission_status || "Not submitted"}</span>
                </p>
                <p className="mt-1">
                  Amount: <span className="font-medium text-[#0D5C48]">{item.amount || "-"}</span>
                </p>
                {item.paid_amount ? (
                  <p className="mt-1">
                    Paid amount: <span className="font-medium text-[#0D5C48]">{item.paid_amount}</span>
                  </p>
                ) : null}
                {item.transaction_id ? (
                  <p className="mt-1">
                    Transaction ID: <span className="font-medium text-[#0D5C48]">{item.transaction_id}</span>
                  </p>
                ) : null}
              </div>
              <div className="w-full max-w-sm rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.96)_100%)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Payment proof</p>
                {item.proof_url ? (
                  <a href={item.proof_url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl border border-[#F1EADC] bg-[#FAF7F0]">
                    <img src={item.proof_url} alt={`Payment proof for ${item.voucher_no}`} className="h-48 w-full object-contain" />
                  </a>
                ) : (
                  <p className="mt-3 rounded-xl bg-[#FAF7F0] p-4 text-xs text-[#245C4F]">Payment proof has not been uploaded yet.</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {!items.length ? <p className="text-sm text-[#245C4F]">No fee records found.</p> : null}
      </div>
    </section>
  );
}
