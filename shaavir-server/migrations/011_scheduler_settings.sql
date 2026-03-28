-- 011_scheduler_settings: Auto-cutoff, absence marking, and scheduler configuration.

-- Per-group cutoff buffer (overrides global default)
ALTER TABLE groups ADD COLUMN cutoff_buffer_minutes INTEGER NOT NULL DEFAULT 120;

-- Global scheduler settings
ALTER TABLE system_settings ADD COLUMN auto_cutoff_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN auto_cutoff_buffer_minutes INTEGER NOT NULL DEFAULT 120;
ALTER TABLE system_settings ADD COLUMN auto_cutoff_credit_mode TEXT NOT NULL DEFAULT 'shift_end' CHECK(auto_cutoff_credit_mode IN ('shift_end', 'last_activity', 'cutoff_time'));
ALTER TABLE system_settings ADD COLUMN absence_marking_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN pto_accrual_day INTEGER NOT NULL DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN reminder_interval_hours INTEGER NOT NULL DEFAULT 3;
