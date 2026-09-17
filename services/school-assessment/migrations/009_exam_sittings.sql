-- Exam sittings, seating, hall tickets, timed attempts

CREATE TABLE IF NOT EXISTS exam_sittings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  room_label TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  invigilator_member_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exam_sittings_tenant_exam
  ON exam_sittings(tenant_id, exam_id);

CREATE TABLE IF NOT EXISTS seat_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sitting_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  seat_code TEXT NOT NULL,
  UNIQUE(sitting_id, student_id),
  UNIQUE(sitting_id, seat_code)
);

CREATE INDEX IF NOT EXISTS idx_seat_assignments_sitting
  ON seat_assignments(tenant_id, sitting_id);

CREATE TABLE IF NOT EXISTS hall_tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  sitting_id TEXT NOT NULL,
  ticket_code TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_hall_tickets_sitting
  ON hall_tickets(tenant_id, sitting_id);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sitting_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  paper_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress',
  UNIQUE(sitting_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_sitting
  ON exam_attempts(tenant_id, sitting_id);
