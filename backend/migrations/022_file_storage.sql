-- 022_file_storage: File storage provider configuration + upload tracking.

-- Storage provider config on branding (setup wizard configurable)
ALTER TABLE branding ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'local' CHECK(storage_provider IN ('local', 'azure_blob', 'aws_s3', 'none'));
ALTER TABLE branding ADD COLUMN storage_local_path TEXT NOT NULL DEFAULT './uploads';
ALTER TABLE branding ADD COLUMN storage_azure_connection_string TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN storage_azure_container TEXT NOT NULL DEFAULT 'shaavir-files';
ALTER TABLE branding ADD COLUMN storage_aws_region TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN storage_aws_bucket TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN storage_aws_access_key TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN storage_aws_secret_key TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN storage_max_file_size_mb INTEGER NOT NULL DEFAULT 25;

-- Track all uploaded files (provider-agnostic metadata)
CREATE TABLE IF NOT EXISTS file_uploads (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_provider TEXT NOT NULL,
  storage_path TEXT NOT NULL DEFAULT '',
  storage_url TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL,
  context_type TEXT NOT NULL DEFAULT '' CHECK(context_type IN ('', 'profile_photo', 'logo', 'attachment', 'document', 'export')),
  context_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_file_uploads_by ON file_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_uploads_context ON file_uploads(context_type, context_id);
