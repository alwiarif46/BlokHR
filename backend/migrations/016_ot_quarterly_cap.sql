-- 016_ot_quarterly_cap: Add quarterly overtime cap (125 hours per Factories Act).

ALTER TABLE system_settings ADD COLUMN ot_max_quarterly_hours INTEGER NOT NULL DEFAULT 125;
