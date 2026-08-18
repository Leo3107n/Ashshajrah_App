import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSignedPaymentProofUrl } from "@/lib/supabaseStorage";

const FILTER_TO_DB_STATUS = {
  pending: "pending",
  verified: "verified",
  rejected: "rejected",
};

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdminSession() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return { error: json("Unauthorized.", 401) };
  }

  if (role !== "admin" && role !== "superadmin") {
    return { error: json("Forbidden.", 403) };
  }

  return { session };
}

async function addSignedUrls(items) {
  return Promise.all(
    items.map(async (item) => {
      let proofUrl = item.stored_proof_file_url || "";

      if (item.proof_file_path) {
        try {
          proofUrl = await createSignedPaymentProofUrl(item.proof_file_path);
        } catch {
          // Local development and migrated records may not have Supabase
          // storage credentials. Keep a previously stored URL when available.
        }
      }

      return {
        ...item,
        proof_file_url: proofUrl,
      };
    })
  );
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const search = normalizeText(searchParams.get("search"));
    const dbStatus = FILTER_TO_DB_STATUS[status] || "";
    const values = [];
    const conditions = [];

    if (dbStatus) {
      values.push(dbStatus);
      conditions.push(`fs."status"::text = $${values.length}`);
    }

    if (search) {
      const term = `%${search}%`;
      values.push(term);
      const firstIndex = values.length;
      values.push(term);
      const secondIndex = values.length;
      values.push(term);
      const thirdIndex = values.length;
      values.push(term);
      const fourthIndex = values.length;
      conditions.push(`
        (
          rl."student_name" ILIKE $${firstIndex}
          OR rl."parent_name" ILIKE $${secondIndex}
          OR fs."transaction_id" ILIKE $${thirdIndex}
          OR fv."voucher_no" ILIKE $${fourthIndex}
        )
      `);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [pendingRow, verifiedRow, rejectedRow, items] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'verified'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'rejected'`,
      prisma.$queryRawUnsafe(
        `
        SELECT
          fs.id::text AS id,
          fs.payer_name,
          fs.transaction_id,
          fs.paid_amount,
          fs.paid_at,
          fs.proof_file_path,
          fs.proof_file_url AS stored_proof_file_url,
          fs."status"::text AS status,
          fv.id::text AS fee_voucher_id,
          fv.voucher_no,
          fv.amount AS voucher_amount,
          fv.status::text AS voucher_status,
          rl.id::text AS registration_lead_id,
          rl.student_name,
          rl.parent_name,
          rl.email,
          rl.phone
        FROM fee_submissions fs
        INNER JOIN fee_vouchers fv ON fv.id = fs.voucher_id
        INNER JOIN registration_leads rl ON rl.id = fv.registration_id
        ${whereClause}
        ORDER BY fs.paid_at DESC NULLS LAST, fs.id DESC
        `,
        ...values
      ),
    ]);

    return json("Admin payments fetched.", 200, {
      counts: {
        pending: Number(pendingRow?.[0]?.total || 0),
        verified: Number(verifiedRow?.[0]?.total || 0),
        rejected: Number(rejectedRow?.[0]?.total || 0),
      },
      items: await addSignedUrls(items),
      filters: {
        statuses: Object.keys(FILTER_TO_DB_STATUS),
      },
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch payments.", 500);
  }
}
