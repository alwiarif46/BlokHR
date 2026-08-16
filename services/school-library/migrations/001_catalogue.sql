CREATE TABLE IF NOT EXISTS titles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  isbn13 TEXT,
  title TEXT NOT NULL,
  authors_json TEXT NOT NULL DEFAULT '[]',
  publisher TEXT,
  published_year INTEGER,
  subjects_json TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'en',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS titles_tenant_isbn13_uq
  ON titles (tenant_id, isbn13)
  WHERE isbn13 IS NOT NULL;

CREATE INDEX IF NOT EXISTS titles_tenant_idx ON titles (tenant_id);

CREATE TABLE IF NOT EXISTS copies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title_id TEXT NOT NULL,
  barcode TEXT NOT NULL,
  accession_no TEXT,
  condition TEXT NOT NULL DEFAULT 'good',
  status TEXT NOT NULL DEFAULT 'available',
  location_label TEXT,
  acquired_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, barcode),
  FOREIGN KEY (title_id) REFERENCES titles(id)
);

CREATE INDEX IF NOT EXISTS copies_tenant_title_idx ON copies (tenant_id, title_id);
CREATE INDEX IF NOT EXISTS copies_tenant_status_idx ON copies (tenant_id, status);
