// Ensure the reviewed build-tool exceptions have not entered the shipped JS graph.
const fs = require("node:fs"),
  path = require("node:path");
let count = 0;
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (file.endsWith(".map")) {
      const map = JSON.parse(fs.readFileSync(file, "utf8"));
      count++;
      const unexpected = (map.sources || []).filter((source) =>
        /node-forge|\/braces\//.test(source),
      );
      if (unexpected.length)
        throw new Error(
          `Reviewed tooling dependency is in a shipped bundle: ${unexpected.join(", ")}`,
        );
    }
  }
}
scan(process.argv[2] || "/tmp/app-export");
if (!count)
  throw new Error(
    "Export with --source-maps before checking bundle dependencies.",
  );
console.log(
  `Checked ${count} source maps: no braces or node-forge in shipped JavaScript.`,
);
