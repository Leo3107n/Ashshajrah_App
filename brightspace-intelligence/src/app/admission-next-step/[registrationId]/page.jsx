import { notFound } from "next/navigation";
import AdmissionNextStepClient from "@/components/admission/AdmissionNextStepClient";
import prisma from "@/lib/prisma";

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

async function getLead(registrationId) {
  const [lead] = await prisma.$queryRaw`
    SELECT
      rl.id::text AS id,
      rl.student_name,
      rl.parent_name,
      rl.class_level,
      rl.email,
      rl.phone,
      rl.program_name
    FROM registration_leads rl
    WHERE rl.id = ${registrationId}::uuid
    LIMIT 1
  `;

  return lead || null;
}

async function getVoucher(voucherNo) {
  if (!voucherNo) {
    return null;
  }

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
      COALESCE(rl.student_name, '') AS student_name,
      COALESCE(rl.parent_name, '') AS parent_name,
      COALESCE(rl.class_level, '') AS class_level,
      COALESCE(rl.email, '') AS email,
      COALESCE(rl.phone, '') AS phone
    FROM fee_vouchers fv
    LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
    WHERE fv.voucher_no = ${voucherNo}
    LIMIT 1
  `;

  if (!item?.id) {
    return null;
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

async function getScholarship(registrationId) {
  const [item] = await prisma.$queryRaw`
    SELECT
      nbsf.id::text AS id,
      nbsf.dependents_count,
      nbsf.school_going_children_count,
      nbsf.residence_type,
      nbsf.requested_amount::float8 AS requested_amount,
      nbsf.scholarship_reason,
      LOWER(nbsf.status::text) AS status
    FROM need_based_scholarship_forms nbsf
    WHERE nbsf.registration_id = ${registrationId}::uuid
    ORDER BY nbsf.created_at DESC NULLS LAST
    LIMIT 1
  `;

  return item || null;
}

export default async function AdmissionNextStepPage({ params, searchParams }) {
  const { registrationId } = await params;
  const resolvedSearchParams = await searchParams;
  const voucherNo = String(resolvedSearchParams?.voucherNo || "").trim();
  const submitted = String(resolvedSearchParams?.submitted || "") === "1";
  const leadToken = String(resolvedSearchParams?.leadToken || "").trim();

  const [lead, voucher, scholarship] = await Promise.all([
    getLead(registrationId),
    getVoucher(voucherNo),
    getScholarship(registrationId),
  ]);

  if (!lead?.id) {
    notFound();
  }

  const serializedVoucher = voucher
    ? {
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
      }
    : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_26%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)] px-4 py-10 text-[#063F32] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <AdmissionNextStepClient
          registrationId={registrationId}
          leadToken={leadToken}
          submitted={submitted}
          voucher={serializedVoucher}
          lead={lead}
          scholarship={scholarship}
        />
      </div>
    </main>
  );
}
