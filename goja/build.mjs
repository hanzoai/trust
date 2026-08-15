// Builds the self-contained, ESM-free goja bundle from the TypeScript source and
// the inventory.
//
// Order matters and is the point: VALIDATE, then inline, then bundle. A control
// with a bad status, a mapping to a clause no framework declares, or a sentence
// that claims a certification stops the build — there is no artifact to ship and
// therefore no number to misread. See check.mjs for the rules.
//
// Output: goja/bundle.js — an IIFE targeting ES2015, platform "neutral" so
// esbuild injects NO node/browser globals and no `node:` builtins. The only
// globals it touches are the two the Go host injects (__now, __audit) and
// standard JS (JSON/Math/RegExp/Date.UTC).
//
// Run: `node goja/build.mjs`  (esbuild is the sole devDependency)
// The built bundle.js is committed so hanzoai/cloud can go:embed it (embed.go),
// exactly how hanzoai/plans and hanzoai/captable ship theirs.

import { build as esbuild } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertValid } from "./check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const read = (name) => JSON.parse(readFileSync(join(root, name), "utf8"));

// controls.json is a LIST of controls, optionally wrapped in an envelope that
// carries a "$comment" beside it. Both spellings are read here, once, so
// everything downstream — the validator, the bundle, the tests — sees a list.
// Handing an envelope to code that indexes an array is the exact failure this
// repo exists to refuse: every count comes back zero and nothing says why.
export const list = (controls) => (Array.isArray(controls) ? controls : controls.controls);

// The inventory has been written two ways: `enforced`/`verified`/`maps`-as-edges,
// and `source`/`check`/`evidence`/`maps`-as-lists. They carry the same facts.
// normalize reads either and emits the first, ONCE, at the build edge — so the
// validator, the bundle and the tests below it all see one shape and there is no
// second spelling anywhere past this line.
export function normalize(input) {
  return list(input).map((c) => {
    const enforced = c.enforced || c.source || [];
    let verified = c.verified;
    if (!verified) {
      verified = [];
      if (c.check) verified.push({ method: "read", at: enforced, detail: c.check });
      if (c.evidence && c.evidence.length) {
        verified.push({ method: "audit", actions: c.evidence });
      }
    }
    let maps = c.maps;
    if (maps && !Array.isArray(maps)) {
      // A clause list carries no per-edge strength, so the control's own status
      // sets it: an automated control answers a clause it names in full, a
      // partial one only in part. Nothing is invented, and nothing is inflated.
      const strength = c.status === "automated" ? "full" : "partial";
      const flat = [];
      for (const fw of Object.keys(maps)) {
        for (const id of maps[fw]) flat.push({ clause: `${fw}:${id}`, strength });
      }
      maps = flat;
    }
    const out = { id: c.id };
    if (c.title) out.title = c.title;
    out.claim = c.claim;
    out.mechanism = c.mechanism;
    out.status = c.status;
    if (c.note) out.note = c.note;
    out.enforced = enforced;
    out.verified = verified;
    out.maps = maps || [];
    return out;
  });
}

// version comes from embed.go, so the Go const and the bundle can never disagree
// about which inventory is running.
export function version() {
  const go = readFileSync(join(root, "embed.go"), "utf8");
  const m = /const Version = "([^"]+)"/.exec(go);
  if (!m) throw new Error("trust: embed.go has no Version const");
  return m[1];
}

// build returns the bundle source.
//
//   write false     rebuild in memory — how the staleness test compares the
//                   committed artifact against a fresh one.
//   controls/frameworks
//                   build against data other than the repo's. The tests use
//                   this to fold synthetic inventories through the SAME code
//                   that ships, rather than through a second implementation.
//
// Validation runs either way. A synthetic inventory that would not be allowed
// in the repo is not allowed in a test either.
export async function build({ write = true, controls, frameworks } = {}) {
  controls = normalize(controls || read("controls.json"));
  frameworks = frameworks || read("frameworks.json");
  assertValid(controls, frameworks);

  const out = await esbuild({
    entryPoints: [join(here, "src/index.ts")],
    bundle: true,
    format: "iife",
    target: "es2015",
    platform: "neutral",
    legalComments: "none",
    define: {
      // The file is an envelope — "$comment" beside the list — so the LIST is
      // what gets inlined. Handing the envelope to a bundle that indexes an
      // array is the exact failure this repo exists to refuse: every count
      // would come back zero and nothing would say why.
      __CONTROLS__: JSON.stringify(controls),
      __FRAMEWORKS__: JSON.stringify(frameworks),
      __VERSION__: JSON.stringify(version()),
    },
    banner: {
      js:
        "// @hanzo/trust — goja bundle (GENERATED by goja/build.mjs; edit src/*.ts + controls.json).\n" +
        "// Self-contained, ESM-free; runs in dop251/goja inside hanzoai/cloud (HIP-0106).",
    },
    outfile: write ? join(here, "bundle.js") : undefined,
    write: write,
  });

  return write ? null : out.outputFiles[0].text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const controls = normalize(read("controls.json"));
  await build();
  console.log(`built goja/bundle.js — ${controls.length} controls, version ${version()}`);
}
