// Manual sync runs: npm run sync [-- --source <name> ...] [--dry-run]
import { parseArgs } from "node:util";
import { findSource, sources } from "@/lib/sources";
import { runSources } from "@/lib/sync";

const { values } = parseArgs({
  options: {
    source: { type: "string", multiple: true },
    "dry-run": { type: "boolean", default: false },
  },
});

const names = values.source ?? sources.map((source) => source.name);
const unknown = names.filter((name) => !findSource(name));
if (unknown.length) {
  console.error(`Unknown source(s): ${unknown.join(", ")}. Known: ${sources.map((s) => s.name).join(", ") || "none"}`);
  process.exit(1);
}

const results = await runSources(
  names.map((name) => findSource(name)!),
  { dryRun: values["dry-run"] },
);

if (results.length === 0) console.log("No sources registered.");
for (const result of results) console.log(JSON.stringify(result));
process.exit(results.some((result) => result.status === "failed") ? 1 : 0);
