CREATE TABLE IF NOT EXISTS internal_event_attendees (
  event_id UUID NOT NULL REFERENCES internal_events(id) ON DELETE CASCADE,
  attendee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, attendee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_internal_event_attendees_user
  ON internal_event_attendees(attendee_user_id);

INSERT INTO internal_event_attendees (event_id, attendee_user_id)
SELECT id, attendee_user_id
FROM internal_events
ON CONFLICT (event_id, attendee_user_id) DO NOTHING;

-- Consolidate only exact duplicate rows created together for the same event.
WITH duplicate_groups AS (
  SELECT
    (ARRAY_AGG(id ORDER BY id::text))[1] AS keeper_id,
    ARRAY_AGG(id ORDER BY id::text) AS event_ids
  FROM internal_events
  GROUP BY
    title,
    COALESCE(description, ''),
    scheduled_start,
    scheduled_end,
    created_by,
    created_at,
    COALESCE(google_calendar_event_id, ''),
    COALESCE(google_meet_link, '')
  HAVING COUNT(*) > 1
),
attendees_to_keep AS (
  SELECT DISTINCT
    groups.keeper_id AS event_id,
    events.attendee_user_id
  FROM duplicate_groups groups
  CROSS JOIN LATERAL UNNEST(groups.event_ids) AS duplicate_id
  INNER JOIN internal_events events ON events.id = duplicate_id
)
INSERT INTO internal_event_attendees (event_id, attendee_user_id)
SELECT event_id, attendee_user_id
FROM attendees_to_keep
ON CONFLICT (event_id, attendee_user_id) DO NOTHING;

WITH duplicate_groups AS (
  SELECT
    (ARRAY_AGG(id ORDER BY id::text))[1] AS keeper_id,
    ARRAY_AGG(id ORDER BY id::text) AS event_ids
  FROM internal_events
  GROUP BY
    title,
    COALESCE(description, ''),
    scheduled_start,
    scheduled_end,
    created_by,
    created_at,
    COALESCE(google_calendar_event_id, ''),
    COALESCE(google_meet_link, '')
  HAVING COUNT(*) > 1
)
DELETE FROM internal_events events
USING duplicate_groups groups
WHERE events.id = ANY(groups.event_ids)
  AND events.id <> groups.keeper_id;
