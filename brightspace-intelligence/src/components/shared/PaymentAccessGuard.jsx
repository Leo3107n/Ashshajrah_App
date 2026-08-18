"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

export default function PaymentAccessGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ blocked: false });

  useEffect(() => {
    let active = true;
    let timer = null;

    async function load() {
      try {
        const response = await fetch("/api/payment-access-status", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (active) {
          setStatus(data || { blocked: false });
        }
      } catch {
        if (active) {
          setStatus({ blocked: true, message: "Payment status could not be verified. Please contact administration." });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    timer = setInterval(() => {
      void load();
    }, 60000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[88vh] items-center justify-center">
        <OpenBookLoader title="Checking access" subtitle="Opening your classroom..." />
      </div>
    );
  }

  if (!status.blocked) {
    return children;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-lg border border-white/70 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-700">
          Payment Due Date Passed
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Payment submission due date has passed.
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {status.message || "Please contact administration."}
        </p>
        {status.voucher_no ? (
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-950">Voucher No:</span> {status.voucher_no}
          </p>
        ) : null}
        {status.due_date ? (
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold text-slate-950">Due Date:</span> {String(status.due_date)}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
