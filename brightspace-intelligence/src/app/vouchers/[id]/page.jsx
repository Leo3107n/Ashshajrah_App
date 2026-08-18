import { notFound } from "next/navigation";
import PaymentSubmissionForm from "@/components/payment/PaymentSubmissionForm";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getVoucherById(id) {
  const [item] = await prisma.$queryRaw`
    SELECT
      fv.id::text AS id,
      fv.voucher_no,
      fv.amount,
      fv.due_date,
      LOWER(fv.status::text) AS status,
      fv.payment_method,
      fv.payment_instructions,
      rl.student_name,
      rl.parent_name,
      rl.email,
      rl.phone
    FROM fee_vouchers fv
    INNER JOIN registration_leads rl ON rl.id = fv.registration_id
    WHERE fv.id = ${id}::uuid
    LIMIT 1
  `;

  return item;
}

export default async function PublicVoucherPage({ params }) {
  const resolvedParams = await params;
  const voucherId = resolvedParams.id;
  const voucher = await getVoucherById(voucherId);

  if (!voucher?.id) {
    notFound();
  }

  const safeVoucher = {
    ...voucher,
    amount: Number(voucher.amount),
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_26%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)] px-4 py-10 text-[#063F32] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#E4C766]">
            Payment submission
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">
            Voucher {safeVoucher.voucher_no}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Submit your payment details and upload proof for review. The coordinator will verify the payment before LMS access is granted.
          </p>
        </section>

        <PaymentSubmissionForm voucher={safeVoucher} />
      </div>
    </main>
  );
}
