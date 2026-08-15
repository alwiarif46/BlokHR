-- 012_holidays: Holiday calendar — mandatory, optional, and restricted holidays.

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'mandatory' CHECK(type IN ('mandatory', 'optional', 'restricted')),
  year INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, name)
);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);

-- Employee holiday selections (for optional/restricted holidays)
CREATE TABLE IF NOT EXISTS employee_holiday_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  holiday_id INTEGER NOT NULL REFERENCES holidays(id),
  year INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, holiday_id)
);

-- How many optional holidays an employee can choose per year
ALTER TABLE system_settings ADD COLUMN optional_holidays_per_year INTEGER NOT NULL DEFAULT 2;

-- Seed the 3 mandatory national holidays
INSERT OR IGNORE INTO holidays (date, name, type, year) VALUES
  ('2026-01-26', 'Republic Day', 'mandatory', 2026),
  ('2026-08-15', 'Independence Day', 'mandatory', 2026),
  ('2026-10-02', 'Gandhi Jayanti', 'mandatory', 2026);
