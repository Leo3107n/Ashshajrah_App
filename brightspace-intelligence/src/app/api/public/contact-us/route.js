import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function json(success, message, status = 200, extra = {}) {
  return NextResponse.json({ success, message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const studentName = normalizeText(body?.student_name);
    const parentName = normalizeText(body?.parent_name);
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);

    if (!studentName) return json(false, "Student name is required.", 400);
    if (!parentName) return json(false, "Parent name is required.", 400);
    if (!email || !isValidEmail(email)) return json(false, "A valid email is required.", 400);
    if (!phone) return json(false, "Phone number is required.", 400);

    const [coordinator] = await prisma.$queryRaw`
      SELECT
        u.email,
        u.full_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE LOWER(r.name) = 'coordinator'
        AND LOWER(u.status::text) = 'active'
        AND COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
      ORDER BY u.created_at ASC NULLS LAST, u.id ASC
      LIMIT 1
    `;

    await prisma.$executeRaw`
      INSERT INTO interested_students (
        id,
        student_name,
        parent_name,
        email,
        phone,
        source,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${studentName},
        ${parentName},
        ${email},
        ${phone},
        ${"contact_us"},
        ${"new"},
        NOW(),
        NOW()
      )
    `;

    if (coordinator?.email) {
      const subject = `New interested student: ${studentName}`;
      const coordinatorName = coordinator.full_name || "Coordinator";
      const linkText = `Assalamualaikum ${coordinatorName},\n\nA new interested student has submitted the contact form.\n\nStudent: ${studentName}\nParent: ${parentName}\nEmail: ${email}\nPhone: ${phone}\nSource: contact_us\nStatus: new\n\nPlease review this lead in the Interested Students section.`;
      const html = `
        <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
            <p style="margin:0 0 12px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#0284c7;font-weight:700;">New Interested Student</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Assalamualaikum <strong>${coordinatorName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">A new interested student has submitted the contact form.</p>
            <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#f8fafc;font-size:14px;line-height:1.8;">
              <div><strong>Student:</strong> ${studentName}</div>
              <div><strong>Parent:</strong> ${parentName}</div>
              <div><strong>Email:</strong> ${email}</div>
              <div><strong>Phone:</strong> ${phone}</div>
              <div><strong>Source:</strong> contact_us</div>
              <div><strong>Status:</strong> new</div>
            </div>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Please review this lead in the Interested Students section.</p>
          </div>
        </div>
      `;

      try {
        await sendEmail({
          to: coordinator.email,
          subject,
          html,
          text: linkText,
        });
      } catch (mailError) {
        console.error("INTERESTED_STUDENT_NOTIFY_ERROR:", mailError);
      }
    }

    return json(true, "Thank you. Our coordinator will contact you soon.", 201);
  } catch (error) {
    return json(false, error instanceof Error ? error.message : "Unable to submit contact request.", 500);
  }
}
