# Primetime CMS — how it works

A lightweight, no-backend content system for the Primetime Softball Organization site,
modeled on the same pattern used by the org's other team hubs (single JSON content file +
static admin dashboard + client-side renderer).

## Pieces

| Path | Purpose |
| --- | --- |
| `cms/content/primetime-site.json` | The single source of truth for editable content: org info, board, all 3 teams (incl. rosters, coach info, GameChanger/NCS links), fundraising/sponsors, docs, policies, bylaws, finances, SEO. |
| `cms/schema/primetime-site.schema.json` | JSON Schema describing the shape of that file. |
| `cms/admin/index.html` + `app.js` + `styles.css` | A local, form-based dashboard for editing the content file without touching code. |
| `assets/js/primetime-content-renderer.js` | Included on every public page; fetches the content JSON and fills in any `[data-pt-*]` element it finds. If the fetch fails, the page's static placeholder copy stays visible — nothing breaks. |
| `scripts/validate-primetime-content.mjs` | Node script checking required fields, duplicate team ids, and flagging leftover `[ENTER ...]` placeholders. Runs in CI on every content change. |
| `scripts/import-roster-csv.mjs` | Bulk-import a team roster from a CSV instead of typing rows one by one. |
| `.github/workflows/validate-cms-content.yml` | Runs the validator automatically on any PR/push touching `cms/content/` or `cms/schema/`. |

## Editing workflow

1. Serve the site locally: `npx serve .` (needed because pages `fetch()` the JSON — opening `index.html` directly from disk won't load content).
2. Open `http://localhost:.../cms/admin/`.
3. Edit any tab (Org Info, Board, Teams, Roster, Fundraising, Docs, Policies, Bylaws, Finances, SEO).
4. Click **Validate** to catch mistakes before publishing.
5. Click **Export for GitHub** — downloads an updated `primetime-site.json`.
6. Replace `cms/content/primetime-site.json` with the downloaded file.
7. Commit and push:
   ```bash
   git add cms/content/primetime-site.json
   git commit -m "Update Primetime CMS content"
   git push
   ```
8. GitHub Pages picks up the change on the next deploy; the CI workflow validates the file automatically.

## Data flow on public pages

Public pages ship with real placeholder copy already in the HTML (so the site never looks
broken). `primetime-content-renderer.js` runs after page load, fetches the JSON, and — for
every element with a `data-pt-*` attribute it recognizes — overwrites that element's text,
href, or inner HTML with live content. Mount points currently wired up:

- `data-pt-org-name`, `data-pt-org-nickname`, `data-pt-org-tagline`, `data-pt-org-mission`,
  `data-pt-org-location`, `data-pt-org-email`, `data-pt-board-email`, `data-pt-org-phone`,
  `data-pt-instagram`, `data-pt-facebook`
- `data-pt-board-list` (renders board member cards)
- `data-pt-coaching-list` (renders one card per team's head coach)
- `data-pt-team-info="<team-id>"` with nested `data-pt-field="tagline|description"`
- `data-pt-team-coach="<team-id>"`
- `data-pt-roster="<team-id>"` (full roster table body) and `data-pt-roster-preview="<team-id>"`
  (5-row preview on team hub pages)
- `data-pt-gamechanger-schedule`, `data-pt-gamechanger-stats`, `data-pt-ncs` (each keyed by team id — renders a link once a real URL is set, otherwise stays as a "connect this" placeholder)
- `data-pt-fundraising-intro`, `data-pt-sponsors`
- `data-pt-docs-list`
- `data-pt-policy="<key>"`, `data-pt-bylaws="<key>"`, `data-pt-finances="<key>"`

## What this deliberately doesn't do

- **No authentication.** `/cms/admin/` is a plain static page — anyone with the URL can open
  it and edit the form (though nothing saves anywhere until they manually export + you commit
  the file). Don't link it publicly; if you want real access control, put it behind
  Cloudflare Access, a private repo/branch, or similar.
- **No auto-commit.** Export produces a downloaded file; a human still moves it into place
  and pushes. This keeps the whole system static-hostable with zero server cost.
- **No AI content assistant / player-profile pages / live GameChanger scraping.** These exist
  in some other team sites in this family as heavier, more custom builds. Ask if you want any
  of them added here — they'd layer on top of this same content file cleanly.
