-- 060_pii_domain_tenant_scope: tenant_id for PII / domain tables.
-- Same N-tenant generic attribution as 059 — never hardcodes named tenant IDs.

-- ── bd_meetings ────────────────────────────────────────────────────────────────
ALTER TABLE bd_meetings ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE bd_meetings SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(bd_meetings.email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(bd_meetings.email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_bd_tenant ON bd_meetings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bd_tenant_status ON bd_meetings(tenant_id, status);

-- ── documents / acknowledgments / templates / generated ────────────────────────
ALTER TABLE documents ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE document_templates ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE generated_documents ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE employee_acknowledgments ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE generated_documents SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(generated_documents.target_email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(generated_documents.target_email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

UPDATE employee_acknowledgments SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(employee_acknowledgments.email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(employee_acknowledgments.email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_tenant ON document_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gen_docs_tenant ON generated_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_acks_tenant ON employee_acknowledgments(tenant_id);

-- ── visitors ───────────────────────────────────────────────────────────────────
ALTER TABLE visitor_visits ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE visitor_visits SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(visitor_visits.host_email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(visitor_visits.host_email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_visits_tenant ON visitor_visits(tenant_id);

-- ── assets ─────────────────────────────────────────────────────────────────────
ALTER TABLE assets ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE asset_assignments ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE maintenance_records ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE asset_assignments SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(asset_assignments.email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(asset_assignments.email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

UPDATE assets SET tenant_id = COALESCE(
  (SELECT aa.tenant_id FROM asset_assignments aa WHERE aa.asset_id = assets.id
   ORDER BY (aa.tenant_id = 'default') ASC, aa.tenant_id ASC LIMIT 1),
  'default'
);

UPDATE maintenance_records SET tenant_id = COALESCE(
  (SELECT a.tenant_id FROM assets a WHERE a.id = maintenance_records.asset_id),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_assets_tenant ON assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assign_tenant ON asset_assignments(tenant_id);

-- ── expenses (expense_receipts) ─────────────────────────────────────────────────
ALTER TABLE expense_receipts ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE expense_receipts SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(expense_receipts.email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(expense_receipts.email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expense_receipts(tenant_id);

-- ── surveys (029) ──────────────────────────────────────────────────────────────
ALTER TABLE surveys ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_surveys_tenant ON surveys(tenant_id);

-- ── face enrollments (UNIQUE must include tenant_id) ───────────────────────────
CREATE TABLE IF NOT EXISTS face_enrollments_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  person_group_id TEXT NOT NULL DEFAULT 'shaavir-default',
  azure_person_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'enrolled', 'failed')),
  error_message TEXT NOT NULL DEFAULT '',
  enrolled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, email)
);

INSERT OR IGNORE INTO face_enrollments_mt (
  tenant_id, email, person_group_id, azure_person_id, status, error_message, enrolled_at, created_at, updated_at
)
SELECT
  COALESCE(
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(f.email) AND COALESCE(m.active, 1) = 1
     ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(f.email)
     ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    'default'
  ),
  f.email, f.person_group_id, f.azure_person_id, f.status, f.error_message, f.enrolled_at, f.created_at, f.updated_at
FROM face_enrollments f;

DROP TABLE face_enrollments;
ALTER TABLE face_enrollments_mt RENAME TO face_enrollments;

CREATE INDEX IF NOT EXISTS idx_face_tenant_email ON face_enrollments(tenant_id, email);

-- ── iris (032) — add tenant if table exists pattern via ADD COLUMN ─────────────
-- iris_enrollments may use email unique; rebuild if present.
CREATE TABLE IF NOT EXISTS iris_enrollments_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  iris_template TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'enrolled', 'failed')),
  error_message TEXT NOT NULL DEFAULT '',
  enrolled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, email)
);

INSERT OR IGNORE INTO iris_enrollments_mt (
  tenant_id, email, iris_template, status, error_message, enrolled_at, created_at, updated_at
)
SELECT
  COALESCE(
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(i.email) AND COALESCE(m.active, 1) = 1
     ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(i.email)
     ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    'default'
  ),
  i.email,
  COALESCE(i.iris_template, ''),
  COALESCE(i.status, 'pending'),
  COALESCE(i.error_message, ''),
  i.enrolled_at,
  COALESCE(i.created_at, datetime('now')),
  COALESCE(i.updated_at, datetime('now'))
FROM iris_enrollments i;

DROP TABLE IF EXISTS iris_enrollments;
ALTER TABLE iris_enrollments_mt RENAME TO iris_enrollments;

-- ── clients / projects ─────────────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE projects ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);

-- ── chat sessions / messages ───────────────────────────────────────────────────
ALTER TABLE chat_sessions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE chat_sessions SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(chat_sessions.email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(chat_sessions.email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_chat_sess_tenant ON chat_sessions(tenant_id);
