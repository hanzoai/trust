// The store seam, and the whole of what this bundle knows about storage.
//
// A trust centre is small, read-mostly and page-shaped: a profile, some
// controls, some documents, a subprocessor list, a few policies, an FAQ, a
// changelog, a risk sheet. None of them join to another. So they are ONE table
// discriminated by `kind`, not eight tables that would each need their own
// migration, their own read, their own write and their own test.
//
//   record(kind, id, ord, data, updated)   PRIMARY KEY (kind, id)
//
// `data` is the record's own JSON. What may be in it is decided by valid.ts,
// which is the same module the build gate runs, so a control authored through
// the API is held to the rule a control committed to git is held to.
//
// The host binds these to the tenant it validated, per request, and opens that
// tenant's own SQLite file. There is no org column and no org argument: a
// tenant the caller cannot express is a tenant the caller cannot cross.

export interface Row {
  kind: string;
  id: string;
  ord: number;
  data: string;
  updated: number;
}

interface Db {
  query: (sql: string, args: unknown[]) => Row[];
  exec: (sql: string, args: unknown[]) => { changes: number; lastId: number };
}

declare global {
  // eslint-disable-next-line no-var
  var __db: Db | undefined;
  // eslint-disable-next-line no-var
  var __newId: (() => string) | undefined;
  // Whether the tenant of THIS dispatch is the one whose inventory is compiled
  // into this bundle. The host answers it, because which org a deployment's own
  // inventory belongs to is deployment configuration and not build data. The
  // bundle uses it to decide whether the embedded baseline is part of this
  // tenant's answer — never as an authorization decision, which the host has
  // already made by choosing the file.
  // eslint-disable-next-line no-var
  var __own: (() => boolean) | undefined;
}

// A store that is not there is a MOUNT fault. Saying so beats answering an
// empty list, which reads exactly like a tenant that has published nothing.
export function db(): Db | null {
  const d = globalThis.__db;
  return d && typeof d.query === "function" ? d : null;
}

export function own(): boolean {
  const f = globalThis.__own;
  return typeof f === "function" ? f() : false;
}

export function newId(): string {
  const f = globalThis.__newId;
  if (typeof f !== "function") throw new Error("trust: host injected no __newId");
  return f();
}

// The kinds a trust centre is made of. A closed vocabulary: a write naming
// anything else is refused, so a typo cannot quietly create a ninth section
// that nothing renders.
export const KINDS = [
  "profile",
  "control",
  "document",
  "subprocessor",
  "policy",
  "faq",
  "update",
  "risk",
] as const;

export type Kind = (typeof KINDS)[number];

export function isKind(s: string): s is Kind {
  for (let i = 0; i < KINDS.length; i++) if (KINDS[i] === s) return true;
  return false;
}

// Kinds that hold exactly one record. Their id is the empty string, so "create"
// and "replace" are the same statement and there is no second row to reconcile.
export const SINGLE: Record<string, boolean> = { profile: true, risk: true };

export interface Record_ {
  id: string;
  ord: number;
  updated: number;
  data: Record<string, unknown>;
}

function parse(r: Row): Record_ {
  let data: Record<string, unknown> = {};
  try {
    const v = JSON.parse(r.data);
    if (v && typeof v === "object" && !Array.isArray(v)) data = v as Record<string, unknown>;
  } catch {
    // A row that will not parse is a row this bundle did not write. Reporting
    // it as an empty record keeps one bad row from emptying a whole section.
    data = {};
  }
  return { id: r.id, ord: Number(r.ord) || 0, updated: Number(r.updated) || 0, data: data };
}

export function list(kind: Kind): Record_[] {
  const d = db();
  if (!d) return [];
  const rows = d.query(
    "SELECT kind, id, ord, data, updated FROM record WHERE kind = ? ORDER BY ord ASC, id ASC",
    [kind],
  );
  const out: Record_[] = [];
  for (let i = 0; i < rows.length; i++) out.push(parse(rows[i]));
  return out;
}

export function get(kind: Kind, id: string): Record_ | null {
  const d = db();
  if (!d) return null;
  const rows = d.query(
    "SELECT kind, id, ord, data, updated FROM record WHERE kind = ? AND id = ?",
    [kind, id],
  );
  return rows.length ? parse(rows[0]) : null;
}

export function put(kind: Kind, id: string, ord: number, data: unknown, at: number): void {
  const d = db();
  if (!d) throw new Error("trust: no store");
  d.exec(
    "INSERT INTO record (kind, id, ord, data, updated) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(kind, id) DO UPDATE SET ord = excluded.ord, data = excluded.data, updated = excluded.updated",
    [kind, id, ord, JSON.stringify(data), at],
  );
}

export function drop(kind: Kind, id: string): number {
  const d = db();
  if (!d) throw new Error("trust: no store");
  return d.exec("DELETE FROM record WHERE kind = ? AND id = ?", [kind, id]).changes;
}
