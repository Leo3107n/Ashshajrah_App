"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { BadgePercent, Calculator, CalendarDays, ChevronDown, FileText, Info, School } from "lucide-react";
import { normalizeClassLevel } from "@/lib/academicCatalog";

const PROGRAM_OPTIONS = [
  "Early Childhood Education (Parent Partnership Model)",
];

const STARTING_MONTH_OPTIONS = ["August"];
const GENDER_OPTIONS = ["Boy", "Girl"];
const YES_NO_OPTIONS = ["Yes", "No"];
const SUPPORT_OPTIONS = ["Mother", "Father", "Both", "Guardian"];
const CONTACT_OPTIONS = ["Father", "Mother"];
const DEVICE_OPTIONS = ["Laptop", "Desktop Computer", "External Monitor / Large Screen"];
const RESIDENCE_OPTIONS = ["Owned", "Rented", "Shared", "Other"];
const EMPLOYMENT_STATUS_OPTIONS = ["Salaried", "Business", "Daily Wage", "Unemployed", "Other"];

const BASE_STEP_TITLES = [
  "Programme",
  "Student",
  "Profile",
  "Parents",
  "Readiness",
  "Declaration",
];

const initialForm = {
  programName: PROGRAM_OPTIONS[0],
  classLevel: "",
  preferredStartingMonth: "August",
  preferredStartingMonthOther: "",
  studentName: "",
  gender: "",
  dateOfBirth: "",
  country: "Pakistan",
  city: "",
  nationality: "Pakistan",
  religion: "",
  childProfile: "",
  childStrengths: "",
  childSupportNeeds: "",
  childSpecialInterests: "",
  developmentalConcern: "",
  developmentalConcernDetails: "",
  medicalConditions: "",
  needBasedScholarshipRequested: false,
  scholarshipDependentsCount: "",
  scholarshipSchoolGoingChildrenCount: "",
  scholarshipResidenceType: "",
  scholarshipRequestedAmount: "",
  scholarshipReason: "",
  scholarshipSupportingDocumentFile: null,
  paymentMethod: "",
  admissionFee: "",
  discountPercent: "",
  paymentInstructions: "",
  payerName: "",
  payerEmail: "",
  payerPhone: "",
  transactionId: "",
  paidAmount: "",
  paidAt: "",
  paymentProofFile: null,
  fatherNameEnglish: "",
  fatherCnic: "",
  fatherQualification: "",
  fatherOccupation: "",
  fatherMotherTongue: "",
  fatherContactHome: "",
  fatherContactWhatsapp: "",
  fatherEmergencyContact: "",
  fatherEmail: "",
  fatherResidentialAddress: "",
  motherNameEnglish: "",
  motherCnic: "",
  motherQualification: "",
  motherOccupation: "",
  motherMotherTongue: "",
  motherContactHome: "",
  motherContactWhatsapp: "",
  motherEmergencyContact: "",
  motherEmail: "",
  motherResidentialAddress: "",
  preferredContactPerson: "",
  supportPersonDuringLearning: "",
  deviceAvailable: "",
  whyJoinSchool: "",
  schoolExpectations: "",
  declarationAccepted: false,
  birthCertificateFile: null,
  parentCnicFile: null,
  childPhotographFile: null,
  medicalReportFile: null,
};

const container = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut", staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPersonName(value) {
  const text = String(value || "").trim();
  return /^[A-Za-zÀ-ÖØ-öø-ÿا-ي؀-ۿ][A-Za-zÀ-ÖØ-öø-ÿا-ي؀-ۿ\s.'-]{1,78}[A-Za-zÀ-ÖØ-öø-ÿا-ي؀-ۿ.]?$/.test(text);
}

function isValidPhoneNumber(value) {
  const text = String(value || "").trim();
  return /^[+()0-9\s-]{7,20}$/.test(text) && /\d{7,}/.test(text);
}

function getPhoneDigitLimit(country) {
  const normalized = String(country || "").trim().toLowerCase();
  if (!normalized) return 15;
  if (normalized === "pakistan") return 12;
  if (normalized === "saudi arabia") return 12;
  if (normalized === "united arab emirates") return 12;
  if (normalized === "united kingdom") return 12;
  if (normalized === "united states" || normalized === "canada") return 11;
  return 15;
}

function countPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "").length;
}

function trimPhoneDigits(value, country) {
  const text = String(value || "");
  const limit = getPhoneDigitLimit(country);
  let digitsSeen = 0;
  let result = "";

  for (const char of text) {
    if (/\d/.test(char)) {
      if (digitsSeen >= limit) continue;
      digitsSeen += 1;
      result += char;
      continue;
    }

    if (char === "+" && result.length === 0) {
      result += char;
      continue;
    }

    if (/[\s()-]/.test(char)) {
      result += char;
    }
  }

  return result;
}

function isValidPhoneNumberForCountry(value, country) {
  if (!isValidPhoneNumber(value)) return false;
  return countPhoneDigits(value) <= getPhoneDigitLimit(country);
}

function isValidNumericValue(value) {
  const text = String(value || "").trim();
  return /^\d+(\.\d{1,2})?$/.test(text);
}

function isValidCnic(value) {
  const text = String(value || "").trim();
  return /^(\d{5}-\d{7}-\d{1}|\d{13})$/.test(text);
}

function formatCnic(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
}

function isValidTextName(value) {
  const text = String(value || "").trim();
  return /^[A-Za-zÀ-ÖØ-öø-ÿا-ي؀-ۿ][A-Za-zÀ-ÖØ-öø-ÿا-ي؀-ۿ\s.'()&/-]{1,98}[A-Za-zÀ-ÖØ-öø-ÿا-ي؀-ۿ.)]?$/.test(text);
}

function isValidTextValue(value) {
  const text = String(value || "").trim();
  return text.length > 0 && !/^\d+$/.test(text);
}

function calculateAgeFromDate(dateValue) {
  if (!dateValue) return "";

  const dateOfBirth = new Date(dateValue);
  if (Number.isNaN(dateOfBirth.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDifference = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : "";
}

function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getPrimaryParentName(form) {
  return form.preferredContactPerson === "Mother"
    ? form.motherNameEnglish || form.fatherNameEnglish
    : form.fatherNameEnglish || form.motherNameEnglish;
}

function getStepErrors(form, previewMode = false) {
  const errors = {};

  if (!form.programName) errors.programName = "Programme is required.";
  if (!form.classLevel) errors.classLevel = "Applying class is required.";
  if (!form.preferredStartingMonth) errors.preferredStartingMonth = "Preferred starting month is required.";
  if (!form.studentName.trim()) errors.studentName = "Student full name is required.";
  else if (!isValidPersonName(form.studentName)) errors.studentName = "Enter a valid student name.";
  if (!form.gender) errors.gender = "Gender is required.";
  if (!form.dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
  if (!form.country.trim()) errors.country = "Country is required.";
  else if (!isValidTextName(form.country)) errors.country = "Enter a valid country name.";
  if (!form.city.trim()) errors.city = "City is required.";
  else if (!isValidTextName(form.city)) errors.city = "Enter a valid city name.";
  if (!form.nationality.trim()) errors.nationality = "Nationality is required.";
  else if (!isValidTextName(form.nationality)) errors.nationality = "Enter a valid nationality.";
  if (!form.religion.trim()) errors.religion = "Religion is required.";
  else if (!isValidTextName(form.religion)) errors.religion = "Enter a valid religion.";
  if (!form.supportPersonDuringLearning) errors.supportPersonDuringLearning = "Please select who will support the child.";
  if (!form.deviceAvailable) errors.deviceAvailable = "Device availability is required.";
  if (!form.developmentalConcern) errors.developmentalConcern = "Please select whether there is any diagnosed concern.";
  if (form.developmentalConcern === "Yes" && !String(form.developmentalConcernDetails || "").trim()) {
    errors.developmentalConcernDetails = "Please share the diagnosed concern details.";
  }

  if (!String(form.fatherNameEnglish || "").trim() && !String(form.motherNameEnglish || "").trim()) {
    errors.parentNames = "At least one parent name is required.";
  }
  if (String(form.fatherNameEnglish || "").trim() && !isValidPersonName(form.fatherNameEnglish)) {
    errors.fatherNameEnglish = "Enter a valid father name.";
  }
  if (String(form.motherNameEnglish || "").trim() && !isValidPersonName(form.motherNameEnglish)) {
    errors.motherNameEnglish = "Enter a valid mother name.";
  }
  if (!String(form.fatherNameEnglish || "").trim()) {
    errors.fatherNameEnglish = "Father name is required.";
  }
  if (!String(form.motherNameEnglish || "").trim()) {
    errors.motherNameEnglish = "Mother name is required.";
  }
  if (!String(form.fatherCnic || "").trim()) errors.fatherCnic = "Father CNIC is required.";
  else if (!isValidCnic(form.fatherCnic)) errors.fatherCnic = "Enter a valid CNIC number.";
  if (!String(form.motherCnic || "").trim()) errors.motherCnic = "Mother CNIC is required.";
  else if (!isValidCnic(form.motherCnic)) errors.motherCnic = "Enter a valid CNIC number.";
  if (!String(form.fatherQualification || "").trim()) errors.fatherQualification = "Father qualification is required.";
  else if (!isValidTextName(form.fatherQualification)) errors.fatherQualification = "Enter a valid qualification.";
  if (!String(form.motherQualification || "").trim()) errors.motherQualification = "Mother qualification is required.";
  else if (!isValidTextName(form.motherQualification)) errors.motherQualification = "Enter a valid qualification.";
  if (!String(form.fatherOccupation || "").trim()) errors.fatherOccupation = "Father occupation is required.";
  else if (!isValidTextName(form.fatherOccupation)) errors.fatherOccupation = "Enter a valid occupation.";
  if (!String(form.motherOccupation || "").trim()) errors.motherOccupation = "Mother occupation is required.";
  else if (!isValidTextName(form.motherOccupation)) errors.motherOccupation = "Enter a valid occupation.";
  if (!String(form.fatherMotherTongue || "").trim()) errors.fatherMotherTongue = "Father mother tongue is required.";
  else if (!isValidTextName(form.fatherMotherTongue)) errors.fatherMotherTongue = "Enter a valid language.";
  if (!String(form.motherMotherTongue || "").trim()) errors.motherMotherTongue = "Mother mother tongue is required.";
  else if (!isValidTextName(form.motherMotherTongue)) errors.motherMotherTongue = "Enter a valid language.";
  if (!String(form.fatherContactHome || "").trim()) errors.fatherContactHome = "Father home contact is required.";
  else if (!isValidPhoneNumberForCountry(form.fatherContactHome, form.country)) errors.fatherContactHome = `Enter a valid home contact number for ${form.country || "the selected country"}.`;
  if (!String(form.fatherEmergencyContact || "").trim()) errors.fatherEmergencyContact = "Father emergency contact is required.";
  else if (!isValidPhoneNumberForCountry(form.fatherEmergencyContact, form.country)) {
    errors.fatherEmergencyContact = "Enter a valid emergency contact number.";
  }
  if (!String(form.fatherContactWhatsapp || "").trim() && !String(form.fatherEmergencyContact || "").trim()) {
    errors.fatherContactWhatsapp = "Father WhatsApp or emergency contact is required.";
  }
  if (!String(form.motherContactHome || "").trim()) errors.motherContactHome = "Mother home contact is required.";
  else if (!isValidPhoneNumberForCountry(form.motherContactHome, form.country)) errors.motherContactHome = `Enter a valid home contact number for ${form.country || "the selected country"}.`;
  if (!String(form.motherEmergencyContact || "").trim()) errors.motherEmergencyContact = "Mother emergency contact is required.";
  else if (!isValidPhoneNumberForCountry(form.motherEmergencyContact, form.country)) {
    errors.motherEmergencyContact = "Enter a valid emergency contact number.";
  }
  if (!String(form.motherContactWhatsapp || "").trim() && !String(form.motherEmergencyContact || "").trim()) {
    errors.motherContactWhatsapp = "Mother WhatsApp or emergency contact is required.";
  }
  if (String(form.fatherEmail || "").trim() && !isValidEmail(String(form.fatherEmail || "").trim())) {
    errors.fatherEmail = "Enter a valid father email address.";
  } else if (!String(form.fatherEmail || "").trim()) {
    errors.fatherEmail = "Father email is required.";
  }
  if (String(form.motherEmail || "").trim() && !isValidEmail(String(form.motherEmail || "").trim())) {
    errors.motherEmail = "Enter a valid mother email address.";
  } else if (!String(form.motherEmail || "").trim()) {
    errors.motherEmail = "Mother email is required.";
  }
  if (!form.preferredContactPerson) {
    errors.preferredContactPerson = "Preferred contact person is required.";
  }
  if (!getPrimaryParentName(form)) {
    errors.primaryParent = "Primary parent details are incomplete.";
  }
  if (!String(form.fatherResidentialAddress || "").trim()) errors.fatherResidentialAddress = "Father residential address is required.";
  if (!String(form.motherResidentialAddress || "").trim()) errors.motherResidentialAddress = "Mother residential address is required.";
  if (
    form.preferredContactPerson === "Father" &&
    !(
      String(form.fatherContactWhatsapp || "").trim() ||
      String(form.fatherEmergencyContact || "").trim() ||
      String(form.fatherContactHome || "").trim()
    )
  ) {
    errors.fatherContactWhatsapp = "Father contact number is required for the preferred contact person.";
  }
  if (
    form.preferredContactPerson === "Mother" &&
    !(
      String(form.motherContactWhatsapp || "").trim() ||
      String(form.motherEmergencyContact || "").trim() ||
      String(form.motherContactHome || "").trim()
    )
  ) {
    errors.motherContactWhatsapp = "Mother contact number is required for the preferred contact person.";
  }

  if (!form.birthCertificateFile) errors.birthCertificateFile = "Child B-Form / Birth Certificate is required.";
  if (!form.parentCnicFile) errors.parentCnicFile = "Parent CNIC is required.";
  if (!form.childPhotographFile) errors.childPhotographFile = "Recent child photograph is required.";
  if (!form.declarationAccepted) errors.declarationAccepted = "You must accept the declaration before submitting.";

  return errors;
}

function FieldError({ error }) {
  return error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null;
}

function FilePreview({ file }) {
  const previewUrl = useMemo(() => {
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return "";
    }

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!(file instanceof File)) return null;

  const isImage = file.type.startsWith("image/");

  return isImage ? (
    <div className="mt-3 overflow-hidden rounded-[1rem] border border-[#2D8A6A]/10 bg-[#FAF7F0]">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={file.name}
          className="h-32 w-full object-cover"
        />
      ) : null}
      <div className="px-3 py-3 text-sm text-[#245C4F]">
        <p className="font-semibold text-[#063F32]">{file.name}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#0D5C48]">Image selected</p>
      </div>
    </div>
  ) : (
    <div className="mt-3 rounded-[1rem] border border-[#2D8A6A]/10 bg-[#FAF7F0] px-3 py-3 text-sm text-[#245C4F]">
      <p className="font-semibold text-[#063F32]">{file.name}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#0D5C48]">File selected</p>
    </div>
  );
}

function SelectField({ id, value, onChange, error, className = "", children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-full">
      <select
        id={id}
        value={value ?? ""}
        onMouseDown={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={onChange}
        className={`${className} pr-12 appearance-none`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
      />
      <FieldError error={error} />
    </div>
  );
}

function FormulaBox({ value, label }) {
  return (
    <div className="min-w-fit text-center">
      <div className="rounded-lg border border-[#E4D9BE] bg-[#FCFAF5] px-1 py-2 text-[10px] font-bold text-[#063F32] sm:px-2 sm:text-[11px]">
        {Number(value || 0).toLocaleString("en-PK")}
      </div>
      <p className="mt-1 text-[8px] font-medium leading-3 text-[#245C4F] sm:text-[9px]">{label}</p>
    </div>
  );
}

function FormulaBoxSmall({ value, label }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E4D9BE] bg-[#FCFAF5] px-2 py-2 sm:hidden">
      <p className="text-[10px] font-semibold text-[#245C4F]">{label}</p>
      <p className="whitespace-nowrap text-[11px] font-bold text-[#063F32]">
        {Number(value || 0).toLocaleString("en-PK")}
      </p>
    </div>
  );
}

function FormulaOperator({ value }) {
  return (
    <div className="pt-2 text-sm font-bold text-[#063F32] sm:text-base">
      {value}
    </div>
  );
}

function FormulaTotal({ value }) {
  return (
    <div className="min-w-0 text-center">
      <div className="rounded-lg bg-[linear-gradient(135deg,#063F32,#0D5C48)] px-1.5 py-2 text-[10px] font-bold text-[#FAF7F0] shadow-[0_10px_24px_rgba(13,59,46,0.16)] sm:px-2 sm:text-[11px]">
        {Number(value || 0).toLocaleString("en-PK")}
      </div>
      <p className="mt-1 text-[8px] font-medium leading-3 text-[#245C4F] sm:text-[9px]">Total Amount</p>
    </div>
  );
}

function FormulaTotalSmall({ value }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-[linear-gradient(135deg,#063F32,#0D5C48)] px-2 py-2 shadow-[0_10px_24px_rgba(13,59,46,0.16)] sm:hidden">
      <p className="text-[10px] font-semibold text-[#FAF7F0]/85">Total Amount</p>
      <p className="whitespace-nowrap text-[11px] font-bold text-[#FAF7F0]">
        {Number(value || 0).toLocaleString("en-PK")}
      </p>
    </div>
  );
}

async function uploadAdmissionFormFile({ documentType, file, applicationId, voucherNo = "" }) {
  if (!(file instanceof File) || file.size <= 0) {
    return "";
  }

  const shouldCompressImage =
    typeof window !== "undefined" &&
    file.type.startsWith("image/") &&
    file.size > 1024 * 1024;

  async function compressImageFile(inputFile) {
    const objectUrl = URL.createObjectURL(inputFile);
    try {
      const bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = objectUrl;
      });

      const maxSize = 1600;
      const scale = Math.min(1, maxSize / Math.max(bitmap.width || 1, bitmap.height || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((bitmap.width || 1) * scale));
      canvas.height = Math.max(1, Math.round((bitmap.height || 1) * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        return inputFile;
      }

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const compressedBlob = await new Promise((resolve) =>
        canvas.toBlob(
          (blob) => resolve(blob),
          "image/jpeg",
          0.82
        )
      );

      if (!compressedBlob || compressedBlob.size >= inputFile.size) {
        return inputFile;
      }

      return new File([compressedBlob], inputFile.name.replace(/\.[^.]+$/, ".jpg"), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } catch {
      return inputFile;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const uploadFile = shouldCompressImage ? await compressImageFile(file) : file;

  const payload = new FormData();
  payload.append("documentType", documentType);
  payload.append("applicationId", applicationId);
  if (voucherNo) payload.append("voucherNo", voucherNo);
  payload.append("file", uploadFile);

  const response = await fetch("/api/public/admission-file-upload", {
    method: "POST",
    body: payload,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.storedPath) {
    throw new Error(data?.message || `Unable to upload ${documentType.replace(/_/g, " ")}.`);
  }

  return data.storedPath;
}

function AdmissionFormContent() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [leadToken, setLeadToken] = useState("");
  const [leadClassLevel, setLeadClassLevel] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [leadTokenError, setLeadTokenError] = useState("");
  const [paymentOptions, setPaymentOptions] = useState({
    discounts: [],
    paymentMethods: [],
    regularFees: [],
    admissionFees: [],
    classLevels: [],
    coordinatorMaxDiscountPercent: 20,
  });
  const [locationOptions, setLocationOptions] = useState({
    countries: [],
    cities: [],
  });
  const searchParams = useSearchParams();
  const router = useRouter();
  const readinessErrorRef = useRef(null);
  const leadTokenParam = searchParams?.get("leadToken") || "";
  const isPreviewMode = searchParams?.get("preview") === "1";
  const STEP_TITLES = ["Programme", "Student", "Profile", "Parents", "Readiness", "Declaration"];
  const totalSteps = STEP_TITLES.length;

  function getErrorsForCurrentStep(formValue, currentStep) {
    const allErrors = getStepErrors(formValue, isPreviewMode);
    const keysByStep = {
      0: ["programName", "classLevel", "preferredStartingMonth"],
      1: ["studentName", "gender", "dateOfBirth", "country", "city", "nationality", "religion"],
      2: ["developmentalConcern", "developmentalConcernDetails"],
      3: ["parentNames", "fatherNameEnglish", "motherNameEnglish", "fatherCnic", "motherCnic", "fatherQualification", "motherQualification", "fatherOccupation", "motherOccupation", "fatherMotherTongue", "motherMotherTongue", "fatherEmail", "motherEmail", "preferredContactPerson", "primaryParent", "fatherContactHome", "fatherContactWhatsapp", "fatherEmergencyContact", "motherContactHome", "motherContactWhatsapp", "motherEmergencyContact", "fatherResidentialAddress", "motherResidentialAddress", "supportPersonDuringLearning"],
      4: ["deviceAvailable", "birthCertificateFile", "parentCnicFile", "childPhotographFile"],
      5: ["declarationAccepted"],
    };

    return (keysByStep[currentStep] || []).reduce((accumulator, key) => {
      if (allErrors[key]) {
        accumulator[key] = allErrors[key];
      }
      return accumulator;
    }, {});
  }

  function stepHasCurrentErrors(currentStep, errorsValue) {
    const map = {
      0: ["programName", "classLevel", "preferredStartingMonth"],
      1: ["studentName", "gender", "dateOfBirth", "country", "city", "nationality", "religion"],
      2: ["developmentalConcern", "developmentalConcernDetails"],
      3: ["parentNames", "fatherNameEnglish", "motherNameEnglish", "fatherCnic", "motherCnic", "fatherQualification", "motherQualification", "fatherOccupation", "motherOccupation", "fatherMotherTongue", "motherMotherTongue", "fatherEmail", "motherEmail", "preferredContactPerson", "primaryParent", "fatherContactHome", "fatherContactWhatsapp", "fatherEmergencyContact", "motherContactHome", "motherContactWhatsapp", "motherEmergencyContact", "fatherResidentialAddress", "motherResidentialAddress", "supportPersonDuringLearning"],
      4: ["deviceAvailable", "birthCertificateFile", "parentCnicFile", "childPhotographFile"],
      5: ["declarationAccepted"],
    };

    return (map[currentStep] || []).some((key) => Boolean(errorsValue[key]));
  }

  function getAllCurrentErrors(formValue) {
    const errors = getStepErrors(formValue, isPreviewMode);
    return errors;
  }

  useEffect(() => {
    const token = leadTokenParam;
    if (!token) return;

    setLeadToken(token);
    setLeadTokenError("");
    setTokenLoading(true);
    let active = true;

    async function loadLead() {
      try {
        const response = await fetch(`/api/public/interested-students/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!active) {
          return;
        }

        if (!response.ok || !data?.item) {
          setLeadTokenError(data?.message || "This admission form link is no longer valid.");
          setErrors((current) => ({
            ...current,
            form: data?.message || "This admission form link is no longer valid.",
          }));
          return;
        }

        setForm((current) => ({
          ...current,
          studentName: data.item.student_name || current.studentName,
          classLevel: data.item.class_level || current.classLevel,
          fatherNameEnglish: data.item.parent_name || current.fatherNameEnglish,
          fatherEmail: data.item.email || current.fatherEmail,
          fatherContactWhatsapp: data.item.phone || current.fatherContactWhatsapp,
          preferredContactPerson: current.preferredContactPerson || "Father",
        }));
        setLeadClassLevel(String(data.item.class_level || "").trim());
      } catch {
        // Allow manual admission form submission even if prefill is unavailable.
      } finally {
        if (active) setTokenLoading(false);
      }
    }

    void loadLead();

    return () => {
      active = false;
    };
  }, [leadTokenParam]);

  useEffect(() => {
    let active = true;

    async function loadPaymentOptions() {
      try {
        const response = await fetch("/api/public/admission-form-options", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data || !active) return;

        setPaymentOptions({
          discounts: Array.isArray(data.discounts) ? data.discounts : [],
          paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
          regularFees: Array.isArray(data.regularFees) ? data.regularFees : [],
          admissionFees: Array.isArray(data.admissionFees) ? data.admissionFees : [],
          classLevels: Array.isArray(data.classLevels) ? data.classLevels : [],
          coordinatorMaxDiscountPercent: Number(data.coordinatorMaxDiscountPercent || 20),
        });
      } catch {
        // Keep the form usable even if payment options cannot be loaded.
      }
    }

    void loadPaymentOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadLocationOptions() {
      try {
        const response = await fetch("/api/public/location-options", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !active) return;

        setLocationOptions((current) => ({
          countries: Array.isArray(data.countries) ? data.countries : [],
          cities: Array.isArray(current.cities) ? current.cities : [],
        }));
      } catch {
        // Keep the form usable even if location options cannot be loaded.
      }
    }

    void loadLocationOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const selectedCountry = String(form.country || "").trim();

    if (!selectedCountry) {
      setLocationOptions((current) => ({ ...current, cities: [] }));
      return () => {
        active = false;
      };
    }

    async function loadCities() {
      try {
        const response = await fetch(`/api/public/location-options?country=${encodeURIComponent(selectedCountry)}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !active) return;

        setLocationOptions((current) => ({
          ...current,
          cities: Array.isArray(data.cities) ? data.cities : [],
        }));
      } catch {
        if (active) {
          setLocationOptions((current) => ({ ...current, cities: [] }));
        }
      }
    }

    void loadCities();

    return () => {
      active = false;
    };
  }, [form.country]);

  const previewClassLevel = useMemo(() => String(leadClassLevel || form.classLevel || "").trim(), [leadClassLevel, form.classLevel]);

  const classLevelOptions = useMemo(() => {
    const items = paymentOptions.classLevels
      .map((item) => String(item?.class_level || item?.title || "").trim())
      .filter(Boolean);

    return items.filter((item, index) => items.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index);
  }, [paymentOptions.classLevels]);

  const countryOptions = useMemo(() => {
    return Array.isArray(locationOptions.countries) ? locationOptions.countries : [];
  }, [locationOptions.countries]);

  const cityOptions = useMemo(() => {
    return Array.isArray(locationOptions.cities) ? locationOptions.cities : [];
  }, [locationOptions.cities]);

  const age = useMemo(() => calculateAgeFromDate(form.dateOfBirth), [form.dateOfBirth]);
  const matchingRegularFees = useMemo(() => {
    const normalizedPreviewClass = normalizeLookupKey(previewClassLevel);
    return paymentOptions.regularFees.filter((item) => {
      const classLevel = normalizeLookupKey(item?.class_level || "");
      return !normalizedPreviewClass || classLevel === normalizedPreviewClass;
    });
  }, [previewClassLevel, paymentOptions.regularFees]);

  useEffect(() => {
    if (!form.admissionFee && matchingRegularFees.length === 1) {
      setForm((current) => ({
        ...current,
        admissionFee: String(matchingRegularFees[0]?.amount || ""),
      }));
    }
  }, [form.admissionFee, matchingRegularFees]);

  const previewRegularFee = useMemo(() => {
    return matchingRegularFees[0] || null;
  }, [matchingRegularFees]);

  const previewAdmissionFeeOptions = useMemo(() => {
    return paymentOptions.admissionFees.filter((item) => {
      const classLevel = normalizeLookupKey(item?.class_level || "");
      const normalizedPreviewClass = normalizeLookupKey(previewClassLevel);
      return !normalizedPreviewClass || !classLevel || classLevel === normalizedPreviewClass;
    });
  }, [previewClassLevel, paymentOptions.admissionFees]);

  const previewAdmissionFee = useMemo(() => {
    if (form.admissionFee) {
      return previewAdmissionFeeOptions.find((item) => String(item.amount || "") === String(form.admissionFee || "")) || null;
    }
    return null;
  }, [form.admissionFee, previewAdmissionFeeOptions]);

  const liveSelectedAdmissionFeeId = useMemo(() => searchParams?.get("admissionFeeId") || "", [searchParams]);
  const liveSelectedAdmissionFeeAmountParam = useMemo(() => searchParams?.get("admissionFeeAmount") || "", [searchParams]);
  const liveSelectedDiscountId = useMemo(() => searchParams?.get("discountId") || "", [searchParams]);
  const liveSelectedDiscountPercentParam = useMemo(() => searchParams?.get("discountPercent") || "", [searchParams]);
  const liveSelectedPaymentMethodId = useMemo(() => searchParams?.get("paymentMethodId") || "", [searchParams]);
  const liveSelectedPaymentMethodNameParam = useMemo(() => searchParams?.get("paymentMethodName") || "", [searchParams]);
  const livePaymentInstructionsFromLink = useMemo(() => searchParams?.get("paymentInstructions") || "", [searchParams]);
  const liveSelectedAdmissionFee = useMemo(
    () =>
      paymentOptions.admissionFees.find((item) => item.id === liveSelectedAdmissionFeeId) ||
      paymentOptions.admissionFees.find((item) => String(item.amount || "") === String(liveSelectedAdmissionFeeAmountParam || "")) ||
      null,
    [liveSelectedAdmissionFeeId, liveSelectedAdmissionFeeAmountParam, paymentOptions.admissionFees]
  );
  const liveSelectedDiscount = useMemo(
    () =>
      paymentOptions.discounts.find((item) => item.id === liveSelectedDiscountId) ||
      paymentOptions.discounts.find((item) => String(item.percent || "") === String(liveSelectedDiscountPercentParam || "")) ||
      null,
    [liveSelectedDiscountId, liveSelectedDiscountPercentParam, paymentOptions.discounts]
  );
  const liveSelectedPaymentMethod = useMemo(
    () =>
      paymentOptions.paymentMethods.find((item) => item.id === liveSelectedPaymentMethodId) ||
      paymentOptions.paymentMethods.find((item) => String(item.name || "").trim().toLowerCase() === String(liveSelectedPaymentMethodNameParam || "").trim().toLowerCase()) ||
      null,
    [liveSelectedPaymentMethodId, liveSelectedPaymentMethodNameParam, paymentOptions.paymentMethods]
  );
  const liveAdmissionFeeAmount = Number(liveSelectedAdmissionFee?.amount || liveSelectedAdmissionFeeAmountParam || 0);
  const liveDiscountPercent = Number(liveSelectedDiscount?.percent || 0);
  const livePaymentInstructions = String(livePaymentInstructionsFromLink || liveSelectedPaymentMethod?.instructions || "").trim();

  const previewDiscountPercent = useMemo(() => {
    return Number(String(form.discountPercent || "0").replace("%", "")) || 0;
  }, [form.discountPercent]);

  const previewPaymentInstructions = useMemo(() => {
    return String(form.paymentInstructions || "").trim();
  }, [form.paymentInstructions]);

  const isPreviewPaymentReady = useMemo(() => {
    if (!isPreviewMode) return true;
    return Boolean(form.admissionFee && String(form.discountPercent || "").trim() && previewPaymentInstructions);
  }, [isPreviewMode, form.admissionFee, form.discountPercent, previewPaymentInstructions]);

  useEffect(() => {
    if (!isPreviewMode) return undefined;

    const targetOrigin = window.location.origin;
    window.parent?.postMessage(
      {
        type: "ADMISSION_PREVIEW_PAYMENT_READY",
        leadToken,
        ready: isPreviewPaymentReady,
      },
      targetOrigin
    );

    return undefined;
  }, [isPreviewMode, leadToken, isPreviewPaymentReady]);

  const previewRegularFeeAmount = Number(previewRegularFee?.amount || 0);
  const previewDiscountAmount = Math.round((previewRegularFeeAmount * previewDiscountPercent) / 100);
  const previewAdmissionFeeAmount = Number(previewAdmissionFee?.amount || 0);
  const previewTotalAmount = Math.max(previewRegularFeeAmount - previewDiscountAmount + previewAdmissionFeeAmount, 0);
  const liveDiscountAmount = Math.round(previewRegularFeeAmount * (liveDiscountPercent / 100));
  const liveTotalAmount = Math.max(previewRegularFeeAmount - liveDiscountAmount + liveAdmissionFeeAmount, 0);

  function updateField(name, value) {
    const nextValue = (name === "fatherCnic" || name === "motherCnic")
      ? formatCnic(value)
      : (
        name === "fatherContactHome" ||
        name === "fatherContactWhatsapp" ||
        name === "fatherEmergencyContact" ||
        name === "motherContactHome" ||
        name === "motherContactWhatsapp" ||
        name === "motherEmergencyContact" ||
        name === "payerPhone"
      )
        ? trimPhoneDigits(value, form.country)
      : value;
    setForm((current) => ({ ...current, [name]: nextValue }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function controlledValue(value) {
    return value ?? "";
  }

  async function handleFileSelection(name, file) {
    if (!file) {
      updateField(name, null);
      return;
    }

    const isImage = file.type.startsWith("image/");
    const maxDirectUploadSize = 2 * 1024 * 1024;

    if (!isImage && file.size > maxDirectUploadSize) {
      setErrors((current) => ({
        ...current,
        [name]: "This file is too large. Please upload a smaller image or PDF.",
      }));
      updateField(name, null);
      return;
    }

    if (!isImage) {
      updateField(name, file);
      return;
    }

    updateField(name, file);

    const compressedFile = await (async () => {
      const objectUrl = URL.createObjectURL(file);
      try {
        const bitmap = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = objectUrl;
        });

        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(bitmap.width || 1, bitmap.height || 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((bitmap.width || 1) * scale));
        canvas.height = Math.max(1, Math.round((bitmap.height || 1) * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          return file;
        }

        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        const compressedBlob = await new Promise((resolve) =>
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.72)
        );

        if (!compressedBlob || compressedBlob.size >= file.size) {
          return file;
        }

        return new File([compressedBlob], file.name.replace(/\.[^.]+$/, ".jpg"), {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      } catch {
        return file;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    })();

    if (compressedFile && compressedFile.size > 0 && compressedFile.size < file.size) {
      updateField(name, compressedFile);
    }
  }

  function goNext() {
    const nextErrors = getErrorsForCurrentStep(form, step);
    setErrors({
      ...nextErrors,
      form: Object.values(nextErrors)[0] || "",
    });

    if (Object.values(nextErrors).some(Boolean)) {
      if (step === 4) {
        window.requestAnimationFrame(() => {
          readinessErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return;
    }

    setStep((current) => Math.min(current + 1, totalSteps - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (leadTokenParam && leadTokenError) {
      setErrors((current) => ({
        ...current,
        form: leadTokenError,
      }));
      return;
    }

    const nextErrors = getAllCurrentErrors(form);
    setErrors({
      ...nextErrors,
      form: Object.values(nextErrors)[0] || "",
    });

    if (Object.values(nextErrors).some(Boolean)) {
      setSuccessMessage("");
      const firstErrorStep = STEP_TITLES.findIndex((_, index) => stepHasCurrentErrors(index, nextErrors));
      if (firstErrorStep >= 0) setStep(firstErrorStep);
      return;
    }

    setPending(true);
    setSuccessMessage("");

    try {
      const applicationId = leadToken || crypto.randomUUID();
      const birthCertificatePath = await uploadAdmissionFormFile({
        documentType: "birth_certificate",
        file: form.birthCertificateFile,
        applicationId,
      });
      const parentCnicPath = await uploadAdmissionFormFile({
        documentType: "parent_cnic",
        file: form.parentCnicFile,
        applicationId,
      });
      const childPhotographPath = await uploadAdmissionFormFile({
        documentType: "child_photograph",
        file: form.childPhotographFile,
        applicationId,
      });
      const medicalReportPath = await uploadAdmissionFormFile({
        documentType: "medical_report",
        file: form.medicalReportFile,
        applicationId,
      });
      const scholarshipSupportingDocumentPath = await uploadAdmissionFormFile({
        documentType: "scholarship_supporting_document",
        file: form.scholarshipSupportingDocumentFile,
        applicationId,
      });

      const payload = new FormData();
      Object.entries({
        program_name: form.programName,
        class_level: form.classLevel,
        preferred_starting_month: form.preferredStartingMonth,
        preferred_starting_month_other: "",
        student_name: form.studentName,
        student_name_urdu: "",
        gender: form.gender,
        date_of_birth: form.dateOfBirth,
        age: String(age || ""),
        country: form.country,
        city: form.city,
        nationality: form.nationality,
        religion: form.religion,
        preferred_language: "",
        current_school: "",
        current_grade: "",
        shift_reason: "",
        attended_online_classes: "",
        child_profile: form.childProfile,
        child_strengths: form.childStrengths,
        child_support_needs: form.childSupportNeeds,
        child_special_interests: form.childSpecialInterests,
        developmental_concern: form.developmentalConcern,
        developmental_concern_details: form.developmentalConcernDetails,
        medical_conditions: form.medicalConditions,
        father_name_english: form.fatherNameEnglish,
        father_name_urdu: "",
        father_cnic: form.fatherCnic,
        father_qualification: form.fatherQualification,
        father_occupation: form.fatherOccupation,
        father_mother_tongue: form.fatherMotherTongue,
        father_contact_home: form.fatherContactHome,
        father_contact_office: "",
        father_contact_whatsapp: form.fatherContactWhatsapp,
        father_emergency_contact: form.fatherEmergencyContact,
        father_email: form.fatherEmail,
        father_residential_address: form.fatherResidentialAddress,
        mother_name_english: form.motherNameEnglish,
        mother_name_urdu: "",
        mother_cnic: form.motherCnic,
        mother_qualification: form.motherQualification,
        mother_occupation: form.motherOccupation,
        mother_mother_tongue: form.motherMotherTongue,
        mother_contact_home: form.motherContactHome,
        mother_contact_office: "",
        mother_contact_whatsapp: form.motherContactWhatsapp,
        mother_emergency_contact: form.motherEmergencyContact,
        mother_email: form.motherEmail,
        mother_residential_address: form.motherResidentialAddress,
        preferred_contact_person: form.preferredContactPerson,
        support_person_during_learning: form.supportPersonDuringLearning,
        device_available: form.deviceAvailable,
        need_based_scholarship_requested: "No",
        scholarship_monthly_income: "",
        scholarship_dependents_count: "",
        scholarship_school_going_children_count: "",
        scholarship_residence_type: "",
        scholarship_guardian_employment_status: "",
        scholarship_requested_amount: "",
        scholarship_reason: "",
        scholarship_supporting_document_file_path: "",
        payment_method_id: isPreviewMode ? "" : String(liveSelectedPaymentMethod?.id || ""),
        payment_method: isPreviewMode ? form.paymentMethod : (liveSelectedPaymentMethod?.name || liveSelectedPaymentMethod?.method_key || ""),
        admission_fee: isPreviewMode ? form.admissionFee : String(liveAdmissionFeeAmount || ""),
        discount_percent: isPreviewMode ? form.discountPercent : String(liveDiscountPercent || ""),
        payment_instructions: isPreviewMode ? form.paymentInstructions : livePaymentInstructions,
        payer_name: "",
        payer_email: "",
        payer_phone: "",
        transaction_id: "",
        paid_amount: "",
        paid_at: "",
        why_join_school: "",
        school_expectations: "",
        declaration_accepted: form.declarationAccepted ? "Yes" : "No",
        leadToken,
        birth_certificate_file_path: birthCertificatePath,
        parent_cnic_file_path: parentCnicPath,
        child_photograph_file_path: childPhotographPath,
        medical_report_file_path: medicalReportPath,
        payment_proof_file_path: "",
      }).forEach(([key, value]) => payload.append(key, value || ""));

      const response = await fetch("/api/public/registration-leads", {
        method: "POST",
        body: payload,
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit admission form.");
      }

      setForm(initialForm);
      setErrors({});
      setStep(0);
      setLeadTokenError("This admission form link has been used and is no longer valid.");
      setSuccessMessage("Admission form submitted successfully. Redirecting to the payment and scholarship page...");
      const nextStepUrl = String(data?.next_step_url || "").trim();
      if (nextStepUrl) {
        if (/^https?:\/\//i.test(nextStepUrl)) {
          window.location.assign(nextStepUrl);
        } else {
          router.push(nextStepUrl);
        }
      }
    } catch (error) {
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "Unable to submit admission form.",
      }));
    } finally {
      setPending(false);
    }
  }

  const inputClass = (hasError) =>
    `w-full rounded-[14px] border px-4 py-3 font-body text-[#063F32] outline-none transition placeholder:text-[#245C4F]/45 focus:ring-4 ${
      hasError
        ? "border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-rose-100"
        : "border-[rgba(13,59,46,0.12)] bg-[#FCFAF5] shadow-[inset_0_1px_2px_rgba(13,59,46,0.04)] focus:border-[#2D8A6A] focus:bg-white focus:ring-[#2D8A6A]/10"
    }`;

  function renderProgrammeStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2 rounded-[1.1rem] border border-[rgba(201,162,39,0.26)] bg-[#FFF5D6]/80 px-4 py-4 text-sm leading-6 text-[#063F32]">
          For Academic Year 2026-2027, admissions are being offered in the Early Childhood programme only. Available classes are limited to the classes already active in the LMS.
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="programName">Programme</label>
          <SelectField id="programName" value={form.programName} onChange={(event) => updateField("programName", event.target.value)} error={errors.programName} className={inputClass(errors.programName)}>
            {PROGRAM_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="classLevel">Applying for Class</label>
          <SelectField id="classLevel" value={form.classLevel} onChange={(event) => updateField("classLevel", event.target.value)} error={errors.classLevel} className={inputClass(errors.classLevel)}>
            <option value="">Select class</option>
            {classLevelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="preferredStartingMonth">Preferred Starting Month</label>
          <SelectField id="preferredStartingMonth" value={form.preferredStartingMonth} onChange={(event) => updateField("preferredStartingMonth", event.target.value)} error={errors.preferredStartingMonth} className={inputClass(errors.preferredStartingMonth)}>
            <option value="">Select month</option>
            {STARTING_MONTH_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
      </div>
    );
  }

  function renderStudentStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="studentName">Student Full Name (English)</label>
          <input id="studentName" value={form.studentName} onChange={(event) => updateField("studentName", event.target.value)} className={inputClass(errors.studentName)} />
          <FieldError error={errors.studentName} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="gender">Gender</label>
          <SelectField id="gender" value={form.gender} onChange={(event) => updateField("gender", event.target.value)} error={errors.gender} className={inputClass(errors.gender)}>
            <option value="">Select gender</option>
            {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="dateOfBirth">Date of Birth</label>
          <input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} className={inputClass(errors.dateOfBirth)} />
          <FieldError error={errors.dateOfBirth} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="age">Age</label>
          <input id="age" value={age} readOnly className="w-full rounded-[14px] border border-[rgba(13,59,46,0.10)] bg-[#F1EADC] px-4 py-3 text-[#245C4F] outline-none" />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="country">Country</label>
          <SelectField id="country" value={form.country} onChange={(event) => {
            const nextCountry = event.target.value;
            updateField("country", nextCountry);
            if (form.city && !cityOptions.includes(String(form.city))) {
              updateField("city", "");
            }
          }} error={errors.country} className={inputClass(errors.country)}>
            <option value="">Select country</option>
            {countryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="city">City</label>
          <SelectField id="city" value={form.city} onChange={(event) => updateField("city", event.target.value)} error={errors.city} className={inputClass(errors.city)}>
            <option value="">{form.country ? "Select city" : "Select country first"}</option>
            {cityOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="nationality">Nationality</label>
          <SelectField id="nationality" value={form.nationality} onChange={(event) => updateField("nationality", event.target.value)} error={errors.nationality} className={inputClass(errors.nationality)}>
            <option value="">Select nationality</option>
            {countryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="religion">Religion</label>
          <input id="religion" value={form.religion} onChange={(event) => updateField("religion", event.target.value)} className={inputClass(errors.religion)} />
          <FieldError error={errors.religion} />
        </div>
      </div>
    );
  }

  function renderProfileStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:grid-cols-2 sm:p-6">
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="developmentalConcern">Any diagnosed learning difficulty or developmental concern?</label>
          <SelectField id="developmentalConcern" value={form.developmentalConcern} onChange={(event) => updateField("developmentalConcern", event.target.value)} error={errors.developmentalConcern} className={inputClass(errors.developmentalConcern)}>
            <option value="">Select option</option>
            {YES_NO_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        {form.developmentalConcern === "Yes" ? (
          <div className="sm:col-span-2">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="developmentalConcernDetails">If yes, please share details</label>
            <textarea id="developmentalConcernDetails" rows={3} value={form.developmentalConcernDetails} onChange={(event) => updateField("developmentalConcernDetails", event.target.value)} className={inputClass(errors.developmentalConcernDetails)} />
            <FieldError error={errors.developmentalConcernDetails} />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childProfile">Please describe your child briefly</label>
          <textarea id="childProfile" rows={3} value={form.childProfile} onChange={(event) => updateField("childProfile", event.target.value)} className={inputClass(false)} />
          <FieldError error={errors.childProfile} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childStrengths">Strengths</label>
          <textarea id="childStrengths" rows={3} value={form.childStrengths} onChange={(event) => updateField("childStrengths", event.target.value)} className={inputClass(false)} />
          <FieldError error={errors.childStrengths} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childSupportNeeds">Areas needing support</label>
          <textarea id="childSupportNeeds" rows={3} value={form.childSupportNeeds} onChange={(event) => updateField("childSupportNeeds", event.target.value)} className={inputClass(false)} />
          <FieldError error={errors.childSupportNeeds} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childSpecialInterests">Special interests</label>
          <textarea id="childSpecialInterests" rows={3} value={form.childSpecialInterests} onChange={(event) => updateField("childSpecialInterests", event.target.value)} className={inputClass(false)} />
          <FieldError error={errors.childSpecialInterests} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="medicalConditions">Medical conditions (if any)</label>
          <textarea id="medicalConditions" rows={3} value={form.medicalConditions} onChange={(event) => updateField("medicalConditions", event.target.value)} className={inputClass(false)} />
          <FieldError error={errors.medicalConditions} />
        </div>
      </div>
    );
  }

  function renderParentColumn(prefix, title) {
    const nameEnglishKey = `${prefix}NameEnglish`;
    const cnicKey = `${prefix}Cnic`;
    const qualificationKey = `${prefix}Qualification`;
    const occupationKey = `${prefix}Occupation`;
    const motherTongueKey = `${prefix}MotherTongue`;
    const homeKey = `${prefix}ContactHome`;
    const whatsappKey = `${prefix}ContactWhatsapp`;
    const emergencyKey = `${prefix}EmergencyContact`;
    const emailKey = `${prefix}Email`;
    const addressKey = `${prefix}ResidentialAddress`;

    return (
      <div className="rounded-[1.5rem] border border-[rgba(13,59,46,0.12)] bg-[#FCFAF5] p-4 shadow-[0_10px_24px_rgba(13,59,46,0.04)]">
        <h3 className="font-display text-lg font-semibold text-[#063F32]">{title}</h3>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">{title} Name (Block Letters)</label>
            <input value={form[nameEnglishKey]} onChange={(event) => updateField(nameEnglishKey, event.target.value)} className={inputClass(false)} />
            <FieldError error={errors[nameEnglishKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">CNIC Number</label>
            <input
              value={form[cnicKey]}
              onChange={(event) => updateField(cnicKey, event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              maxLength={15}
              placeholder="12345-1234567-1"
              className={inputClass(false)}
            />
            <FieldError error={errors[cnicKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Qualification</label>
            <input value={form[qualificationKey]} onChange={(event) => updateField(qualificationKey, event.target.value)} className={inputClass(false)} />
            <FieldError error={errors[qualificationKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Occupation</label>
            <input value={form[occupationKey]} onChange={(event) => updateField(occupationKey, event.target.value)} className={inputClass(false)} />
            <FieldError error={errors[occupationKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Mother Tongue</label>
            <input value={form[motherTongueKey]} onChange={(event) => updateField(motherTongueKey, event.target.value)} className={inputClass(false)} />
            <FieldError error={errors[motherTongueKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Contact No. (Home)</label>
            <input value={form[homeKey]} onChange={(event) => updateField(homeKey, event.target.value)} maxLength={getPhoneDigitLimit(form.country) + 6} className={inputClass(false)} />
            <FieldError error={errors[homeKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Contact No. (WhatsApp)</label>
            <input value={form[whatsappKey]} onChange={(event) => updateField(whatsappKey, event.target.value)} maxLength={getPhoneDigitLimit(form.country) + 6} className={inputClass(errors[whatsappKey])} />
            <FieldError error={errors[whatsappKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Emergency Contact No.</label>
            <input value={form[emergencyKey]} onChange={(event) => updateField(emergencyKey, event.target.value)} maxLength={getPhoneDigitLimit(form.country) + 6} className={inputClass(false)} />
            <FieldError error={errors[emergencyKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Email ID</label>
            <input type="email" value={form[emailKey]} onChange={(event) => updateField(emailKey, event.target.value)} className={inputClass(errors[emailKey])} />
            <FieldError error={errors[emailKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Residential Address</label>
            <textarea rows={3} value={form[addressKey]} onChange={(event) => updateField(addressKey, event.target.value)} className={inputClass(false)} />
            <FieldError error={errors[addressKey]} />
          </div>
        </div>
      </div>
    );
  }

  function renderParentsStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:p-6">
        {errors.parentNames ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.parentNames}</div> : null}
        {errors.primaryParent ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.primaryParent}</div> : null}
        <div className="grid gap-5 lg:grid-cols-2">
          {renderParentColumn("father", "Father")}
          {renderParentColumn("mother", "Mother")}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="preferredContactPerson">Preferred Contact Person</label>
            <SelectField id="preferredContactPerson" value={form.preferredContactPerson} onChange={(event) => updateField("preferredContactPerson", event.target.value)} error={errors.preferredContactPerson} className={inputClass(errors.preferredContactPerson)}>
              <option value="">Select contact person</option>
              {CONTACT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </SelectField>
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="supportPersonDuringLearning">Who will support the child during learning?</label>
            <SelectField id="supportPersonDuringLearning" value={form.supportPersonDuringLearning} onChange={(event) => updateField("supportPersonDuringLearning", event.target.value)} error={errors.supportPersonDuringLearning} className={inputClass(errors.supportPersonDuringLearning)}>
              <option value="">Select support person</option>
              {SUPPORT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </SelectField>
          </div>
        </div>
      </div>
    );
  }

  function renderReadinessStep() {
    const readinessErrors = [
      "supportPersonDuringLearning",
      "deviceAvailable",
      "birthCertificateFile",
      "parentCnicFile",
      "childPhotographFile",
      "previousSchoolReportFile",
      "medicalReportFile",
    ]
      .filter((key) => errors[key])
      .map((key) => errors[key]);

    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:grid-cols-2 sm:p-6">
        {readinessErrors.length ? (
          <div ref={readinessErrorRef} className="sm:col-span-2 rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p className="font-semibold">Readiness step still needs a few required fields.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {readinessErrors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="sm:col-span-2 rounded-[1.1rem] border border-[rgba(201,162,39,0.26)] bg-[#FFF5D6]/80 px-4 py-4 text-sm leading-6 text-[#063F32]">
          Regular class attendance through smartphones or tablets is not permitted. Please arrange a laptop, desktop computer, or an adequately sized screen for the child.
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="deviceAvailable">Device available for online classes</label>
          <SelectField id="deviceAvailable" value={form.deviceAvailable} onChange={(event) => updateField("deviceAvailable", event.target.value)} error={errors.deviceAvailable} className={inputClass(errors.deviceAvailable)}>
            <option value="">Select device</option>
            {DEVICE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="birthCertificateFile">Child B-Form / Birth Certificate</label>
          <input id="birthCertificateFile" type="file" accept="image/*,.pdf" onChange={(event) => void handleFileSelection("birthCertificateFile", event.target.files?.[0] || null)} className={inputClass(errors.birthCertificateFile)} />
          <FieldError error={errors.birthCertificateFile} />
          <FilePreview file={form.birthCertificateFile} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="parentCnicFile">Parent CNIC</label>
          <input id="parentCnicFile" type="file" accept="image/*,.pdf" onChange={(event) => void handleFileSelection("parentCnicFile", event.target.files?.[0] || null)} className={inputClass(errors.parentCnicFile)} />
          <FieldError error={errors.parentCnicFile} />
          <FilePreview file={form.parentCnicFile} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childPhotographFile">Recent Child Photograph</label>
          <input id="childPhotographFile" type="file" accept="image/*,.pdf" onChange={(event) => void handleFileSelection("childPhotographFile", event.target.files?.[0] || null)} className={inputClass(errors.childPhotographFile)} />
          <FieldError error={errors.childPhotographFile} />
          <FilePreview file={form.childPhotographFile} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="medicalReportFile">Medical Report (if applicable)</label>
          <input id="medicalReportFile" type="file" accept="image/*,.pdf" onChange={(event) => void handleFileSelection("medicalReportFile", event.target.files?.[0] || null)} className={inputClass(false)} />
          <FilePreview file={form.medicalReportFile} />
        </div>
      </div>
    );
  }

  function renderScholarshipToggle() {
    if (isPreviewMode) return null;

    return (
      <div className="rounded-[1.1rem] border border-[#2D8A6A]/10 bg-[#FAF7F0] p-4">
        <label className="flex items-start gap-3 text-sm text-[#063F32]">
          <input
            type="checkbox"
            checked={Boolean(form.needBasedScholarshipRequested)}
            onChange={(event) => updateField("needBasedScholarshipRequested", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#2D8A6A]/30 text-[#0D5C48] focus:ring-[#C9A227]"
          />
          <span>
            <span className="block font-semibold">Do you want to avail need based scholarship?</span>
            <span className="mt-1 block text-[#245C4F]">
              Need base scholarship is for Zakat, Khairat and Atiyah.
            </span>
          </span>
        </label>
      </div>
    );
  }

  function renderFeeDetailsCard({ mode = "live", scholarship = false } = {}) {
    const monthlyFee = previewRegularFeeAmount;
    const admissionFee = mode === "preview" ? previewAdmissionFeeAmount : liveAdmissionFeeAmount;
    const discountPercent = scholarship ? 0 : mode === "preview" ? previewDiscountPercent : liveDiscountPercent;
    const discountAmount = scholarship ? 0 : Math.round((monthlyFee * discountPercent) / 100);
    const totalAmount = scholarship
      ? Math.max(monthlyFee + admissionFee, 0)
      : Math.max(monthlyFee - discountAmount + admissionFee, 0);
    const nextMonthlyFee = Math.max(monthlyFee - discountAmount, 0);
    const hasDiscount = discountPercent > 0 && discountAmount > 0;

    return (
      <section className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFAF5_100%)] p-5 shadow-[0_18px_45px_rgba(13,59,46,0.08)] sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F1EADC] text-[#0D5C48] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold uppercase text-[#063F32] sm:text-2xl">
              Payment Details
            </h3>
            <p className="mt-2 text-xs leading-5 text-[#245C4F] sm:text-sm">
              Please review your fee breakdown before uploading your payment proof.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[1.25rem] border border-[#E4D9BE] bg-[#FCFAF5] p-4 sm:p-5">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#0D5C48]">
            Fee Breakdown
          </p>

          <div className="mt-5 divide-y divide-[#E4D9BE]">
            <div className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F1EADC] text-[#0D5C48]">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-[#063F32] sm:text-lg">Monthly Fee</p>
              </div>
              <p className="shrink-0 text-right text-base font-bold text-[#063F32] sm:text-lg">
                PKR {monthlyFee.toLocaleString("en-PK")}
              </p>
            </div>

            {hasDiscount ? (
              <div className="flex items-center gap-4 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F1EADC] text-[#0D5C48]">
                  <BadgePercent className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-[#063F32] sm:text-lg">Discount</p>
                  <p className="mt-1 text-sm text-[#245C4F]">{discountPercent}% monthly fee discount</p>
                </div>
                <p className="shrink-0 text-right text-base font-bold text-[#063F32] sm:text-lg">
                  - PKR {discountAmount.toLocaleString("en-PK")}
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F1EADC] text-[#0D5C48]">
                <School className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-[#063F32] sm:text-lg">Admission Fee</p>
                <p className="mt-1 text-sm text-[#245C4F]">One-time fee only</p>
              </div>
              <p className="shrink-0 text-right text-base font-bold text-[#063F32] sm:text-lg">
                PKR {admissionFee.toLocaleString("en-PK")}
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-dashed border-[#D8CBAA]" />

          <div className="rounded-[1.25rem] border border-[#E4D9BE] bg-white p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#063F32,#0D5C48)] text-[#FAF7F0] shadow-[0_12px_30px_rgba(13,59,46,0.22)]">
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0D5C48] sm:text-xs">Total Amount</p>
                  <p className="mt-1 text-xl font-bold leading-tight text-[#063F32] sm:text-xl">
                    PKR {totalAmount.toLocaleString("en-PK")}
                  </p>
                </div>
              </div>

              <div className={`hidden items-start gap-1.5 text-center text-[#063F32] sm:grid ${
                hasDiscount
                  ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
                  : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
              }`}>
                  <FormulaBox value={monthlyFee} label="Monthly Fee" />
                  {hasDiscount ? <FormulaOperator value="-" /> : <FormulaOperator value="+" />}
                  {hasDiscount ? (
                    <FormulaBox value={discountAmount} label={`Discount (${discountPercent}%)`} />
                  ) : (
                    <FormulaBox value={admissionFee} label="Admission Fee" />
                  )}
                  {hasDiscount ? <FormulaOperator value="+" /> : <FormulaOperator value="=" />}
                  {hasDiscount ? (
                    <FormulaBox value={admissionFee} label="Admission Fee" />
                  ) : (
                    <FormulaTotal value={totalAmount} />
                  )}
                  {hasDiscount ? <FormulaOperator value="=" /> : null}
                  {hasDiscount ? <FormulaTotal value={totalAmount} /> : null}
              </div>

              <div className="grid gap-2 sm:hidden">
                <FormulaBoxSmall value={monthlyFee} label="Monthly Fee" />
                {hasDiscount ? <FormulaOperator value="-" /> : <FormulaOperator value="+" />}
                {hasDiscount ? (
                  <FormulaBoxSmall value={discountAmount} label={`Discount (${discountPercent}%)`} />
                ) : (
                  <FormulaBoxSmall value={admissionFee} label="Admission Fee" />
                )}
                {hasDiscount ? <FormulaOperator value="+" /> : <FormulaOperator value="=" />}
                {hasDiscount ? (
                  <FormulaBoxSmall value={admissionFee} label="Admission Fee" />
                ) : (
                  <FormulaTotalSmall value={totalAmount} />
                )}
                {hasDiscount ? <FormulaOperator value="=" /> : null}
                {hasDiscount ? <FormulaTotalSmall value={totalAmount} /> : null}
              </div>
            </div>
          </div>

          {hasDiscount ? (
            <div className="mt-3 flex items-start gap-3 rounded-[1rem] border border-[#E4D9BE] bg-[#FFF5D6]/65 px-4 py-3 text-sm text-[#063F32]">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#0D5C48]" />
              <p>From next month onward, the monthly fee will be PKR {nextMonthlyFee.toLocaleString("en-PK")}/month.</p>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderPaymentStep() {
    if (!isPreviewMode && form.needBasedScholarshipRequested) {
      return (
        <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:p-6">
          {renderFeeDetailsCard({ mode: "live", scholarship: true })}

          <div className="rounded-[1.1rem] border border-[rgba(201,162,39,0.22)] bg-[#FFF5D6]/70 p-4">
            <label className="flex items-start gap-3 text-sm text-[#063F32]">
              <input
                type="checkbox"
                checked={Boolean(form.needBasedScholarshipRequested)}
                onChange={(event) => updateField("needBasedScholarshipRequested", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#2D8A6A]/30 text-[#0D5C48] focus:ring-[#C9A227]"
              />
              <span>
                <span className="block font-semibold">Do you want to avail need based scholarship?</span>
                <span className="mt-1 block text-[#245C4F]">
                  Need base scholarship is for Zakat, Khairat and Atiyah.
                </span>
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="scholarshipRequestedAmount">Requested scholarship amount</label>
              <input id="scholarshipRequestedAmount" type="number" min="0" step="0.01" value={controlledValue(form.scholarshipRequestedAmount)} onChange={(event) => updateField("scholarshipRequestedAmount", event.target.value)} className={inputClass(errors.scholarshipRequestedAmount)} placeholder="10000" />
              <FieldError error={errors.scholarshipRequestedAmount} />
            </div>
            <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="scholarshipDependentsCount">Number of dependents</label>
              <input id="scholarshipDependentsCount" type="number" min="0" step="1" value={controlledValue(form.scholarshipDependentsCount)} onChange={(event) => updateField("scholarshipDependentsCount", event.target.value)} className={inputClass(errors.scholarshipDependentsCount)} placeholder="4" />
              <FieldError error={errors.scholarshipDependentsCount} />
            </div>
            <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="scholarshipSchoolGoingChildrenCount">School-going children</label>
              <input id="scholarshipSchoolGoingChildrenCount" type="number" min="0" step="1" value={controlledValue(form.scholarshipSchoolGoingChildrenCount)} onChange={(event) => updateField("scholarshipSchoolGoingChildrenCount", event.target.value)} className={inputClass(errors.scholarshipSchoolGoingChildrenCount)} placeholder="2" />
              <FieldError error={errors.scholarshipSchoolGoingChildrenCount} />
            </div>
            <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="scholarshipResidenceType">Residence type</label>
              <SelectField id="scholarshipResidenceType" value={controlledValue(form.scholarshipResidenceType)} onChange={(event) => updateField("scholarshipResidenceType", event.target.value)} error={errors.scholarshipResidenceType} className={inputClass(errors.scholarshipResidenceType)}>
                <option value="">Select residence type</option>
                {RESIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </SelectField>
            </div>
            <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4 md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="scholarshipReason">Reason for scholarship</label>
              <textarea
                id="scholarshipReason"
                rows={4}
                value={controlledValue(form.scholarshipReason)}
                onChange={(event) => updateField("scholarshipReason", event.target.value)}
                className={inputClass(errors.scholarshipReason)}
                placeholder="Please share why you need this scholarship"
              />
              <FieldError error={errors.scholarshipReason} />
            </div>
          </div>
        </div>
      );
    }

    if (!isPreviewMode) {
      return (
        <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:p-6">
          <div className="grid gap-4 rounded-[1.1rem] border border-[rgba(201,162,39,0.22)] bg-[#FFF5D6]/70 p-4">
            <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Payment methods</p>
              <div className="mt-3 space-y-2">
                {paymentOptions.paymentMethods.length ? paymentOptions.paymentMethods.map((method) => (
                  <div key={method.id || method.name} className="rounded-xl border border-[#2D8A6A]/10 bg-[#FAF7F0] px-3 py-2 text-sm text-[#063F32]">
                    <p className="font-semibold">{method.name || "Payment method"}</p>
                    <div className="mt-2 grid gap-1 text-xs text-[#245C4F]">
                      {method.bank_name ? <p><span className="font-semibold text-[#063F32]">Bank:</span> {method.bank_name}</p> : null}
                      {method.account_title ? <p><span className="font-semibold text-[#063F32]">Account title:</span> {method.account_title}</p> : null}
                      {method.account_number ? <p><span className="font-semibold text-[#063F32]">Account number:</span> {method.account_number}</p> : null}
                      {method.iban ? <p><span className="font-semibold text-[#063F32]">IBAN:</span> {method.iban}</p> : null}
                      {method.branch_code ? <p><span className="font-semibold text-[#063F32]">Branch code:</span> {method.branch_code}</p> : null}
                      {method.instructions ? <p><span className="font-semibold text-[#063F32]">Instructions:</span> {method.instructions}</p> : null}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-[#245C4F]">No payment methods available.</p>
                )}
              </div>
            </div>

            {renderFeeDetailsCard({ mode: "live", scholarship: false })}

            <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-[#FAF7F0] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Payment instructions</p>
              <p className="mt-2 whitespace-pre-line text-sm text-[#245C4F]">
                {livePaymentInstructions || "No payment instructions added yet."}
              </p>
            </div>

          <div className="rounded-[1.1rem] border border-[rgba(201,162,39,0.22)] bg-[#FAF7F0] p-4">
            <label className="flex items-start gap-3 text-sm text-[#063F32]">
              <input
                type="checkbox"
                checked={Boolean(form.needBasedScholarshipRequested)}
                onChange={(event) => updateField("needBasedScholarshipRequested", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#2D8A6A]/30 text-[#0D5C48] focus:ring-[#C9A227]"
              />
              <span>
                <span className="block font-semibold">Do you want to avail need based scholarship?</span>
                <span className="mt-1 block text-[#245C4F]">
                  Need base scholarship is for Zakat, Khairat and Atiyah.
                </span>
              </span>
            </label>
          </div>

            <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="payerName">
                Payer name
              </label>
              <input
                id="payerName"
                type="text"
                value={controlledValue(form.payerName)}
                onChange={(event) => updateField("payerName", event.target.value)}
                className={inputClass(errors.payerName)}
                placeholder="Enter payer name"
              />
              <FieldError error={errors.payerName} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="payerEmail">
                  Payer email
                </label>
                <input
                  id="payerEmail"
                  type="email"
                  value={controlledValue(form.payerEmail)}
                  onChange={(event) => updateField("payerEmail", event.target.value)}
                  className={inputClass(errors.payerEmail)}
                  placeholder="payer@example.com"
                />
                <FieldError error={errors.payerEmail} />
              </div>

              <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="payerPhone">
                  Payer phone
                </label>
                <input
                  id="payerPhone"
                  type="tel"
                  value={controlledValue(form.payerPhone)}
                  onChange={(event) => updateField("payerPhone", event.target.value)}
                  className={inputClass(errors.payerPhone)}
                  placeholder="03xx-xxxxxxx"
                />
                <FieldError error={errors.payerPhone} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="transactionId">
                  Transaction ID
                </label>
                <input
                  id="transactionId"
                  type="text"
                  value={controlledValue(form.transactionId)}
                  onChange={(event) => updateField("transactionId", event.target.value)}
                  className={inputClass(errors.transactionId)}
                  placeholder="Bank reference or wallet transaction ID"
                />
                <FieldError error={errors.transactionId} />
              </div>

              <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="paidAmount">
                  Paid amount
                </label>
                <input
                  id="paidAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={controlledValue(form.paidAmount)}
                  onChange={(event) => updateField("paidAmount", event.target.value)}
                  className={inputClass(errors.paidAmount)}
                  placeholder="5000"
                />
                <FieldError error={errors.paidAmount} />
              </div>
            </div>

            <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="paidAt">
                Paid at
              </label>
              <input
                id="paidAt"
                type="datetime-local"
                value={controlledValue(form.paidAt)}
                onChange={(event) => updateField("paidAt", event.target.value)}
                className={inputClass(errors.paidAt)}
              />
              <FieldError error={errors.paidAt} />
            </div>

            <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="paymentProofFile">
                Payment proof file
              </label>
              <input
                id="paymentProofFile"
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => void handleFileSelection("paymentProofFile", event.target.files?.[0] || null)}
                className={inputClass(errors.paymentProofFile)}
              />
              <FieldError error={errors.paymentProofFile} />
              <FilePreview file={form.paymentProofFile} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:p-6">
        <div className="grid gap-4 sm:col-span-2">
          <div className="grid gap-4 rounded-[1.1rem] border border-[rgba(201,162,39,0.22)] bg-[#FFF5D6]/70 p-4">
            <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Payment methods</p>
              <div className="mt-3 space-y-2">
                {paymentOptions.paymentMethods.length ? paymentOptions.paymentMethods.map((method) => (
                  <div key={method.id || method.name} className="rounded-xl border border-[#2D8A6A]/10 bg-[#FAF7F0] px-3 py-2 text-sm text-[#063F32]">
                    <p className="font-semibold">{method.name || "Payment method"}</p>
                    <div className="mt-2 grid gap-1 text-xs text-[#245C4F]">
                      {method.bank_name ? <p><span className="font-semibold text-[#063F32]">Bank:</span> {method.bank_name}</p> : null}
                      {method.account_title ? <p><span className="font-semibold text-[#063F32]">Account title:</span> {method.account_title}</p> : null}
                      {method.account_number ? <p><span className="font-semibold text-[#063F32]">Account number:</span> {method.account_number}</p> : null}
                      {method.iban ? <p><span className="font-semibold text-[#063F32]">IBAN:</span> {method.iban}</p> : null}
                      {method.branch_code ? <p><span className="font-semibold text-[#063F32]">Branch code:</span> {method.branch_code}</p> : null}
                      {method.instructions ? <p><span className="font-semibold text-[#063F32]">Instructions:</span> {method.instructions}</p> : null}
                      {!method.bank_name && !method.account_title && !method.account_number && !method.iban && !method.branch_code && !method.instructions ? (
                        <p>Available payment option</p>
                      ) : null}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-[#245C4F]">No payment methods available.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="previewAdmissionFee">
                  Admission fee
                </label>
                <SelectField
                  id="previewAdmissionFee"
                  value={controlledValue(form.admissionFee)}
                  onChange={(event) => updateField("admissionFee", event.target.value)}
                  error={errors.admissionFee}
                  className={`${inputClass(errors.admissionFee)} text-xs`}
                >
                  <option value="">No admission fee selected</option>
                  {previewAdmissionFeeOptions.length ? previewAdmissionFeeOptions.map((item) => (
                    <option key={item.id || `${item.class_level}-${item.amount}`} value={String(item.amount || "")}>
                      {item.title || item.name || "Admission fee"} - PKR {Number(item.amount || 0).toLocaleString("en-PK")}
                    </option>
                  )) : null}
                </SelectField>
                <p className="mt-2 text-sm text-[#245C4F]">Choose an admission-fee item from fee management.</p>
              </div>

              {!form.needBasedScholarshipRequested ? <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="previewDiscountPercent">
                  Discount
                </label>
                <SelectField
                  id="previewDiscountPercent"
                  value={controlledValue(form.discountPercent)}
                  onChange={(event) => updateField("discountPercent", event.target.value)}
                  error={errors.discountPercent}
                  className={`${inputClass(errors.discountPercent)} text-xs`}
                >
                  <option value="">No discount selected</option>
                  {paymentOptions.discounts
                    .filter((option) => Number(option.percent || 0) <= Number(paymentOptions.coordinatorMaxDiscountPercent || 20))
                    .map((option) => (
                      <option key={option.id || option.label} value={String(option.percent || "")}>
                        {option.label || `${Number(option.percent || 0)}%`}
                      </option>
                    ))}
                </SelectField>
                <p className="mt-2 text-sm text-[#245C4F]">Allowed discounts are limited to coordinator-approved values up to 20%.</p>
              </div> : null}
            </div>

            <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="paymentInstructions">
                Payment instructions
              </label>
              <textarea
                id="paymentInstructions"
                rows={4}
                value={controlledValue(form.paymentInstructions)}
                onChange={(event) => updateField("paymentInstructions", event.target.value)}
                className={inputClass(errors.paymentInstructions)}
                placeholder="Add payment instructions for this admission"
              />
              <FieldError error={errors.paymentInstructions} />
            </div>

          </div>

          <div className="rounded-[1.1rem] border border-[rgba(201,162,39,0.22)] bg-[#FFF5D6]/70 p-4">
            <label className="flex items-start gap-3 text-sm text-[#063F32]">
              <input
                type="checkbox"
                checked={Boolean(form.needBasedScholarshipRequested)}
                onChange={(event) => updateField("needBasedScholarshipRequested", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#2D8A6A]/30 text-[#0D5C48] focus:ring-[#C9A227]"
              />
              <span>
                <span className="block font-semibold">Do you want to avail need based scholarship?</span>
                <span className="mt-1 block text-[#245C4F]">
                  Need base scholarship is for Zakat, Khairat and Atiyah.
                </span>
              </span>
            </label>
          </div>

          {renderFeeDetailsCard({ mode: "preview", scholarship: form.needBasedScholarshipRequested })}
        </div>
      </div>
    );
  }

  function renderDeclarationStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:p-6">
        <div className="rounded-[1.5rem] border border-[rgba(201,162,39,0.22)] bg-[#FFF5D6]/80 p-5 text-sm leading-7 text-[#245C4F] shadow-[0_10px_22px_rgba(201,162,39,0.08)]">
          <p className="font-display font-semibold text-[#063F32]">Declaration & Parent Commitment</p>
          <p className="mt-3">I/We declare that all information provided in this application is true and correct to the best of our knowledge.</p>
          <p className="mt-3">I/We understand that Ash-Shajarah follows a Parent Partnership and Guided Home Learning Model where active parental involvement is essential for meaningful learning outcomes.</p>
          <p className="mt-3">I/We understand that live online interaction will be age-appropriate and limited, and that parents are expected to support guided off-screen activities, orientation sessions, parenting workshops, academic training programmes, school schedules, assessment procedures, and healthy device practices.</p>
        </div>
        <label className="flex items-start gap-3 rounded-2xl border border-[rgba(13,59,46,0.12)] bg-[#FCFAF5] px-4 py-4 text-sm text-[#245C4F] shadow-[0_8px_20px_rgba(13,59,46,0.04)]">
          <input type="checkbox" checked={form.declarationAccepted} onChange={(event) => updateField("declarationAccepted", event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2D8A6A] focus:ring-[#2D8A6A]" />
          <span>I/We accept the declaration and commit to working collaboratively with Ash-Shajarah as active partners in our child&apos;s learning, character development, and overall growth.</span>
        </label>
        <FieldError error={errors.declarationAccepted} />
      </div>
    );
  }

  const stepContent = isPreviewMode
    ? [
        renderProgrammeStep(),
        renderStudentStep(),
        renderProfileStep(),
        renderParentsStep(),
        renderReadinessStep(),
        renderDeclarationStep(),
      ]
    : [
        renderProgrammeStep(),
        renderStudentStep(),
        renderProfileStep(),
        renderParentsStep(),
        renderReadinessStep(),
        renderDeclarationStep(),
      ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FAF7F0] text-[#063F32]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,138,106,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(201,162,39,0.12),_transparent_30%),radial-gradient(circle_at_center,_rgba(101,184,145,0.08),_transparent_42%)]" />
      <div className="absolute left-[-6rem] top-24 h-56 w-56 rounded-full bg-[#2D8A6A]/10 blur-3xl" />
      <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-[#C9A227]/10 blur-3xl" />

      {leadTokenParam && leadTokenError && !tokenLoading ? (
        <div className="relative mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 py-8 sm:px-6">
          <section className="w-full rounded-[2.2rem] border border-[rgba(13,59,46,0.12)] bg-[linear-gradient(180deg,_rgba(252,250,245,0.98)_0%,_rgba(247,241,231,0.96)_100%)] p-6 text-center shadow-[0_24px_60px_rgba(13,59,46,0.12)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="mx-auto max-w-2xl rounded-[1.6rem] bg-[linear-gradient(135deg,_#063F32_0%,_#0D5C48_45%,_#236B51_100%)] p-6 text-[#FAF7F0] shadow-[0_14px_32px_rgba(6,63,50,0.2)]">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F7EFCF]">
                Admission form
              </span>
              <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                This admission form has already been submitted
              </h1>
              <p className="mt-4 text-base leading-7 text-[#F3EEDB]/85 sm:text-[1.02rem]">
                This link has already been used to submit the admission form, or it is no longer active.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-2xl rounded-[1.5rem] border border-[rgba(201,162,39,0.22)] bg-[#FFF5D6]/80 p-5 text-left text-sm leading-7 text-[#245C4F] shadow-[0_10px_22px_rgba(201,162,39,0.08)]">
              <p className="font-display text-lg font-semibold text-[#063F32]">
                What this means
              </p>
              <p className="mt-3">
                Your admission form has most likely already been submitted successfully. For security and to avoid duplicate admissions, the same form link cannot be used again.
              </p>
              <p className="mt-3">
                If you believe this happened by mistake, please contact Ash-Shajrah admissions support and request a fresh link.
              </p>
            </div>

            <div className="mt-8">
              <p className="text-sm font-medium text-rose-700">{leadTokenError}</p>
            </div>
          </section>
        </div>
      ) : (
      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-2 py-2">
        <motion.div className="grid w-full items-stretch gap-8 lg:grid-cols-[0.8fr_1.2fr]" variants={container} initial="hidden" animate="show">
          <motion.section variants={item} className="flex w-full flex-col justify-start rounded-[2.2rem] border border-[rgba(13,59,46,0.12)] bg-[linear-gradient(180deg,_rgba(252,250,245,0.98)_0%,_rgba(245,240,232,0.96)_100%)] p-6 shadow-[0_24px_60px_rgba(13,59,46,0.12)] backdrop-blur-xl sm:p-7 lg:p-8">
            <div className="rounded-[1.6rem] bg-[linear-gradient(135deg,_#063F32_0%,_#0D5C48_45%,_#236B51_100%)] p-6 text-[#FAF7F0] shadow-[0_14px_32px_rgba(6,63,50,0.2)]">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F7EFCF]">
                Admission form
              </span>
              <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Apply for your child&apos;s admission to Ash-Shajarah Learning Hub.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-[#F3EEDB]/85 sm:text-[1.02rem]">
                Complete the admission form step by step. Our admissions team will review the application and guide you through the next stage.
              </p>
            </div>

            <div className="mt-7 grid gap-3 rounded-[1.6rem] border border-[rgba(13,59,46,0.08)] bg-white/70 p-3 shadow-[0_10px_24px_rgba(13,59,46,0.04)]">
              {STEP_TITLES.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={isPreviewMode ? () => setStep(index) : undefined}
                  disabled={!isPreviewMode}
                  className={`flex w-full items-center gap-3 rounded-[1.15rem] border px-3 py-3 text-left text-sm shadow-[0_8px_20px_rgba(13,59,46,0.04)] transition ${isPreviewMode ? "hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(13,59,46,0.08)]" : "cursor-default"} ${index === step ? "cursor-default border-[#C9A227]/30 bg-[#FFF5D6]/80 text-[#063F32]" : index < step ? "border-[#2D8A6A]/20 bg-[#F4F0E7] text-[#063F32]" : "border-[rgba(13,59,46,0.10)] bg-white/90 text-[#245C4F]"}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${index === step ? "bg-gradient-to-br from-[#C9A227] to-[#E4C766] text-[#063F32]" : index < step ? "bg-[#2D8A6A] text-[#FAF7F0]" : "bg-[#FAF7F0] text-[#245C4F]"}`}>
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-xs uppercase tracking-[0.18em] opacity-75">
                      {index === step ? "Current step" : index < step ? "Completed" : "Pending"}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-7 rounded-[1.5rem] border border-[rgba(13,59,46,0.08)] bg-[linear-gradient(135deg,_#063F32_0%,_#0D5C48_45%,_#236B51_100%)] p-6 text-[#FAF7F0] px-5 py-5 shadow-[0_10px_24px_rgba(13,59,46,0.04)]">
              <p className="text-sm uppercase tracking-[0.24em] text-white">Healthy digital learning</p>
              <p className="mt-3 max-w-md text-sm leading-6">
                Ash-Shajarah follows a parent partnership model with age-appropriate online sessions, guided home activities, and a strong focus on healthy device use.
              </p>
            </div>
          </motion.section>

          <motion.section variants={item} className="rounded-[2.2rem] border border-[rgba(13,59,46,0.12)] bg-[linear-gradient(180deg,_#FCFAF5_0%,_#F7F1E7_100%)] p-6 shadow-[0_24px_60px_rgba(13,59,46,0.1)] sm:p-8 lg:p-10">
            <div className="mb-8 rounded-[1.4rem] border border-[rgba(13,59,46,0.08)] bg-white/90 p-5 shadow-[0_10px_24px_rgba(13,59,46,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Online school admission form</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[#063F32]">Step {step + 1}: {STEP_TITLES[step]}</h2>
              <p className="mt-2 text-sm leading-6 text-[#245C4F]/80">Please complete this section carefully. Fields required by the admissions team should not be left blank.</p>
            </div>

            {errors.form ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.form}</div> : null}
            {successMessage ? <div className="mb-5 rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#0D5C48]">{successMessage}</div> : null}

            <form className="grid gap-6" onSubmit={handleSubmit}>
              {stepContent[step]}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(13,59,46,0.08)] pt-6">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 0 || pending}
                  className="rounded-full border border-[rgba(13,59,46,0.12)] bg-white px-4 py-3 text-sm font-semibold text-[#0D5C48] shadow-[0_8px_20px_rgba(13,59,46,0.04)] transition hover:bg-[#FAF7F0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Back
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[#FAF7F0] px-3 py-2 text-sm text-[#245C4F]">
                  {tokenLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0D5C48]/20 border-t-[#0D5C48]" />
                      Loading lead details...
                    </span>
                  ) : (
                    `Step ${step + 1} of ${STEP_TITLES.length}`
                  )}
                </span>
                  {step < STEP_TITLES.length - 1 ? (
                    <button
                      type="button"
                      onClick={goNext}
                  disabled={pending || tokenLoading || Boolean(leadTokenError)}
                      className="rounded-full bg-[#236B51] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_12px_28px_rgba(45,138,106,0.25)] transition hover:bg-[#184A38] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Next step
                    </button>
                  ) : (
                    <motion.button
                      type="submit"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      disabled={pending || tokenLoading || isPreviewMode}
                      className="rounded-full bg-[#236B51] px-5 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_12px_28px_rgba(45,138,106,0.25)] transition hover:bg-[#184A38] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isPreviewMode ? "Preview only" : pending ? "Submitting..." : tokenLoading ? "Loading prefill..." : leadTokenError ? "Link invalid" : "Submit admission form"}
                    </motion.button>
                  )}
                </div>
              </div>
            </form>
          </motion.section>
        </motion.div>
      </div>
      )}
    </main>
  );
}

export default function AdmissionFormPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#FAF7F0]" />}>
      <AdmissionFormContent />
    </Suspense>
  );
}
