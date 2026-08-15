// Loads a bundle in an isolated node:vm context with only the globals the Go
// host provides. If a test passes here, the artifact that ships is the thing
// that passed — not the TypeScript it was built from.
//
// The context is deliberately spare: no `require`, no `process`, no `fetch`, no
// `Date.now`. Anything the bundle reaches for that is not listed here is a bug
// in the bundle, and it surfaces as a ReferenceError rather than as a surprise
// in production.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { build } from "../build.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export const NOW = 1_760_000_000_000; // a fixed clock, so `generated` is exact

export function run(src, { now = () => NOW, audit } = {}) {
  const ctx = { __now: now, JSON, Math, RegExp, Number, String, Array, Object, isFinite };
  if (audit) ctx.__audit = audit;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { handle: ctx.handle, trust: ctx.trust };
}

export const source = () => readFileSync(join(here, "..", "bundle.js"), "utf8");

// The committed artifact, which is what ships.
export function load(opts) {
  return run(source(), opts);
}

// A bundle built from a SYNTHETIC inventory. This is how the coverage fold is
// exercised on data written for one case: same code, same vm, different data.
export async function loadWith(controls, frameworks, opts) {
  return run(await build({ write: false, controls, frameworks }), opts);
}
