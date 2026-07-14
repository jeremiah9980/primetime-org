# Primetime Softball Organization — Website

A static, no-build-step website for **Primetime Softball Organization**, covering three teams:

- **Primetime 10U** (`teams/primetime-10u.html`, `roster/primetime-10u.html`)
- **Primetime 12U** (`teams/primetime-12u.html`, `roster/primetime-12u.html`)
- **Primetime Elite 12U** (`teams/primetime-elite-12u.html`, `roster/primetime-elite-12u.html`)

Plus organization-level pages: `about.html`, `board.html`, `bylaws.html`, `coaching.html`,
`contact.html`, `docs.html`, `finances.html`, `fundraising.html`, `policies.html`.

Theme: **black & gold** ("Primetime spotlight"), with a light/dark toggle in the nav bar.
See `BRANDING.md` for the palette.

## What this is (and isn't)

This site is modeled on the same design pattern (glassmorphism cards, sticky nav, Anton +
Inter display type, light/dark token system) used across the org's other team hubs — rebuilt
from scratch with Primetime's own black-and-gold identity, copy, and structure reorganized as
a multi-team **organization** site rather than a single team page.

It does **not** include a few things found on some other team sites in this family, since
they're custom backend/ops tooling outside the scope of a static GitHub Pages site:
- A roster/CMS admin panel (rosters here are edited by hand in `config/teams.config.json`)
- Live GameChanger stats/schedule syncing (placeholder panels are wired for it — see below)
- An NCS tournament monitor/tracker backend (placeholder panel included; ask if you want a
  real integration built)

## How to edit content

- **Org info, board, theme colors, contact:** `config/org.config.json`
- **Per-team info, coaches, GameChanger URL, rosters:** `config/teams.config.json`
  (the roster pages read this file live via `fetch()` — add players as
  `{ "number": "12", "name": "Jane Doe", "position": "SS", "batsThrows": "R/R" }`)
- **Governance/policy copy:** edit the HTML directly in `board.html`, `bylaws.html`,
  `policies.html`, `finances.html` — all placeholder text is marked in *italics*.
- **Images:** drop files into `public/images/<folder>/` per `public/images/README.md`,
  then reference them as `/images/<folder>/filename.png` in the relevant HTML.

## Local preview

Because the roster pages use `fetch()`, you must serve the site over HTTP (not open
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
