import { NextResponse } from "next/server";
import { uploadAdmissionDocument, uploadPaymentProof } from "@/lib/supabaseStorage";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const documentType = normalizeText(formData.get("documentType"));
    const applicationId = normalizeText(formData.get("applicationId"));
    const voucherNo = normalizeText(formData.get("voucherNo"));

    if (!(file instanceof File) || file.size <= 0) {
      return json("File is required.", 400);
    }

    if (!documentType) {
      return json("Document type is required.", 400);
    }

    let upload;
    if (documentType === "payment_proof") {
      upload = await uploadPaymentProof({
        voucherNo: voucherNo || applicationId || "admission-payment",
        file,
      });
    } else {
      upload = await uploadAdmissionDocument({
        applicationId: applicationId || voucherNo || "admission-application",
        documentType,
        file,
      });
    }

    return json("File uploaded.", 200, {
      bucket: upload.bucket,
      objectPath: upload.objectPath,
      storedPath: upload.storedPath,
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to upload file.",
      500
    );
  }
}
