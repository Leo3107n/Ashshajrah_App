-- Owner-only teacher notes are not addressed to a student or parent.
-- Shared notes continue to store one student_id per intended recipient.
ALTER TABLE teacher_notes
  ALTER COLUMN student_id DROP NOT NULL;
