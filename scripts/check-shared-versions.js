#!/usr/bin/env node
/**
 * CI enforcement for Issue #755 / #728: fails if `client` and
 * `agro-production/client` drift apart on the major version of a
 * dependency both apps share. Doesn't require either app's
 * node_modules to be installed — just reads both package.json files.
 *
 * Extend SHARED_DEPS as more dependencies (Tailwind, etc.) are unified.
 */
const fs = require("fs");
const path = require("path");

const SHARED_DEPS = ["next", "react", "react-dom"];

function readPkg(relPath) {
  const full = path.join(__dirname, "..", relPath, "package.json");
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function majorOf(versionRange) {
  const match = /(\d+)/.exec(versionRange || "");
  return match ? match[1] : null;
}

const apps = {
  client: readPkg("client"),
  "agro-production/client": readPkg("agro-production/client"),
};

let failed = false;

for (const dep of SHARED_DEPS) {
  const versions = {};
  for (const [appName, pkg] of Object.entries(apps)) {
    const raw = (pkg.dependencies || {})[dep] || (pkg.devDependencies || {})[dep];
    if (raw) versions[appName] = raw;
  }

  const entries = Object.entries(versions);
  if (entries.length < 2) continue;

  const majors = new Set(entries.map(([, v]) => majorOf(v)));
  if (majors.size > 1) {
    failed = true;
    console.error(`Version drift on "${dep}":`);
    for (const [appName, v] of entries) {
      console.error(`  ${appName}: ${v} (major ${majorOf(v)})`);
    }
  } else {
    console.log(`OK: "${dep}" aligned at major ${[...majors][0]} across both apps.`);
  }
}

if (failed) {
  console.error(
    "\nclient and agro-production/client have re-diverged on a shared dependency's major version " +
      "(Issue #755 / #728) — bump the older app to match, don't let it drift.",
  );
  process.exit(1);
}

console.log("\nAll shared dependencies aligned.");
