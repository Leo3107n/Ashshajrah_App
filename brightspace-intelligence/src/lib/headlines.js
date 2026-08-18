import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function headlinesTableExists(tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'headlines'
    ) AS exists
  `;

  return Boolean(row?.exists);
}

export async function getActiveHeadlines(tx = prisma) {
  if (!(await headlinesTableExists(tx))) {
    return [];
  }

  return tx.$queryRaw`
    SELECT
      id::text AS id,
      headline,
      start_date::text AS start_date,
      end_date::text AS end_date,
      created_at::text AS created_at
    FROM headlines
    WHERE start_date <= ${Prisma.raw("(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::date")}
      AND end_date >= ${Prisma.raw("(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::date")}
    ORDER BY start_date ASC, created_at DESC, id DESC
  `;
}
