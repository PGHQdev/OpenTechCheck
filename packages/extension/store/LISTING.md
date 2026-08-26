# Chrome Web Store submission — OpenTechCheck

Everything below maps 1:1 to fields in the CWS developer dashboard.
Assets in this directory; the zip is rebuilt by `bun run build` + zipping
`dist/chrome` (or take it from the release-cws workflow artifact).

## Store listing

**Name:** OpenTechCheck

**Summary (132 max):**
See what any website is built with — open-source, evidence-based technology
detection that runs entirely in your browser.

**Category:** Developer Tools

**Language:** English

**Description:**

OpenTechCheck shows you the technology stack behind any website: frameworks,
CMS, e-commerce platforms, analytics, tag managers, CDNs, servers, and
programming languages — grouped by category, with version numbers where
detectable.

What makes it different:

EVIDENCE FOR EVERY CLAIM
Every detection shows the exact signal that produced it — a response header,
a meta tag, a script URL, a JavaScript global. Expand any row to see the
proof. Confidence grades (A–D) tell you how solid each detection is.

100% LOCAL
Detection runs entirely inside your browser, against the page you already
loaded. The extension makes zero network requests: fingerprints, icons, and
fonts all ship in the package. No account, no tracking, no analytics, no
cloud. Nothing about your browsing ever leaves your machine.

OPEN SOURCE
The detection engine and all 152+ technology fingerprints are open source
(Apache-2.0) and community-maintained. Every fingerprint is a readable YAML
file, tested in CI against fixtures captured from real sites. Wrong or
missing detection? One pull request fixes it for everyone.

USEFUL OUTPUT
Copy the stack as plain text or export the full result — detections,
versions, confidence, evidence — as JSON.

Source: https://github.com/PGHQdev/OpenTechCheck
Website: https://opentechcheck.com

**Privacy policy URL:** https://opentechcheck.com/privacy
**Homepage URL:** https://opentechcheck.com

## Assets (this directory)

| File | Dashboard slot |
|---|---|
| `screenshot-1.png` … `screenshot-4.png` | Screenshots (1280×800) |
| `promo-440x280.png` | Small promo tile |
| `promo-1400x560.png` | Marquee promo tile |
| `opentechcheck-chrome-0.1.0.zip` | Package upload |

## Privacy practices form

**Single purpose description:**
The extension's single purpose is to identify and display the web
technologies used by the page the user is currently viewing.

**Permission justifications:**

- **Host permission (`<all_urls>`)** — Technology detection must read the
  content of whatever page the user chooses to inspect; the technologies a
  site uses can only be identified from that site's own pages. All analysis
  happens locally; page data is never transmitted.
- **webRequest** — HTTP response headers (e.g. `server: nginx`) are primary
  detection signals for servers and CDNs. The extension observes main-frame
  response headers, matches them locally, and stores them only in per-tab
  session storage.
- **cookies** — Cookie names (e.g. `laravel_session`, `PHPSESSID`) identify
  server-side technologies that leave no trace in page markup. Cookies are
  read for the inspected tab's URL, matched locally, and never transmitted.
- **storage** — Holds per-tab detection results in session storage so the
  popup can display them; results are discarded when the tab closes.
- **webNavigation** — Detects page loads and SPA navigations so stale
  results are cleared and the page is re-analyzed.
- **Remote code:** No. All code is packaged; the extension loads and
  executes nothing remote.

**Data usage disclosures:** check "none of the above" for every category —
the extension does not collect, transmit, sell, or share any user data.

## Submission checklist

1. Deploy the site so https://opentechcheck.com/privacy is live (CWS
   validates the URL).
2. dashboard → New item → upload the zip.
3. Paste the listing fields and upload the images above.
4. Fill the privacy practices form from this document.
5. Submit for review. First reviews of extensions with broad host
   permissions commonly take several business days.
6. After approval: put the assigned item ID into the `CWS_EXTENSION_ID`
   repo secret (plus the OAuth secrets) so tagged releases publish
   automatically via `.github/workflows/release-cws.yml`.
