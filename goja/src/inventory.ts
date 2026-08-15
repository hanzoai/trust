// The inventory — the data, and the only questions worth asking of it.
//
// controls.json and frameworks.json are INLINED here at build time by
// goja/build.mjs, which validates them first. There is no load, no parse and no
// failure mode at runtime: if the data were malformed there would be no bundle.
// Nothing in a request can reach these values, which is why a tenant cannot
// inflate its own coverage.

declare const __CONTROLS__: Control[];
declare const __FRAMEWORKS__: Frameworks;
declare const __VERSION__: string;

// Where a mechanism lives. `path` is relative to `repo`'s root; `line` points at
// the lines someone actually read.
export interface Place {
  repo: string;
  path: string;
  symbol?: string;
  line?: number;
  note?: string;
}

// automated — the mechanism runs with nobody in the loop.
// partial   — it runs but does not cover the whole claim. `note` says what is missing.
// absent    — we do not have it. `note` says so. It never counts toward coverage.
export type Status = "automated" | "partial" | "absent";

// How we know a control holds.
//   read  — a person read the source at `at`. It cannot fail on its own.
//   test  — an automated test at `at` asserts it. It can fail, so it is evidence.
//   audit — rows in the trail evidence it; `actions` names them.
export type Method = "read" | "test" | "audit";

export interface Check {
  method: Method;
  at?: Place[];
  actions?: string[];
  detail?: string;
}

export type Strength = "full" | "partial";

export interface Mapping {
  clause: string; // "<framework>:<clause>", e.g. "soc2:CC6.1"
  strength: Strength;
}

export interface Control {
  id: string;
  title?: string;
  claim: string;
  mechanism: string;
  status: Status;
  note?: string;
  enforced: Place[];
  verified: Check[];
  maps: Mapping[];
}

export interface Clause {
  id: string;
  title: string;
  group?: string;
}

export interface Framework {
  name: string;
  publisher: string;
  edition: string;
  // What one clause IS. Both forms, because every count is rendered into a
  // sentence and "12 of 20 family" does not read.
  unit: string;
  units: string;
  note?: string;
  clauses: Clause[];
}

export type Frameworks = Record<string, Framework>;

// Referenced once each: esbuild substitutes the literal at every occurrence, so
// a second reference would inline the whole inventory a second time.
export const CONTROLS: Control[] = __CONTROLS__;
export const FRAMEWORKS: Frameworks = __FRAMEWORKS__;
export const VERSION: string = __VERSION__;

// Keys starting with "$" are file metadata, not frameworks. One place knows it.
export function ids(): string[] {
  const out: string[] = [];
  for (const k in FRAMEWORKS) {
    if (!Object.prototype.hasOwnProperty.call(FRAMEWORKS, k)) continue;
    if (k.charAt(0) === "$") continue;
    out.push(k);
  }
  return out.sort();
}

export function framework(id: string): Framework | null {
  if (!id || id.charAt(0) === "$") return null;
  return Object.prototype.hasOwnProperty.call(FRAMEWORKS, id) ? FRAMEWORKS[id] : null;
}

export function control(id: string): Control | null {
  for (let i = 0; i < CONTROLS.length; i++) {
    if (CONTROLS[i].id === id) return CONTROLS[i];
  }
  return null;
}

// Verified is DERIVED, never declared. A control is verified when something can
// FAIL on its behalf — a test, or rows in the trail. A control that only a
// person has read is not verified, and coverage counts it one rung weaker than
// it claims to be. There is no field anyone can set to skip this.
export function verified(c: Control): boolean {
  for (let i = 0; i < c.verified.length; i++) {
    const m = c.verified[i].method;
    if (m === "test" || m === "audit") return true;
  }
  return false;
}

// The audit actions that evidence a control, or an empty list if none do.
export function evidence(c: Control): string[] {
  for (let i = 0; i < c.verified.length; i++) {
    const v = c.verified[i];
    if (v.method === "audit" && v.actions && v.actions.length) return v.actions;
  }
  return [];
}
