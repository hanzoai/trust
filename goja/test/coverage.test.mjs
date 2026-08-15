// Coverage arithmetic, against SYNTHETIC inventories.
//
// Each case builds a real bundle from data written for that case and folds it
// through the SAME code that ships. There is no second implementation here for
// the arithmetic to agree with — the thing under test is the artifact.
//
// The load-bearing property, stated once: an ABSENT control never counts. Naming
// the clause it would satisfy is useful — that is a roadmap. The moment naming
// it moves a number, the number is a lie.

import assert from "node:assert/strict";
import { it } from "./harness.mjs";
import { loadWith } from "./vm.mjs";

const FW = {
  t: {
    name: "Test framework",
    publisher: "nobody",
    edition: "made up, on purpose",
    unit: "criterion",
    units: "criteria",
    clauses: [
      { id: "X1", title: "one" },
      { id: "X2", title: "two" },
      { id: "X3", title: "three" },
    ],
  },
};

const PLACE = { repo: "hanzoai/x", path: "x.go", line: 12 };
const TEST = { method: "test", at: [PLACE] };
const READ = { method: "read", at: [PLACE] };

// A control. `verified` defaults to a test, so a case that does not care about
// the evidence rung is not silently exercising it. `clauses` is a list of clause
// ids in framework `t`, mapped at `strength`.
function control(id, status, clauses, { verified = [TEST], strength = "full" } = {}) {
  const c = {
    id,
    title: id,
    claim: "It does the thing.",
    mechanism: "In Go.",
    status,
    enforced: [PLACE],
    verified,
    maps: clauses.map((cl) => ({ clause: "t:" + cl, strength })),
  };
  if (status !== "automated") c.note = "Because of a reason someone wrote down.";
  return c;
}

const wrap = (controls) => ({ controls });
const cover = async (controls) => (await loadWith(wrap(controls), FW)).trust.framework("t");

it("an automated control, fully mapped and tested, covers its clause", async () => {
  const cov = await cover([control("a.b", "automated", ["X1"])]);
  assert.equal(cov.total, 3);
  assert.equal(cov.automated, 1);
  assert.equal(cov.none, 2);
  assert.deepEqual([...cov.clauses[0].controls], ["a.b"]);
  assert.equal(cov.statement, "1 of 3 criteria have an automated control, 0 partial, 2 none");
});

it("AN ABSENT CONTROL NEVER COUNTS AS COVERED", async () => {
  const cov = await cover([control("a.b", "absent", ["X1"])]);
  assert.equal(cov.automated, 0, "absent must not reach automated");
  assert.equal(cov.partial, 0, "absent must not reach partial either");
  assert.equal(cov.none, 3, "every clause is still uncovered");
  assert.equal(cov.clauses[0].controls.length, 0, "and it is not credited on the clause");
});

it("an absent control cannot pull a real one down", async () => {
  const cov = await cover([
    control("real.thing", "automated", ["X1"]),
    control("the.gap", "absent", ["X1"]),
  ]);
  assert.equal(cov.clauses[0].level, "automated");
  assert.deepEqual([...cov.clauses[0].controls], ["real.thing"]);
});

it("a partial control yields partial, never automated", async () => {
  const cov = await cover([control("a.b", "partial", ["X1"])]);
  assert.equal(cov.partial, 1);
  assert.equal(cov.automated, 0);
});

it("a control only a person has READ is capped at partial", async () => {
  const cov = await cover([control("a.b", "automated", ["X1"], { verified: [READ] })]);
  assert.equal(cov.automated, 0, "nothing can fail on its behalf, so it is not automated coverage");
  assert.equal(cov.partial, 1);
});

it("a PARTIAL mapping is capped at partial however strong the control", async () => {
  const cov = await cover([control("a.b", "automated", ["X1"], { strength: "partial" })]);
  assert.equal(cov.automated, 0);
  assert.equal(cov.partial, 1);
});

it("an audit check is evidence too — rows can be absent", async () => {
  const audit = [{ method: "audit", actions: ["issue-user-token"] }];
  const cov = await cover([control("a.b", "automated", ["X1"], { verified: audit })]);
  assert.equal(cov.automated, 1);
});

it("a clause takes the STRONGEST control, in either order", async () => {
  const weak = control("weak.one", "partial", ["X1"]);
  const strong = control("strong.one", "automated", ["X1"]);
  for (const order of [[weak, strong], [strong, weak]]) {
    const cov = await cover(order);
    assert.equal(cov.clauses[0].level, "automated");
    assert.deepEqual([...cov.clauses[0].controls], ["strong.one", "weak.one"], "strongest first");
  }
});

it("the denominator is the FRAMEWORK's clause list, not the clauses controls name", async () => {
  const cov = await cover([control("a.b", "automated", ["X1"])]);
  assert.equal(cov.total, 3, "one control naming one clause must not read as 1 of 1");
  assert.equal(cov.automated + cov.partial + cov.none, cov.total, "the buckets must partition it");
});

it("one control can cover several clauses, and each counts once", async () => {
  const cov = await cover([control("a.b", "automated", ["X1", "X2"])]);
  assert.equal(cov.automated, 2);
  assert.equal(cov.none, 1);
});

it("a mapping into another framework does not score here", async () => {
  const two = { ...FW, u: { ...FW.t, name: "Other" } };
  const c = control("a.b", "automated", ["X1"]);
  c.maps = [{ clause: "u:X1", strength: "full" }];
  const { trust } = await loadWith(wrap([c]), two);
  assert.equal(trust.framework("t").automated, 0);
  assert.equal(trust.framework("u").automated, 1, "it scores where it was aimed");
});

it("an unknown framework is EMPTY, not a throw", async () => {
  const { trust } = await loadWith(wrap([control("a.b", "automated", ["X1"])]), FW);
  assert.equal(trust.framework("nope"), null);
  assert.equal(trust.framework(""), null);
  assert.equal(trust.framework("$comment"), null, "file metadata is not a framework");
});

it("a known framework with no controls is all-none, not empty", async () => {
  const { trust } = await loadWith(wrap([]), FW);
  const cov = trust.framework("t");
  assert.equal(cov.total, 3);
  assert.equal(cov.none, 3);
  assert.equal(cov.clauses.length, 3, "the uncovered clauses stay visible");
});

it("every count carries the unit it is in", async () => {
  const { trust } = await loadWith(wrap([control("a.b", "automated", ["X1"])]), FW);
  const row = trust.summary().frameworks[0];
  assert.equal(row.unit, "criterion");
  assert.equal(row.units, "criteria");
  assert.match(row.statement, /criteria/, "the sentence must survive being quoted alone");
});

it("no fold anywhere emits a verdict", async () => {
  const { trust } = await loadWith(wrap([control("a.b", "automated", ["X1"])]), FW);
  const json = JSON.stringify({ s: trust.summary(), f: trust.framework("t") });
  assert.equal(/"(compliant|passing|certified|ok)":/.test(json), false);
  assert.equal(/\btrue\b|\bfalse\b/.test(json), false, "no boolean may stand in for a number");
});

it("the inventory sentence counts what rests on a reading", async () => {
  const { trust } = await loadWith(
    wrap([
      control("a.b", "automated", ["X1"]),
      control("c.d", "partial", ["X2"], { verified: [READ] }),
      control("e.f", "absent", ["X3"], { verified: [READ] }),
    ]),
    FW,
  );
  const inv = trust.summary().controls;
  assert.equal(inv.total, 3);
  assert.equal(inv.automated, 1);
  assert.equal(inv.partial, 1);
  assert.equal(inv.absent, 1);
  assert.equal(inv.unverified, 2);
  assert.match(inv.statement, /2 rest on a reading rather than a test/);
});
