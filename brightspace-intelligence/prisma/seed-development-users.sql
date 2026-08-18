-- Development-only login identities used for local mobile and web testing.
-- This intentionally excludes academic and finance reference data so it stays
-- compatible when class-level foreign keys change.

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
FROM users WHERE email = 'coordinator@ashshajrah.local'
ON CONFLICT (user_id) DO UPDATE SET department = EXCLUDED.department, status = EXCLUDED.status, updated_at = NOW();

INSERT INTO teacher_profiles (user_id, qualification, experience, status)
SELECT id, 'Development Test Qualification', 'Development account', 'active'
FROM users WHERE email = 'teacher@ashshajrah.local'
ON CONFLICT (user_id) DO UPDATE SET qualification = EXCLUDED.qualification, experience = EXCLUDED.experience, status = EXCLUDED.status, updated_at = NOW();

INSERT INTO parent_profiles (user_id, relation)
SELECT id, 'Parent' FROM users WHERE email = 'parent@ashshajrah.local'
ON CONFLICT (user_id) DO UPDATE SET relation = EXCLUDED.relation, updated_at = NOW();

INSERT INTO student_profiles (user_id, admission_no, age, grade_level, status)
SELECT id, 'DEV-0001', 4, 'Nursery', 'active'
FROM users WHERE email = 'student@ashshajrah.local'
ON CONFLICT (user_id) DO UPDATE SET admission_no = EXCLUDED.admission_no, age = EXCLUDED.age, grade_level = EXCLUDED.grade_level, status = EXCLUDED.status, updated_at = NOW();

INSERT INTO student_parents (student_id, parent_id, is_primary)
SELECT sp.id, pp.id, TRUE
FROM student_profiles sp
INNER JOIN users su ON su.id = sp.user_id AND su.email = 'student@ashshajrah.local'
CROSS JOIN parent_profiles pp
INNER JOIN users pu ON pu.id = pp.user_id AND pu.email = 'parent@ashshajrah.local'
ON CONFLICT (student_id, parent_id) DO UPDATE SET is_primary = TRUE;
