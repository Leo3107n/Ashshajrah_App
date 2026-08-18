import { notFound } from "next/navigation";
import PaymentSubmissionForm from "@/components/payment/PaymentSubmissionForm";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function normalizePaymentMethods(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

async function getVoucher(voucherNo) {
  const [item] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount,
        fv.regular_fee_amount,
        fv.admission_fee_amount,
        fv.subtotal_amount,
        fv.discount_amount,
        fv.total_amount,
        fv.due_date,
        LOWER(fv.status::text) AS status,
        fv.payment_method_id::text AS payment_method_id,
        fv.payment_method,
        fv.payment_instructions,
        fv.payment_method_options,
        COALESCE(su.full_name, rl.student_name, item.student_name, '') AS student_name,
        COALESCE(rl.parent_name, item.parent_name, '') AS parent_name,
        COALESCE(rl.class_level, c.class_level, c.title, '') AS class_level,
        COALESCE(rl.email, item.student_email, item.parent_email, '') AS email,
        COALESCE(rl.phone, item.student_phone, item.parent_phone, '') AS phone
    FROM fee_vouchers fv
    LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
    LEFT JOIN regular_monthly_fee_voucher_items item ON item.voucher_id = fv.id
    LEFT JOIN student_profiles sp ON sp.id = item.student_id
    LEFT JOIN users su ON su.id = sp.user_id
    LEFT JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
    LEFT JOIN courses c ON c.id = b.class_id
    WHERE fv.voucher_no = ${voucherNo}
    LIMIT 1
  `;

  if (!item?.id) {
    return item;
  }

  const availablePaymentMethods = await prisma.$queryRaw`
    SELECT
      pm.id::text AS id,
      pm.name,
      pm.method_key,
      pm.account_title,
      pm.account_number,
      pm.iban,
      pm.bank_name,
      pm.branch_code,
      pm.instructions,
      LOWER(pm.status::text) AS status
    FROM payment_methods pm
    WHERE LOWER(pm.status::text) = 'active'
    ORDER BY pm.name ASC
  `;

  const [paymentMethod] = item.payment_method_id
    ? await prisma.$queryRaw`
        SELECT
          pm.id::text AS id,
          pm.name,
          pm.method_key,
          pm.account_title,
          pm.account_number,
          pm.iban,
          pm.bank_name,
          pm.branch_code,
          pm.instructions,
          LOWER(pm.status::text) AS status
        FROM payment_methods pm
        WHERE pm.id = ${item.payment_method_id}::uuid
          AND LOWER(pm.status::text) = 'active'
        LIMIT 1
      `
    : [null];

  return {
    ...item,
    payment_method_details: paymentMethod || null,
    available_payment_methods: availablePaymentMethods || [],
  };
}

export default async function PaymentVoucherPage({ params }) {
  const { voucherNo } = await params;
  const voucher = await getVoucher(voucherNo);

  if (!voucher?.id) {
    notFound();
  }

  const serializedVoucher = {
    id: String(voucher.id),
    voucher_no: String(voucher.voucher_no || ""),
    amount: Number(voucher.amount || 0),
    regular_fee_amount: Number(voucher.regular_fee_amount || 0),
    admission_fee_amount: Number(voucher.admission_fee_amount || 0),
    subtotal_amount: Number(voucher.subtotal_amount || 0),
    discount_amount: Number(voucher.discount_amount || 0),
    total_amount: Number(voucher.total_amount || voucher.amount || 0),
    due_date: voucher.due_date ? new Date(voucher.due_date).toISOString() : null,
    status: String(voucher.status || ""),
    payment_method: voucher.payment_method || "",
    payment_instructions: voucher.payment_instructions || "",
    payment_method_details: voucher.payment_method_details || null,
    available_payment_methods: normalizePaymentMethods(
      voucher.available_payment_methods || voucher.payment_method_options
    ),
    student_name: voucher.student_name || "",
    parent_name: voucher.parent_name || "",
    class_level: voucher.class_level || "",
    email: voucher.email || "",
    phone: voucher.phone || "",
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_26%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)] px-4 py-10 text-[#063F32] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#E4C766]">
            Payment submission
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">
            Voucher {voucher.voucher_no}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Submit payment details and proof for this voucher. Your submission will be reviewed by the coordinator before LMS access is granted.
          </p>
        </section>

        <PaymentSubmissionForm voucher={serializedVoucher} />
      </div>
    </main>
  );
}
