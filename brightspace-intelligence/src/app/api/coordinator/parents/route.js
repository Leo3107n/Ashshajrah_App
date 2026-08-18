import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueConflictMessage(error) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (!message.includes("23505")) return "";
  if (message.includes("(phone)=")) return "This phone number is already used by another account.";
  if (message.includes("(email)=")) return "This email address is already used by another account.";

  return "This record conflicts with an existing account.";
}

export async function GET(request) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const conditions = [];
    const values = [];

    if (search) {
      const term = `%${search}%`;
      values.push(term);
      conditions.push(`(
          u.full_name ILIKE $${values.length}
          OR u.email ILIKE $${values.length}
          OR u.phone ILIKE $${values.length}
          OR COALESCE(
            CASE
              WHEN LOWER(COALESCE(pp.relation, '')) IN ('', 'parent')
                THEN NULLIF(latest_registration.parent_relation, '')
              ELSE pp.relation
            END,
            pp.relation,
            ''
          ) ILIKE $${values.length}
        )`);
    }

    conditions.push("LOWER(u.status::text) <> 'archived'");

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        pp.id::text AS id,
        u.id::text AS user_id,
        COALESCE(
          NULLIF(TRIM(u.full_name), ''),
          NULLIF(TRIM(latest_registration.parent_name), '')
        ) AS full_name,
        u.email,
        u.phone,
        u.status::text AS status,
        pp.created_at,
        CASE
          WHEN LOWER(COALESCE(pp.relation, '')) IN ('', 'parent')
            THEN COALESCE(NULLIF(latest_registration.parent_relation, ''), COALESCE(pp.relation, ''))
          ELSE COALESCE(pp.relation, '')
        END AS relation,
        STRING_AGG(su.full_name, ', ' ORDER BY su.full_name) AS student_names,
        COALESCE(
          STRING_AGG(DISTINCT NULLIF(c.title, ''), ', ' ORDER BY NULLIF(c.title, '')),
          ''
        ) AS course_titles,
        COALESCE(
          STRING_AGG(DISTINCT NULLIF(rl.class_level, ''), ', ' ORDER BY NULLIF(rl.class_level, '')),
          ''
        ) AS class_levels,
        COALESCE(
          STRING_AGG(
            DISTINCT NULLIF(
              CASE
                WHEN LOWER(COALESCE(pp.relation, '')) IN ('', 'parent')
                  THEN COALESCE(NULLIF(rl.parent_relation, ''), COALESCE(pp.relation, ''))
                ELSE COALESCE(pp.relation, '')
              END,
              ''
            ),
            ', '
            ORDER BY NULLIF(
              CASE
                WHEN LOWER(COALESCE(pp.relation, '')) IN ('', 'parent')
                  THEN COALESCE(NULLIF(rl.parent_relation, ''), COALESCE(pp.relation, ''))
                ELSE COALESCE(pp.relation, '')
              END,
              ''
            )
          ),
          ''
        ) AS student_relations,
        COALESCE(MAX(rl.city), '') AS city,
        COALESCE(MAX(rl.father_name_english), '') AS father_name_english,
        COALESCE(MAX(rl.mother_name_english), '') AS mother_name_english,
        COALESCE(MAX(rl.preferred_contact_person), '') AS preferred_contact_person
      FROM parent_profiles pp
      INNER JOIN users u ON u.id = pp.user_id
      LEFT JOIN student_parents spp ON spp.parent_id = pp.id
      LEFT JOIN student_profiles sp ON sp.id = spp.student_id
      LEFT JOIN users su ON su.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN LATERAL (
        SELECT rl.parent_name, rl.parent_relation
        FROM student_parents spp_latest
        INNER JOIN enrollments e ON e.student_id = spp_latest.student_id
        INNER JOIN registration_leads rl ON rl.id = e.registration_id
        WHERE spp_latest.parent_id = pp.id
        ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, rl.created_at DESC NULLS LAST
        LIMIT 1
      ) latest_registration ON TRUE
      ${whereClause}
      GROUP BY pp.id, u.id, u.full_name, u.email, u.phone, u.status, pp.relation, latest_registration.parent_relation, latest_registration.parent_name
      ORDER BY COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(latest_registration.parent_name), ''), '') ASC
      `,
      ...values
    );

    return json("Parents fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(error instanceof Error ? error.message : "Unable to fetch parents.", 500);
  }
}

export async function PUT(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const id = normalizeText(body?.id);
    const fullName = normalizeText(body?.full_name);
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);
    const relation = normalizeText(body?.relation) || "parent";
    const status = normalizeText(body?.status).toLowerCase();

    if (!id) return json("Parent id is required.", 400);
    if (!fullName) return json("Parent name is required.", 400);
    if (!email && !phone) return json("Parent email is required.", 400);
    if (status && !["active", "suspended", "archived"].includes(status)) {
      return json("Invalid parent status.", 400);
    }

    const [parent] = await prisma.$queryRaw`
      SELECT pp.id::text AS id, u.id::text AS user_id
      FROM parent_profiles pp
      INNER JOIN users u ON u.id = pp.user_id
      WHERE pp.id = ${id}::uuid
      LIMIT 1
    `;

    if (!parent?.id) return json("Parent not found.", 404);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE users
        SET
          full_name = ${fullName},
          email = ${email || null},
          phone = ${phone || null},
          status = ${status || "active"}::user_status,
          updated_at = NOW()
        WHERE id = ${parent.user_id}::uuid
      `;

      await tx.$executeRaw`
        UPDATE parent_profiles
        SET relation = ${relation}, updated_at = NOW()
        WHERE id = ${parent.id}::uuid
      `;

      await tx.$executeRaw`
        UPDATE registration_leads rl
        SET
          parent_name = ${fullName},
          parent_relation = ${relation},
          email = COALESCE(NULLIF(${email}, ''), rl.email),
          phone = COALESCE(NULLIF(${phone}, ''), rl.phone),
          updated_at = NOW()
        FROM student_parents spp
        INNER JOIN enrollments e ON e.student_id = spp.student_id
        WHERE spp.parent_id = ${parent.id}::uuid
          AND e.registration_id = rl.id
      `;

      await tx.$executeRaw`
        UPDATE interested_students istd
        SET
          parent_name = ${fullName},
          parent_relation = ${relation},
          email = COALESCE(NULLIF(${email}, ''), istd.email),
          phone = COALESCE(NULLIF(${phone}, ''), istd.phone),
          updated_at = NOW()
        FROM student_parents spp
        INNER JOIN enrollments e ON e.student_id = spp.student_id
        WHERE spp.parent_id = ${parent.id}::uuid
          AND istd.registration_lead_id = e.registration_id
      `;

      await tx.$executeRaw`
        UPDATE parent_interview_forms pif
        SET
          parent_name = ${fullName},
          parent_email = COALESCE(NULLIF(${email}, ''), pif.parent_email),
          updated_at = NOW()
        WHERE EXISTS (
          SELECT 1
          FROM student_parents spp
          INNER JOIN enrollments e ON e.student_id = spp.student_id
          LEFT JOIN interested_students istd ON istd.registration_lead_id = e.registration_id
          WHERE spp.parent_id = ${parent.id}::uuid
            AND (
              pif.registration_id = e.registration_id::text
              OR pif.registration_id = istd.id::text
              OR pif.registration_id = istd.registration_code
            )
        )
      `;

      await tx.$executeRaw`
        INSERT INTO audit_logs (id, actor_user_id, entity_type, entity_id, action)
        VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'parent_profiles', ${parent.id}::uuid, 'parent_updated')
      `;
    });

    return json("Parent updated.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    const conflictMessage = uniqueConflictMessage(error);
    if (conflictMessage) return json(conflictMessage, 409);
    return json(error instanceof Error ? error.message : "Unable to update parent.", 500);
  }
}

export async function DELETE(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const id = normalizeText(searchParams.get("id"));

    if (!id) return json("Parent id is required.", 400);

    const [parent] = await prisma.$queryRaw`
      SELECT pp.id::text AS id, u.id::text AS user_id
      FROM parent_profiles pp
      INNER JOIN users u ON u.id = pp.user_id
      WHERE pp.id = ${id}::uuid
      LIMIT 1
    `;

    if (!parent?.id) return json("Parent not found.", 404);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE users
        SET status = 'archived'::user_status, updated_at = NOW()
        WHERE id = ${parent.user_id}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO audit_logs (id, actor_user_id, entity_type, entity_id, action)
        VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'parent_profiles', ${parent.id}::uuid, 'parent_archived')
      `;
    });

    return json("Parent archived.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to archive parent.", 500);
  }
}
