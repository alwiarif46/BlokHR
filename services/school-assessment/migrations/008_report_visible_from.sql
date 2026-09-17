-- Phase 2: parent-visible publish date on report cards

ALTER TABLE report_cards ADD COLUMN visible_from TEXT;

CREATE INDEX IF NOT EXISTS idx_report_cards_visible
  ON report_cards(tenant_id, student_id, visible_from);
