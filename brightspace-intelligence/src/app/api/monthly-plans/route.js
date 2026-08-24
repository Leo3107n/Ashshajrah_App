import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createPublicAdmissionDocumentUrl } from "@/lib/supabaseStorage";

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
  if (end && today > end) return "expired";
  return "active";
}

function mediaUrls(paths = []) {
  return paths.map((path, index) => {
    const value = String(path || "");
    const embedded = value.startsWith("data:");
    const video = embedded
      ? value.toLowerCase().startsWith("data:video/")
      : value.toLowerCase().endsWith(".mp4");

    return {
      // Avoid sending the large Base64 value twice in the API response.
      path: embedded ? `embedded-media-${index + 1}` : path,
      url: embedded ? value : createPublicAdmissionDocumentUrl(path),
      type: video ? "video" : "image",
    };
  });
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
        COALESCE(
          (
            SELECT array_agg(media_path.path ORDER BY media_path.position)
            FROM unnest(COALESCE(monthly_plans.image_urls, ARRAY[]::text[]))
              WITH ORDINALITY AS media_path(path, position)
            WHERE media_path.path LIKE 'data:image/%;base64,%'
               OR media_path.path LIKE 'data:video/%;base64,%'
               OR EXISTS (
                 SELECT 1
                 FROM storage.objects stored_media
                 WHERE stored_media.bucket_id = split_part(media_path.path, '/', 1)
                   AND stored_media.name = substring(
                     media_path.path FROM position('/' IN media_path.path) + 1
                   )
               )
          ),
          ARRAY[]::text[]
        ) AS image_urls,
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
          media: mediaUrls(row.image_urls || []),
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
        expired: items.filter((item) => item.status === "expired").length,
      },
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load monthly plans.", 500);
  }
}
