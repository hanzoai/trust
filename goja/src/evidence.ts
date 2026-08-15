// Evidence — the audit rows that stand behind one control, over a window.
//
// The inventory decides what evidences what: a control names the audit ACTIONS
// that are its trail, and this route resolves a control id to those actions and
// asks the host for them. Evidence therefore cannot drift from the inventory.
//
// This module names no table and no column. The trail lives in the platform's
// own store, so the host owns the query and the rows pass straight through.
//
// A control nothing evidences says so plainly rather than answering an empty
// page, because an empty page reads like a clean quarter.

import { audit } from "./host";
import { control, evidence as evidencing, verified } from "./inventory";
import { badReq, Ctx, notFound, ok, Res, unmounted } from "./reply";

const LIMIT = 100;
const MAX = 1000;

// RFC 3339 — the form the trail stores and the form the host compares. A
// malformed bound is refused rather than passed down as an unbounded window: a
// typo that silently widens a reviewer's window is the wrong way to fail.
const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;

function bound(v: string | undefined, field: string, errs: string[]): string {
  const s = v || "";
  if (s && !DATE.test(s)) errs.push(field + " must be an RFC 3339 date");
  return s;
}

export function query(ctx: Ctx): Res {
  const id = ctx.params.control || "";
  if (!id) return badReq("control is required");

  const c = control(id);
  if (!c) return notFound("no control " + id + " in the inventory");

  const errs: string[] = [];
  const from = bound(ctx.params.from, "from", errs);
  const to = bound(ctx.params.to, "to", errs);

  let limit = LIMIT;
  const raw = ctx.params.limit;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (!isFinite(n) || Math.floor(n) !== n || n < 1) {
      errs.push("limit must be a positive whole number");
    } else {
      limit = n > MAX ? MAX : n;
    }
  }
  if (from && to && from >= to) errs.push("from must be before to");
  if (errs.length) return badReq(errs.join("; "));

  const actions = evidencing(c);
  const head = {
    control: c.id,
    claim: c.claim,
    status: c.status,
    verified: verified(c),
    actions: actions,
    from: from,
    to: to,
    limit: limit,
  };

  // Nothing in the trail evidences this control. That is an answer, not an
  // error, and it is the honest one: the mechanism may well be enforced in code
  // and simply leave no row. Saying which is the whole job.
  if (actions.length === 0) {
    return ok({
      control: head.control,
      claim: head.claim,
      status: head.status,
      verified: head.verified,
      actions: actions,
      queried: false,
      total: 0,
      note:
        "no audit action evidences this control; it is verified by reading the " +
        "source at the files the inventory names, not from the trail",
      enforced: c.enforced,
    });
  }

  // The query carries no organization. The host binds __audit to the tenant it
  // validated, so there is no field here for a caller's parameter to reach and
  // no way for this bundle to name another organization's trail.
  const trail = audit({ actions: actions, from: from, to: to, limit: limit });
  if (!trail) {
    return unmounted(
      "this deployment mounted trust without __audit, so the trail cannot be read",
    );
  }

  return ok({
    control: head.control,
    claim: head.claim,
    status: head.status,
    verified: head.verified,
    actions: actions,
    from: from,
    to: to,
    limit: limit,
    queried: true,
    total: trail.total,
    count: trail.rows.length,
    truncated: trail.total > trail.rows.length,
    rows: trail.rows,
  });
}
