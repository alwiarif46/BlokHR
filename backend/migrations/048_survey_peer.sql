-- 048_survey_peer: Peer-360 audience, subject email on responses, peer assignments.

ALTER TABLE surveys ADD COLUMN audience TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE surveys ADD COLUMN min_responses INTEGER NOT NULL DEFAULT 1;

ALTER TABLE survey_responses_anonymous ADD COLUMN subject_email TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS survey_peer_assignments (
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  reviewer_email TEXT NOT NULL,
  subject_email TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(survey_id, reviewer_email, subject_email)
);
CREATE INDEX IF NOT EXISTS idx_peer_assign_reviewer ON survey_peer_assignments(reviewer_email);
CREATE INDEX IF NOT EXISTS idx_peer_assign_survey ON survey_peer_assignments(survey_id);
