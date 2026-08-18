-- Development-only identities and reference records.
-- Authentication currently compares password_hash as plaintext; these values
-- must never be copied to production.

INSERT INTO roles (name, description)
VALUES
  ('superadmin', 'Full platform access'),
  ('admin', 'Administrative access'),
  ('coordinator', 'Academic and operations coordination'),
  ('teacher', 'Teacher portal access'),
  ('parent', 'Parent portal access'),
  ('student', 'Student portal access')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO users (role_id, full_name, email, username, password_hash, status, must_change_password)
SELECT r.id, seed.full_name, seed.email, seed.username, 'DevOnly@123', 'active', FALSE
FROM (
  VALUES
    ('superadmin', 'Development Super Admin', 'superadmin@ashshajrah.local', 'dev.superadmin'),
    ('admin', 'Development Admin', 'admin@ashshajrah.local', 'dev.admin'),
    ('coordinator', 'Development Coordinator', 'coordinator@ashshajrah.local', 'dev.coordinator'),
    ('teacher', 'Development Teacher', 'teacher@ashshajrah.local', 'dev.teacher'),
    ('parent', 'Development Parent', 'parent@ashshajrah.local', 'dev.parent'),
    ('student', 'Development Student', 'student@ashshajrah.local', 'dev.student')
) AS seed(role_name, full_name, email, username)
INNER JOIN roles r ON r.name = seed.role_name
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  full_name = EXCLUDED.full_name,
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  status = 'active',
  must_change_password = FALSE,
  updated_at = NOW();

INSERT INTO coordinator_profiles (user_id, department, status)
SELECT id, 'Academic Operations', 'active'
FROM users
WHERE email = 'coordinator@ashshajrah.local'
ON CONFLICT (user_id) DO UPDATE SET
  department = EXCLUDED.department,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO teacher_profiles (user_id, qualification, experience, status)
SELECT id, 'Development Test Qualification', 'Development account', 'active'
FROM users
WHERE email = 'teacher@ashshajrah.local'
ON CONFLICT (user_id) DO UPDATE SET
  qualification = EXCLUDED.qualification,
  experience = EXCLUDED.experience,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO parent_profiles (user_id, relation)
SELECT id, 'Parent'
FROM users
WHERE email = 'parent@ashshajrah.local'
ON CONFLICT (user_id) DO UPDATE SET
  relation = EXCLUDED.relation,
  updated_at = NOW();

INSERT INTO student_profiles (user_id, admission_no, age, grade_level, status)
SELECT id, 'DEV-0001', 4, 'Nursery', 'active'
FROM users
WHERE email = 'student@ashshajrah.local'
ON CONFLICT (user_id) DO UPDATE SET
  admission_no = EXCLUDED.admission_no,
  age = EXCLUDED.age,
  grade_level = EXCLUDED.grade_level,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO student_parents (student_id, parent_id, is_primary)
SELECT sp.id, pp.id, TRUE
FROM student_profiles sp
INNER JOIN users su ON su.id = sp.user_id AND su.email = 'student@ashshajrah.local'
CROSS JOIN parent_profiles pp
INNER JOIN users pu ON pu.id = pp.user_id AND pu.email = 'parent@ashshajrah.local'
ON CONFLICT (student_id, parent_id) DO UPDATE SET is_primary = TRUE;

INSERT INTO enrollments (student_id, course_id, start_date, status)
SELECT sp.id, c.id, CURRENT_DATE, 'active'
FROM student_profiles sp
INNER JOIN users su ON su.id = sp.user_id AND su.email = 'student@ashshajrah.local'
CROSS JOIN courses c
WHERE c.class_level = 'Nursery'
  AND NOT EXISTS (
    SELECT 1
    FROM enrollments e
    WHERE e.student_id = sp.id
      AND e.course_id = c.id
      AND e.status::text = 'active'
  );

INSERT INTO teacher_assignments (
  teacher_id, student_id, course_id, subject_id, assigned_by, status
)
SELECT
  tp.id,
  sp.id,
  c.id,
  s.id,
  coordinator.id,
  'active'
FROM teacher_profiles tp
INNER JOIN users tu ON tu.id = tp.user_id AND tu.email = 'teacher@ashshajrah.local'
CROSS JOIN student_profiles sp
INNER JOIN users su ON su.id = sp.user_id AND su.email = 'student@ashshajrah.local'
CROSS JOIN courses c
CROSS JOIN subjects s
CROSS JOIN users coordinator
WHERE c.class_level = 'Nursery'
  AND s.name = 'English'
  AND coordinator.email = 'coordinator@ashshajrah.local'
  AND NOT EXISTS (
    SELECT 1
    FROM teacher_assignments ta
    WHERE ta.teacher_id = tp.id
      AND ta.student_id = sp.id
      AND ta.course_id = c.id
      AND ta.subject_id = s.id
  );

INSERT INTO regular_fee (class_level, name, amount, status)
VALUES
  ('Pre-Nursery', 'Monthly Tuition Fee', 0, 'active'),
  ('Nursery', 'Monthly Tuition Fee', 0, 'active'),
  ('KG-1', 'Monthly Tuition Fee', 0, 'active'),
  ('KG-2', 'Monthly Tuition Fee', 0, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods (
  name, method_key, account_title, instructions, status
)
VALUES
  ('Cash', 'cash', 'Ash-Shajrah', 'Contact administration for cash payment instructions.', 'active'),
  ('Bank Transfer', 'bank_transfer', 'Ash-Shajrah', 'Configure bank details before accepting payments.', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO headlines (headline, start_date, end_date, created_by)
SELECT
  'Welcome to the Ash-Shajrah development environment',
  CURRENT_DATE,
  CURRENT_DATE + 30,
  u.id
FROM users u
WHERE u.email = 'admin@ashshajrah.local'
  AND NOT EXISTS (
    SELECT 1 FROM headlines
    WHERE headline = 'Welcome to the Ash-Shajrah development environment'
  );
