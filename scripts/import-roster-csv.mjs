#!/usr/bin/env node
// Import a roster CSV into cms/content/primetime-site.json for one team.
// CSV header: number,name,position,batsThrows
// Usage: node scripts/import-roster-csv.mjs <team-id> <path-to-csv> [path-to-content-json]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [, , teamId, csvPath, contentArg] = process.argv;

if (!teamId || !csvPath) {
  console.error("Usage: node scripts/import-roster-csv.mjs <team-id> <path-to-csv> [path-to-content-json]");
  process.exit(1);
}

const contentPath = contentArg || path.join(__dirname, "..", "cms", "content", "primetime-site.json");
const data = JSON.parse(readFileSync(contentPath, "utf8"));
const team = data.teams.find((t) => t.id === teamId);
if (!team) {
  console.error(`No team with id "${teamId}" found in ${contentPath}. Known ids: ${data.teams.map((t) => t.id).join(", ")}`);
  process.exit(1);
}

const lines = readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
const rows = lines.slice(1).map((line) => {
  const cols = line.split(",");
  const row = {};
  header.forEach((h, i) => { row[h] = (cols[i] || "").trim(); });
  return {
    number: row.number || "",
    name: row.name || "",
    position: row.position || "",
    batsThrows: row.batsthrows || row["bats/throws"] || "",
  };
});

team.roster = rows;
writeFileSync(contentPath, JSON.stringify(data, null, 2) + "\n");
console.log(`Imported ${rows.length} players into team "${teamId}" in ${contentPath}`);
