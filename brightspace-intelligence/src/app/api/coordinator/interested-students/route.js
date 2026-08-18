import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const items = await prisma.$queryRaw`
      SELECT
        istd.id::text AS id,
        istd.registration_code,
        NULLIF(TRIM(istd.parent_name), '') AS parent_name,
        COALESCE(NULLIF(TRIM(istd.child_name), ''), NULLIF(TRIM(istd.student_name), '')) AS child_name,
        COALESCE(
          NULLIF(TRIM(istd.student_name), ''),
          NULLIF(TRIM(istd.child_name), '')
        ) AS student_name,
        NULLIF(TRIM(istd.email), '') AS email,
        NULLIF(TRIM(istd.phone), '') AS phone,
        NULLIF(TRIM(istd.class_level), '') AS class_level,
        istd.child_dob,
        CASE
          WHEN istd.child_dob IS NULL THEN NULL
          ELSE CONCAT(
            FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, istd.child_dob)))::int,
            ' years'
          )
        END AS child_age,
        NULLIF(TRIM(istd.city), '') AS city,
        NULLIF(TRIM(istd.country), '') AS country,
        CASE
          WHEN NULLIF(TRIM(istd.city), '') IS NOT NULL AND NULLIF(TRIM(istd.country), '') IS NOT NULL
            THEN CONCAT(TRIM(istd.city), ', ', TRIM(istd.country))
          ELSE COALESCE(
            NULLIF(TRIM(istd.city), ''),
            NULLIF(TRIM(istd.country), '')
          )
        END AS city_country,
        COALESCE(
          NULLIF(TRIM(istd.message), ''),
          NULLIF(TRIM(istd.why_interested), ''),
          NULLIF(TRIM(istd.questions_comments), ''),
          NULLIF(TRIM(istd.notes), '')
        ) AS message,
        COALESCE(istd.source, '') AS source,
        LOWER(istd.status::text) AS status,
        istd.admission_form_sent_at,
        istd.admission_form_due_at,
        istd.admission_form_last_reminder_at,
        istd.admission_form_reminder_count,
        LOWER(istd.admission_form_status::text) AS admission_form_status,
        istd.admission_form_submitted_at,
        istd.admission_form_last_channel,
        istd.admission_form_last_error,
        COALESCE(NULLIF(LOWER(TRIM(istd.parent_form_sent_status::text)), ''), 'no') AS parent_form_sent_status,
        istd.registration_token,
        istd.registration_link_generated_at,
        istd.registration_link_generated_by::text AS registration_link_generated_by,
        istd.registration_lead_id::text AS registration_lead_id,
        LOWER(COALESCE(rl.status::text, istd.status::text, '')) AS registration_status,
        pif.registration_code AS parent_interview_registration_code,
        pif.parent_interview_form_id,
        pif.parent_interview_status,
        pif.parent_interview_token_hash,
        pif.parent_interview_link,
        istd.parent_interview_url AS parent_interview_form_url,
        pif.parent_interview_sent_count,
        pif.parent_interview_submitted_count,
        pif.parent_interview_created_at,
        pif.parent_interview_submitted_at,
        pif.parent_interview_reviewed_at,
        NULLIF(TRIM(istd.notes), '') AS notes,
        istd.created_at,
        istd.updated_at
      FROM interested_students istd
      LEFT JOIN LATERAL (
        SELECT
          rl_inner.status,
          rl_inner.id,
          rl_inner.student_name,
          rl_inner.parent_name,
          rl_inner.email,
          rl_inner.phone
        FROM registration_leads rl_inner
        WHERE (
          rl_inner.id::text = istd.registration_lead_id::text
          OR (
            NULLIF(TRIM(istd.email), '') IS NOT NULL
            AND LOWER(NULLIF(TRIM(rl_inner.email), '')) = LOWER(NULLIF(TRIM(istd.email), ''))
          )
          OR (
            NULLIF(TRIM(istd.phone), '') IS NOT NULL
            AND REGEXP_REPLACE(COALESCE(rl_inner.phone, ''), '\\D', '', 'g') = REGEXP_REPLACE(COALESCE(istd.phone, ''), '\\D', '', 'g')
          )
          OR (
            NULLIF(TRIM(istd.student_name), '') IS NOT NULL
            AND LOWER(NULLIF(TRIM(rl_inner.student_name), '')) = LOWER(NULLIF(TRIM(istd.student_name), ''))
          )
          OR (
            NULLIF(TRIM(istd.child_name), '') IS NOT NULL
            AND LOWER(NULLIF(TRIM(rl_inner.student_name), '')) = LOWER(NULLIF(TRIM(istd.child_name), ''))
          )
        )
        ORDER BY
          CASE
            WHEN rl_inner.id::text = istd.registration_lead_id::text THEN 0
            WHEN LOWER(COALESCE(rl_inner.status::text, '')) = 'access_granted' THEN 1
            ELSE 2
          END,
          rl_inner.created_at DESC NULLS LAST,
          rl_inner.id DESC
        LIMIT 1
      ) rl ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          pif_inner.id::text AS parent_interview_form_id,
          pif_inner.registration_id AS registration_code,
          pif_inner.token_hash AS parent_interview_token_hash,
          LOWER(COALESCE(pif_inner.status::text, 'pending')) AS parent_interview_status,
          CASE
            WHEN NULLIF(TRIM(istd.parent_interview_url), '') IS NOT NULL THEN
              istd.parent_interview_url
            WHEN NULLIF(TRIM(pif_inner.token_hash), '') IS NOT NULL THEN
              CONCAT(
                'https://ashshajrah.com/parent-interview-preview',
                CASE
                  WHEN NULLIF(TRIM(${process.env.PARENT_INTERVIEW_PREVIEW_PASSWORD || ""}), '') IS NOT NULL
                    THEN CONCAT('?password=', ${process.env.PARENT_INTERVIEW_PREVIEW_PASSWORD || ""})
                  ELSE ''
                END
              )
            ELSE NULL
          END AS parent_interview_link,
          CASE
            WHEN LOWER(COALESCE(pif_inner.status::text, '')) IN ('submitted', 'reviewed')
              OR pif_inner.submitted_at IS NOT NULL THEN 1
            ELSE 0
          END::int AS parent_interview_submitted_count,
          CASE
            WHEN LOWER(COALESCE(pif_inner.status::text, '')) = 'sent' THEN 1
            ELSE 0
          END::int AS parent_interview_sent_count,
          pif_inner.created_at AS parent_interview_created_at,
          pif_inner.submitted_at AS parent_interview_submitted_at,
          pif_inner.reviewed_at AS parent_interview_reviewed_at
        FROM parent_interview_forms pif_inner
        WHERE (
          NULLIF(TRIM(pif_inner.registration_id), '') = COALESCE(NULLIF(TRIM(istd.registration_code), ''), istd.registration_lead_id::text, istd.id::text)
          OR NULLIF(TRIM(pif_inner.registration_id), '') = istd.registration_lead_id::text
          OR NULLIF(TRIM(pif_inner.registration_id), '') = istd.id::text
          OR (
            NULLIF(TRIM(pif_inner.registration_id), '') IS NULL
            AND LOWER(NULLIF(TRIM(pif_inner.parent_email), '')) = LOWER(NULLIF(TRIM(istd.email), ''))
            AND LOWER(NULLIF(TRIM(pif_inner.child_name), '')) = LOWER(
              COALESCE(
                NULLIF(TRIM(istd.child_name), ''),
                NULLIF(TRIM(istd.student_name), '')
              )
            )
          )
        )
        ORDER BY pif_inner.created_at DESC
        LIMIT 1
        ) pif ON TRUE
      WHERE COALESCE(LOWER(istd.status::text), '') <> 'archived'
        AND COALESCE(LOWER(istd.admission_form_status::text), '') <> 'failed'
      ORDER BY istd.created_at DESC NULLS LAST, istd.id DESC
    `;

    return json("Interested students fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch interested students.", 500);
  }
}
