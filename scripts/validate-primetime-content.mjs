#!/usr/bin/env node
// Validates cms/content/primetime-site.json against cms/schema/primetime-site.schema.json
// plus a few hand-written rules the JSON Schema alone can't express cleanly.
// Usage: node scripts/validate-primetime-content.mjs [path-to-json]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentPath = process.argv[2] || path.join(__dirname, "..", "cms", "content", "primetime-site.json");
const schemaPath = path.join(__dirname, "..", "cms", "schema", "primetime-site.schema.json");

function loadJson(p, label) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`✖ Could not read/parse ${label} at ${p}\n  ${e.message}`);
    process.exit(1);
  }
}

const data = loadJson(contentPath, "content file");
loadJson(schemaPath, "schema file"); // presence/shape check only; no external validator dependency

const errors = [];
const warnings = [];

function req(cond, msg) { if (!cond) errors.push(msg); }
function warn(cond, msg) { if (!cond) warnings.push(msg); }

req(data.org && data.org.name, "org.name is required");
req(data.org && data.org.contact && data.org.contact.generalEmail, "org.contact.generalEmail is required");
req(Array.isArray(data.teams) && data.teams.length > 0, "teams must be a non-empty array");

const seenIds = new Set();
(data.teams || []).forEach((t, i) => {
  req(t.id, `teams[${i}].id is required`);
  req(/^[a-z0-9-]+$/.test(t.id || ""), `teams[${i}].id "${t.id}" must be lowercase letters/numbers/hyphens only`);
  req(!seenIds.has(t.id), `teams[${i}].id "${t.id}" is duplicated`);
  seenIds.add(t.id);
  req(t.name, `teams[${i}].name is required`);
  req(Array.isArray(t.roster), `teams[${i}].roster must be an array (can be empty)`);
  (t.roster || []).forEach((p, j) => {
    req(p.name, `teams[${i}] ("${t.id}") roster[${j}] is missing a player name`);
    warn(p.number, `teams[${i}] ("${t.id}") roster[${j}] ("${p.name}") has no jersey number`);
    warn(p.position, `teams[${i}] ("${t.id}") roster[${j}] ("${p.name}") has no position`);
  });
  warn(t.headCoach && t.headCoach.name && !/ENTER/.test(t.headCoach.name), `teams[${i}] ("${t.id}") head coach is still a placeholder`);
});

(data.board || []).forEach((m, i) => {
  req(m.role, `board[${i}] is missing a role`);
  warn(m.name && !/ENTER/.test(m.name), `board[${i}] ("${m.role}") name is still a placeholder`);
});

// Guard against accidentally publishing a placeholder-only site
const placeholderCount = JSON.stringify(data).split("[ENTER").length - 1;
warn(placeholderCount === 0, `${placeholderCount} "[ENTER ...]" placeholder value(s) remain in the content file`);

console.log(`Checked ${contentPath}`);
console.log(`  ${errors.length} error(s), ${warnings.length} warning(s)`);
if (warnings.length) {
  console.log("\nWarnings:");
  warnings.forEach((w) => console.log("  ⚠ " + w));
}
if (errors.length) {
  console.log("\nErrors:");
  errors.forEach((e) => console.log("  ✖ " + e));
  process.exit(1);
}
console.log("\n✔ No blocking errors.");
