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
  if (message.includes("(admission_no)=")) return "This admission or roll number is already assigned to another student.";

  return "This record conflicts with an existing account.";
}

export async function GET(request) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];
    const values = [];

    if (search) {
      const term = `%${search}%`;
      values.push(term);
      conditions.push(`(
          u.full_name ILIKE $${values.length}
          OR u.email ILIKE $${values.length}
          OR u.phone ILIKE $${values.length}
          OR sp.admission_no ILIKE $${values.length}
          OR sp.grade_level ILIKE $${values.length}
        )`);
    }

    if (status) {
      values.push(status);
      conditions.push(`LOWER(COALESCE(sp.status::text, u.status::text)) = $${values.length}`);
    } else {
      conditions.push("LOWER(COALESCE(sp.status::text, u.status::text)) <> 'archived'");
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        sp.id::text AS id,
        u.id::text AS user_id,
        u.full_name,
        u.email AS student_email,
        u.phone AS student_phone,
        u.email AS contact_email,
        u.phone AS contact_phone,
        u.email,
        u.phone,
        sp.admission_no,
        sp.age,
        sp.created_at,
        sp.grade_level,
        sp.grade_level AS class_level,
        COALESCE(sp.status::text, u.status::text) AS status,
        c.title AS course_title,
        rl.id::text AS registration_lead_id,
        rl.student_name AS lead_student_name,
        rl.parent_name,
        rl.parent_relation,
        rl.phone AS lead_phone,
        rl.email AS lead_email,
        rl.city,
        rl.gender,
        rl.date_of_birth,
        rl.program_name,
        rl.nationality,
        p.full_name AS parent_name,
        pu.phone AS parent_phone,
        pu.email AS parent_email
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users p ON p.id = pp.user_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      ${whereClause}
      ORDER BY sp.created_at DESC NULLS LAST, sp.id DESC
      `,
      ...values
    );

    return json("Students fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(error instanceof Error ? error.message : "Unable to fetch students.", 500);
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
    const gradeLevel = normalizeText(body?.grade_level);
    const status = normalizeText(body?.status).toLowerCase();
    const age = body?.age === "" || body?.age == null ? null : Number(body.age);

    if (!id) return json("Student id is required.", 400);
    if (!fullName) return json("Student name is required.", 400);
    if (age !== null && (!Number.isInteger(age) || age < 1 || age > 100)) {
      return json("Student age must be a valid number.", 400);
    }
    if (status && !["active", "suspended", "archived"].includes(status)) {
      return json("Invalid student status.", 400);
    }

    const [student] = await prisma.$queryRaw`
      SELECT
        sp.id::text AS id,
        u.id::text AS user_id,
        (
          SELECT e.registration_id::text
          FROM enrollments e
          WHERE e.student_id = sp.id
            AND e.registration_id IS NOT NULL
          ORDER BY
            CASE WHEN LOWER(COALESCE(e.status, '')) = 'active' THEN 0 ELSE 1 END,
            e.created_at DESC NULLS LAST,
            e.id DESC
          LIMIT 1
        ) AS registration_id,
        (
          SELECT istd.id::text
          FROM enrollments e
          INNER JOIN interested_students istd ON istd.registration_lead_id = e.registration_id
          WHERE e.student_id = sp.id
          ORDER BY
            CASE WHEN LOWER(COALESCE(e.status, '')) = 'active' THEN 0 ELSE 1 END,
            e.created_at DESC NULLS LAST,
            e.id DESC
          LIMIT 1
        ) AS interested_student_id,
        (
          SELECT istd.registration_code
          FROM enrollments e
          INNER JOIN interested_students istd ON istd.registration_lead_id = e.registration_id
          WHERE e.student_id = sp.id
          ORDER BY
            CASE WHEN LOWER(COALESCE(e.status, '')) = 'active' THEN 0 ELSE 1 END,
            e.created_at DESC NULLS LAST,
            e.id DESC
          LIMIT 1
        ) AS interested_student_registration_code
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      WHERE sp.id = ${id}::uuid
      LIMIT 1
    `;

    if (!student?.id) return json("Student not found.", 404);

    const [targetCourse] = gradeLevel
      ? await prisma.$queryRaw`
          SELECT id::text AS id
          FROM courses
          WHERE LOWER(TRIM(COALESCE(class_level, title, ''))) = LOWER(TRIM(${gradeLevel}))
            AND LOWER(COALESCE(status::text, 'active')) = 'active'
          LIMIT 1
        `
      : [];

    if (gradeLevel && !targetCourse?.id) {
      return json("Selected class was not found in class management.", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE users
        SET
          full_name = ${fullName},
          email = ${email || null},
          phone = ${phone || null},
          status = ${status || "active"}::user_status,
          updated_at = NOW()
        WHERE id = ${student.user_id}::uuid
      `;

      await tx.$executeRaw`
        UPDATE student_profiles
        SET
          age = ${age},
          grade_level = ${gradeLevel || null},
          status = ${status || "active"}::user_status,
          updated_at = NOW()
        WHERE id = ${student.id}::uuid
      `;

      if (targetCourse?.id) {
        await tx.$executeRaw`
          UPDATE enrollments
          SET
            status = 'archived',
            end_date = CURRENT_DATE,
            updated_at = NOW()
          WHERE student_id = ${student.id}::uuid
            AND course_id <> ${targetCourse.id}::uuid
            AND LOWER(COALESCE(status, 'active')) = 'active'
        `;

        await tx.$executeRaw`
          INSERT INTO enrollments (
            id,
            student_id,
            course_id,
            registration_id,
            status,
            start_date,
            end_date,
            created_at,
            updated_at
          )
          VALUES (
            gen_random_uuid(),
            ${student.id}::uuid,
            ${targetCourse.id}::uuid,
            ${student.registration_id || null}::uuid,
            'active',
            CURRENT_DATE,
            NULL,
            NOW(),
            NOW()
          )
          ON CONFLICT (student_id, course_id)
          DO UPDATE SET
            registration_id = COALESCE(enrollments.registration_id, EXCLUDED.registration_id),
            status = 'active',
            end_date = NULL,
            updated_at = NOW()
        `;
      }

      await tx.$executeRaw`
        UPDATE registration_leads rl
        SET
          student_name = ${fullName},
          email = COALESCE(NULLIF(${email}, ''), rl.email),
          phone = COALESCE(NULLIF(${phone}, ''), rl.phone),
          age = ${age},
          class_level = ${gradeLevel || null},
          updated_at = NOW()
        FROM enrollments e
        WHERE e.registration_id = rl.id
          AND e.student_id = ${student.id}::uuid
      `;

      if (student.interested_student_id) {
        await tx.$executeRaw`
          UPDATE interested_students
          SET
            student_name = ${fullName},
            child_name = ${fullName},
            email = COALESCE(NULLIF(${email}, ''), email),
            phone = COALESCE(NULLIF(${phone}, ''), phone),
            class_level = ${gradeLevel || null},
            updated_at = NOW()
          WHERE id = ${student.interested_student_id}::uuid
        `;
      }

      if (student.registration_id || student.interested_student_id || student.interested_student_registration_code) {
        await tx.$executeRaw`
          UPDATE parent_interview_forms
          SET
            child_name = ${fullName},
            child_age = ${age === null ? null : String(age)},
            interested_programme = ${gradeLevel || null},
            updated_at = NOW()
          WHERE registration_id = ANY(
            ARRAY_REMOVE(
              ARRAY[
                ${student.registration_id || null},
                ${student.interested_student_id || null},
                ${student.interested_student_registration_code || null}
              ]::text[],
              NULL
            )
          )
        `;
      }

      await tx.$executeRaw`
        INSERT INTO audit_logs (id, actor_user_id, entity_type, entity_id, action)
        VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'student_profiles', ${student.id}::uuid, 'student_updated')
      `;
    });

    return json("Student updated.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    const conflictMessage = uniqueConflictMessage(error);
    if (conflictMessage) return json(conflictMessage, 409);
    return json(error instanceof Error ? error.message : "Unable to update student.", 500);
  }
}

export async function DELETE(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const id = normalizeText(searchParams.get("id"));

    if (!id) return json("Student id is required.", 400);

    const [student] = await prisma.$queryRaw`
      SELECT sp.id::text AS id, u.id::text AS user_id
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      WHERE sp.id = ${id}::uuid
      LIMIT 1
    `;

    if (!student?.id) return json("Student not found.", 404);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE student_profiles
        SET status = 'archived'::user_status, updated_at = NOW()
        WHERE id = ${student.id}::uuid
      `;
      await tx.$executeRaw`
        UPDATE users
        SET status = 'archived'::user_status, updated_at = NOW()
        WHERE id = ${student.user_id}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO audit_logs (id, actor_user_id, entity_type, entity_id, action)
        VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'student_profiles', ${student.id}::uuid, 'student_archived')
      `;
    });

    return json("Student archived.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to archive student.", 500);
  }
}
