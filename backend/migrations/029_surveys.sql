-- 029_surveys: Employee surveys, pulse checks, eNPS.
-- Anonymous responses stored WITHOUT email. Completions track who responded (boolean only).

CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  questions_json TEXT NOT NULL DEFAULT '[]',
  anonymous INTEGER NOT NULL DEFAULT 1,
  recurrence TEXT NOT NULL DEFAULT 'none'
    CHECK(recurrence IN ('none', 'weekly', 'monthly', 'quarterly')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft', 'active', 'closed')),
  target_group_ids TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);

-- Anonymous responses — NO email column
CREATE TABLE IF NOT EXISTS survey_responses_anonymous (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL DEFAULT '{}',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_survey_resp_survey ON survey_responses_anonymous(survey_id);

-- Completions — tracks WHO responded (boolean only, no link to response)
CREATE TABLE IF NOT EXISTS survey_completions (
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(survey_id, email)
);
CREATE INDEX IF NOT EXISTS idx_survey_comp_email ON survey_completions(email);

-- Action items linked to survey results
CREATE TABLE IF NOT EXISTS survey_action_items (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN ('open', 'in_progress', 'completed')),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_action_items_survey ON survey_action_items(survey_id);
