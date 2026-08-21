import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

const CLASS_DOCUMENT_TABLES = [
  "class_documents",
  "course_documents",
  "educational_documents",
  "study_materials",
  "learning_resources",
  "class_resources",
  "course_resources",
];

const DOCUMENT_PATH_COLUMNS = [
  "file_path",
  "stored_path",
  "object_path",
  "document_path",
  "attachment_path",
  "image_stored_path",
  "image_object_path",
];

const DOCUMENT_URL_COLUMNS = ["url", "file_url", "document_url", "attachment_url"];
const DOCUMENT_TITLE_COLUMNS = ["title", "name", "label", "document_name", "file_name"];
const DOCUMENT_STATUS_COLUMNS = ["status", "publication_status"];
const DOCUMENT_ACTIVE_COLUMNS = ["is_active", "active"];
const GLOBAL_OTHER_DOCUMENT_TYPES = ["other", "otherdocument", "otherdocuments", "parentguide", "yearlyplan"];

async function getTableColumns(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return new Set(rows.map((row) => row.column_name));
}

function firstExisting(columns, candidates) {
  return candidates.find((column) => columns.has(column)) || "";
}

function classLevelAliases(value) {
  const text = String(value || "").trim();
  if (!text) return [];

  const aliases = new Set([text]);
  const spaced = text.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  aliases.add(spaced);

  const romanToNumber = [
    ["III", "3"],
    ["II", "2"],
    ["I", "1"],
  ];
  for (const [roman, number] of romanToNumber) {
    aliases.add(spaced.replace(new RegExp(`\\b${roman}\\b`, "gi"), number));
    aliases.add(spaced.replace(new RegExp(`\\b${number}\\b`, "g"), roman));
  }

  return [...aliases].filter(Boolean);
}

function classAliasesFromRow(row) {
  const values = [
    row?.class_level,
    row?.grade_level,
    row?.course_class_level,
    row?.course_title,
  ];
  const aliases = new Set();
  for (const value of values) {
    for (const alias of classLevelAliases(value)) {
      aliases.add(alias);
    }
  }
  return [...aliases];
}

export async function classEducationalDocumentsFromRow(row) {
  const courseId = row?.course_id ? String(row.course_id) : "";
  const classLevel = row?.class_level ? String(row.class_level) : "";
  const classAliases = classAliasesFromRow(row);

  if (!courseId && !classLevel && !classAliases.length) return [];

  for (const tableName of CLASS_DOCUMENT_TABLES) {
    const columns = await getTableColumns(tableName);
    if (!columns.size) continue;

    const pathColumn = firstExisting(columns, DOCUMENT_PATH_COLUMNS);
    const urlColumn = firstExisting(columns, DOCUMENT_URL_COLUMNS);
    const titleColumn = firstExisting(columns, DOCUMENT_TITLE_COLUMNS);
    const statusColumn = firstExisting(columns, DOCUMENT_STATUS_COLUMNS);
    const activeColumn = firstExisting(columns, DOCUMENT_ACTIVE_COLUMNS);
    const idColumn = columns.has("id") ? "id" : "";
    const orderColumn = columns.has("created_at") ? "created_at" : "";
    const hasCourseId = columns.has("course_id");
    const hasClassLevel = columns.has("class_level");
    const documentTypeColumn = columns.has("document_type") ? "document_type" : "";

    if ((!pathColumn && !urlColumn) || (!hasCourseId && !hasClassLevel)) continue;

    const selectTitle = titleColumn ? `"${titleColumn}"::text` : "'Educational Document'";
    const selectDocumentType = documentTypeColumn ? `"${documentTypeColumn}"::text` : "NULL::text";
    const selectPath = pathColumn ? `"${pathColumn}"::text` : "NULL::text";
    const selectUrl = urlColumn ? `"${urlColumn}"::text` : "NULL::text";
    const selectId = idColumn ? `"${idColumn}"::text` : `md5(COALESCE(${selectPath}, ${selectUrl}, ${selectTitle}, ''))`;
    const orderClause = orderColumn ? `ORDER BY "${orderColumn}" DESC NULLS LAST` : `ORDER BY ${selectTitle} ASC`;
    const statusFilter = statusColumn
      ? `AND LOWER(COALESCE("${statusColumn}"::text, 'active')) IN ('active', 'published', 'approved')`
      : "";
    const activeFilter = "";
    const normalizedClassAliases = classAliases.map((alias) => alias.toLowerCase().replace(/[^a-z0-9]+/g, ""));
    const scopeFilters = [];
    const scopeValues = [];
    if (hasCourseId && courseId) {
      scopeValues.push(courseId);
      scopeFilters.push(`"course_id"::text = $${scopeValues.length}`);
    }
    if (hasClassLevel && normalizedClassAliases.length) {
      scopeValues.push(normalizedClassAliases);
      scopeFilters.push(`REGEXP_REPLACE(LOWER(COALESCE("class_level"::text, '')), '[^a-z0-9]+', '', 'g') = ANY($${scopeValues.length}::text[])`);
    }
    if (hasClassLevel && documentTypeColumn) {
      scopeValues.push(GLOBAL_OTHER_DOCUMENT_TYPES);
      scopeFilters.push(`("class_level" IS NULL AND REGEXP_REPLACE(LOWER(COALESCE("${documentTypeColumn}"::text, '')), '[^a-z0-9]+', '', 'g') = ANY($${scopeValues.length}::text[]))`);
    }
    if (!scopeFilters.length) continue;
    const scopeFilter = `(${scopeFilters.join(" OR ")})`;

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        COALESCE(${selectId}, md5(COALESCE(${selectPath}, ${selectUrl}, ${selectTitle}, ''))) AS id,
        COALESCE(NULLIF(${selectTitle}, ''), 'Educational Document') AS label,
        ${selectDocumentType} AS document_type,
        ${hasClassLevel ? `"class_level"::text` : "NULL::text"} AS class_level,
        ${selectPath} AS path,
        ${selectUrl} AS direct_url
      FROM "${tableName}"
      WHERE ${scopeFilter}
        ${statusFilter}
        ${activeFilter}
      ${orderClause}
      `,
      ...scopeValues
    );

    if (!rows.length) continue;

    return Promise.all(
      rows.map(async (document) => {
        const path = document.path || "";
        const directUrl = document.direct_url || "";
        const storedPath = directUrl && !/^https?:\/\//i.test(directUrl) ? directUrl : path;
        return {
          key: document.id,
          label: document.label || "Educational Document",
          type: document.document_type || "",
          class_level: document.class_level || "",
          path: storedPath || directUrl || "",
          url: /^https?:\/\//i.test(directUrl)
            ? directUrl
            : storedPath
              ? await createSignedAdmissionDocumentUrl(storedPath).catch(() => "")
              : "",
          source: "class",
        };
      })
    );
  }

  return [];
}
