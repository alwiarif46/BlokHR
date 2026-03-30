-- 039_leave_kind_comp_off: Add 'CompOff' to leave_requests.kind CHECK constraint.
--
-- SQLite does not support ALTER COLUMN or DROP CONSTRAINT.
-- Standard approach: rename old table → create new table with updated constraint
-- → copy all data → drop old table → recreate indexes.
--
-- Old constraint: CHECK(kind IN ('FullDay', 'FirstHalf', 'SecondHalf'))
-- New constraint: CHECK(kind IN ('FullDay', 'FirstHalf', 'SecondHalf', 'CompOff'))

PRAGMA foreign_keys = OFF;

BEGIN;

-- Step 1: rename existing table
ALTER TABLE leave_requests RENAME TO leave_requests_old;

-- Step 2: create new table with updated CHECK
CREATE TABLE leave_requests (
  id TEXT PRIMARY KEY,
  person_name TEXT NOT NULL,
  person_email TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  policy_name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'FullDay'
    CHECK(kind IN ('FullDay', 'FirstHalf', 'SecondHalf', 'CompOff')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days_requested REAL NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK(status IN ('Pending', 'Approved by Manager', 'Approved', 'Rejected', 'Cancelled')),
  paid_type TEXT NOT NULL DEFAULT ''
    CHECK(paid_type IN ('', 'paid', 'unpaid')),
  rejection_reason TEXT NOT NULL DEFAULT '',
  manager_approver_email TEXT NOT NULL DEFAULT '',
  hr_approver_email TEXT NOT NULL DEFAULT '',
  cancelled_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 3: copy all existing data
INSERT INTO leave_requests SELECT * FROM leave_requests_old;

-- Step 4: drop old table
DROP TABLE leave_requests_old;

-- Step 5: recreate indexes
CREATE INDEX IF NOT EXISTS idx_leave_email  ON leave_requests(person_email);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates  ON leave_requests(start_date, end_date);

COMMIT;

PRAGMA foreign_keys = ON;
