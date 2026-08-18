import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["superadmin", "admin"]);

function contentDisposition(fileName, download = false) {
  const safeName = String(fileName || "resume.pdf").replace(/"/g, "");
  return `${download ? "attachment" : "inline"}; filename="${safeName}"`;
}

export async function GET(request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return new NextResponse("Unauthorized.", { status: 401 });
  if (!ALLOWED_ROLES.has(role)) return new NextResponse("Forbidden.", { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const download = String(searchParams.get("download") || "").toLowerCase() === "1";

  try {
    const [row] = await prisma.$queryRaw`
      SELECT
        resume_file_name,
        resume_mime_type,
        resume_file_data
      FROM career_applications
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!row?.resume_file_data) {
      return new NextResponse("Resume not found.", { status: 404 });
    }

    const mimeType = row.resume_mime_type || "application/pdf";
    const buffer = Buffer.from(row.resume_file_data);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": mimeType,
        "content-disposition": contentDisposition(row.resume_file_name, download),
        "cache-control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "Unable to load resume.", {
      status: 500,
    });
  }
}
