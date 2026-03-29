-- 037_feature_flags_admin_only: Add admin_only visibility control to feature flags.
-- Flags marked admin_only=1 are hidden from non-admin users in GET /api/features
-- and their route prefixes return 403 for non-admins.

ALTER TABLE feature_flags ADD COLUMN admin_only INTEGER NOT NULL DEFAULT 0;

-- Mark admin-only features: analytics, geo config, biometric enrollment
UPDATE feature_flags SET admin_only = 1 WHERE feature_key IN ('analytics', 'geo_fencing', 'face_recognition', 'iris_scan');
