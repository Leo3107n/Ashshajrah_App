import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function planStatus(startDate, endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (start && today < start) return "upcoming";
  if (end && today > end) return "completed";
  return "active";
}

async function signedMediaUrls(paths = []) {
  const urls = [];
  for (const path of paths) {
    try {
      urls.push({
        path,
        url: await createSignedAdmissionDocumentUrl(path, 3600),
        type: String(path || "").toLowerCase().endsWith(".mp4") ? "video" : "image",
      });
    } catch {
      urls.push({ path, url: "", type: "file" });
    }
  }
  return urls;
}

export async function GET(request) {
  try {
    await requireRole(["student", "parent"]);

    const { searchParams } = new URL(request.url);
    const statusFilter = String(searchParams.get("status") || "all").toLowerCase();

    const rows = await prisma.$queryRaw`
      SELECT
        id::text,
        name,
        start_date::text,
        end_date::text,
        COALESCE(image_urls, ARRAY[]::text[]) AS image_urls,
        created_by::text,
        created_at::text,
        updated_at::text
      FROM monthly_plans
      ORDER BY start_date DESC, created_at DESC
    `;

    const items = await Promise.all(
      rows.map(async (row) => {
        const status = planStatus(row.start_date, row.end_date);
        return {
          ...row,
          status,
          media: await signedMediaUrls(row.image_urls || []),
        };
      })
    );

    const filtered =
      statusFilter === "all"
        ? items
        : items.filter((item) => item.status === statusFilter);

    return json("Monthly plans fetched.", 200, {
      items: filtered,
      summary: {
        total: items.length,
        active: items.filter((item) => item.status === "active").length,
        upcoming: items.filter((item) => item.status === "upcoming").length,
        completed: items.filter((item) => item.status === "completed").length,
      },
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load monthly plans.", 500);
  }
}
