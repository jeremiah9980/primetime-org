/* Primetime CMS admin dashboard.
   Loads cms/content/primetime-site.json, lets a coach/board member edit every
   section through plain forms, validates against the schema rules, and
   exports an updated JSON file to replace cms/content/primetime-site.json
   before committing + pushing. No backend, no login — see the warning in
   the header and in README-CMS.md about protecting this page if needed. */

var state = null;
var activeTeamId = null;
var TABS = ["org", "board", "teams", "roster", "fundraising", "docs", "policies", "bylaws", "finances", "seo"];

function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function el(tag, attrs, children) {
  var e = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach(function (k) {
    if (k === "class") e.className = attrs[k];
    else if (k === "text") e.textContent = attrs[k];
    else e.setAttribute(k, attrs[k]);
  });
  (children || []).forEach(function (c) { e.appendChild(c); });
  return e;
}

function showStatus(message, type, detail) {
  var banner = $("#status-banner");
  banner.className = "status-banner show " + (type || "");
  banner.innerHTML = "<strong>" + message + "</strong>" + (detail ? "<pre>" + detail + "</pre>" : "");
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(function () { banner.classList.remove("show"); }, 6000);
}

function switchTab(tab) {
  TABS.forEach(function (t) {
    $("#panel-" + t).hidden = t !== tab;
    var btn = $("#tab-" + t);
    if (btn) btn.classList.toggle("active", t === tab);
  });
}

/* ---------------------------------------------------------------- ORG */
function renderOrgPanel() {
  var p = $("#panel-org");
  p.innerHTML = "";
  p.appendChild(el("h2", { class: "cms-section-title", text: "Organization Info" }));
  p.appendChild(el("p", { class: "cms-section-sub", text: "Core org details used across the nav, footer, about page, and contact page." }));

  function field(labelText, path, type) {
    type = type || "text";
    var wrap = el("div");
    wrap.appendChild(el("label", { text: labelText }));
    var input = el(type === "textarea" ? "textarea" : "input", type === "textarea" ? {} : { type: type });
    input.value = getPath(state.org, path) || "";
    input.addEventListener("input", function () { setPath(state.org, path, input.value); });
    wrap.appendChild(input);
    return wrap;
  }

  var grid = el("div", { class: "field-grid" }, [
    field("Organization Name", "name"),
    field("Nickname", "nickname"),
    field("Tagline", "tagline"),
    field("Location", "location"),
    field("Founded Year", "founded"),
    field("General Email", "contact.generalEmail", "email"),
    field("Board Email", "contact.boardEmail", "email"),
    field("Phone", "contact.phone"),
    field("Instagram URL", "social.instagram", "url"),
    field("Facebook URL", "social.facebook", "url"),
  ]);
  p.appendChild(grid);
  p.appendChild(el("div", { class: "field-grid one" }, [field("Mission Statement", "missionStatement", "textarea")]));
}

function getPath(obj, path) {
  return path.split(".").reduce(function (o, k) { return o ? o[k] : undefined; }, obj);
}
function setPath(obj, path, value) {
  var parts = path.split(".");
  var last = parts.pop();
  var target = parts.reduce(function (o, k) { if (!o[k]) o[k] = {}; return o[k]; }, obj);
  target[last] = value;
}

/* ---------------------------------------------------------------- BOARD */
function renderBoardPanel() {
  var p = $("#panel-board");
  p.innerHTML = "";
  p.appendChild(el("h2", { class: "cms-section-title", text: "Board of Directors" }));
  p.appendChild(el("p", { class: "cms-section-sub", text: "Shown on the Board page and rendered as cards." }));
  var list = el("div", { id: "board-list" });
  state.board.forEach(function (member, idx) { list.appendChild(boardRow(member, idx)); });
  p.appendChild(list);
  var addBtn = el("button", { class: "cms-btn add-btn", text: "+ Add Board Member" });
  addBtn.addEventListener("click", function () {
    state.board.push({ role: "", name: "" });
    renderBoardPanel();
  });
  p.appendChild(addBtn);
}
function boardRow(member, idx) {
  var row = el("div", { class: "card-row" });
  var fields = el("div", { class: "fields" });
  var roleInput = el("input", { type: "text", placeholder: "Role" });
  roleInput.value = member.role || "";
  roleInput.addEventListener("input", function () { state.board[idx].role = roleInput.value; });
  var nameInput = el("input", { type: "text", placeholder: "Name" });
  nameInput.value = member.name || "";
  nameInput.addEventListener("input", function () { state.board[idx].name = nameInput.value; });
  fields.appendChild(roleInput);
  fields.appendChild(nameInput);
  row.appendChild(fields);
  var removeBtn = el("button", { class: "remove-btn", text: "Remove" });
  removeBtn.addEventListener("click", function () { state.board.splice(idx, 1); renderBoardPanel(); });
  row.appendChild(removeBtn);
  return row;
}

/* ---------------------------------------------------------------- TEAMS + ROSTER */
function renderTeamsPanel() {
  var p = $("#panel-teams");
  p.innerHTML = "";
  p.appendChild(el("h2", { class: "cms-section-title", text: "Teams" }));
  p.appendChild(el("p", { class: "cms-section-sub", text: "Team identity, head coach, and integration links. Roster editing is on the Roster tab." }));

  var bar = el("div", { class: "team-select-bar" });
  var select = el("select");
  state.teams.forEach(function (t) { select.appendChild(el("option", { value: t.id, text: t.name })); });
  select.value = activeTeamId;
  select.addEventListener("change", function () { activeTeamId = select.value; renderTeamsPanel(); renderRosterPanel(); });
  bar.appendChild(el("label", { text: "Editing team:" }));
  bar.appendChild(select);
  p.appendChild(bar);

  var t = state.teams.find(function (x) { return x.id === activeTeamId; });
  if (!t) return;

  function field(labelText, getFn, setFn, type) {
    type = type || "text";
    var wrap = el("div");
    wrap.appendChild(el("label", { text: labelText }));
    var input = el(type === "textarea" ? "textarea" : "input", type === "textarea" ? {} : { type: type });
    input.value = getFn() || "";
    input.addEventListener("input", function () { setFn(input.value); });
    wrap.appendChild(input);
    return wrap;
  }

  var grid = el("div", { class: "field-grid" }, [
    field("Team Name", function () { return t.name; }, function (v) { t.name = v; }),
    field("Division", function () { return t.division; }, function (v) { t.division = v; }),
    field("Badge (short code)", function () { return t.badge; }, function (v) { t.badge = v; }),
    field("Head Coach Name", function () { return t.headCoach.name; }, function (v) { t.headCoach.name = v; }),
    field("Head Coach Email", function () { return t.headCoach.email; }, function (v) { t.headCoach.email = v; }, "email"),
    field("GameChanger Schedule URL", function () { return t.gamechanger.scheduleUrl; }, function (v) { t.gamechanger.scheduleUrl = v; }, "url"),
    field("GameChanger Stats URL", function () { return t.gamechanger.statsUrl; }, function (v) { t.gamechanger.statsUrl = v; }, "url"),
    field("NCS Team URL", function () { return t.ncs.teamUrl; }, function (v) { t.ncs.teamUrl = v; }, "url"),
  ]);
  p.appendChild(grid);
  p.appendChild(el("div", { class: "field-grid one" }, [
    field("Tagline", function () { return t.tagline; }, function (v) { t.tagline = v; }),
    field("Description", function () { return t.description; }, function (v) { t.description = v; }, "textarea"),
    field("Head Coach Bio", function () { return t.headCoach.bio; }, function (v) { t.headCoach.bio = v; }, "textarea"),
  ]));
}

/* ---------------------------------------------------------------- ROSTER */
function renderRosterPanel() {
  var p = $("#panel-roster");
  p.innerHTML = "";
  p.appendChild(el("h2", { class: "cms-section-title", text: "Roster" }));
  p.appendChild(el("p", { class: "cms-section-sub", text: "Add, edit, or remove players for the team selected on the Teams tab. Or import a CSV (number,name,position,batsThrows)." }));

  var bar = el("div", { class: "team-select-bar" });
  bar.appendChild(el("label", { text: "Team: " + (state.teams.find(function (x) { return x.id === activeTeamId; }) || {}).name }));
  var fileLabel = el("label", { class: "file-input-label", text: "&#128193; Import CSV" });
  fileLabel.innerHTML = "📁 Import CSV";
  var fileInput = el("input", { type: "file", accept: ".csv", style: "display:none;" });
  fileLabel.appendChild(fileInput);
  fileInput.addEventListener("change", handleCsvImport);
  bar.appendChild(fileLabel);
  p.appendChild(bar);

  var t = state.teams.find(function (x) { return x.id === activeTeamId; });
  if (!t) return;

  var table = el("table", { class: "roster-table" });
  var thead = el("thead", {}, [el("tr", {}, ["#", "Name", "Position", "Bats/Throws", ""].map(function (h) { return el("th", { text: h }); }))]);
  table.appendChild(thead);
  var tbody = el("tbody");
  t.roster.forEach(function (player, idx) { tbody.appendChild(rosterRow(t, player, idx)); });
  table.appendChild(tbody);
  p.appendChild(table);

  var addBtn = el("button", { class: "cms-btn add-btn", text: "+ Add Player" });
  addBtn.addEventListener("click", function () {
    t.roster.push({ number: "", name: "", position: "", batsThrows: "" });
    renderRosterPanel();
  });
  p.appendChild(addBtn);
}
function rosterRow(team, player, idx) {
  var tr = el("tr");
  function cell(field, placeholder, width) {
    var td = el("td", { style: width ? "width:" + width + ";" : "" });
    var input = el("input", { type: "text", placeholder: placeholder });
    input.value = player[field] || "";
    input.addEventListener("input", function () { player[field] = input.value; });
    td.appendChild(input);
    return td;
  }
  tr.appendChild(cell("number", "#", "70px"));
  tr.appendChild(cell("name", "Player name"));
  tr.appendChild(cell("position", "POS", "90px"));
  tr.appendChild(cell("batsThrows", "R/R", "90px"));
  var removeTd = el("td");
  var removeBtn = el("button", { class: "remove-btn", text: "Remove" });
  removeBtn.addEventListener("click", function () {
    team.roster.splice(idx, 1);
    renderRosterPanel();
  });
  removeTd.appendChild(removeBtn);
  tr.appendChild(removeTd);
  return tr;
}
function handleCsvImport(ev) {
  var file = ev.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var lines = String(reader.result).split(/\r?\n/).filter(Boolean);
      var header = lines[0].split(",").map(function (h) { return h.trim().toLowerCase(); });
      var rows = lines.slice(1).map(function (line) {
        var cols = line.split(",");
        var row = {};
        header.forEach(function (h, i) { row[h] = (cols[i] || "").trim(); });
        return { number: row.number || "", name: row.name || "", position: row.position || "", batsThrows: row.batsthrows || row["bats/throws"] || "" };
      });
      var t = state.teams.find(function (x) { return x.id === activeTeamId; });
      t.roster = t.roster.concat(rows);
      renderRosterPanel();
      showStatus("Imported " + rows.length + " players from CSV.", "ok");
    } catch (e) {
      showStatus("CSV import failed.", "error", String(e));
    }
  };
  reader.readAsText(file);
}

/* ---------------------------------------------------------------- FUNDRAISING */
function renderFundraisingPanel() {
  var p = $("#panel-fundraising");
  p.innerHTML = "";
  p.appendChild(el("h2", { class: "cms-section-title", text: "Fundraising & Sponsors" }));
  var introWrap = el("div", { class: "field-grid one" });
  var introLabel = el("label", { text: "Fundraising Intro Text" });
  var intro = el("textarea");
  intro.value = state.fundraising.intro || "";
  intro.addEventListener("input", function () { state.fundraising.intro = intro.value; });
  introWrap.appendChild(introLabel);
  introWrap.appendChild(intro);
  p.appendChild(introWrap);

  p.appendChild(el("h3", { text: "Sponsors", style: "margin-top:1.5rem;" }));
  var list = el("div");
  state.fundraising.sponsors.forEach(function (s, idx) { list.appendChild(sponsorRow(s, idx)); });
  p.appendChild(list);
  var addBtn = el("button", { class: "cms-btn add-btn", text: "+ Add Sponsor" });
  addBtn.addEventListener("click", function () {
    state.fundraising.sponsors.push({ name: "", logo: "", url: "" });
    renderFundraisingPanel();
  });
  p.appendChild(addBtn);
}
function sponsorRow(s, idx) {
  var row = el("div", { class: "card-row" });
  var fields = el("div", { class: "fields" });
  ["name", "logo", "url"].forEach(function (f) {
    var input = el("input", { type: "text", placeholder: f === "logo" ? "/images/sponsors/logo.png" : f });
    input.value = s[f] || "";
    input.addEventListener("input", function () { s[f] = input.value; });
    fields.appendChild(input);
  });
  row.appendChild(fields);
  var removeBtn = el("button", { class: "remove-btn", text: "Remove" });
  removeBtn.addEventListener("click", function () { state.fundraising.sponsors.splice(idx, 1); renderFundraisingPanel(); });
  row.appendChild(removeBtn);
  return row;
}

/* ---------------------------------------------------------------- DOCS */
function renderDocsPanel() {
  var p = $("#panel-docs");
  p.innerHTML = "";
  p.appendChild(el("h2", { class: "cms-section-title", text: "Docs & Downloads" }));
  p.appendChild(el("p", { class: "cms-section-sub", text: "Listed on the Docs page. Point url at a file in public/documents/." }));
  var list = el("div");
  state.docs.forEach(function (d, idx) { list.appendChild(docRow(d, idx)); });
  p.appendChild(list);
  var addBtn = el("button", { class: "cms-btn add-btn", text: "+ Add Document" });
  addBtn.addEventListener("click", function () { state.docs.push({ name: "", description: "", url: "" }); renderDocsPanel(); });
  p.appendChild(addBtn);
}
function docRow(d, idx) {
  var row = el("div", { class: "card-row" });
  var fields = el("div", { class: "fields" });
  ["name", "description", "url"].forEach(function (f) {
    var input = el("input", { type: "text", placeholder: f === "url" ? "public/documents/file.pdf" : f });
    input.value = d[f] || "";
    input.addEventListener("input", function () { d[f] = input.value; });
    fields.appendChild(input);
  });
  row.appendChild(fields);
  var removeBtn = el("button", { class: "remove-btn", text: "Remove" });
  removeBtn.addEventListener("click", function () { state.docs.splice(idx, 1); renderDocsPanel(); });
  row.appendChild(removeBtn);
  return row;
}

/* ---------------------------------------------------------------- TEXT BLOCK PANELS (policies/bylaws/finances/seo) */
function renderTextBlockPanel(panelId, sectionKey, title, sub, fields) {
  var p = $("#panel-" + panelId);
  p.innerHTML = "";
  p.appendChild(el("h2", { class: "cms-section-title", text: title }));
  p.appendChild(el("p", { class: "cms-section-sub", text: sub }));
  fields.forEach(function (f) {
    var wrap = el("div", { class: "field-grid one" });
    wrap.appendChild(el("label", { text: f.label }));
    var input = el("textarea");
    input.value = state[sectionKey][f.key] || "";
    input.addEventListener("input", function () { state[sectionKey][f.key] = input.value; });
    wrap.appendChild(input);
    p.appendChild(wrap);
  });
}
function renderPoliciesPanel() {
  renderTextBlockPanel("policies", "policies", "Policies & Code of Conduct", "Shown on the Policies page.", [
    { key: "playerConduct", label: "Player Conduct" },
    { key: "parentConduct", label: "Parent/Guardian Conduct" },
    { key: "attendance", label: "Attendance & Commitment" },
    { key: "playingTime", label: "Playing Time" },
    { key: "grievance", label: "Grievance Process" },
  ]);
}
function renderBylawsPanel() {
  renderTextBlockPanel("bylaws", "bylaws", "Bylaws", "Shown on the Bylaws page.", [
    { key: "purpose", label: "Article I — Purpose" },
    { key: "membership", label: "Article II — Membership" },
    { key: "governance", label: "Article III — Board of Directors" },
    { key: "meetings", label: "Article IV — Meetings" },
    { key: "amendments", label: "Article V — Amendments" },
  ]);
}
function renderFinancesPanel() {
  renderTextBlockPanel("finances", "finances", "Finances", "Shown on the Finances page.", [
    { key: "seasonFees", label: "Season Fees" },
    { key: "whereFundsGo", label: "Where Fundraising Goes" },
    { key: "budgetSummary", label: "Budget Summary" },
  ]);
}
function renderSeoPanel() {
  renderTextBlockPanel("seo", "seo", "SEO", "Used in page <meta> descriptions (manual for now).", [
    { key: "description", label: "Site Description" },
    { key: "keywords", label: "Keywords (comma separated)" },
  ]);
}

/* ---------------------------------------------------------------- VALIDATE / EXPORT / LOAD */
function validate() {
  var errors = [];
  if (!state.org.name) errors.push("Org name is required.");
  if (!state.org.contact.generalEmail) errors.push("General contact email is required.");
  if (!state.teams.length) errors.push("At least one team is required.");
  state.teams.forEach(function (t) {
    if (!t.id) errors.push("A team is missing its id.");
    if (!/^[a-z0-9-]+$/.test(t.id || "")) errors.push('Team id "' + t.id + '" must be lowercase letters/numbers/hyphens only.');
    if (!t.name) errors.push('Team "' + t.id + '" is missing a name.');
    (t.roster || []).forEach(function (p, i) {
      if (!p.name) errors.push('Team "' + t.id + '" roster row ' + (i + 1) + " is missing a player name.");
    });
  });
  state.board.forEach(function (m, i) {
    if (!m.role) errors.push("Board row " + (i + 1) + " is missing a role.");
  });
  if (errors.length) {
    showStatus(errors.length + " validation issue(s) found:", "error", errors.join("\n"));
    return false;
  }
  showStatus("Validation passed — content looks good.", "ok");
  return true;
}

function exportJson() {
  var ok = validate();
  var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "primetime-site.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  showStatus((ok ? "Exported" : "Exported with warnings") + " — replace cms/content/primetime-site.json with this file, then commit & push.", ok ? "ok" : "error");
}

function loadFromFile(ev) {
  var file = ev.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      state = JSON.parse(String(reader.result));
      activeTeamId = state.teams[0] && state.teams[0].id;
      renderAll();
      showStatus("Loaded content from file.", "ok");
    } catch (e) {
      showStatus("Could not parse that file as JSON.", "error", String(e));
    }
  };
  reader.readAsText(file);
}

function renderAll() {
  renderOrgPanel();
  renderBoardPanel();
  renderTeamsPanel();
  renderRosterPanel();
  renderFundraisingPanel();
  renderDocsPanel();
  renderPoliciesPanel();
  renderBylawsPanel();
  renderFinancesPanel();
  renderSeoPanel();
}

function init() {
  TABS.forEach(function (t) {
    var btn = $("#tab-" + t);
    if (btn) btn.addEventListener("click", function () { switchTab(t); });
  });
  $("#btn-validate").addEventListener("click", validate);
  $("#btn-export").addEventListener("click", exportJson);
  $("#file-load").addEventListener("change", loadFromFile);

  fetch("../content/primetime-site.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state = data;
      activeTeamId = (state.teams[0] || {}).id;
      renderAll();
      switchTab("org");
    })
    .catch(function (err) {
      showStatus("Could not load cms/content/primetime-site.json. Serve this folder over HTTP (e.g. npx serve .) rather than opening it from disk.", "error", String(err));
    });
}

document.addEventListener("DOMContentLoaded", init);
