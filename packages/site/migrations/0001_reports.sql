CREATE TABLE IF NOT EXISTS coverage_reports (
  id TEXT PRIMARY KEY,
  website TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('coverage-gap', 'detection-issue')),
  extension_version TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS coverage_reports_queue ON coverage_reports(status, created_at);
