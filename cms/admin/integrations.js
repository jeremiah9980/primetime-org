/* Primetime Integration Center.
   All state lives in localStorage as a per-team draft; nothing here writes to the
   repo directly. "Export site JSON" merges rosters into cms/content/primetime-site.json
   format for the normal commit workflow. Demo mode fakes every adapter call so the
   full workflow can be exercised before the integration Worker exists. */
(function () {
  "use strict";

  var KEY = "primetime_integrations_v1";
  // Deployed from integrations-worker/ — scrapes playncs.com server-side and
  // returns JSON with CORS (the NCS site has no API and no CORS headers).
  var DEFAULT_API = "https://primetime-integrations.jeremiahcargill.workers.dev";
  var FALLBACK_TEAMS = [
    { id: "primetime-10u", name: "Primetime 10U" },
    { id: "primetime-12u", name: "Primetime 12U" },
    { id: "primetime-elite-12u", name: "Primetime Elite 12U" }
  ];

  function teamBucket() {
    var id = state.activeTeam;
    if (!state.teams[id]) state.teams[id] = { players: [], tournamentTeamIds: [], events: [], ncsTeamId: "", gamechanger: { teamId: "", seasonId: "", visibility: "public" } };
    return state.teams[id];
  }

  var defaults = {
    demoMode: false,
    apiBaseUrl: DEFAULT_API,
    activeTeam: "primetime-10u",
    ncs: { baseSearchUrl: "https://playncs.com/fastpitch/Teams", seasonId: "33", query: "", division: "", country: "US", state: "TX" },
    sync: { intervalMinutes: 15, timezone: "America/Chicago", enabled: false },
    policy: { requireManualMatchApproval: true, preserveManualEdits: true, publishStats: true, archiveRemovedPlayers: true },
    teams: {},
    activity: []
  };

  var state;
  try { state = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { state = null; }
  state = Object.assign(structuredClone(defaults), state || {});
  // Migrate drafts saved before the live NCS adapter existed: they have no API
  // URL and demo mode on, so point them at the deployed Worker and go live.
  if (!state.apiBaseUrl) { state.apiBaseUrl = DEFAULT_API; state.demoMode = false; }
  if (!state.ncs.seasonId) state.ncs.seasonId = "33";
  var siteTeams = FALLBACK_TEAMS;

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); };
  var get = function (o, p) { return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
  var set = function (o, p, v) { var a = p.split("."), k = a.pop(), t = a.reduce(function (x, y) { if (x[y] == null) x[y] = {}; return x[y]; }, o); t[k] = v; };
  var uid = function (p) { return p + "-" + Date.now() + "-" + Math.random().toString(16).slice(2, 7); };
  var now = function () { return new Date().toLocaleString(); };

  function save(msg) {
    localStorage.setItem(KEY, JSON.stringify(state));
    $("#saveStatus").textContent = msg || "Saved locally";
    renderMetrics(); renderReadiness();
  }
  function logActivity(message) {
    state.activity.push({ message: message, at: now(), team: state.activeTeam });
  }

  /* ---- Adapter layer: demo mode fakes; live mode hits the integration Worker ---- */

  var DEMO_TEAMS = [
    { id: "ncs-84121", name: "Primetime 10U", division: "10U", location: "TX" },
    { id: "ncs-87310", name: "Primetime 12U", division: "12U", location: "TX" },
    { id: "ncs-87455", name: "Primetime Elite 12U", division: "12U", location: "TX" },
    { id: "ncs-88102", name: "TX Crush Fastpitch", division: "12U", location: "TX" }
  ];
  var DEMO_ROSTER = [
    { id: "318601", name: "Avery Johnson", number: "3", position: "P" },
    { id: "318602", name: "Riley Sanchez", number: "7", position: "C" },
    { id: "318603", name: "Harper Nguyen", number: "12", position: "SS" },
    { id: "318604", name: "Peyton Brooks", number: "21", position: "CF" },
    { id: "318605", name: "Emerson Hale", number: "24", position: "1B" }
  ];
  function demoEvents(teamIds) {
    return teamIds.filter(Boolean).map(function (id, i) {
      return {
        id: "evt-" + i + "-" + String(id).replace(/\W+/g, "").slice(-6),
        name: ["Lone Star Kickoff", "Gold Glove Classic", "Primetime Invitational"][i % 3],
        startDate: ["2026-08-01", "2026-08-15", "2026-09-05"][i % 3],
        location: ["Round Rock, TX", "Waco, TX", "Frisco, TX"][i % 3],
        status: "Registered",
        lastSyncedAt: now(),
        games: [{ opponent: "TX Crush", time: "9:00 AM" }, { opponent: "Aces Fastpitch", time: "12:30 PM" }]
      };
    });
  }

  function api(path, options) {
    var base = (state.apiBaseUrl || "").replace(/\/$/, "");
    if (!base) return Promise.reject(new Error("Set the Integration API base URL first (Integration Settings), or turn on demo mode."));
    options = options || {};
    options.headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    return fetch(base + path, options).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        var msg = t || ("HTTP " + r.status);
        try { msg = JSON.parse(t).error || msg; } catch (e) { /* not JSON */ }
        throw new Error(msg);
      });
      return r.json();
    });
  }

  var adapters = {
    searchTeams: function () {
      if (state.demoMode) {
        var q = (state.ncs.query || "").toLowerCase();
        return Promise.resolve(DEMO_TEAMS.filter(function (t) { return !q || t.name.toLowerCase().indexOf(q) >= 0; }));
      }
      var qs = new URLSearchParams({ q: state.ncs.query || "", division: state.ncs.division || "", state: state.ncs.state || "", country: state.ncs.country || "", seasonId: state.ncs.seasonId || "" });
      return api("/api/ncs/teams?" + qs);
    },
    fetchRoster: function (teamId) {
      if (state.demoMode) return Promise.resolve(DEMO_ROSTER);
      return api("/api/ncs/teams/" + encodeURIComponent(teamId) + "/roster");
    },
    syncStats: function (bucket) {
      if (state.demoMode) {
        var stats = {};
        bucket.players.forEach(function (p, i) {
          if (p.gameChangerPlayerId) stats[p.gameChangerPlayerId] = { avg: (0.280 + i * 0.02).toFixed(3), hits: 10 + i * 3, rbi: 6 + i * 2 };
        });
        return Promise.resolve({ stats: stats });
      }
      return api("/api/gamechanger/sync", { method: "POST", body: JSON.stringify({ teamId: bucket.gamechanger.teamId, seasonId: bucket.gamechanger.seasonId, players: bucket.players }) });
    },
    syncEvents: function (bucket) {
      if (state.demoMode) return Promise.resolve(demoEvents(bucket.tournamentTeamIds));
      return api("/api/ncs/events/sync", { method: "POST", body: JSON.stringify({ teamIds: bucket.tournamentTeamIds }) });
    },
    syncOneEvent: function (eventId) {
      if (state.demoMode) {
        var e = teamBucket().events.find(function (x) { return x.id === eventId; });
        return Promise.resolve(Object.assign({}, e, { lastSyncedAt: now() }));
      }
      return api("/api/ncs/events/" + encodeURIComponent(eventId) + "/sync", { method: "POST" });
    },
    testConnection: function (adapter) {
      if (state.demoMode) return Promise.resolve({ adapter: adapter, ok: true, mode: "demo", detail: "Demo mode: no external call made." });
      return api("/api/health?adapter=" + encodeURIComponent(adapter));
    }
  };

  /* ---- Navigation & header ---- */

  var VIEW_META = {
    overview: ["Integration Overview", "Connect roster, statistics, tournaments, and live game data."],
    ncs: ["NCS Roster Import", "Find an authorized team roster and review it before import."],
    roster: ["Roster Mapping", "Edit player profiles and map identities across systems."],
    gamechanger: ["GameChanger Stats", "Configure team stats and approve player matches."],
    tournaments: ["Tournament Sync", "Import registered events for one or more NCS teams."],
    trackers: ["Game Trackers", "Monitor each event schedule and bracket separately."],
    diagnostics: ["Diagnostics", "Test and triage every integration connection."],
    settings: ["Integration Settings", "Control service endpoints, cadence, and data policy."]
  };

  function nav(view) {
    $$(".view").forEach(function (x) { x.classList.toggle("active", x.id === view); });
    $$("[data-view]").forEach(function (x) { x.classList.toggle("active", x.dataset.view === view); });
    var meta = VIEW_META[view];
    $("#pageTitle").textContent = meta[0];
    $("#pageDescription").textContent = meta[1];
  }

  function teamName(id) {
    var t = siteTeams.find(function (x) { return x.id === id; });
    return t ? t.name : id;
  }

  function renderTeamPicker() {
    $("#activeTeam").innerHTML = siteTeams.map(function (t) {
      return '<option value="' + esc(t.id) + '"' + (t.id === state.activeTeam ? " selected" : "") + ">" + esc(t.name) + "</option>";
    }).join("");
    $("#teamEyebrow").textContent = teamName(state.activeTeam);
  }

  /* ---- Overview ---- */

  function renderMetrics() {
    var b = teamBucket();
    $("#ncsMetric").textContent = b.ncsTeamId || "Not connected";
    $("#gcMetric").textContent = b.gamechanger.teamId || "Not connected";
    $("#teamMetric").textContent = b.tournamentTeamIds.filter(Boolean).length;
    $("#intervalMetric").textContent = (state.sync.intervalMinutes || 15) + " min";
  }

  function renderReadiness() {
    var b = teamBucket();
    var checks = [
      ["Integration API", state.demoMode || !!state.apiBaseUrl],
      ["NCS team", !!b.ncsTeamId],
      ["GameChanger team", !!b.gamechanger.teamId],
      ["Tournament teams", b.tournamentTeamIds.filter(Boolean).length > 0],
      ["Roster imported", b.players.length > 0]
    ];
    $("#readiness").innerHTML = checks.map(function (c) { return "<p>" + (c[1] ? "✅" : "⬜") + " " + esc(c[0]) + "</p>"; }).join("");
    var recent = state.activity.length ? state.activity.slice(-6).reverse() : [{ message: "No sync activity yet", at: "" }];
    $("#activity").innerHTML = recent.map(function (a) {
      return "<div><strong>" + esc(a.message) + "</strong><small>" + esc((a.team ? teamName(a.team) + " · " : "") + (a.at || "")) + "</small></div>";
    }).join("");
  }

  /* ---- NCS import ---- */

  function searchNcs() {
    $("#ncsResults").textContent = "Searching…";
    adapters.searchTeams().then(function (teams) {
      $("#ncsResults").classList.remove("empty");
      $("#ncsResults").innerHTML = teams.map(function (t) {
        return '<button data-ncs-team="' + esc(t.id) + '"><strong>' + esc(t.name) + "</strong><span>" + esc((t.division || "") + " · " + (t.location || "")) + "</span></button>";
      }).join("") || "No teams found.";
      $$("[data-ncs-team]").forEach(function (x) { x.onclick = function () { loadNcsRoster(x.dataset.ncsTeam); }; });
    }).catch(function (e) { $("#ncsResults").textContent = e.message; });
  }

  function loadNcsRoster(id) {
    teamBucket().ncsTeamId = id;
    $("#ncsTeamId").value = id;
    $("#ncsRosterPreview").textContent = "Loading roster…";
    adapters.fetchRoster(id).then(function (roster) {
      $("#ncsRosterPreview").classList.remove("empty");
      $("#ncsRosterPreview").innerHTML = roster.map(function (p, i) {
        return '<label><input type="checkbox" data-import-player="' + i + '" checked> #' + esc(p.number || "") + " " + esc(p.name) + " — " + esc(p.position || "") + "</label>";
      }).join("");
      $("#ncsRosterPreview").dataset.payload = JSON.stringify(roster);
      $("#importSelected").disabled = false;
      save("NCS team selected");
    }).catch(function (e) { $("#ncsRosterPreview").textContent = e.message; });
  }

  function importSelected() {
    var b = teamBucket();
    var roster = JSON.parse($("#ncsRosterPreview").dataset.payload || "[]");
    var selected = {};
    $$("[data-import-player]").forEach(function (x) { if (x.checked) selected[x.dataset.importPlayer] = true; });
    var count = 0;
    roster.forEach(function (p, i) {
      if (!selected[i]) return;
      count++;
      var existing = b.players.find(function (x) { return x.ncsPlayerId && x.ncsPlayerId === p.id; });
      if (existing && state.policy.preserveManualEdits) { existing.ncsSource = p; return; }
      if (!existing) b.players.push({ id: uid("player"), name: p.name || "", number: p.number || "", position: p.position || "", photo: p.photo || "", bio: "", ncsPlayerId: p.id || "", gameChangerPlayerId: "", ncsSource: p });
    });
    logActivity("Imported " + count + " NCS roster players");
    renderPlayers(); save("Roster imported"); nav("roster");
  }

  /* ---- Roster mapping ---- */

  function playerCard(p, i) {
    var b = teamBucket();
    var t = $("#playerTemplate").content.cloneNode(true);
    var img = t.querySelector("[data-field=photo]");
    img.src = p.photo || "";
    img.alt = p.name || "Player photo";
    t.querySelectorAll("[data-input]").forEach(function (el) {
      var k = el.dataset.input;
      el.value = p[k] || "";
      el.oninput = function () {
        b.players[i][k] = el.value;
        if (k === "photo") img.src = el.value;
        save("Unsaved roster draft");
      };
    });
    t.querySelector("[data-match-status]").textContent = p.gameChangerPlayerId ? "GameChanger mapped" : (p.ncsPlayerId ? "NCS mapped" : "Unmapped");
    t.querySelector("[data-remove]").onclick = function () {
      if (confirm("Remove " + (p.name || "this player") + "?")) { b.players.splice(i, 1); renderPlayers(); save(); }
    };
    return t;
  }

  function renderPlayers() {
    var b = teamBucket();
    var el = $("#playerEditor");
    el.innerHTML = "";
    b.players.forEach(function (p, i) { el.appendChild(playerCard(p, i)); });
    if (!b.players.length) el.innerHTML = '<article class="card empty">No players yet. Import from NCS or add one manually.</article>';
    renderMatches();
  }

  function renderMatches() {
    var b = teamBucket();
    var rows = b.players.map(function (p) {
      return "<tr><td>" + esc(p.name) + "</td><td>#" + esc(p.number) + "</td><td>" + esc(p.ncsPlayerId || "—") +
        '</td><td><input value="' + esc(p.gameChangerPlayerId || "") + '" data-gc-player="' + esc(p.id) + '" placeholder="GameChanger player ID"></td><td>' +
        (p.gameChangerPlayerId ? "Approved" : "Needs review") + "</td></tr>";
    }).join("");
    $("#matchTable").innerHTML = "<table><thead><tr><th>Website player</th><th>#</th><th>NCS ID</th><th>GameChanger ID</th><th>Status</th></tr></thead><tbody>" +
      (rows || '<tr><td colspan="5">Import the roster first.</td></tr>') + "</tbody></table>";
    $$("[data-gc-player]").forEach(function (x) {
      x.oninput = function () {
        var p = teamBucket().players.find(function (y) { return y.id === x.dataset.gcPlayer; });
        if (p) { p.gameChangerPlayerId = x.value; save("Mapping draft saved"); }
      };
    });
  }

  /* ---- GameChanger ---- */

  function bindGamechanger() {
    var b = teamBucket();
    $("#gcTeamId").value = b.gamechanger.teamId || "";
    $("#gcSeasonId").value = b.gamechanger.seasonId || "";
    $("#gcVisibility").value = b.gamechanger.visibility || "public";
    $("#gcTeamId").oninput = function (e) { teamBucket().gamechanger.teamId = e.target.value; save("GameChanger settings saved"); };
    $("#gcSeasonId").oninput = function (e) { teamBucket().gamechanger.seasonId = e.target.value; save("GameChanger settings saved"); };
    $("#gcVisibility").onchange = function (e) { teamBucket().gamechanger.visibility = e.target.value; save("GameChanger settings saved"); };
  }

  function syncStats() {
    var b = teamBucket();
    adapters.syncStats(b).then(function (result) {
      b.players = b.players.map(function (p) {
        var s = result.stats && result.stats[p.gameChangerPlayerId];
        return s ? Object.assign({}, p, { stats: s }) : p;
      });
      logActivity("GameChanger stats synchronized");
      save("Stats synchronized"); renderPlayers();
    }).catch(function (e) { alert(e.message); });
  }

  /* ---- Tournaments & trackers ---- */

  function renderTournamentTeams() {
    var b = teamBucket();
    var el = $("#tournamentTeams");
    el.innerHTML = b.tournamentTeamIds.map(function (id, i) {
      return '<article class="card"><div class="section-head compact"><strong>NCS Team ' + (i + 1) +
        '</strong><button class="danger" data-remove-team="' + i + '">Remove</button></div><input value="' + esc(id) + '" data-team-id="' + i + '" placeholder="NCS team ID or team URL"></article>';
    }).join("") || '<article class="card empty">Add at least one NCS team ID.</article>';
    $$("[data-team-id]").forEach(function (x) { x.oninput = function () { teamBucket().tournamentTeamIds[+x.dataset.teamId] = x.value; save("Team IDs saved"); }; });
    $$("[data-remove-team]").forEach(function (x) { x.onclick = function () { teamBucket().tournamentTeamIds.splice(+x.dataset.removeTeam, 1); renderTournamentTeams(); save(); }; });
    renderEvents(); renderTrackers();
  }

  function renderEvents() {
    var rows = teamBucket().events.map(function (e) {
      return "<tr><td>" + esc(e.name) + "</td><td>" + esc(e.startDate || "") + "</td><td>" + esc(e.location || "") + "</td><td>" + esc(e.status || "") + "</td><td>" + esc(e.lastSyncedAt || "Never") + "</td></tr>";
    }).join("");
    $("#eventTable").innerHTML = "<table><thead><tr><th>Event</th><th>Starts</th><th>Location</th><th>Status</th><th>Last sync</th></tr></thead><tbody>" +
      (rows || '<tr><td colspan="5">No imported events.</td></tr>') + "</tbody></table>";
  }

  function renderTrackers() {
    $("#trackerGrid").innerHTML = teamBucket().events.map(function (e) {
      return '<article class="card"><p class="eyebrow">' + esc(e.status || "Registered") + "</p><h3>" + esc(e.name) + "</h3><p>" + esc(e.location || "Location pending") +
        "</p><p><strong>" + (e.games || []).length + '</strong> scheduled games</p><button data-sync-event="' + esc(e.id) + '">Refresh tracker</button></article>';
    }).join("") || '<article class="card empty">Imported tournaments will create trackers here.</article>';
    $$("[data-sync-event]").forEach(function (x) { x.onclick = function () { syncOneEvent(x.dataset.syncEvent); }; });
  }

  function syncEvents() {
    var b = teamBucket();
    adapters.syncEvents(b).then(function (events) {
      b.events = events;
      logActivity("Synchronized " + events.length + " tournament events");
      save("Events synchronized"); renderEvents(); renderTrackers();
    }).catch(function (e) { alert(e.message); });
  }

  function syncOneEvent(id) {
    adapters.syncOneEvent(id).then(function (event) {
      var b = teamBucket();
      var i = b.events.findIndex(function (x) { return x.id === id; });
      if (i >= 0) b.events[i] = event;
      save("Tracker refreshed"); renderEvents(); renderTrackers();
    }).catch(function (e) { alert(e.message); });
  }

  /* ---- Diagnostics ---- */

  function runAllTests() {
    var b = teamBucket();
    $("#diagnosticResults").innerHTML = "<div>Running diagnostics…</div>";
    var local = [
      { name: "Local draft storage", run: function () { localStorage.setItem(KEY + "_probe", "1"); localStorage.removeItem(KEY + "_probe"); return "Read/write OK"; } },
      { name: "NCS team configured", run: function () { if (!b.ncsTeamId) throw new Error("No NCS team selected for " + teamName(state.activeTeam)); return b.ncsTeamId; } },
      { name: "GameChanger team configured", run: function () { if (!b.gamechanger.teamId) throw new Error("No GameChanger team ID set"); return b.gamechanger.teamId; } },
      { name: "Roster players present", run: function () { if (!b.players.length) throw new Error("Roster is empty — import or add players"); return b.players.length + " players"; } },
      { name: "All players GameChanger-mapped", run: function () { var un = b.players.filter(function (p) { return !p.gameChangerPlayerId; }).length; if (un) throw new Error(un + " unmapped player(s)"); return "All mapped"; } }
    ];
    var results = local.map(function (t) {
      try { return { name: t.name, ok: true, detail: t.run() }; }
      catch (e) { return { name: t.name, ok: false, detail: e.message }; }
    });
    var remote = ["health", "ncs", "gamechanger"].map(function (a) {
      return adapters.testConnection(a)
        .then(function (r) { return { name: "Adapter: " + a, ok: r.ok !== false, detail: r.detail || JSON.stringify(r) }; })
        .catch(function (e) { return { name: "Adapter: " + a, ok: false, detail: e.message }; });
    });
    Promise.all(remote).then(function (remoteResults) {
      var all = results.concat(remoteResults);
      var passed = all.filter(function (r) { return r.ok; }).length;
      $("#diagnosticSummary").innerHTML =
        '<article class="' + (passed === all.length ? "ok" : "") + '"><span>Passed</span><strong>' + passed + "</strong></article>" +
        '<article class="' + (passed === all.length ? "" : "bad") + '"><span>Failed</span><strong>' + (all.length - passed) + "</strong></article>" +
        "<article><span>Mode</span><strong>" + (state.demoMode ? "Demo" : "Live") + "</strong></article>";
      $("#diagnosticResults").innerHTML = all.map(function (r) {
        return '<div class="' + (r.ok ? "pass" : "fail") + '"><strong>' + (r.ok ? "✅" : "❌") + " " + esc(r.name) + "</strong><small>" + esc(r.detail) + "</small></div>";
      }).join("");
      logActivity("Diagnostics run: " + passed + "/" + all.length + " passed");
      save("Diagnostics complete");
    });
  }

  /* ---- Settings & config binding ---- */

  function bindConfig() {
    $$("[data-config]").forEach(function (el) {
      var p = el.dataset.config, v = get(state, p);
      if (el.type === "checkbox") el.checked = !!v; else el.value = v == null ? "" : v;
      el.oninput = function () {
        set(state, p, el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value);
        if (p === "demoMode") renderReadiness();
        save("Configuration draft saved");
      };
    });
    $("#ncsQuery").value = state.ncs.query || "";
    $("#ncsDivision").value = state.ncs.division || "";
    $("#ncsState").value = state.ncs.state || "";
    $("#ncsTeamId").value = teamBucket().ncsTeamId || "";
    $("#ncsQuery").oninput = function (e) { state.ncs.query = e.target.value; save("NCS settings saved"); };
    $("#ncsDivision").oninput = function (e) { state.ncs.division = e.target.value; save("NCS settings saved"); };
    $("#ncsState").oninput = function (e) { state.ncs.state = e.target.value; save("NCS settings saved"); };
    $("#ncsTeamId").oninput = function (e) { teamBucket().ncsTeamId = e.target.value; save("NCS settings saved"); };
  }

  /* ---- Exports ---- */

  function download(name, text) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportSiteJson() {
    fetch("../content/primetime-site.json").then(function (r) {
      if (!r.ok) throw new Error("Could not load ../content/primetime-site.json (serve the site with `npx serve .`)");
      return r.json();
    }).then(function (site) {
      (site.teams || []).forEach(function (team) {
        var bucket = state.teams[team.id];
        if (!bucket || !bucket.players.length) return;
        team.roster = bucket.players.map(function (p) {
          return { number: p.number || "", name: p.name || "", position: p.position || "", batsThrows: p.batsThrows || "", photo: p.photo || "", bio: p.bio || "", ncsPlayerId: p.ncsPlayerId || "", gameChangerPlayerId: p.gameChangerPlayerId || "" };
        });
        if (bucket.ncsTeamId) team.ncs = Object.assign({}, team.ncs, { teamId: bucket.ncsTeamId });
        if (bucket.gamechanger.teamId) team.gamechanger = Object.assign({}, team.gamechanger, { teamId: bucket.gamechanger.teamId });
      });
      download("primetime-site.json", JSON.stringify(site, null, 2));
      logActivity("Exported site JSON with integration rosters");
      save("Site JSON exported");
    }).catch(function (e) { alert(e.message); });
  }

  /* ---- Wiring ---- */

  function renderAll() {
    renderTeamPicker(); renderMetrics(); renderReadiness(); renderPlayers(); renderTournamentTeams(); bindGamechanger();
    $("#ncsTeamId").value = teamBucket().ncsTeamId || "";
  }

  $$("[data-view]").forEach(function (x) { x.onclick = function () { nav(x.dataset.view); }; });
  $("#activeTeam").onchange = function (e) {
    state.activeTeam = e.target.value;
    $("#ncsRosterPreview").textContent = "Select an NCS team to preview its roster.";
    $("#importSelected").disabled = true;
    renderAll(); save("Switched to " + teamName(state.activeTeam));
  };
  $("#saveLocal").onclick = function () { save(); };
  $("#exportConfig").onclick = function () { download("primetime-integrations.json", JSON.stringify(state, null, 2)); };
  $("#exportSiteJson").onclick = exportSiteJson;
  $("#addPlayer").onclick = function () { teamBucket().players.push({ id: uid("player"), name: "New Player", number: "", position: "", photo: "", bio: "", ncsPlayerId: "", gameChangerPlayerId: "" }); renderPlayers(); save(); };
  $("#addTournamentTeam").onclick = function () { teamBucket().tournamentTeamIds.push(""); renderTournamentTeams(); save(); };
  $("#searchNcs").onclick = searchNcs;
  $("#importSelected").onclick = importSelected;
  $("#syncStats").onclick = syncStats;
  $("#syncEvents").onclick = syncEvents;
  $("#runAllTests").onclick = runAllTests;
  $$("[data-test]").forEach(function (x) {
    x.onclick = function () {
      $("#testOutput").textContent = "Testing " + x.dataset.test + "…";
      adapters.testConnection(x.dataset.test)
        .then(function (r) { $("#testOutput").textContent = JSON.stringify(r, null, 2); })
        .catch(function (e) { $("#testOutput").textContent = e.message; });
    };
  });

  // Pull real team list from the site content so new teams show up automatically.
  fetch("../content/primetime-site.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (site) {
    if (site && Array.isArray(site.teams) && site.teams.length) {
      siteTeams = site.teams.map(function (t) { return { id: t.id, name: t.name }; });
      if (!siteTeams.some(function (t) { return t.id === state.activeTeam; })) state.activeTeam = siteTeams[0].id;
    }
  }).catch(function () {}).then(function () {
    bindConfig(); renderAll(); nav("overview");
  });
})();
