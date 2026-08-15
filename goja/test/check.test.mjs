// The validator, tested by breaking things.
//
// Every case takes a VALID inventory and mutates exactly one thing, then asserts
// the build would refuse it. That is the only way to know the gate is
// load-bearing: a validator nobody has watched reject something is a validator
// that might be returning [] unconditionally.
//
// The last case asserts the real controls.json and frameworks.json pass, so a
// control added tomorrow that breaks a rule fails here rather than in production.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { it } from "./harness.mjs";
import { check, assertValid } from "../check.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (f) => JSON.parse(readFileSync(join(root, f), "utf8"));
const REAL_CONTROLS = read("controls.json");
const REAL_FRAMEWORKS = read("frameworks.json");

const FW = {
  $comment: "metadata, not a framework",
  t: {
    name: "Test framework",
    publisher: "nobody",
    edition: "made up, on purpose",
    unit: "criterion",
    units: "criteria",
    clauses: [{ id: "X1", title: "one" }],
  },
};

const PLACE = { repo: "hanzoai/iam", path: "internal/thing/thing.go", line: 42 };

const GOOD = {
  id: "iam.thing.works",
  title: "A thing works",
  claim: "The thing does what it says.",
  mechanism: "It does it in Go.",
  status: "automated",
  enforced: [PLACE],
  verified: [{ method: "test", at: [{ repo: "hanzoai/iam", path: "internal/thing/thing_test.go" }] }],
  maps: [{ clause: "t:X1", strength: "full" }],
};

const clone = (o) => JSON.parse(JSON.stringify(o));

function broken(f) {
  const c = clone(GOOD);
  f(c);
  return check({ controls: [c] }, FW);
}

const refuses = (what, f, match) =>
  it(`refuses ${what}`, () => {
    const problems = broken(f);
    assert.ok(problems.length > 0, "expected at least one problem, got none");
    assert.ok(
      problems.some((p) => match.test(p)),
      `no problem matched ${match}\n  got: ${problems.join("\n       ")}`,
    );
  });

it("accepts a well-formed control (so the refusals below mean something)", () => {
  assert.deepEqual(check({ controls: [GOOD] }, FW), []);
});

it("reads a list or an envelope holding one, and refuses anything else", () => {
  assert.deepEqual(check([GOOD], FW), [], "a bare list is the same inventory");
  assert.ok(check({ controls: "nope" }, FW).length > 0);
  assert.ok(check(null, FW).length > 0);
});

refuses("a missing id", (c) => delete c.id, /id is required/);
refuses("an id that is not dotted lowercase", (c) => (c.id = "IAM Thing"), /dotted lowercase/);
refuses("a missing claim", (c) => delete c.claim, /claim is required/);
refuses("a missing mechanism", (c) => delete c.mechanism, /mechanism is required/);
refuses("a control that names no check at all", (c) => (c.verified = []), /verified must name/);
refuses("an unknown verification method", (c) => (c.verified[0].method = "vibes"), /method must be one of/);
refuses(
  "an audit check that names no actions",
  (c) => (c.verified = [{ method: "audit" }]),
  /must name the actions/,
);
refuses("a test check that names no file", (c) => delete c.verified[0].at, /must name where it is/);
refuses("a title that is not a string", (c) => (c.title = 7), /title must be a non-empty string/);
refuses("an unknown status", (c) => (c.status = "mostly"), /status must be one of/);
refuses(
  "a PARTIAL control with no note saying what is missing",
  (c) => (c.status = "partial"),
  /requires a note/,
);
refuses("an ABSENT control with no note saying why", (c) => (c.status = "absent"), /requires a note/);
refuses("a control that names nowhere it is enforced", (c) => (c.enforced = []), /enforced must name/);
refuses("an enforced place with no file path", (c) => delete c.enforced[0].path, /path is required/);
refuses("an absolute path where a repo-relative one belongs", (c) => (c.enforced[0].path = "/etc/x"), /repo-relative/);
refuses("a line number that is not one", (c) => (c.enforced[0].line = 0), /line must be a positive/);
refuses("a control that maps to nothing", (c) => (c.maps = []), /maps must name/);
refuses("an unknown mapping strength", (c) => (c.maps[0].strength = "kinda"), /strength must be one of/);
refuses(
  "A MAPPING TO A CLAUSE NO FRAMEWORK DECLARES",
  (c) => (c.maps[0].clause = "t:X9"),
  /no framework declares that clause/,
);
refuses(
  "a mapping into a framework that does not exist",
  (c) => (c.maps[0].clause = "hipaa:164.312"),
  /no framework declares that clause/,
);
refuses(
  "the same clause mapped twice",
  (c) => c.maps.push({ clause: "t:X1", strength: "partial" }),
  /duplicate mapping/,
);

it("refuses two controls with the same id", () => {
  const problems = check({ controls: [GOOD, clone(GOOD)] }, FW);
  assert.ok(problems.some((p) => /duplicate id/.test(p)), problems.join("\n"));
});

// The claim ban. These are the sentences that turn an inventory into a liability.
refuses("prose that claims a certification", (c) => (c.claim = "We are certified for this."), /does not claim status/);
refuses("prose that claims compliance", (c) => (c.mechanism = "The service is compliant."), /does not claim status/);
refuses("prose that claims an attestation", (c) => (c.title = "Attested key custody"), /does not claim status/);
refuses(
  "prose that claims a module is FIPS validated",
  (c) => (c.mechanism = "A FIPS 140-3 validated module."),
  /does not claim status/,
);
refuses("prose that names a framework we map to", (c) => (c.claim = "This satisfies SOC 2."), /belongs in maps/);
refuses(
  "prose that names a framework in a note",
  (c) => {
    c.status = "partial";
    c.note = "Not yet assessed against ISO 27001.";
  },
  /belongs in maps/,
);
refuses(
  "prose that names a framework in a check detail",
  (c) => (c.verified[0].detail = "Covers the 800-53 families."),
  /belongs in maps/,
);

// Frameworks.
it("refuses a framework whose count has no unit", () => {
  const fw = clone(FW);
  delete fw.t.unit;
  assert.ok(check({ controls: [GOOD] }, fw).some((p) => /unit is required/.test(p)));
});

it("refuses a framework with no publisher or edition", () => {
  const fw = clone(FW);
  delete fw.t.publisher;
  delete fw.t.edition;
  const problems = check({ controls: [GOOD] }, fw);
  assert.ok(problems.some((p) => /publisher is required/.test(p)));
  assert.ok(problems.some((p) => /edition is required/.test(p)));
});

it("refuses a framework with a duplicate clause id", () => {
  const fw = clone(FW);
  fw.t.clauses.push({ id: "X1", title: "one again" });
  assert.ok(check({ controls: [GOOD] }, fw).some((p) => /duplicate clause X1/.test(p)));
});

it("treats a $-prefixed key as metadata, not as a broken framework", () => {
  assert.deepEqual(check({ controls: [GOOD] }, FW), [], "$comment must not be validated as one");
});

it("exempts the standards' own clause titles from the claim ban", () => {
  // A.5.36 really is titled "Compliance with policies...". Rewriting a published
  // standard to satisfy our own copy rule would be the dishonest move.
  const iso = REAL_FRAMEWORKS.iso27001.clauses.filter((c) => c.id === "A.5.36")[0];
  assert.match(iso.title, /^Compliance with policies/);
  assert.deepEqual(check({ controls: [] }, REAL_FRAMEWORKS), []);
});

it("assertValid throws with every problem listed, not just the first", () => {
  const c = clone(GOOD);
  delete c.id;
  delete c.claim;
  c.maps[0].clause = "t:NOPE";
  let err;
  try {
    assertValid({ controls: [c] }, FW);
  } catch (e) {
    err = e;
  }
  assert.ok(err, "expected a throw");
  assert.match(err.message, /no bundle was built \(3\)/);
  assert.match(err.message, /id is required/);
  assert.match(err.message, /claim is required/);
  assert.match(err.message, /no framework declares that clause/);
});

it("THE REAL INVENTORY PASSES", () => {
  assert.deepEqual(check(REAL_CONTROLS, REAL_FRAMEWORKS), []);
});

it("every clause the real inventory maps to is declared by a framework", () => {
  const declared = new Set();
  for (const [fw, f] of Object.entries(REAL_FRAMEWORKS)) {
    if (fw[0] === "$") continue;
    for (const cl of f.clauses) declared.add(`${fw}:${cl.id}`);
  }
  for (const c of REAL_CONTROLS.controls) {
    for (const m of c.maps) {
      assert.ok(declared.has(m.clause), `${c.id} maps to undeclared ${m.clause}`);
    }
  }
});
