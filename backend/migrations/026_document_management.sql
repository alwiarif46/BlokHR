-- 026_document_management: Policy repository, versioning, acknowledgments, template library.
-- Documents live alongside file storage. Templates use {{variable}} syntax
-- with formula bridge and conditional logic.

-- ── Policy / Document repository with version control ──
-- Versioning: all versions of the same document share a document_group_id.
-- Creating a new version inserts a new row with version incremented.
-- Previous versions are retained (never deleted on publish).
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  document_group_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'policy'
    CHECK(category IN ('policy', 'handbook', 'code_of_conduct', 'procedure', 'guidelines', 'form', 'other')),
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL DEFAULT '',
  file_id TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft', 'published', 'archived')),
  ack_required INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  published_by TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_group ON documents(document_group_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_group_version ON documents(document_group_id, version);

-- ── Employee acknowledgments ──
-- One ack per employee per document version. Tracks who read and accepted each policy.
CREATE TABLE IF NOT EXISTS employee_acknowledgments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  acked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(document_id, email)
);
CREATE INDEX IF NOT EXISTS idx_acks_document ON employee_acknowledgments(document_id);
CREATE INDEX IF NOT EXISTS idx_acks_email ON employee_acknowledgments(email);

-- ── Template library ──
-- Reusable letter/certificate templates with {{variable}} merge fields.
-- Template variables: {{employee_name}}, {{joining_date}}, {{designation}}, etc.
-- Formula bridge: {{formula:tenure:joining_date}}
-- Data lookups: {{leave_balance:Casual}}
-- Conditionals: {{if:tenure_years > 5}}Senior benefit{{/if}}
CREATE TABLE IF NOT EXISTS document_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom'
    CHECK(category IN ('offer_letter', 'appraisal_letter', 'warning_letter',
      'experience_certificate', 'salary_certificate', 'custom')),
  content_template TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_templates_category ON document_templates(category);

-- ── Generated documents ──
-- Output from template merges. Linked to file_uploads via file_id.
-- Variables snapshot preserves exactly what was merged at generation time.
CREATE TABLE IF NOT EXISTS generated_documents (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  target_email TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  variables_json TEXT NOT NULL DEFAULT '{}',
  file_id TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gen_docs_template ON generated_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_gen_docs_target ON generated_documents(target_email);
CREATE INDEX IF NOT EXISTS idx_gen_docs_by ON generated_documents(generated_by);
