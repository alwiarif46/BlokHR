-- Optional vertical on entitlements (hr | school). Existing rows read as hr when NULL.
ALTER TABLE entitlements ADD COLUMN vertical TEXT DEFAULT 'hr';
