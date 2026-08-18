"use client";

import InterestedStudentsPageShell from "@/components/coordinator/InterestedStudentsPageShell";

export default function CoordinatorInterestedStudentsPage() {
  return (
    <InterestedStudentsPageShell
      portalLabel="Coordinator portal"
      title="New interested records of students"
      description="Review interested student submissions and generate registration links."
      showDetailsButton={true}
      showActionsColumn={true}
      allowSendFormAction={true}
      allowParentFormSentColumn={true}
      showTableControls={true}
    />
  );
}
