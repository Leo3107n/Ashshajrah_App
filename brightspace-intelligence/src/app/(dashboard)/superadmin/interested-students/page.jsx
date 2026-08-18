"use client";

import InterestedStudentsPageShell from "@/components/coordinator/InterestedStudentsPageShell";

export default function SuperAdminInterestedStudentsPage() {
  return (
    <InterestedStudentsPageShell
      portalLabel="Super Admin portal"
      title="New interested records of students"
      description="Review interested student submissions and generate registration links."
      showActionsColumn={true}
      hideDeleteAction={true}
      showTableControls={true}
    />
  );
}
