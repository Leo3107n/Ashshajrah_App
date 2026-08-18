import crypto from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeClassLevel } from "@/lib/academicCatalog";
import { sendEmail, themedEmailShell } from "@/lib/email";
import prisma from "@/lib/prisma";
import { generateVoucherNumber } from "@/lib/voucherNumber";
import { uploadAdmissionDocument } from "@/lib/supabaseStorage";

function json(success, message, status, extra = {}) {
  return NextResponse.json({ success, message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeDate(value) {
  const trimmed = normalizeText(value);
  if (!trimmed) return "";

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "";

  return trimmed;
}

function calculateAgeFromDate(dateValue) {
  if (!dateValue) return null;

  const dateOfBirth = new Date(dateValue);
  if (Number.isNaN(dateOfBirth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDifference = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : 0;
}

function normalizeBoolean(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (["yes", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return null;
}

function getOptionalFile(formData, key) {
  const file = formData.get(key);
  return file instanceof File && file.size > 0 ? file : null;
}

async function getTableColumns(tableName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT
      column_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
    };
    return accumulator;
  }, {});
}

function addColumn(columns, values, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  values.push(value);
}

function ensureSupportedRequiredColumns(tableName, columns, supportedColumns) {
  const missing = Object.entries(columns)
    .filter(
      ([columnName, meta]) =>
        !meta.nullable && !meta.defaultValue && !supportedColumns.has(columnName)
    )
    .map(([columnName]) => columnName);

  if (missing.length) {
    throw new Error(`${tableName} requires unsupported columns: ${missing.join(", ")}.`);
  }
}

function normalizeDueDate(value) {
  const trimmed = normalizeText(value);
  if (!trimmed) return "";

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function toMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

async function getRegularFeeAmount(classLevel, tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT amount::float8 AS amount
    FROM regular_fee
    WHERE LOWER(class_level::text) = LOWER(${classLevel})
      AND LOWER(status::text) = 'active'
    ORDER BY created_at DESC NULLS LAST, id DESC
    LIMIT 1
  `;

  return Number(row?.amount || 0);
}

async function getPaymentMethodById(paymentMethodId, tx = prisma) {
  if (!paymentMethodId) {
    return null;
  }

  const [row] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      name,
      method_key,
      bank_name,
      account_title,
      account_number,
      iban,
      branch_code,
      instructions,
      LOWER(status::text) AS status
    FROM payment_methods
    WHERE id = ${paymentMethodId}::uuid
      AND LOWER(status::text) = 'active'
    LIMIT 1
  `;

  return row || null;
}

async function insertFeeVoucherForAdmission({
  registrationLeadId,
  classLevel,
  voucherNo: providedVoucherNo,
  paymentMethodId,
  paymentMethodName,
  admissionFeeAmount,
  discountPercent,
  paymentInstructions,
  dueDate,
  tx,
}) {
  const voucherNo = providedVoucherNo || await generateVoucherNumber();
  const columns = await getTableColumns("fee_vouchers", tx);
  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();
  const voucherId = crypto.randomUUID();
  const regularFeeAmount = await getRegularFeeAmount(classLevel, tx);
  const discountAmount = Number(((regularFeeAmount * Number(discountPercent || 0)) / 100).toFixed(2));
  const subtotalAmount = Number((regularFeeAmount + Number(admissionFeeAmount || 0)).toFixed(2));
  const totalAmount = Number((subtotalAmount - discountAmount).toFixed(2));
  const paymentMethod = paymentMethodId ? await getPaymentMethodById(paymentMethodId, tx) : null;

  if (columns.id) {
    addColumn(insertColumns, insertValues, "id", voucherId);
    supportedColumns.add("id");
  }
  if (columns.registration_id) {
    addColumn(insertColumns, insertValues, "registration_id", registrationLeadId);
    supportedColumns.add("registration_id");
  }
  if (columns.voucher_no) {
    addColumn(insertColumns, insertValues, "voucher_no", voucherNo);
    supportedColumns.add("voucher_no");
  }
  if (columns.amount) {
    addColumn(insertColumns, insertValues, "amount", totalAmount);
    supportedColumns.add("amount");
  }
  if (columns.regular_fee_applied) {
    addColumn(insertColumns, insertValues, "regular_fee_applied", regularFeeAmount > 0);
    supportedColumns.add("regular_fee_applied");
  }
  if (columns.regular_fee_amount) {
    addColumn(insertColumns, insertValues, "regular_fee_amount", regularFeeAmount);
    supportedColumns.add("regular_fee_amount");
  }
  if (columns.admission_fee_amount) {
    addColumn(insertColumns, insertValues, "admission_fee_amount", Number(admissionFeeAmount || 0));
    supportedColumns.add("admission_fee_amount");
  }
  if (columns.discount_percent) {
    addColumn(insertColumns, insertValues, "discount_percent", Number(discountPercent || 0));
    supportedColumns.add("discount_percent");
  }
  if (columns.subtotal_amount) {
    addColumn(insertColumns, insertValues, "subtotal_amount", subtotalAmount);
    supportedColumns.add("subtotal_amount");
  }
  if (columns.discount_amount) {
    addColumn(insertColumns, insertValues, "discount_amount", discountAmount);
    supportedColumns.add("discount_amount");
  }
  if (columns.total_amount) {
    addColumn(insertColumns, insertValues, "total_amount", totalAmount);
    supportedColumns.add("total_amount");
  }
  if (columns.due_date && dueDate) {
    addColumn(insertColumns, insertValues, "due_date", new Date(dueDate));
    supportedColumns.add("due_date");
  }
  if (paymentMethod?.id && columns.payment_method_id) {
    addColumn(insertColumns, insertValues, "payment_method_id", paymentMethod.id);
    supportedColumns.add("payment_method_id");
  } else if (columns.payment_method && (paymentMethod?.name || paymentMethodName)) {
    addColumn(insertColumns, insertValues, "payment_method", paymentMethod?.method_key || paymentMethod?.name || paymentMethodName || "");
    supportedColumns.add("payment_method");
  }
  if (columns.payment_instructions) {
    addColumn(insertColumns, insertValues, "payment_instructions", paymentInstructions || paymentMethod?.instructions || null);
    supportedColumns.add("payment_instructions");
  }
  if (columns.status) {
    insertColumns.push(Prisma.raw(`"status"`));
    insertValues.push({ value: "unpaid", castType: "voucher_status" });
    supportedColumns.add("status");
  }
  if (columns.created_at) {
    addColumn(insertColumns, insertValues, "created_at", new Date());
    supportedColumns.add("created_at");
  }
  if (columns.updated_at) {
    addColumn(insertColumns, insertValues, "updated_at", new Date());
    supportedColumns.add("updated_at");
  }

  ensureSupportedRequiredColumns("fee_vouchers", columns, supportedColumns);

  if (!insertColumns.length) {
    return null;
  }

  await tx.$executeRaw`
    INSERT INTO fee_vouchers (${Prisma.join(insertColumns, ", ")})
    VALUES (${Prisma.join(
      insertValues.map((item) => {
        if (item && typeof item === "object" && item.castType) {
          if (item.castType === "uuid") return Prisma.sql`${item.value}::uuid`;
          if (item.castType === "voucher_status") return Prisma.sql`${item.value}::voucher_status`;
        }
        if (typeof item === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)) {
          return Prisma.sql`${item}::uuid`;
        }
        if (item instanceof Date) {
          return Prisma.sql`${item}`;
        }
        return Prisma.sql`${item}`;
      }),
      ", "
    )})
  `;

  return {
    voucherId,
    voucherNo,
    regularFeeAmount,
    discountAmount,
    subtotalAmount,
    totalAmount,
    paymentMethod,
  };
}

async function insertFeeSubmissionForAdmission({
  voucherId,
  payerName,
  payerEmail = "",
  payerPhone = "",
  transactionId,
  paidAmount,
  paidAt,
  proofFilePath,
  remarks = "",
  submittedBy = null,
  tx,
}) {
  const columns = await getTableColumns("fee_submissions", tx);
  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();
  const submissionId = crypto.randomUUID();

  if (columns.id) {
    addColumn(insertColumns, insertValues, "id", submissionId);
    supportedColumns.add("id");
  }
  if (columns.voucher_id) {
    addColumn(insertColumns, insertValues, "voucher_id", voucherId);
    supportedColumns.add("voucher_id");
  }
  if (columns.submitted_by) {
    addColumn(insertColumns, insertValues, "submitted_by", submittedBy);
    supportedColumns.add("submitted_by");
  }
  if (columns.payer_name) {
    addColumn(insertColumns, insertValues, "payer_name", payerName || null);
    supportedColumns.add("payer_name");
  }
  if (columns.transaction_id) {
    addColumn(insertColumns, insertValues, "transaction_id", transactionId || null);
    supportedColumns.add("transaction_id");
  }
  if (columns.paid_amount) {
    addColumn(insertColumns, insertValues, "paid_amount", Number(paidAmount || 0));
    supportedColumns.add("paid_amount");
  }
  if (columns.paid_at) {
    addColumn(insertColumns, insertValues, "paid_at", paidAt ? new Date(paidAt) : null);
    supportedColumns.add("paid_at");
  }
  if (columns.proof_bucket) {
    addColumn(insertColumns, insertValues, "proof_bucket", "payment_proofs");
    supportedColumns.add("proof_bucket");
  }
  if (columns.proof_file_path) {
    addColumn(insertColumns, insertValues, "proof_file_path", proofFilePath);
    supportedColumns.add("proof_file_path");
  }
  if (columns.proof_file_url) {
    addColumn(insertColumns, insertValues, "proof_file_url", null);
    supportedColumns.add("proof_file_url");
  }
  if (columns.remarks) {
    addColumn(insertColumns, insertValues, "remarks", remarks || null);
    supportedColumns.add("remarks");
  }
  if (columns.status) {
    insertColumns.push(Prisma.raw(`"status"`));
    insertValues.push({ value: "pending", castType: "fee_submission_status" });
    supportedColumns.add("status");
  }
  if (columns.created_at) {
    addColumn(insertColumns, insertValues, "created_at", new Date());
    supportedColumns.add("created_at");
  }
  if (columns.updated_at) {
    addColumn(insertColumns, insertValues, "updated_at", new Date());
    supportedColumns.add("updated_at");
  }

  ensureSupportedRequiredColumns("fee_submissions", columns, supportedColumns);

  await tx.$executeRaw`
    INSERT INTO fee_submissions (${Prisma.join(insertColumns, ", ")})
    VALUES (${Prisma.join(
      insertValues.map((item) => {
        if (item && typeof item === "object" && item.castType) {
          if (item.castType === "uuid") return Prisma.sql`${item.value}::uuid`;
          if (item.castType === "fee_submission_status") return Prisma.sql`${item.value}::fee_submission_status`;
        }
        if (typeof item === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)) {
          return Prisma.sql`${item}::uuid`;
        }
        if (item instanceof Date) {
          return Prisma.sql`${item}`;
        }
        return Prisma.sql`${item}`;
      }),
      ", "
    )})
  `;

  return submissionId;
}

function buildParentSummary({
  preferredContactPerson,
  fatherNameEnglish,
  fatherEmail,
  fatherWhatsapp,
  fatherEmergency,
  fatherOffice,
  fatherHome,
  motherNameEnglish,
  motherEmail,
  motherWhatsapp,
  motherEmergency,
  motherOffice,
  motherHome,
}) {
  const normalizedContact = normalizeText(preferredContactPerson).toLowerCase();
  const useMother = normalizedContact === "mother";

  const parentName = useMother
    ? motherNameEnglish || fatherNameEnglish
    : fatherNameEnglish || motherNameEnglish;
  const parentRelation = useMother ? "Mother" : "Father";
  const parentEmail = useMother
    ? motherEmail || fatherEmail
    : fatherEmail || motherEmail;
  const parentPhone = useMother
    ? motherWhatsapp || motherEmergency || motherOffice || motherHome || fatherWhatsapp || fatherEmergency
    : fatherWhatsapp || fatherEmergency || fatherOffice || fatherHome || motherWhatsapp || motherEmergency;

  return {
    parentName,
    parentRelation,
    parentEmail,
    parentPhone,
  };
}

async function fetchInterestedStudentByToken(leadToken) {
  if (!leadToken) {
    return null;
  }

  const [linkedLead] = await prisma.$queryRaw`
    SELECT
      id::text AS id,
      student_name,
      parent_name,
      email,
      phone,
      LOWER(status::text) AS status,
      registration_lead_id::text AS registration_lead_id
    FROM interested_students
    WHERE registration_token = ${leadToken}
    LIMIT 1
  `;

  return linkedLead || null;
}

async function uploadAdmissionFiles(applicationId, files) {
  const uploads = {};

  if (files.birthCertificateFile) {
    const upload = await uploadAdmissionDocument({
      applicationId,
      documentType: "birth_certificate",
      file: files.birthCertificateFile,
    });
    uploads.birthCertificatePath = upload.storedPath;
  }

  if (files.parentCnicFile) {
    const upload = await uploadAdmissionDocument({
      applicationId,
      documentType: "parent_cnic",
      file: files.parentCnicFile,
    });
    uploads.parentCnicPath = upload.storedPath;
  }

  if (files.childPhotographFile) {
    const upload = await uploadAdmissionDocument({
      applicationId,
      documentType: "child_photograph",
      file: files.childPhotographFile,
    });
    uploads.childPhotographPath = upload.storedPath;
  }

  if (files.medicalReportFile) {
    const upload = await uploadAdmissionDocument({
      applicationId,
      documentType: "medical_report",
      file: files.medicalReportFile,
    });
    uploads.medicalReportPath = upload.storedPath;
  }

  if (files.scholarshipSupportingDocumentFile) {
    const upload = await uploadAdmissionDocument({
      applicationId,
      documentType: "scholarship_supporting_document",
      file: files.scholarshipSupportingDocumentFile,
    });
    uploads.scholarshipSupportingDocumentPath = upload.storedPath;
  }

  return uploads;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const applicationId = crypto.randomUUID();
    const leadToken = normalizeText(formData.get("leadToken"));
    const programName = normalizeText(formData.get("program_name")) || "Early Childhood Education (Parent Partnership Model)";
    const requestedClassLevel = normalizeText(formData.get("class_level"));
    const classLevel = normalizeClassLevel(requestedClassLevel) || requestedClassLevel;
    const preferredStartingMonth = normalizeText(formData.get("preferred_starting_month"));
    const studentName = normalizeText(formData.get("student_name"));
    const gender = normalizeText(formData.get("gender"));
    const dateOfBirth = normalizeDate(formData.get("date_of_birth"));
    const age = calculateAgeFromDate(dateOfBirth);
    const country = normalizeText(formData.get("country"));
    const city = normalizeText(formData.get("city"));
    const nationality = normalizeText(formData.get("nationality"));
    const religion = normalizeText(formData.get("religion"));
    const childProfile = normalizeText(formData.get("child_profile"));
    const childStrengths = normalizeText(formData.get("child_strengths"));
    const childSupportNeeds = normalizeText(formData.get("child_support_needs"));
    const childSpecialInterests = normalizeText(formData.get("child_special_interests"));
    const developmentalConcern = normalizeBoolean(formData.get("developmental_concern"));
    const developmentalConcernDetails = normalizeText(formData.get("developmental_concern_details"));
    const medicalConditions = normalizeText(formData.get("medical_conditions"));
    const needBasedScholarshipRequested = normalizeBoolean(formData.get("need_based_scholarship_requested")) === true;
    const scholarshipMonthlyIncome = normalizeText(formData.get("scholarship_monthly_income"));
    const scholarshipDependentsCount = normalizeText(formData.get("scholarship_dependents_count"));
    const scholarshipSchoolGoingChildrenCount = normalizeText(formData.get("scholarship_school_going_children_count"));
    const scholarshipResidenceType = normalizeText(formData.get("scholarship_residence_type"));
    const scholarshipGuardianEmploymentStatus = normalizeText(formData.get("scholarship_guardian_employment_status"));
    const scholarshipRequestedAmount = normalizeText(formData.get("scholarship_requested_amount"));
    const scholarshipReason = normalizeText(formData.get("scholarship_reason"));
    const fatherNameEnglish = normalizeText(formData.get("father_name_english"));
    const fatherCnic = normalizeText(formData.get("father_cnic"));
    const fatherQualification = normalizeText(formData.get("father_qualification"));
    const fatherOccupation = normalizeText(formData.get("father_occupation"));
    const fatherMotherTongue = normalizeText(formData.get("father_mother_tongue"));
    const fatherContactHome = normalizeText(formData.get("father_contact_home"));
    const fatherContactWhatsapp = normalizeText(formData.get("father_contact_whatsapp"));
    const fatherEmergencyContact = normalizeText(formData.get("father_emergency_contact"));
    const fatherEmail = normalizeEmail(formData.get("father_email"));
    const fatherResidentialAddress = normalizeText(formData.get("father_residential_address"));
    const motherNameEnglish = normalizeText(formData.get("mother_name_english"));
    const motherCnic = normalizeText(formData.get("mother_cnic"));
    const motherQualification = normalizeText(formData.get("mother_qualification"));
    const motherOccupation = normalizeText(formData.get("mother_occupation"));
    const motherMotherTongue = normalizeText(formData.get("mother_mother_tongue"));
    const motherContactHome = normalizeText(formData.get("mother_contact_home"));
    const motherContactWhatsapp = normalizeText(formData.get("mother_contact_whatsapp"));
    const motherEmergencyContact = normalizeText(formData.get("mother_emergency_contact"));
    const motherEmail = normalizeEmail(formData.get("mother_email"));
    const motherResidentialAddress = normalizeText(formData.get("mother_residential_address"));
    const preferredContactPerson = normalizeText(formData.get("preferred_contact_person"));
    const deviceAvailable = normalizeText(formData.get("device_available"));
    const supportPersonDuringLearning = normalizeText(formData.get("support_person_during_learning"));
    const paymentMethod = normalizeText(formData.get("payment_method"));
    const paymentMethodId = normalizeText(formData.get("paymentMethodId") || formData.get("payment_method_id"));
    const admissionFeeAmount = normalizeText(formData.get("admission_fee"));
    const discountPercent = normalizeText(formData.get("discount_percent"));
    const paymentInstructions = normalizeText(formData.get("payment_instructions"));
    const payerName = normalizeText(formData.get("payer_name"));
    const payerEmail = normalizeText(formData.get("payer_email"));
    const payerPhone = normalizeText(formData.get("payer_phone"));
    const transactionId = normalizeText(formData.get("transaction_id"));
    const paidAmount = normalizeText(formData.get("paid_amount"));
    const paidAt = normalizeText(formData.get("paid_at"));
    const whyJoinSchool = normalizeText(formData.get("why_join_school"));
    const declarationAccepted = normalizeBoolean(formData.get("declaration_accepted")) === true;
    const birthCertificateFilePath = normalizeText(formData.get("birth_certificate_file_path"));
    const parentCnicFilePath = normalizeText(formData.get("parent_cnic_file_path"));
    const childPhotographFilePath = normalizeText(formData.get("child_photograph_file_path"));
    const medicalReportFilePath = normalizeText(formData.get("medical_report_file_path"));
    const paymentProofFilePath = normalizeText(formData.get("payment_proof_file_path"));
    const scholarshipSupportingDocumentFilePath = normalizeText(formData.get("scholarship_supporting_document_file_path"));

    const files = {
      birthCertificateFile: getOptionalFile(formData, "birth_certificate_file"),
      parentCnicFile: getOptionalFile(formData, "parent_cnic_file"),
      childPhotographFile: getOptionalFile(formData, "child_photograph_file"),
      medicalReportFile: getOptionalFile(formData, "medical_report_file"),
      paymentProofFile: getOptionalFile(formData, "payment_proof_file"),
      scholarshipSupportingDocumentFile: getOptionalFile(formData, "scholarship_supporting_document_file"),
    };

    if (!programName) return json(false, "Programme is required.", 400);
    if (!classLevel) return json(false, "Applying class is required.", 400);
    if (!preferredStartingMonth) return json(false, "Preferred starting month is required.", 400);
    if (!studentName) return json(false, "Student full name is required.", 400);
    if (!gender) return json(false, "Gender is required.", 400);
    if (!dateOfBirth) return json(false, "Date of birth is required.", 400);
    if (!Number.isFinite(age) || age < 0) return json(false, "Student age must be valid.", 400);
    if (!country) return json(false, "Country is required.", 400);
    if (!city) return json(false, "City is required.", 400);
    if (!nationality) return json(false, "Nationality is required.", 400);
    if (!religion) return json(false, "Religion is required.", 400);
    if (!fatherNameEnglish && !motherNameEnglish) {
      return json(false, "At least one parent name is required.", 400);
    }
    if (!preferredContactPerson) {
      return json(false, "Preferred contact person is required.", 400);
    }
    if (!deviceAvailable) {
      return json(false, "Device availability is required.", 400);
    }
    if (!supportPersonDuringLearning) {
      return json(false, "Please select who will support the child during learning.", 400);
    }
    if (!declarationAccepted) {
      return json(false, "You must accept the declaration before submitting the admission form.", 400);
    }
    if (!files.birthCertificateFile && !birthCertificateFilePath) {
      return json(false, "Child B-Form / Birth Certificate is required.", 400);
    }
    if (!files.parentCnicFile && !parentCnicFilePath) {
      return json(false, "Parent CNIC document is required.", 400);
    }
    if (!files.childPhotographFile && !childPhotographFilePath) {
      return json(false, "Recent child photograph is required.", 400);
    }
    if (fatherEmail && !isValidEmail(fatherEmail)) {
      return json(false, "Please enter a valid father email address.", 400);
    }
    if (motherEmail && !isValidEmail(motherEmail)) {
      return json(false, "Please enter a valid mother email address.", 400);
    }

    const parentSummary = buildParentSummary({
      preferredContactPerson,
      fatherNameEnglish,
      fatherEmail,
      fatherWhatsapp: fatherContactWhatsapp,
      fatherEmergency: fatherEmergencyContact,
      fatherHome: fatherContactHome,
      motherNameEnglish,
      motherEmail,
      motherWhatsapp: motherContactWhatsapp,
      motherEmergency: motherEmergencyContact,
      motherHome: motherContactHome,
    });

    if (!parentSummary.parentName) {
      return json(false, "A primary parent name is required.", 400);
    }

    if (!parentSummary.parentPhone) {
      return json(false, "A primary parent contact number is required.", 400);
    }

    const linkedLead = await fetchInterestedStudentByToken(leadToken);
    if (linkedLead?.status === "registered" && linkedLead?.registration_lead_id) {
      return json(false, "This admission form link is no longer valid because the form has already been submitted.", 410);
    }

    const uploads = {
      birthCertificatePath: birthCertificateFilePath || null,
      parentCnicPath: parentCnicFilePath || null,
      childPhotographPath: childPhotographFilePath || null,
      medicalReportPath: medicalReportFilePath || null,
      scholarshipSupportingDocumentPath: scholarshipSupportingDocumentFilePath || null,
    };

    const needsAdmissionUpload =
      files.birthCertificateFile ||
      files.parentCnicFile ||
      files.childPhotographFile ||
      files.medicalReportFile ||
      files.scholarshipSupportingDocumentFile;

    if (needsAdmissionUpload) {
      const uploadedFiles = await uploadAdmissionFiles(applicationId, files);
      Object.assign(uploads, uploadedFiles);
    }
    const cityCountry = [city, country].filter(Boolean).join(", ");

    const [createdLead] = await prisma.$queryRaw`
      INSERT INTO registration_leads (
        id,
        student_name,
        parent_name,
        parent_relation,
        email,
        phone,
        age,
        class_level,
        city,
        city_country,
        gender,
        date_of_birth,
        interest_reason,
        notes,
        source,
        status,
        program_name,
        preferred_starting_month,
        country,
        nationality,
        religion,
        child_profile,
        child_strengths,
        child_support_needs,
        child_special_interests,
        developmental_concern,
        developmental_concern_details,
        medical_conditions,
        father_name_english,
        father_cnic,
        father_qualification,
        father_occupation,
        father_mother_tongue,
        father_contact_home,
        father_contact_whatsapp,
        father_emergency_contact,
        father_email,
        father_residential_address,
        mother_name_english,
        mother_cnic,
        mother_qualification,
        mother_occupation,
        mother_mother_tongue,
        mother_contact_home,
        mother_contact_whatsapp,
        mother_emergency_contact,
        mother_email,
        mother_residential_address,
        preferred_contact_person,
        support_person_during_learning,
        device_available,
        declaration_accepted,
        birth_certificate_file_path,
        parent_cnic_file_path,
        child_photograph_file_path,
        medical_report_file_path,
        created_at,
        updated_at
      )
      VALUES (
        ${applicationId}::uuid,
        ${studentName},
        ${parentSummary.parentName},
        ${parentSummary.parentRelation},
        ${parentSummary.parentEmail || linkedLead?.email || null},
        ${parentSummary.parentPhone},
        ${age},
        ${classLevel},
        ${city || null},
        ${cityCountry || null},
        ${gender},
        ${dateOfBirth}::date,
        ${whyJoinSchool},
        ${null},
        ${"admission_form"},
        CAST(${"new_lead"} AS registration_status),
        ${programName},
        ${preferredStartingMonth},
        ${country},
        ${nationality},
        ${religion},
        ${childProfile || null},
        ${childStrengths || null},
        ${childSupportNeeds || null},
        ${childSpecialInterests || null},
        ${developmentalConcern},
        ${developmentalConcernDetails || null},
        ${medicalConditions || null},
        ${fatherNameEnglish || null},
        ${fatherCnic || null},
        ${fatherQualification || null},
        ${fatherOccupation || null},
        ${fatherMotherTongue || null},
        ${fatherContactHome || null},
        ${fatherContactWhatsapp || null},
        ${fatherEmergencyContact || null},
        ${fatherEmail || null},
        ${fatherResidentialAddress || null},
        ${motherNameEnglish || null},
        ${motherCnic || null},
        ${motherQualification || null},
        ${motherOccupation || null},
        ${motherMotherTongue || null},
        ${motherContactHome || null},
        ${motherContactWhatsapp || null},
        ${motherEmergencyContact || null},
        ${motherEmail || null},
        ${motherResidentialAddress || null},
        ${preferredContactPerson},
        ${supportPersonDuringLearning},
        ${deviceAvailable},
        ${declarationAccepted},
        ${uploads.birthCertificatePath || null},
        ${uploads.parentCnicPath || null},
        ${uploads.childPhotographPath || null},
        ${uploads.medicalReportPath || null},
        NOW(),
        NOW()
      )
      RETURNING id::text AS id
    `;

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

    const admissionPaymentVoucherNo = await generateVoucherNumber();
    const paymentDueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const voucher = await prisma.$transaction(async (tx) => {
      return insertFeeVoucherForAdmission({
        registrationLeadId: createdLead.id,
        classLevel,
        voucherNo: admissionPaymentVoucherNo,
        paymentMethodId,
        paymentMethodName: paymentMethod || "",
        admissionFeeAmount: toMoney(admissionFeeAmount),
        discountPercent: Number(String(discountPercent || "0").replace("%", "")) || 0,
        paymentInstructions,
        dueDate: paymentDueDate,
        tx,
      });
    });

    if (leadToken && linkedLead?.id && createdLead?.id) {
      await prisma.$executeRaw`
        UPDATE interested_students
        SET
          status = ${"registered"},
          admission_form_status = ${"submitted"},
          admission_form_submitted_at = NOW(),
          admission_form_last_channel = COALESCE(admission_form_last_channel, ${"form_submit"}),
          admission_form_last_error = NULL,
          registration_lead_id = ${createdLead.id}::uuid,
          updated_at = NOW()
        WHERE id = ${linkedLead.id}::uuid
      `;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || request.nextUrl.origin;
    const nextStepUrl = `${String(appUrl || "").replace(/\/+$/, "")}/admission-next-step/${createdLead.id}?voucherNo=${encodeURIComponent(voucher?.voucherNo || "")}&leadToken=${encodeURIComponent(leadToken || "")}&submitted=1`;

    const parentEmail = parentSummary.parentEmail || linkedLead?.email || "";
    if (parentEmail) {
      const parentSubject = `Admission form submitted for ${studentName}`;
      const parentText = `Assalamualaikum ${parentSummary.parentName},

Your child's admission form has been submitted successfully.

Student: ${studentName}
Programme: ${programName}
Class: ${classLevel}
Preferred Starting Month: ${preferredStartingMonth}
Primary Contact: ${parentSummary.parentName}
Phone: ${parentSummary.parentPhone}

Our admissions team will review the application and contact you with the next steps, In Sha Allah.

Payment & Scholarship Page:
${nextStepUrl}`;
      const parentHtml = themedEmailShell({
        eyebrow: "Admission Form Submitted",
        title: "Your child's admission form was received",
        intro: `Assalamualaikum ${parentSummary.parentName}. Your child's admission form has been submitted successfully.`,
        rows: [
          ["Student", studentName],
          ["Programme", programName],
          ["Class", classLevel],
          ["Preferred Starting Month", preferredStartingMonth],
          ["Primary Contact", parentSummary.parentName],
          ["Phone", parentSummary.parentPhone],
        ],
        bodyBlocks: [
          `<div style="padding:16px;border:1px solid #2D8A6A;border-radius:18px;background:#fffaf0;"><p style="margin:0 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#0D5C48;font-weight:700;">Next Step Link</p><p style="margin:0;line-height:1.8;color:#245C4F;font-size:15px;word-break:break-word;">${nextStepUrl}</p></div>`,
        ],
        buttonLabel: "Open Payment & Scholarship Page",
        buttonUrl: nextStepUrl,
        footerNote: "You have been redirected to the payment and scholarship page. Our admissions team will review the application and contact you with the next steps, In Sha Allah.",
      });

      await sendEmail({
        to: parentEmail,
        subject: parentSubject,
        html: parentHtml,
        text: parentText,
      });
    }

    if (coordinator?.email) {
      const coordinatorSubject = `New admission form submitted: ${studentName}`;
      const coordinatorText = `Assalamualaikum ${coordinator.full_name || "Coordinator"},

A new admission form has been submitted.

Student: ${studentName}
Programme: ${programName}
Class: ${classLevel}
Preferred Starting Month: ${preferredStartingMonth}
Primary Parent: ${parentSummary.parentName}
Email: ${parentSummary.parentEmail || linkedLead?.email || "Not provided"}
Phone: ${parentSummary.parentPhone}
City & Country: ${cityCountry}
Interested Lead Token: ${leadToken || "N/A"}`;
      const coordinatorHtml = themedEmailShell({
        eyebrow: "New Admission Submitted",
        title: "A new admission form has been submitted",
        intro: `Assalamualaikum ${coordinator.full_name || "Coordinator"}. A new admission form has been submitted and is ready for review.`,
        rows: [
          ["Student", studentName],
          ["Programme", programName],
          ["Class", classLevel],
          ["Preferred Starting Month", preferredStartingMonth],
          ["Primary Parent", parentSummary.parentName],
          ["Email", parentSummary.parentEmail || linkedLead?.email || "Not provided"],
          ["Phone", parentSummary.parentPhone],
          ["City & Country", cityCountry],
        ],
        footerNote: `Interested lead token: ${leadToken || "N/A"}`,
      });

      await sendEmail({
        to: coordinator.email,
        subject: coordinatorSubject,
        html: coordinatorHtml,
        text: coordinatorText,
      });
    }

    return json(
      true,
      "Admission form submitted successfully. You are being redirected to the payment and scholarship page.",
      201,
      {
        registration_id: createdLead.id,
        next_step_url: nextStepUrl,
        voucher_no: voucher?.voucherNo || "",
        voucher_id: voucher?.voucherId || "",
      }
    );
  } catch (error) {
    return json(
      false,
      error instanceof Error ? error.message : "Unable to submit admission form.",
      500
    );
  }
}
