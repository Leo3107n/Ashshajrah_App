-- Completes the historical introspected schema for the routes currently in src/.
-- Every operation is idempotent so development databases can be repaired safely.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TYPE homework_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE homework_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE lecture_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE verification_decision ADD VALUE IF NOT EXISTS 'disputed';
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'registered';
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'verified';

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS meta JSONB;

ALTER TABLE registration_leads
  ADD COLUMN IF NOT EXISTS parent_relation TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS city_country TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS religion TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS interest_reason TEXT,
  ADD COLUMN IF NOT EXISTS program_name TEXT,
  ADD COLUMN IF NOT EXISTS preferred_starting_month TEXT,
  ADD COLUMN IF NOT EXISTS preferred_schedule TEXT,
  ADD COLUMN IF NOT EXISTS child_profile TEXT,
  ADD COLUMN IF NOT EXISTS child_strengths TEXT,
  ADD COLUMN IF NOT EXISTS child_support_needs TEXT,
  ADD COLUMN IF NOT EXISTS child_special_interests TEXT,
  ADD COLUMN IF NOT EXISTS developmental_concern TEXT,
  ADD COLUMN IF NOT EXISTS developmental_concern_details TEXT,
  ADD COLUMN IF NOT EXISTS medical_conditions TEXT,
  ADD COLUMN IF NOT EXISTS father_name_english TEXT,
  ADD COLUMN IF NOT EXISTS father_cnic TEXT,
  ADD COLUMN IF NOT EXISTS father_qualification TEXT,
  ADD COLUMN IF NOT EXISTS father_occupation TEXT,
  ADD COLUMN IF NOT EXISTS father_mother_tongue TEXT,
  ADD COLUMN IF NOT EXISTS father_contact_home TEXT,
  ADD COLUMN IF NOT EXISTS father_contact_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS father_emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS father_email TEXT,
  ADD COLUMN IF NOT EXISTS father_residential_address TEXT,
  ADD COLUMN IF NOT EXISTS mother_name_english TEXT,
  ADD COLUMN IF NOT EXISTS mother_cnic TEXT,
  ADD COLUMN IF NOT EXISTS mother_qualification TEXT,
  ADD COLUMN IF NOT EXISTS mother_occupation TEXT,
  ADD COLUMN IF NOT EXISTS mother_mother_tongue TEXT,
  ADD COLUMN IF NOT EXISTS mother_contact_home TEXT,
  ADD COLUMN IF NOT EXISTS mother_contact_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS mother_emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS mother_email TEXT,
  ADD COLUMN IF NOT EXISTS mother_residential_address TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact_person TEXT,
  ADD COLUMN IF NOT EXISTS support_person_during_learning TEXT,
  ADD COLUMN IF NOT EXISTS device_available TEXT,
  ADD COLUMN IF NOT EXISTS declaration_accepted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS birth_certificate_file_path TEXT,
  ADD COLUMN IF NOT EXISTS birth_certificate_file_url TEXT,
  ADD COLUMN IF NOT EXISTS parent_cnic_file_path TEXT,
  ADD COLUMN IF NOT EXISTS parent_cnic_file_url TEXT,
  ADD COLUMN IF NOT EXISTS child_photograph_file_path TEXT,
  ADD COLUMN IF NOT EXISTS child_photograph_file_url TEXT,
  ADD COLUMN IF NOT EXISTS medical_report_file_path TEXT,
  ADD COLUMN IF NOT EXISTS medical_report_file_url TEXT,
  ADD COLUMN IF NOT EXISTS admission_form_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admission_form_due_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admission_form_status TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS admission_fee_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

ALTER TABLE interested_students
  ADD COLUMN IF NOT EXISTS class_level TEXT,
  ADD COLUMN IF NOT EXISTS child_name TEXT,
  ADD COLUMN IF NOT EXISTS child_age TEXT,
  ADD COLUMN IF NOT EXISTS child_dob DATE,
  ADD COLUMN IF NOT EXISTS parent_email TEXT,
  ADD COLUMN IF NOT EXISTS parent_phone TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS why_interested TEXT,
  ADD COLUMN IF NOT EXISTS registration_code TEXT,
  ADD COLUMN IF NOT EXISTS admission_form_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admission_form_due_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admission_form_status TEXT,
  ADD COLUMN IF NOT EXISTS admission_form_submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admission_form_last_channel TEXT,
  ADD COLUMN IF NOT EXISTS admission_form_last_error TEXT,
  ADD COLUMN IF NOT EXISTS admission_form_last_reminder_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admission_form_reminder_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_form_sent_status TEXT,
  ADD COLUMN IF NOT EXISTS parent_interview_link TEXT,
  ADD COLUMN IF NOT EXISTS parent_interview_link_sent_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS interested_students_registration_code_unique
  ON interested_students (registration_code)
  WHERE registration_code IS NOT NULL;

ALTER TABLE fee_vouchers
  ADD COLUMN IF NOT EXISTS payment_method_options JSONB,
  ADD COLUMN IF NOT EXISTS scholarship_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE fee_submissions
  ADD COLUMN IF NOT EXISTS payer_email TEXT,
  ADD COLUMN IF NOT EXISTS payer_phone TEXT;

ALTER TABLE homework
  ADD COLUMN IF NOT EXISTS submission_note TEXT,
  ADD COLUMN IF NOT EXISTS submission_attachment_bucket TEXT,
  ADD COLUMN IF NOT EXISTS submission_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS submission_attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

ALTER TABLE lecture_schedules
  ADD COLUMN IF NOT EXISTS calendar_html_link TEXT,
  ADD COLUMN IF NOT EXISTS google_last_error TEXT,
  ADD COLUMN IF NOT EXISTS google_meet_sync_meta JSONB,
  ADD COLUMN IF NOT EXISTS pending_student_attendance JSONB;

ALTER TABLE lecture_attendance
  ADD COLUMN IF NOT EXISTS participant_email TEXT,
  ADD COLUMN IF NOT EXISTS participant_name TEXT,
  ADD COLUMN IF NOT EXISTS google_participant_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS google_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS meet_raw JSONB;

CREATE TABLE IF NOT EXISTS headlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT headlines_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_headlines_dates ON headlines (start_date, end_date);

CREATE TABLE IF NOT EXISTS internal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  host_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  attendee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMP NOT NULL,
  scheduled_end TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  google_calendar_event_id TEXT,
  google_meet_link TEXT,
  google_meet_space_id TEXT,
  calendar_html_link TEXT,
  recording_drive_url TEXT,
  recording_synced_at TIMESTAMP,
  google_last_error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_events_start ON internal_events (scheduled_start);

CREATE TABLE IF NOT EXISTS note_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_level TEXT,
  visibility TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT note_threads_visibility CHECK (visibility IN ('student', 'parent'))
);

CREATE UNIQUE INDEX IF NOT EXISTS note_threads_scope_unique
  ON note_threads (teacher_id, course_id, subject_id, visibility);

CREATE TABLE IF NOT EXISTS note_thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES note_threads(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  reply_to_message_id UUID REFERENCES note_thread_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_messages_thread_created
  ON note_thread_messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS career_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  interested_role TEXT,
  message TEXT,
  resume_file_name TEXT,
  resume_mime_type TEXT,
  resume_size_bytes BIGINT,
  resume_file_data BYTEA,
  source TEXT DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'submitted',
  admin_notes TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parent_interview_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id TEXT,
  parent_name TEXT,
  parent_email TEXT,
  child_name TEXT,
  child_age TEXT,
  interested_programme TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  form_version TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parent_interview_registration
  ON parent_interview_forms (registration_id);

CREATE TABLE IF NOT EXISTS need_based_scholarship_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registration_leads(id) ON DELETE CASCADE,
  interested_student_id UUID REFERENCES interested_students(id) ON DELETE SET NULL,
  lead_token TEXT,
  dependents_count INTEGER NOT NULL,
  school_going_children_count INTEGER NOT NULL,
  residence_type TEXT NOT NULL,
  requested_amount NUMERIC(12,2) NOT NULL,
  scholarship_reason TEXT NOT NULL,
  scholarship_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted',
  voucher_created BOOLEAN NOT NULL DEFAULT FALSE,
  voucher_id UUID REFERENCES fee_vouchers(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS need_based_scholarship_registration_unique
  ON need_based_scholarship_forms (registration_id);

CREATE TABLE IF NOT EXISTS regular_monthly_fee_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_no TEXT NOT NULL UNIQUE,
  class_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  month_label TEXT,
  due_date DATE NOT NULL,
  base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  late_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  student_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regular_monthly_fee_voucher_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES regular_monthly_fee_batches(id) ON DELETE CASCADE,
  voucher_id UUID NOT NULL UNIQUE REFERENCES fee_vouchers(id) ON DELETE CASCADE,
  voucher_no TEXT,
  student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT,
  student_phone TEXT,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  late_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_items_student
  ON regular_monthly_fee_voucher_items (student_id, due_date);
CREATE INDEX IF NOT EXISTS idx_monthly_items_batch
  ON regular_monthly_fee_voucher_items (batch_id);

CREATE TABLE IF NOT EXISTS interested_student_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interested_student_id UUID NOT NULL REFERENCES interested_students(id) ON DELETE CASCADE,
  reminder_no INTEGER NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TIMESTAMP,
  meta JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interested_reminders_student
  ON interested_student_reminder_logs (interested_student_id, reminder_no);
