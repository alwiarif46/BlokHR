-- 037_feature_flags_admin_only: admin_only column on feature_flags

ALTER TABLE feature_flags ADD COLUMN admin_only INTEGER NOT NULL DEFAULT 0;

UPDATE feature_flags SET admin_only = 1 WHERE feature_key IN ('analytics', 'geo_fencing', 'face_recognition', 'iris_scan');
