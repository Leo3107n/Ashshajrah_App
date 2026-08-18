import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    const [item] = await prisma.$queryRaw`
      SELECT
        student_name,
        parent_name,
        class_level,
        email,
        phone,
        LOWER(status::text) AS status,
        LOWER(COALESCE(admission_form_status::text, '')) AS admission_form_status,
        registration_lead_id::text AS registration_lead_id
      FROM interested_students
      WHERE registration_token = ${token}
      LIMIT 1
    `;

    if (!item) {
      return json("This admission form link is no longer valid. The admission form may already have been submitted.", 410);
    }

    const isAlreadySubmitted =
      String(item.status || "").toLowerCase() === "registered" ||
      String(item.admission_form_status || "").toLowerCase() === "submitted" ||
      Boolean(item.registration_lead_id);

    if (isAlreadySubmitted) {
      return json("This admission form link is no longer valid because the form has already been submitted.", 410);
    }

    return json("Interested student fetched.", 200, {
      item: {
        student_name: item.student_name || "",
        parent_name: item.parent_name || "",
        class_level: item.class_level || "",
        email: item.email || "",
        phone: item.phone || "",
      },
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch interested student.", 500);
  }
}
