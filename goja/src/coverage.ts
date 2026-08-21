// Coverage — computed from the inventory, never asserted.
//
// Three rules carry the whole thing:
//
//   1. A mapping is worth the WEAKEST of three things: what the control claims,
//      how much of the clause that mapping answers, and whether anything can
//      FAIL on the control's behalf. `absent` is worth NOTHING, whatever clauses
//      it names, and a control only a person has read is capped at partial.
//
//   2. A clause takes the STRONGEST control pointed at it. A clause nothing maps
//      to is none.
//
//   3. The denominator is the framework's whole published clause list, so the
//      uncovered ones stay visible instead of dropping out of the fraction.
//
// Nothing here can emit a verdict. The output is three counts, the unit those
// counts are in, and the control ids behind each one — a number that can be
// checked line by line, which is the only kind worth publishing.

import {
  Clause,
  CONTROLS,
  Control,
  Framework,
  framework as lookup,
  ids,
  Mapping,
  verified,
} from "./inventory";

export type Level = "automated" | "partial" | "none";

const RANK: Record<Level, number> = { none: 0, partial: 1, automated: 2 };

// Rule 1, and the only place it is written down. The weakest of three things:
// what the control claims, how much of the clause that mapping answers, and
// whether anything can fail on the control's behalf.
export function worth(c: Control, m: Mapping): Level {
  if (c.status === "absent") return "none";
  if (c.status === "partial") return "partial";
  if (m.strength !== "full") return "partial";
  return verified(c) ? "automated" : "partial";
}

export interface Tally {
  total: number;
  automated: number;
  partial: number;
  none: number;
}

export interface ClauseCoverage {
  id: string;
  title: string;
  group?: string;
  level: Level;
  controls: string[]; // strongest first
}

export interface Coverage extends Tally {
  framework: string;
  name: string;
  publisher: string;
  edition: string;
  unit: string;
  units: string;
  note?: string;
  statement: string;
}

export interface Detail extends Coverage {
  clauses: ClauseCoverage[];
}

export interface Inventory {
  total: number;
  automated: number;
  partial: number;
  absent: number;
  unverified: number;
  statement: string;
}

// How the controls themselves stand, independent of any framework.
//
// The list is a PARAMETER, defaulting to the inventory compiled into this
// bundle. That is what lets one fold serve two callers without a second
// implementation: the deployment's own controls are the compiled-in baseline,
// and a tenant's are rows it authored. The arithmetic cannot differ between
// them, because there is only one copy of it.
export function inventory(cs: Control[] = CONTROLS): Inventory {
  let automated = 0;
  let partial = 0;
  let absent = 0;
  let unverified = 0;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.status === "automated") automated++;
    else if (c.status === "partial") partial++;
    else absent++;
    if (!verified(c)) unverified++;
  }
  return {
    total: cs.length,
    automated,
    partial,
    absent,
    unverified,
    statement:
      automated +
      " of " +
      cs.length +
      " controls automated, " +
      partial +
      " partial, " +
      absent +
      " absent" +
      (unverified ? "; " + unverified + " rest on a reading rather than a test" : ""),
  };
}

function coverClause(clause: Clause, id: string, cs: Control[]): ClauseCoverage {
  let level: Level = "none";
  const hits: { id: string; rank: number }[] = [];

  const ref = id + ":" + clause.id;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    for (let j = 0; j < c.maps.length; j++) {
      const m = c.maps[j];
      if (m.clause !== ref) continue;
      const got = worth(c, m);
      if (got === "none") continue; // an absent control NAMES a clause; it never covers one
      if (RANK[got] > RANK[level]) level = got;
      hits.push({ id: c.id, rank: RANK[got] });
    }
  }

  hits.sort((a, b) => b.rank - a.rank || (a.id < b.id ? -1 : 1));
  const out: ClauseCoverage = {
    id: clause.id,
    title: clause.title,
    level,
    controls: hits.map((h) => h.id),
  };
  if (clause.group) out.group = clause.group;
  return out;
}

function summarize(id: string, f: Framework, cs: Control[]): Detail {
  const clauses: ClauseCoverage[] = [];
  const tally: Tally = { total: f.clauses.length, automated: 0, partial: 0, none: 0 };
  for (let i = 0; i < f.clauses.length; i++) {
    const cc = coverClause(f.clauses[i], id, cs);
    clauses.push(cc);
    tally[cc.level]++;
  }
  const detail: Detail = {
    framework: id,
    name: f.name,
    publisher: f.publisher,
    edition: f.edition,
    unit: f.unit,
    units: f.units,
    total: tally.total,
    automated: tally.automated,
    partial: tally.partial,
    none: tally.none,
    statement:
      tally.automated +
      " of " +
      tally.total +
      " " +
      f.units +
      " have an automated control, " +
      tally.partial +
      " partial, " +
      tally.none +
      " none",
    clauses,
  };
  if (f.note) detail.note = f.note;
  return detail;
}

// One framework, every clause listed. Null for a framework we do not map to —
// an empty answer, never a throw: asking about one is a fair question.
export function framework(id: string, cs: Control[] = CONTROLS): Detail | null {
  const f = lookup(id);
  return f ? summarize(id, f, cs) : null;
}

// Every framework's counts, without the clause lists. This is what a badge reads.
export function summary(cs: Control[] = CONTROLS): { controls: Inventory; frameworks: Coverage[] } {
  const list = ids();
  const out: Coverage[] = [];
  for (let i = 0; i < list.length; i++) {
    const d = summarize(list[i], lookup(list[i]) as Framework, cs);
    const row: Coverage = {
      framework: d.framework,
      name: d.name,
      publisher: d.publisher,
      edition: d.edition,
      unit: d.unit,
      units: d.units,
      total: d.total,
      automated: d.automated,
      partial: d.partial,
      none: d.none,
      statement: d.statement,
    };
    if (d.note) row.note = d.note;
    out.push(row);
  }
  return { controls: inventory(cs), frameworks: out };
}
