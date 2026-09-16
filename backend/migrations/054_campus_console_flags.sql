-- 054_campus_console_flags: Timetable + Circulars staff modules

INSERT OR IGNORE INTO feature_flags (feature_key, label, description, category) VALUES
  ('school_timetable', 'Timetable & Classes', 'Class structure, weekly grid, and cover desk', 'school'),
  ('school_circulars', 'Circulars', 'Section-wide parent notices and circulars', 'school');

UPDATE feature_flags SET admin_only = 1 WHERE feature_key IN (
  'school_timetable',
  'school_circulars'
);
