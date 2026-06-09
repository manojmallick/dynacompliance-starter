// Inspect a REAL Dynatrace problem so we can map its fields → the DORA metrics that
// criteria.js needs. Run this once you have live credentials:
//
//   DT_ENV_URL=https://xxx.live.dynatrace.com DT_API_TOKEN=dt0c01.xxx \
//     node scripts/inspect-dynatrace.js [problemId]
//
// It prints the raw problem, its keys, and what the current toIncident() produces —
// so we can see which DORA fields are still 0/placeholder and wire them to your
// monitored metrics / Davis AI fields.

import { listProblems, getProblem, toIncident } from "../src/dynatrace.js";

if (process.env.MOCK === "true") { console.error("Unset MOCK to inspect real data."); process.exit(1); }
if (!process.env.DT_ENV_URL || !process.env.DT_API_TOKEN) {
  console.error("Set DT_ENV_URL and DT_API_TOKEN (real Dynatrace), then re-run.");
  process.exit(1);
}

const arg = process.argv[2];
const list = await listProblems();
const problems = list.problems || (Array.isArray(list) ? list : []);
const probId = arg || problems[0]?.problemId;
if (!probId) { console.error("No open problems found and no problemId given."); process.exit(1); }

console.log(`\n=== Dynatrace problem ${probId} ===`);
const problem = await getProblem(probId);
console.log("\nTOP-LEVEL KEYS:\n ", Object.keys(problem).join(", "));
console.log("\nRAW (truncated):\n", JSON.stringify(problem, null, 2).slice(0, 4000));

const inc = toIncident(problem);
console.log("\n=== toIncident() output (what classify() sees) ===\n", JSON.stringify(inc, null, 2));

const placeholders = Object.entries(inc).filter(([k, v]) => v === 0 || v === false || v == null)
  .map(([k]) => k);
console.log("\n⚠️  Fields still at 0 / false / null — these must be mapped to your metrics/Davis fields");
console.log("   in src/dynatrace.js → toIncident():\n   ", placeholders.join(", ") || "(none — all populated)");
