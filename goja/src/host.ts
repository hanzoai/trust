// Host bridge — the ONLY seam between the trust logic and the world.
//
// The Go host injects these onto the goja runtime before calling handle():
//
//   globalThis.__now()        -> unix milliseconds (host clock)
//   globalThis.__audit(query) -> { rows, total }   (the platform's audit trail)
//
// There is no __db and no __newId, because this plugin never writes. The
// inventory is compiled into the bundle, so the only state a request can reach
// is the audit trail, and it can only read it.
//
// __audit is deliberately narrow. The trail lives in the platform's own store,
// reached through hanzoai/orm, and the bundle knows nothing about how it is
// stored — no table, no column, no query language. It asks for one org's rows
// carrying one of a set of actions in a time window, and the host answers.
// Everything the bundle knows about the trail is in Query below.
//
// Rows pass straight through to the caller. The bundle does not read a field
// off a row, so the trail's projection can gain or lose a field without
// touching this repo.

export interface Query {
  // There is NO org field, deliberately. The host binds __audit to the tenant it
  // validated, per request, and the bundle has no way to name a different one.
  // A tenant the caller cannot express is a tenant the caller cannot cross.
  //
  // actions selects the rows that evidence a control. Empty means the control
  // has no evidencing action, and the bundle answers without calling the host.
  actions: string[];
  // from/to bound createdTime, RFC 3339, inclusive. Empty means unbounded.
  from: string;
  to: string;
  // limit caps the rows returned. Always set by the bundle.
  limit: number;
}

export interface Trail {
  rows: unknown[];
  total: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __now: () => number;
  // eslint-disable-next-line no-var
  var __audit: ((q: Query) => Trail) | undefined;
}

export function now(): number {
  return globalThis.__now();
}

// audit reads the trail, or reports that the host did not wire a reader.
//
// A missing __audit is a MOUNT fault, not a request fault: the plugin was
// mounted without the one function its evidence route needs. Saying so beats
// answering an empty page, which reads exactly like an org with nothing to show.
export function audit(q: Query): Trail | null {
  const fn = globalThis.__audit;
  if (typeof fn !== "function") return null;
  return fn(q);
}
