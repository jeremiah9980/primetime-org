# Primetime Softball Organization — Website

A static, no-build-step website for **Primetime Softball Organization**, covering three teams:

- **Primetime 10U** (`teams/primetime-10u.html`, `roster/primetime-10u.html`)
- **Primetime 12U** (`teams/primetime-12u.html`, `roster/primetime-12u.html`)
- **Primetime Elite 12U** (`teams/primetime-elite-12u.html`, `roster/primetime-elite-12u.html`)

Plus organization-level pages: `about.html`, `board.html`, `bylaws.html`, `coaching.html`,
`contact.html`, `docs.html`, `finances.html`, `fundraising.html`, `policies.html`.

Theme: **black & gold** ("Primetime spotlight"), with a light/dark toggle in the nav bar.
See `BRANDING.md` for the palette.

## Logo

The nav, footer, homepage hero, and motto banner are all wired to display a real logo —
they just need the file. **Drop your Primetime logo PNG at:**

```
public/images/logos/primetime-logo.png
```

Until that file exists, every one of those spots gracefully falls back to a styled "PT" /
"PRIMETIME FASTPITCH" text badge — nothing looks broken either way. Once the file is in
place, no code changes are needed; every page picks it up automatically. See
`public/images/README.md` for sizing guidance (a square, transparent-background PNG works
best for the nav/footer badge slots; the homepage hero showcase can handle a wider,
detailed logo like a full crest).

## CMS — editing content without touching code

This site ships with a small CMS so board members/coaches can update rosters, coaches,
board info, fundraising, docs, and policies without editing HTML:

- **Dashboard:** `cms/admin/index.html` (open via `npx serve .`, not by double-clicking)
- **Content file it edits:** `cms/content/primetime-site.json`
- **Full explanation:** `docs/SPEC-primetime-cms.md`

Quick version: open the dashboard, edit any tab, click **Validate**, click
**Export for GitHub**, replace `cms/content/primetime-site.json` with the downloaded file,
then commit and push. Every public page re-reads that file at load time.

## What this is (and isn't)

This site is modeled on the same design pattern (glassmorphism cards, sticky nav, Anton +
Inter display type, light/dark token system, JSON-file CMS + admin dashboard) used across
the org's other team hubs — rebuilt from scratch with Primetime's own black-and-gold
identity, copy, and structure reorganized as a multi-team **organization** site rather than
a single team page.

It does **not** include a few things found on some other team sites in this family, since
they're heavier custom backend/ops tooling outside the scope of a static GitHub Pages site:
- Live GameChanger stats/schedule syncing (the CMS stores the URLs; pages link out to them
  rather than embedding live widgets)
- An NCS tournament monitor/tracker backend (same — link-out, not embedded live data)
- An AI content-drafting assistant or auto-generated player profile pages
- Any server-side auth on `/cms/admin/` — it's a static page anyone with the link can open

Ask if you want any of these added — they'd layer on top of the existing content file
cleanly.

## How to edit content

- **Almost everything** (org info, board, teams, rosters, coaches, GameChanger/NCS links,
  fundraising, sponsors, docs, policies, bylaws, finances, SEO): use the CMS at
  `cms/admin/` — see above.
- **Images:** drop files into `public/images/<folder>/` per `public/images/README.md`,
  referenced as `/images/<folder>/filename.png`. The logo is the one exception with a fixed
  expected path — see the Logo section above.

## Local preview

Because pages `fetch()` the CMS content JSON, you must serve the site over HTTP (not open
`index.html` directly from disk):

```bash
npx serve .
```

Then open the printed `http://localhost:...` URL.

## Deploying

See `LAUNCH.md` for the full GitHub Pages walkthrough. Short version: push this folder to
`jeremiah9980/primetime-org`, then enable **Settings → Pages → Deploy from a branch →
`main` / `/ (root)`** (or let the included GitHub Actions workflow at
`.github/workflows/pages.yml` deploy it automatically on every push to `main`).
