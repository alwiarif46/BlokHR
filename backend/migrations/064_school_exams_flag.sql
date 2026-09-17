-- 064_school_exams_flag: Exams & Marks staff mini-app (separate from HPC)

INSERT OR IGNORE INTO feature_flags (feature_key, label, description, category) VALUES
  ('school_exams', 'Exams & Marks', 'Exam terms, marks entry, publish, and report cards', 'school');

UPDATE feature_flags SET admin_only = 1 WHERE feature_key = 'school_exams';

-- Relabel HPC so Exams is the assessment product surface
UPDATE feature_flags
SET label = 'HPC',
    description = 'Holistic progress cards (PARAKH four-voice)'
WHERE feature_key = 'school_hpc';
