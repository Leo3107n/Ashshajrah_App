"use client";

import NoteThreadsBoard from "@/components/shared/NoteThreadsBoard";

export default function TeacherNotesPanel({ lectures = [], portalTargetId }) {
  return <NoteThreadsBoard mode="teacher" lectures={lectures} portalTargetId={portalTargetId} title="Teacher notes" subtitle="Student observations" />;
}
