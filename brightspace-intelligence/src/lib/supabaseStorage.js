const DEFAULT_BUCKET = "payment_proofs";
const DEFAULT_ADMISSION_BUCKET = "ash-shajrah";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getSupabaseConfig() {
  return {
    url: getRequiredEnv("SUPABASE_URL"),
    serviceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    bucket: process.env.SUPABASE_PAYMENT_PROOFS_BUCKET || DEFAULT_BUCKET,
  };
}

function sanitizeFilename(filename) {
  return String(filename || "proof")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

function normalizeStoredPath(path, bucket) {
  const normalized = String(path || "").replace(/^\/+/, "");
  const prefix = `${bucket}/`;
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

function splitStoredPath(storedPath) {
  const normalized = String(storedPath || "").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 2) {
    return { bucket: "", objectPath: normalized };
  }

  return {
    bucket: parts[0],
    objectPath: parts.slice(1).join("/"),
  };
}

export async function uploadPaymentProof({ voucherNo, file }) {
  const { url, serviceRoleKey, bucket } = getSupabaseConfig();
  const safeVoucherNo = sanitizeFilename(voucherNo);
  const timestamp = Date.now();
  const safeFilename = sanitizeFilename(file?.name || "proof");
  const objectPath = `${safeVoucherNo}/${timestamp}_${safeFilename}`;
  const uploadUrl = `${url}/storage/v1/object/${bucket}/${objectPath}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "x-upsert": "false",
      "Content-Type": file.type || "application/octet-stream",
    },
    body: fileBuffer,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase upload failed: ${errorText}`);
  }

  return {
    bucket,
    objectPath,
    storedPath: `${bucket}/${objectPath}`,
  };
}

function getAdmissionSupabaseConfig() {
  return {
    url: getRequiredEnv("SUPABASE_URL"),
    serviceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    bucket: process.env.SUPABASE_ADMISSION_DOCUMENTS_BUCKET || DEFAULT_ADMISSION_BUCKET,
  };
}

async function uploadHomeworkSubmission({ homeworkId, file }) {
  const { url, serviceRoleKey, bucket } = getAdmissionSupabaseConfig();
  const safeHomeworkId = sanitizeFilename(homeworkId);
  const timestamp = Date.now();
  const safeFilename = sanitizeFilename(file?.name || "homework");
  const objectPath = `${safeHomeworkId}/${timestamp}_${safeFilename}`;
  const uploadUrl = `${url}/storage/v1/object/${bucket}/${objectPath}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "x-upsert": "false",
      "Content-Type": file.type || "application/octet-stream",
    },
    body: fileBuffer,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase upload failed: ${errorText}`);
  }

  return {
    bucket,
    objectPath,
    storedPath: `${bucket}/${objectPath}`,
  };
}

export async function uploadAdmissionDocument({ applicationId, documentType, file }) {
  const { url, serviceRoleKey, bucket } = getAdmissionSupabaseConfig();
  const safeApplicationId = sanitizeFilename(applicationId);
  const safeDocumentType = sanitizeFilename(documentType || "document");
  const timestamp = Date.now();
  const safeFilename = sanitizeFilename(file?.name || "document");
  const objectPath = `${safeApplicationId}/${safeDocumentType}/${timestamp}_${safeFilename}`;
  const uploadUrl = `${url}/storage/v1/object/${bucket}/${objectPath}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "x-upsert": "false",
      "Content-Type": file.type || "application/octet-stream",
    },
    body: fileBuffer,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase upload failed: ${errorText}`);
  }

  return {
    bucket,
    objectPath,
    storedPath: `${bucket}/${objectPath}`,
  };
}

export async function createSignedPaymentProofUrl(storedPath, expiresIn = 3600) {
  if (!storedPath) {
    return "";
  }

  const { url, serviceRoleKey, bucket } = getSupabaseConfig();
  const objectPath = normalizeStoredPath(storedPath, bucket);
  const signUrl = `${url}/storage/v1/object/sign/${bucket}/${objectPath}`;
  const response = await fetch(signUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase signed URL generation failed: ${errorText}`);
  }

  const data = await response.json();
  const signedPath = data?.signedURL || data?.signedUrl || data?.signed_url || "";
  if (signedPath) {
    if (/^https?:\/\//i.test(signedPath)) {
      return signedPath;
    }

    if (signedPath.startsWith("/storage/v1/")) {
      return `${url}${signedPath}`;
    }

    if (signedPath.startsWith("/")) {
      return `${url}/storage/v1${signedPath}`;
    }

    return `${url}/storage/v1/${signedPath}`;
  }

  return `${url}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export async function createSignedAdmissionDocumentUrl(storedPath, expiresIn = 3600) {
  if (!storedPath) {
    return "";
  }

  const { url, serviceRoleKey, bucket } = getAdmissionSupabaseConfig();
  const inferred = splitStoredPath(storedPath);
  const signingBucket = inferred.bucket || bucket;
  const objectPath = normalizeStoredPath(storedPath, signingBucket);
  const signUrl = `${url}/storage/v1/object/sign/${signingBucket}/${objectPath}`;
  const response = await fetch(signUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase signed URL generation failed: ${errorText}`);
  }

  const data = await response.json();
  const signedPath = data?.signedURL || data?.signedUrl || data?.signed_url || "";
  if (signedPath) {
    if (/^https?:\/\//i.test(signedPath)) {
      return signedPath;
    }

    if (signedPath.startsWith("/storage/v1/")) {
      return `${url}${signedPath}`;
    }

    if (signedPath.startsWith("/")) {
      return `${url}/storage/v1${signedPath}`;
    }

    return `${url}/storage/v1/${signedPath}`;
  }

  return `${url}/storage/v1/object/public/${signingBucket}/${objectPath}`;
}

/**
 * Builds a key-free URL for media stored in a public Supabase bucket. This is
 * useful while database and Storage credentials are managed independently:
 * public Monthly Plan media can be served from its owning project without
 * using the service-role key required by private uploads and signed files.
 */
export function createPublicAdmissionDocumentUrl(storedPath) {
  if (!storedPath) return "";

  const url = process.env.SUPABASE_PUBLIC_STORAGE_URL || getRequiredEnv("SUPABASE_URL");
  // Public reads do not require (and must not depend on) a service-role key.
  const bucket = process.env.SUPABASE_ADMISSION_DOCUMENTS_BUCKET || DEFAULT_ADMISSION_BUCKET;
  const inferred = splitStoredPath(storedPath);
  const publicBucket = inferred.bucket || bucket;
  const objectPath = normalizeStoredPath(storedPath, publicBucket);
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${url}/storage/v1/object/public/${encodeURIComponent(publicBucket)}/${encodedPath}`;
}

export async function createSignedHomeworkSubmissionUrl(storedPath, expiresIn = 3600) {
  return createSignedAdmissionDocumentUrl(storedPath, expiresIn);
}

export { uploadHomeworkSubmission };
