-- 010_leave_policy_rules: Restriction fields on leave_policies + clubbing rules table.

-- Add restriction columns to leave_policies
ALTER TABLE leave_policies ADD COLUMN allow_negative INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leave_policies ADD COLUMN negative_action TEXT NOT NULL DEFAULT 'block' CHECK(negative_action IN ('block', 'lwp', 'deduct_salary', 'adjust_next_month'));
ALTER TABLE leave_policies ADD COLUMN max_consecutive_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leave_policies ADD COLUMN min_notice_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leave_policies ADD COLUMN medical_cert_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leave_policies ADD COLUMN allow_half_day INTEGER NOT NULL DEFAULT 1;
ALTER TABLE leave_policies ADD COLUMN sandwich_policy TEXT NOT NULL DEFAULT 'exclude_weekends' CHECK(sandwich_policy IN ('count_weekends', 'exclude_weekends'));
ALTER TABLE leave_policies ADD COLUMN probation_mode TEXT NOT NULL DEFAULT 'full' CHECK(probation_mode IN ('no_accrual', 'reduced_rate', 'accrue_no_use', 'full'));
ALTER TABLE leave_policies ADD COLUMN encashment_trigger TEXT NOT NULL DEFAULT '' CHECK(encashment_trigger IN ('', 'termination', 'annual', 'excess'));

-- Clubbing rules — pairs of leave types that cannot be taken back-to-back.
CREATE TABLE IF NOT EXISTS leave_clubbing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leave_type_a TEXT NOT NULL,
  leave_type_b TEXT NOT NULL,
  gap_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(leave_type_a, leave_type_b)
);
