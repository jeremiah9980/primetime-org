# Primetime Integrations Worker

Cloudflare Worker that powers the live mode of the CMS Integration Center
(`cms/admin/integrations.html`).

playncs.com (NCS) has no JSON API and no CORS headers, so the static site can't
read it from the browser. This Worker fetches the public NCS pages server-side,
parses the HTML, and returns JSON with CORS enabled.

**Deployed at:** https://primetime-integrations.jeremiahcargill.workers.dev

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health?adapter=health\|ncs\|gamechanger` | Connection tests for Diagnostics |
| `GET /api/ncs/meta` | Season / age / class option IDs from the NCS search form |
| `GET /api/ncs/teams?q=&division=&state=&country=&seasonId=&city=` | Team search (`division` accepts `10U`, `12U`, …) |
| `GET /api/ncs/teams/:id/roster` | Roster with real NCS player IDs (`:id` accepts a pasted team URL) |
| `GET /api/ncs/teams/:id/events` | Upcoming events for one team |
| `POST /api/ncs/events/sync` `{teamIds: []}` | Merged registered events for several teams |
| `POST /api/ncs/events/:id/sync` | Refresh a single event from its details page |
| `POST /api/gamechanger/sync` | Always 501 — GameChanger has no public API; map player IDs manually |

## Deploy

```bash
cd integrations-worker
npx wrangler deploy
```

If NCS changes its page markup, the parsers in `src/index.js` (regexes over the
server-rendered tables) are the only thing that needs updating.
