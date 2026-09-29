# Website reports

The static SvelteKit site and `worker/index.ts` deploy together as the existing
`opentechcheck-site` Worker. `/report` is the form; `POST /api/reports` stores reports
in the existing `opentechcheck-api` D1 database. No public report-list endpoint exists.

The extension passes the sanitized website, automatic category, and version in a
URL fragment, which is read and cleared in the browser. Loading the form creates
no report. Submission requires a click, accepts only explicit fields, and is limited
to five requests per minute per IP per Cloudflare location. The IP is used by the
rate limiter, not stored in the report table. A stable draft ID prevents retry duplicates.

## Local verification

From this directory:

```sh
bun run build
bunx wrangler d1 migrations apply opentechcheck-api --local
bunx wrangler dev
```

Vite alone serves the form but does not run the report API. Use Wrangler for the
complete flow. Tests from the repo root: `bun test apps/site/test`.

## Release

Apply the additive migration before deploying the website, then release the
extension after the report page is live:

```sh
bunx wrangler d1 migrations apply opentechcheck-api --remote
bun run deploy
```

The site uses its own migration tracking table (`site_report_migrations`) to avoid
colliding with API migrations in the shared database.

## Team review queue

Reports are available to authorized team members in the Cloudflare D1 console,
or through Wrangler. There is no separate admin application in this change.

```sh
bunx wrangler d1 execute opentechcheck-api --remote --command "SELECT id, website, report_type, extension_version, details, email, status, created_at FROM coverage_reports WHERE status != 'resolved' ORDER BY created_at DESC LIMIT 100"
```

Group by website and report_type to spot recurring requests. Update a report's
`status` to `investigating` or `resolved` from the D1 console. Treat URLs and free
text as untrusted user input. Reports are never fetched or crawled automatically.

## Automatic coverage reports

`POST /api/reports/automatic` accepts exactly `{ "domain": "website.com" }`.
It aggregates submissions in `automatic_coverage_reports`, using the server-assigned
`automatic-coverage-gap` category. No extension version, client ID, path, or detection
evidence is accepted. Apply migration `0002_automatic_reports.sql` before releasing
the extension with this setting. The existing migration command applies both migrations.

The setting is off by default and stored in `chrome.storage.local`. The extension
requires completed follow-up scans (at least ten seconds after initial collection),
a quiet page, a successful public-IP document response, and a non-incognito tab.
It sends at most ten attempts per day and one per hostname per thirty days, keeping
only up to 500 hashed hostnames locally. Failed attempts also count to prevent retry
storms; there is no background retry queue. Unknown network addresses are skipped.

Inspect the separate automatic queue in D1:

```sql
SELECT domain, submission_count, status, first_seen, last_seen
FROM automatic_coverage_reports WHERE status != 'resolved'
ORDER BY submission_count DESC, last_seen DESC LIMIT 100;
```
