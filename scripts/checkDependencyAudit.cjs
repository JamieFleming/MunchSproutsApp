// Fail CI on new advisories; keep reviewed, time-limited tooling exceptions visible.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
let report;
try {
  report = execFileSync("npm", ["audit", "--json"], { encoding: "utf8" });
} catch (error) {
  report = error.stdout;
}
const audit = JSON.parse(report || "{}");
if (!audit.metadata || audit.error)
  throw new Error("Dependency audit did not complete.");
if (Date.now() > Date.parse("2026-11-17T00:00:00Z"))
  throw new Error(
    "Review and renew or remove the documented tooling advisory exceptions.",
  );
const allowed = new Set(["GHSA-vfj7-8cjw-p6xm", "GHSA-86w9-cpqp-85rv"]);
// Expo SDK 57 requires Zod 3; the advisory only offers a Zod 4 fix.
// Scope this exception to the reviewed tooling installation, never arbitrary Zod copies.
const zod = audit.vulnerabilities?.zod;
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
if (
  zod &&
  !zod.isDirect &&
  zod.nodes?.length === 1 &&
  zod.nodes[0] === "node_modules/zod" &&
  lock.packages?.["node_modules/zod"]?.version === "3.25.76"
) {
  allowed.add("GHSA-mrhx-c7xc-m3w5");
}
const advisories = Object.values(audit.vulnerabilities || {}).flatMap((v) =>
  v.via.filter((x) => typeof x === "object"),
);
const unexpected = advisories.filter(
  (item) => !allowed.has(item.url.split("/").pop()),
);
fs.mkdirSync("/tmp/munchsprouts-audit", { recursive: true });
fs.writeFileSync(
  "/tmp/munchsprouts-audit/dependencies.json",
  JSON.stringify(audit, null, 2),
);
for (const item of new Map(advisories.map((x) => [x.url, x])).values())
  console.log(
    `${allowed.has(item.url.split("/").pop()) ? "REVIEWED TOOLING EXCEPTION" : "UNEXPECTED"}: ${item.name}: ${item.url}`,
  );
if (unexpected.length) {
  console.error("New advisories require review.");
  process.exitCode = 1;
} else
  console.log(
    "No unreviewed dependency advisories. See docs/release-hardening.md for remaining upstream risk.",
  );
