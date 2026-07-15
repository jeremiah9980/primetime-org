/**
 * Primetime Integrations Worker — NCS (playncs.com) adapter.
 *
 * playncs.com is a server-rendered ASP.NET site with no JSON API and no CORS
 * headers, so the static CMS cannot call it from the browser. This Worker
 * fetches the public pages server-side, parses the HTML, and returns JSON
 * with CORS enabled for the Integration Center.
 *
 * Endpoints:
 *   GET  /api/health?adapter=health|ncs|gamechanger
 *   GET  /api/ncs/meta                          -> seasons / ages / classes from the search form
 *   GET  /api/ncs/teams?q=&division=&state=&country=&seasonId=&city=
 *   GET  /api/ncs/teams/:id/roster
 *   GET  /api/ncs/teams/:id/events
 *   POST /api/ncs/events/sync   {teamIds: []}   -> merged registered events for the teams
 *   POST /api/ncs/events/:id/sync               -> refresh one event from its details page
 *   POST /api/gamechanger/sync                  -> cross-reference + stats from the gc_stats D1 database
 *   POST /api/gcstats/match  {players: []}      -> match website players to gc_stats records
 *   GET  /api/gcstats/teams                     -> GameChanger team registry from gc_stats
 *
 * GameChanger has no public API. The gc_stats D1 database (populated by the
 * separate GameChanger scraping pipeline) keys season stats by NCS player id,
 * so it doubles as the NCS <-> GameChanger cross-reference: exact NCS-id joins
 * first, then normalized name (+ jersey number) matching for the rest.
 */

const NCS_BASE = "https://playncs.com";
const UA = "Mozilla/5.0 (compatible; PrimetimeIntegrations/1.0; +https://jeremiah9980.github.io/primetime-org/)";

// playncs age-division select values (from the Teams search form).
const AGE_IDS = { "6u": "13", "8u": "2", "9u": "3", "10u": "4", "12u": "6", "14u": "8", "16u": "10", "18u": "12", "adult": "17" };
const DEFAULT_SEASON = "33"; // 2027 Fastpitch (current registration season)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });
}

async function fetchNcs(path) {
  const res = await fetch(NCS_BASE + path, { headers: { "User-Agent": UA, "Accept": "text/html" } });
  if (!res.ok) throw new Error(`NCS returned HTTP ${res.status} for ${path}`);
  return res.text();
}

const decode = (s) =>
  String(s ?? "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();

/** Numeric team/event id from a raw id, or a pasted playncs URL. */
function extractId(raw) {
  const s = String(raw ?? "").trim();
  const url = s.match(/Details\/(\d+)/i);
  if (url) return url[1];
  const num = s.match(/^\d+$/);
  return num ? num[0] : null;
}

/* ---------------- parsers ---------------- */

function parseTeamSearch(html) {
  const teams = [];
  // Row shape: <a href="/fastpitch/Teams/Details/{id}/{slug}">Name</a> ... <td>Division</td> <td class="hidden-xs">City, ST</td> <td class="text-nowrap">W-L-T</td>
  const rowRe = /<tr>\s*<td>\s*<a href="\/fastpitch\/Teams\/Details\/(\d+)\/([^"]*)">\s*([^<]+)<\/a>[\s\S]*?<\/td>\s*<td>\s*([^<]*?)\s*<\/td>\s*<td class="hidden-xs">\s*([^<]*?)\s*<\/td>\s*<td class="text-nowrap">\s*([^<]*?)\s*<\/td>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    teams.push({
      id: m[1],
      slug: m[2],
      name: decode(m[3]),
      division: decode(m[4]),
      location: decode(m[5]),
      record: decode(m[6]),
      url: `${NCS_BASE}/fastpitch/Teams/Details/${m[1]}/${m[2]}`,
    });
  }
  return teams;
}

function sliceSection(html, panelId) {
  const start = html.indexOf(`id="${panelId}"`);
  if (start < 0) return "";
  const end = html.indexOf('class="panel"', start + 10);
  return html.slice(start, end < 0 ? undefined : end);
}

function parseRoster(html) {
  const section = sliceSection(html, "collapse-roster");
  const players = [];
  const rowRe = /<tr>\s*<td>\s*([^<]*?)\s*<\/td>\s*<td>\s*<a href="\/fastpitch\/Players\/Details\/(\d+)\/([^"]*)">\s*([^<]+)<\/a>/g;
  let m;
  while ((m = rowRe.exec(section))) {
    players.push({
      id: m[2],
      number: decode(m[1]),
      name: decode(m[4]),
      position: "",
      url: `${NCS_BASE}/fastpitch/Players/Details/${m[2]}/${m[3]}`,
    });
  }
  return players;
}

function parseCoaches(html) {
  const section = sliceSection(html, "collapse-coaches");
  const coaches = [];
  const rowRe = /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/g;
  let m;
  while ((m = rowRe.exec(section))) coaches.push({ name: decode(m[1]), role: decode(m[2]) });
  return coaches;
}

function parseTeamName(html) {
  const m = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/) || html.match(/<title>\s*([^<|]+)/);
  return m ? decode(m[1]) : "";
}

function parseEvents(html) {
  const section = sliceSection(html, "collapse-events") || html;
  const events = [];
  const blockRe = /<div class="media\s*"[\s\S]*?(?=<div class="media\s*"|$)/g;
  let b;
  while ((b = blockRe.exec(section))) {
    const block = b[0];
    const link = block.match(/href="\/fastpitch\/Events\/Details\/(\d+)\/([^"]*)"/);
    if (!link) continue;
    const nameM = block.match(/<div class="h4">\s*<a href="\/fastpitch\/Events\/Details\/[^"]*">\s*([\s\S]*?)\s*<\/a>/);
    const dateM = block.match(/<div class="h4">\s*([A-Z][a-z]{2}\s[\s\S]*?)\s*<\/div>/);
    const locM = block.match(/<div class="h6">\s*<span>\s*([^<]+?)\s*<\/span>/);
    const typeM = block.match(/<div class="h5 stature">\s*([^<]+?)\s*<\/div>/);
    if (events.some((e) => e.id === link[1])) continue;
    events.push({
      id: link[1],
      name: decode(nameM ? nameM[1] : link[2].replace(/-/g, " ")),
      startDate: decode(dateM ? dateM[1] : ""),
      location: decode(locM ? locM[1] : ""),
      status: decode(typeM ? typeM[1] : "Registered"),
      url: `${NCS_BASE}/fastpitch/Events/Details/${link[1]}/${link[2]}`,
    });
  }
  return events;
}

function parseSelect(html, name) {
  const m = html.match(new RegExp(`name="${name}"[\\s\\S]*?</select>`));
  if (!m) return [];
  const opts = [];
  const optRe = /<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g;
  let o;
  while ((o = optRe.exec(m[0]))) if (o[1]) opts.push({ id: o[1], label: decode(o[2]) });
  return opts;
}

/* ---------------- handlers ---------------- */

async function handleTeamSearch(params) {
  const q = new URLSearchParams();
  q.set("seasonId", params.get("seasonId") || DEFAULT_SEASON);
  q.set("country", params.get("country") || "US");
  q.set("state", params.get("state") || "");
  q.set("usState", params.get("state") || "");
  if (params.get("q")) q.set("teamName", params.get("q"));
  if (params.get("city")) q.set("city", params.get("city"));
  const division = (params.get("division") || "").toLowerCase().replace(/[^0-9a-z]/g, "");
  if (AGE_IDS[division]) q.set("ageId", AGE_IDS[division]);
  const html = await fetchNcs(`/fastpitch/Teams?${q}`);
  return json(parseTeamSearch(html));
}

async function handleRoster(teamId) {
  const html = await fetchNcs(`/fastpitch/Teams/Details/${teamId}/team`);
  const roster = parseRoster(html);
  if (!roster.length && /no players currently on the roster/i.test(html)) {
    return json({ error: "NCS lists no players on this team's roster yet.", team: parseTeamName(html), roster: [] }, 404);
  }
  return json(roster);
}

async function handleTeamEvents(teamId) {
  const html = await fetchNcs(`/fastpitch/Teams/Details/${teamId}/team`);
  return json(parseEvents(html));
}

async function handleEventsSync(request) {
  const body = await request.json().catch(() => ({}));
  const ids = (body.teamIds || []).map(extractId).filter(Boolean);
  if (!ids.length) return json({ error: "No valid NCS team IDs or URLs provided." }, 400);
  const merged = [];
  for (const id of ids) {
    const html = await fetchNcs(`/fastpitch/Teams/Details/${id}/team`);
    for (const e of parseEvents(html)) {
      if (!merged.some((x) => x.id === e.id)) merged.push({ ...e, teamId: id, lastSyncedAt: new Date().toISOString() });
    }
  }
  return json(merged);
}

async function handleOneEventSync(eventId) {
  const html = await fetchNcs(`/fastpitch/Events/Details/${eventId}/event`);
  const name = parseTeamName(html);
  const dateM = html.match(/<div class="h4">\s*([A-Z][a-z]{2}\s[^<]*?)\s*<\/div>/);
  const locM = html.match(/<div class="h6">\s*<span>\s*([^<]+?)\s*<\/span>/);
  const games = [];
  const gameRe = /<a href="\/fastpitch\/Games\/Details\/(\d+)[^"]*"/g;
  let g;
  while ((g = gameRe.exec(html))) if (!games.some((x) => x.id === g[1])) games.push({ id: g[1] });
  return json({
    id: eventId,
    name,
    startDate: decode(dateM ? dateM[1] : ""),
    location: decode(locM ? locM[1] : ""),
    status: "Registered",
    games,
    url: `${NCS_BASE}/fastpitch/Events/Details/${eventId}/event`,
    lastSyncedAt: new Date().toISOString(),
  });
}

/* ---------------- gc_stats D1 cross-reference ---------------- */

const normName = (s) => String(s || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Load the whole cross-reference set (small tables) in one round trip each. */
async function loadGcStats(env) {
  if (!env.GC_STATS) throw new Error("GC_STATS D1 binding is not configured on this Worker.");
  const [players, totals, teams] = await Promise.all([
    env.GC_STATS.prepare("SELECT player_id, name, roster_team FROM players").all(),
    env.GC_STATS.prepare("SELECT player_id, gc_url, season, section, games, stats, updated_at FROM season_totals").all(),
    env.GC_STATS.prepare("SELECT gc_url, gc_name, season, ncs_teams FROM teams").all(),
  ]);
  const statsByPlayer = {};
  for (const row of totals.results) {
    const bucket = (statsByPlayer[row.player_id] ??= { gcUrl: row.gc_url, season: row.season, updatedAt: row.updated_at, sections: {} });
    try { bucket.sections[row.section] = { games: row.games, ...JSON.parse(row.stats) }; } catch (e) { /* skip bad row */ }
  }
  return { players: players.results, statsByPlayer, teams: teams.results };
}

/**
 * Match one website player against gc_stats players.
 * Confidence: "exact" (NCS id), "name" (full normalized name), "partial" (last name + first initial).
 */
function matchPlayer(sitePlayer, gcPlayers) {
  if (sitePlayer.ncsPlayerId) {
    const hit = gcPlayers.find((p) => p.player_id === String(sitePlayer.ncsPlayerId));
    if (hit) return { ...hit, confidence: "exact" };
  }
  const n = normName(sitePlayer.name);
  if (!n) return null;
  const full = gcPlayers.filter((p) => normName(p.name) === n);
  if (full.length === 1) return { ...full[0], confidence: "name" };
  const parts = n.split(" ");
  const last = parts[parts.length - 1], firstInitial = parts[0]?.[0];
  const partial = gcPlayers.filter((p) => {
    const gp = normName(p.name).split(" ");
    return gp[gp.length - 1] === last && gp[0]?.[0] === firstInitial;
  });
  if (partial.length === 1) return { ...partial[0], confidence: "partial" };
  return null;
}

async function handleGcMatch(request, env) {
  const body = await request.json().catch(() => ({}));
  const sitePlayers = body.players || [];
  const { players: gcPlayers, statsByPlayer } = await loadGcStats(env);
  const matches = sitePlayers.map((sp) => {
    const hit = matchPlayer(sp, gcPlayers);
    return {
      playerId: sp.id ?? null,
      name: sp.name ?? "",
      ncsPlayerId: sp.ncsPlayerId || "",
      matched: !!hit,
      matchedNcsPlayerId: hit ? hit.player_id : "",
      matchedName: hit ? hit.name : "",
      rosterTeam: hit ? hit.roster_team : "",
      confidence: hit ? hit.confidence : "none",
      stats: hit ? statsByPlayer[hit.player_id] || null : null,
    };
  });
  return json({ ok: true, source: "gc_stats", matches });
}

async function handleGcSync(request, env) {
  const body = await request.json().catch(() => ({}));
  const sitePlayers = body.players || [];
  const { players: gcPlayers, statsByPlayer, teams } = await loadGcStats(env);
  const stats = {};
  const matches = [];
  for (const sp of sitePlayers) {
    const hit = matchPlayer(sp, gcPlayers);
    if (hit && statsByPlayer[hit.player_id]) stats[hit.player_id] = statsByPlayer[hit.player_id];
    matches.push({
      playerId: sp.id ?? null,
      name: sp.name ?? "",
      matched: !!hit,
      matchedNcsPlayerId: hit ? hit.player_id : "",
      confidence: hit ? hit.confidence : "none",
      rosterTeam: hit ? hit.roster_team : "",
      hasStats: !!(hit && statsByPlayer[hit.player_id]),
    });
  }
  return json({ ok: true, source: "gc_stats", teams, matches, stats });
}

async function handleGcTeams(env) {
  const { teams } = await loadGcStats(env);
  return json(teams.map((t) => ({ ...t, ncs_teams: JSON.parse(t.ncs_teams || "[]") })));
}

async function handleMeta() {
  const html = await fetchNcs("/fastpitch/Teams");
  return json({
    seasons: parseSelect(html, "seasonId"),
    ages: parseSelect(html, "ageId"),
    classifications: parseSelect(html, "classificationId"),
  });
}

async function handleHealth(params, env) {
  const adapter = params.get("adapter") || "health";
  if (adapter === "gamechanger") {
    if (!env.GC_STATS) {
      return json({ adapter, ok: false, mode: "live", detail: "GC_STATS D1 binding missing; GameChanger stats unavailable." });
    }
    try {
      const row = await env.GC_STATS.prepare("SELECT (SELECT COUNT(*) FROM players) p, (SELECT COUNT(*) FROM season_totals) s").first();
      return json({ adapter, ok: true, mode: "live", detail: `GameChanger adapter backed by gc_stats D1 (${row.p} players, ${row.s} season stat rows; keyed by NCS player id).` });
    } catch (e) {
      return json({ adapter, ok: false, mode: "live", detail: "gc_stats D1 query failed: " + e.message });
    }
  }
  return json({ adapter, ok: true, mode: "live", detail: adapter === "ncs" ? `NCS adapter ready (scraping ${NCS_BASE})` : "Integration API reachable" });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, "");
    try {
      if (p === "/api/health") return handleHealth(url.searchParams, env);
      if (p === "/api/ncs/meta") return handleMeta();
      if (p === "/api/gcstats/teams") return handleGcTeams(env);
      if (p === "/api/gcstats/match" && request.method === "POST") return handleGcMatch(request, env);
      if (p === "/api/ncs/teams") return handleTeamSearch(url.searchParams);

      let m;
      if ((m = p.match(/^\/api\/ncs\/teams\/([^/]+)\/roster$/))) {
        const id = extractId(m[1]);
        return id ? handleRoster(id) : json({ error: "Invalid team id" }, 400);
      }
      if ((m = p.match(/^\/api\/ncs\/teams\/([^/]+)\/events$/))) {
        const id = extractId(m[1]);
        return id ? handleTeamEvents(id) : json({ error: "Invalid team id" }, 400);
      }
      if (p === "/api/ncs/events/sync" && request.method === "POST") return handleEventsSync(request);
      if ((m = p.match(/^\/api\/ncs\/events\/([^/]+)\/sync$/)) && request.method === "POST") {
        const id = extractId(m[1]);
        return id ? handleOneEventSync(id) : json({ error: "Invalid event id" }, 400);
      }
      if (p === "/api/gamechanger/sync" && request.method === "POST") {
        return handleGcSync(request, env);
      }
      return json({ error: `Unknown endpoint ${p}` }, 404);
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  },
};
