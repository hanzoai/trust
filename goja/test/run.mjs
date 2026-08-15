// Runs every *.test.mjs beside this file. `npm --prefix goja test`.

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { settled } from "./harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));

for (const f of readdirSync(here).filter((f) => f.endsWith(".test.mjs")).sort()) {
  console.log(`\n# ${f}`);
  await import(join(here, f));
  await settled();
}
