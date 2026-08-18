import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

function padSequence(value) {
  return String(value).padStart(4, "0");
}

export function getVoucherPrefix(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `LMS-${year}${month}`;
}

export async function generateVoucherNumber(date = new Date()) {
  const prefix = getVoucherPrefix(date);
  const likePattern = `${prefix}-%`;
  const [row] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT voucher_no
      FROM fee_vouchers
      WHERE voucher_no LIKE ${likePattern}
      ORDER BY voucher_no DESC
      LIMIT 1
    `
  );

  const lastVoucherNo = String(row?.voucher_no || "");
  const lastSequence = Number(lastVoucherNo.split("-").pop() || 0);
  return `${prefix}-${padSequence(lastSequence + 1)}`;
}
