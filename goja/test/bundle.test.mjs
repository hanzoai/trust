// The dispatch surface, against the built bundle in a bare vm.
//
// Plus the check that keeps the committed artifact honest: rebuild in memory and
// compare. bundle.js is generated but committed, because the Go embed reads it —
// so "edited controls.json, forgot to rebuild" is a real way to ship a stale
// score, and it is the one this file exists to catch.

import assert from "node:assert/strict";
import { it } from "./harness.mjs";
import { load, NOW, source } from "./vm.mjs";
import { build, version } from "../build.mjs";

const ORG = "acme";
const get = (handle, route, params) => handle({ route, method: "GET", params, orgId: ORG });

it("health answers without a tenant, and names itself", () => {
  const { handle } = load();
  const res = handle({ route: "health", method: "GET" });
  assert.equal(res.status, 200);
  assert.equal(res.body.service, "trust");
  assert.equal(res.body.status, "ok");
});

it("every other route requires the validated tenant", () => {
  const { handle } = load();
  for (const route of ["controls.list", "coverage.list", "coverage.get", "evidence.get"]) {
    assert.equal(handle({ route, method: "GET", orgId: "" }).status, 401, `${route}`);
  }
});

it("an unknown route is the bundle's OWN 404", () => {
  const { handle } = load();
  const res = get(handle, "does.not.exist");
  assert.equal(res.status, 404);
  assert.match(res.body.message, /no trust route/);
});

it("a write is refused with the reason, not merely missing", () => {
  const { handle } = load();
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const res = handle({ route: "controls.list", method, orgId: ORG, body: { id: "mine" } });
    assert.equal(res.status, 405, method);
    assert.match(res.body.message, /read-only/);
    assert.equal(res.body.allow, "GET");
  }
});

it("an unknown route beats a bad method — 404 before 405", () => {
  const { handle } = load();
  assert.equal(handle({ route: "nope", method: "POST", orgId: ORG }).status, 404);
});

it("controls.list returns the inventory with counts that partition it", () => {
  const { handle } = load();
  const b = get(handle, "controls.list").body;
  assert.ok(b.controls.length > 0);
  assert.equal(b.automated + b.partial + b.absent, b.total);
  assert.equal(b.total, b.controls.length);
});

it("controls.get finds one, and 404s an id that is not there", () => {
  const { handle } = load();
  const id = get(handle, "controls.list").body.controls[0].id;
  assert.equal(get(handle, "controls.get", { id }).status, 200);
  assert.equal(get(handle, "controls.get", { id: "no.such.control" }).status, 404);
});

it("coverage.list carries a unit and a sentence with every framework", () => {
  const { handle } = load();
  const b = get(handle, "coverage.list").body;
  assert.equal(b.generated, NOW, "the only clock is the host's");
  assert.ok(b.frameworks.length >= 3);
  for (const f of b.frameworks) {
    assert.ok(f.unit && f.units, `${f.framework} has no unit — a bare number is not a fact`);
    assert.equal(f.automated + f.partial + f.none, f.total, `${f.framework} counts`);
    assert.match(f.statement, new RegExp(`of ${f.total} ${f.units}`));
  }
});

it("coverage.get lists every clause, covered or not, and 404s an unmapped framework", () => {
  const { handle } = load();
  const soc2 = get(handle, "coverage.get", { framework: "soc2" }).body;
  assert.equal(soc2.clauses.length, soc2.total, "uncovered clauses stay visible");
  assert.ok(soc2.clauses.some((c) => c.level === "none"), "and some really are uncovered");

  const miss = get(handle, "coverage.get", { framework: "hipaa" });
  assert.equal(miss.status, 404);
  assert.ok(miss.body.frameworks.indexOf("soc2") >= 0, "it says which exist");
});

it("query values reach a handler the same way path values do", () => {
  const { handle } = load();
  const viaPath = handle({ route: "coverage.get", method: "GET", orgId: ORG, params: { framework: "soc2" } });
  const viaQuery = handle({ route: "coverage.get", method: "GET", orgId: ORG, query: { framework: "soc2" } });
  assert.equal(viaPath.status, 200);
  assert.deepEqual(viaQuery.body.clauses, viaPath.body.clauses);
});

it("no response anywhere claims a status", () => {
  const { handle } = load();
  // The same word-boundary forms the build gate uses. A looser test would flag
  // "no certificate exists to point at", which is a denial, not a claim.
  const banned = /\bcertifi(ed|cation)\b|\baccredit(ed|ation)\b|\battest(ed|ation)\b|\bcompliant\b|\baudited by\b/i;
  for (const route of ["controls.list", "coverage.list", "frameworks.list"]) {
    const json = JSON.stringify(get(handle, route).body);
    const hit = banned.exec(json);
    assert.equal(hit, null, `${route} emitted "${hit && hit[0]}"`);
  }
});

// ---- evidence -------------------------------------------------------------

const stub = (total = 1) => {
  const seen = [];
  return {
    seen,
    fn: (q) => {
      seen.push(q);
      const n = Math.min(total, q.limit);
      const rows = new Array(n).fill(0).map((_, i) => ({ time: i, action: q.actions[0] }));
      return { rows, total };
    },
  };
};

const actionsOf = (c) => {
  const audit = (c.verified || []).filter((v) => v.method === "audit")[0];
  return (audit && audit.actions) || [];
};
const audited = (handle) =>
  get(handle, "controls.list").body.controls.filter((c) => actionsOf(c).length > 0)[0];
const unaudited = (handle) =>
  get(handle, "controls.list").body.controls.filter((c) => actionsOf(c).length === 0)[0];

it("evidence 404s a control that is not in the inventory", () => {
  const { handle } = load({ audit: stub().fn });
  assert.equal(get(handle, "evidence.get", { control: "no.such.control" }).status, 404);
  assert.equal(get(handle, "evidence.get", {}).status, 400, "and requires one");
});

it("evidence says it did NOT look when no action evidences the control", () => {
  const s = stub();
  const { handle } = load({ audit: s.fn });
  const res = get(handle, "evidence.get", { control: unaudited(handle).id });
  assert.equal(res.status, 200);
  assert.equal(res.body.queried, false);
  assert.equal(res.body.rows, undefined, "no empty array — that would read as 'we looked'");
  assert.equal(s.seen.length, 0, "and it really did not ask");
  assert.match(res.body.note, /not from the trail/);
});

it("evidence says it did NOT look when the host mounted no reader", () => {
  const { handle } = load(); // no __audit
  const res = get(handle, "evidence.get", { control: audited(handle).id });
  assert.equal(res.status, 501);
  assert.equal(res.body.rows, undefined);
  assert.match(res.body.message, /without __audit/);
});

it("evidence queries the trail and reports what it asked for", () => {
  const s = stub(3);
  const { handle } = load({ audit: s.fn });
  const id = audited(handle).id;
  const res = get(handle, "evidence.get", { control: id, from: "2026-01-01", to: "2026-02-01" });
  assert.equal(res.body.queried, true);
  assert.equal(res.body.total, 3);
  assert.equal(res.body.count, 3);
  assert.equal(res.body.truncated, false);
  assert.deepEqual(s.seen[0].from, "2026-01-01");
  assert.deepEqual(s.seen[0].to, "2026-02-01");
  assert.deepEqual([...s.seen[0].actions], [...actionsOf(audited(handle))]);
});

it("THE QUERY CANNOT NAME AN ORGANIZATION AT ALL", () => {
  const s = stub();
  const { handle } = load({ audit: s.fn });
  handle({
    route: "evidence.get",
    method: "GET",
    orgId: ORG,
    params: { control: audited(handle).id, org: "victim", orgId: "victim", organization: "victim" },
    query: { org: "victim" },
    body: { org: "victim" },
  });
  assert.deepEqual(Object.keys(s.seen[0]).sort(), ["actions", "from", "limit", "to"],
    "the host binds the tenant; the bundle has no field to put one in");
});

it("evidence refuses a malformed window rather than widening it", () => {
  const { handle } = load({ audit: stub().fn });
  const id = audited(handle).id;
  assert.equal(get(handle, "evidence.get", { control: id, from: "last tuesday" }).status, 400);
  assert.equal(get(handle, "evidence.get", { control: id, from: "2026-13-01" }).status, 200,
    "a shape check, not a calendar — the host validates the instant");
  assert.equal(get(handle, "evidence.get", { control: id, from: "2026-03-01", to: "2026-02-01" }).status, 400);
  assert.equal(get(handle, "evidence.get", { control: id, limit: "0" }).status, 400);
  assert.equal(get(handle, "evidence.get", { control: id, limit: "2.5" }).status, 400);
});

it("evidence caps the rows and says when the trail held more", () => {
  const s = stub(10_000);
  const { handle } = load({ audit: s.fn });
  const id = audited(handle).id;
  assert.equal(get(handle, "evidence.get", { control: id }).body.limit, 100);
  assert.equal(get(handle, "evidence.get", { control: id, limit: "99999" }).body.limit, 1000);
  assert.equal(get(handle, "evidence.get", { control: id }).body.truncated, true);
});

it("a host reader that throws becomes a 500, not a dead runtime", () => {
  const { handle } = load({
    audit: () => {
      throw new Error("the trail is down");
    },
  });
  const res = get(handle, "evidence.get", { control: audited(handle).id });
  assert.equal(res.status, 500);
  assert.match(res.body.message, /the trail is down/);
});

// ---- the artifact ---------------------------------------------------------

it("THE COMMITTED BUNDLE IS CURRENT (rebuild in memory and compare)", async () => {
  const fresh = await build({ write: false });
  assert.equal(fresh, source(), "bundle.js is stale — run `node goja/build.mjs` and commit it");
});

it("the bundle's version matches the Go const the host logs", () => {
  assert.equal(load().trust.version, version());
});

it("the bundle reaches for no global the host does not inject", () => {
  const src = source();
  // Identifier forms, not substrings: the inventory prose is inlined into this
  // file, and a control that says "the process." is not a global read.
  const reads = [
    /\brequire\s*\(/,
    /\bprocess\s*\.\s*(env|argv|exit|cwd)\b/,
    /\bfetch\s*\(/,
    /\bDate\s*\.\s*now\b/,
    /\bsetTimeout\s*\(/,
    /\b__db\b/,
    /\b__newId\b/,
  ];
  for (const re of reads) {
    const hit = re.exec(src);
    assert.equal(hit, null, `bundle.js reaches for ${hit && hit[0]}`);
  }
});
