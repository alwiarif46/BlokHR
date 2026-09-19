ALTER TABLE tracked_meetings ADD COLUMN tenant_id TEXT;
ALTER TABLE meeting_attendance ADD COLUMN tenant_id TEXT;

-- Backfill tracked_meetings tenant_id from members table based on added_by email.
-- Any rows where added_by cannot be found in members will remain NULL.
-- NULL tenant_id rows will be preserved but completely inaccessible via the API
-- to prevent cross-tenant data leaks.
UPDATE tracked_meetings
SET tenant_id = (
  SELECT tenant_id 
  FROM members 
  WHERE members.email = tracked_meetings.added_by
  LIMIT 1
)
WHERE tenant_id IS NULL;

-- Backfill meeting_attendance tenant_id from their parent tracked_meetings.
UPDATE meeting_attendance
SET tenant_id = (
  SELECT tenant_id 
  FROM tracked_meetings 
  WHERE tracked_meetings.id = meeting_attendance.meeting_id
)
WHERE tenant_id IS NULL;
