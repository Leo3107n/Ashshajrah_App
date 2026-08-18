"use client";

import InterestedStudentsPageShell from "@/components/coordinator/InterestedStudentsPageShell";

export default function AdminInterestedStudentsPage() {
  return (
    <InterestedStudentsPageShell
      portalLabel="Admin portal"
      title="Interested students records"
      description="Review interested student submissions and the current admission pipeline from the admin portal."
      showDetailsButton={true}
      showActionsColumn={false}
      allowSendFormAction={false}
      allowParentFormSentColumn={false}
      allowDetailsAction={true}
      hideDeleteAction={true}
      readOnlyMode={false}
      showTableControls={true}
    />
  );
}
