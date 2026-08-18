INSERT INTO courses (title, class_level, description, status)
VALUES
  ('Pre-Nursery', 'Pre-Nursery', 'Pre-Nursery class program', 'active'::user_status),
  ('Nursery', 'Nursery', 'Nursery class program', 'active'::user_status),
  ('KG-1', 'KG-1', 'KG-1 class program', 'active'::user_status),
  ('KG-2', 'KG-2', 'KG-2 class program', 'active'::user_status)
ON CONFLICT DO NOTHING;

INSERT INTO subjects (name, description, status)
VALUES
  ('English', 'Core English subject', 'active'::user_status),
  ('Mathematics', 'Core Mathematics subject', 'active'::user_status),
  ('Urdu', 'Core Urdu subject', 'active'::user_status),
  ('General Knowledge', 'General Knowledge subject', 'active'::user_status),
  ('Islamiat', 'Core Islamiat subject', 'active'::user_status),
  ('Environmental Studies', 'Environmental Studies subject', 'active'::user_status),
  ('General Science', 'General Science subject', 'active'::user_status)
ON CONFLICT (name) DO UPDATE SET
  status = 'active'::user_status,
  updated_at = NOW();

WITH mapping(class_title, subject_name) AS (
  VALUES
    ('Pre-Nursery', 'English'),
    ('Pre-Nursery', 'Mathematics'),
    ('Pre-Nursery', 'Urdu'),
    ('Pre-Nursery', 'General Knowledge'),
    ('Pre-Nursery', 'Islamiat'),
    ('Nursery', 'English'),
    ('Nursery', 'Mathematics'),
    ('Nursery', 'Urdu'),
    ('Nursery', 'General Knowledge'),
    ('Nursery', 'Islamiat'),
    ('KG-1', 'English'),
    ('KG-1', 'Mathematics'),
    ('KG-1', 'Urdu'),
    ('KG-1', 'Environmental Studies'),
    ('KG-1', 'Islamiat'),
    ('KG-2', 'English'),
    ('KG-2', 'Mathematics'),
    ('KG-2', 'Urdu'),
    ('KG-2', 'General Science'),
    ('KG-2', 'Islamiat')
)
INSERT INTO course_subjects (course_id, subject_id)
SELECT c.id, s.id
FROM mapping m
INNER JOIN courses c ON LOWER(c.title) = LOWER(m.class_title)
INNER JOIN subjects s ON LOWER(s.name) = LOWER(m.subject_name)
ON CONFLICT (course_id, subject_id) DO NOTHING;
