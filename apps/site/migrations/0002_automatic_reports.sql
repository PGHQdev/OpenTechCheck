CREATE TABLE IF NOT EXISTS automatic_coverage_reports (
  domain TEXT PRIMARY KEY,
  report_type TEXT NOT NULL DEFAULT 'automatic-coverage-gap' CHECK (report_type = 'automatic-coverage-gap'),
  submission_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved')),
  first_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
