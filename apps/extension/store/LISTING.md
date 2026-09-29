# Chrome Web Store submission — OpenTechCheck

Everything below maps 1:1 to fields in the CWS developer dashboard.
Assets in this directory; the zip is rebuilt by `bun run build` + zipping
`dist/chrome` (or take it from the release-cws workflow artifact).

## Store listing

**Name:** OpenTechCheck

**Summary (132 max):**
See what any website is built with. Free, open source, and 100% private —
nothing you browse ever leaves your computer.

**Category:** Developer Tools

**Language:** English

**Description:**

Click the icon on any website to see what it's built with: the frameworks,
shop systems, analytics tools, servers, and programming languages behind
the page — with version numbers when they can be found.

IT SHOWS ITS WORK
Tap any result to see the exact clue that produced it, straight from the
page itself. You never have to take the extension's word for anything.

IT'S COMPLETELY PRIVATE
Everything happens on your computer. The extension sends nothing anywhere —
no account, no tracking, no data collection of any kind.

IT'S FREE AND OPEN SOURCE
Anyone can read the code, check how a detection works, or add support for
a new technology. Fixes and additions ship to everyone.

EASY TO SHARE
Copy the list as plain text, or export everything as a JSON file.

Detects WordPress, Shopify, React, Next.js, Vue, jQuery, Google Analytics,
Cloudflare, Nginx, PHP, and 150+ more.

Source code: https://github.com/PGHQdev/OpenTechCheck
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
