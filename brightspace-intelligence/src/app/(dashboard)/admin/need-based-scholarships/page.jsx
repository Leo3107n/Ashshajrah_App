"use client";

import { NeedBasedScholarshipsPage } from "@/app/(dashboard)/coordinator/need-based-scholarships/page";

export default function AdminNeedBasedScholarshipsPage() {
  return (
    <NeedBasedScholarshipsPage
      portalLabel="Admin portal"
      title="Need based scholarship records"
      description="Review Step 6 scholarship applications from the admin portal in a read-only view."
      allowCreateVoucher={false}
    />
  );
}
