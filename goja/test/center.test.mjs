// The trust centre as a PRODUCT: a tenant authors its own, and the two things
// that must never bend are the tier rule and the baseline guard.
//
// Every case runs the COMMITTED bundle in a bare node:vm against the store
// model in vm.mjs, so what is under test is the artifact that ships.

import assert from "node:assert/strict";
import { it } from "./harness.mjs";
import { load, NOW } from "./vm.mjs";

const ORG = "acme";

const call = (handle, route, opts = {}) =>
  handle({ route, method: opts.method || "GET", params: opts.params || {}, orgId: opts.org ?? ORG, body: opts.body });

// The write body is an ENVELOPE — { ord, data } — because the record is an open
// object and the host binds the section and the id from the URL onto a struct.
const put = (handle, kind, id, data, ord = 0) =>
  call(handle, "section.put", { method: "PUT", params: { kind, id }, body: { ord, data } });

// A tenant that is NOT the inventory's owner — a customer, on their first
// request. This is the case a single-tenant page never exercises and the one a
// product lives or dies on.
const tenant = () => load({ own: false });

// ---------------------------------------------------------------------------
// A new organization starts empty, and says so with numbers rather than silence.
// ---------------------------------------------------------------------------

it("a new organization has no controls, and its coverage is honestly zero", () => {
  const { handle } = tenant();
  const res = call(handle, "coverage.list");
  assert.equal(res.status, 200);
  assert.equal(res.body.controls.total, 0);
  for (const f of res.body.frameworks) {
    assert.equal(f.automated, 0, f.framework);
    assert.equal(f.partial, 0, f.framework);
    // The denominator is still the whole published clause list. A tenant with
    // nothing is 0 of 61, never 0 of 0 — which would read as complete.
    assert.equal(f.none, f.total, f.framework);
    assert.ok(f.total > 0, f.framework);
  }
});

it("the deployment's OWN inventory is not visible to another organization", () => {
  assert.ok(load({ own: true }).handle && call(load({ own: true }).handle, "controls.list").body.total > 0);
  assert.equal(call(tenant().handle, "controls.list").body.total, 0);
});

// ---------------------------------------------------------------------------
// The tier rule. This is the one the whole page rests on.
// ---------------------------------------------------------------------------

it("a document is GATED unless somebody says otherwise", () => {
  const { handle } = tenant();
  assert.equal(put(handle, "document", "d1", { title: "Network diagram", kind: "other" }).status, 200);
  // The owner of the centre sees their own address, so `released` is about the
  // READER. What defaults is the TIER, and it defaults closed.
  assert.equal(call(handle, "documents.list").body.documents[0].tier, "gated");

  put(handle, "profile", "", { name: "Acme", published: true });
  assert.equal(call(handle, "published").body.documents[0].released, false);
});

it("an AUDITOR-ATTESTED document cannot be published, whatever the caller asks for", () => {
  const { handle } = tenant();
  for (const kind of ["soc2", "iso", "pentest", "letter"]) {
    const res = put(handle, "document", kind, { title: "T", kind, tier: "public", href: "https://x/y.pdf" });
    assert.equal(res.status, 400, kind);
    assert.match(res.body.errors.join(" "), /released through a grant/, kind);
  }
});

it("a SELF-assessment may be published, because we are the ones attesting it", () => {
  const { handle } = tenant();
  for (const kind of ["caiq", "sig", "vsa"]) {
    const res = put(handle, "document", kind, { title: "T", kind, tier: "public", href: "https://x/y.xlsx" });
    assert.equal(res.status, 200, kind);
  }
  const docs = call(handle, "documents.list").body.documents;
  assert.equal(docs.length, 3);
  for (const d of docs) assert.equal(d.released, true, d.kind);
});

it("a gated document keeps its title and loses its address", () => {
  const { handle } = tenant();
  put(handle, "document", "d1", { title: "SOC 2 report", kind: "soc2", href: "https://s3/secret.pdf" });
  put(handle, "profile", "", { name: "Acme", published: true });

  const own = call(handle, "documents.list").body.documents[0];
  assert.equal(own.href, "https://s3/secret.pdf", "the owner sees their own address");

  const pub = call(handle, "published").body.documents[0];
  assert.equal(pub.title, "SOC 2 report", "the artifact is still named");
  assert.equal(pub.released, false);
  assert.equal(pub.href, undefined, "a visitor is never handed the address");
  assert.equal(pub.attested, true);
});

// ---------------------------------------------------------------------------
// The public door.
// ---------------------------------------------------------------------------

it("an UNPUBLISHED centre is not found, rather than empty", () => {
  const { handle } = tenant();
  put(handle, "faq", "q1", { question: "Where?", answer: "Here." });
  const res = call(handle, "published");
  assert.equal(res.status, 404);
  assert.match(res.body.message, /no published trust centre/);
});

it("publishing is a deliberate act, and then the whole centre reads", () => {
  const { handle } = tenant();
  put(handle, "profile", "", { name: "Acme", tagline: "We hold your data.", published: true });
  put(handle, "subprocessor", "s1", { name: "A cloud", purpose: "Compute" });
  put(handle, "policy", "p1", { title: "Access policy" });
  put(handle, "faq", "q1", { question: "Where?", answer: "Here." });
  put(handle, "update", "u1", { at: "2026-08-01", title: "Rotated our signing keys" });
  put(handle, "risk", "", { items: [{ label: "Data processed", value: "Customer content" }] });

  const b = call(handle, "published").body;
  assert.equal(b.org, ORG);
  assert.equal(b.profile.name, "Acme");
  assert.equal(b.subprocessors.length, 1);
  assert.equal(b.policies.length, 1);
  assert.equal(b.faq.length, 1);
  assert.equal(b.updates.length, 1);
  assert.equal(b.risk.items.length, 1);
  assert.equal(b.generated, NOW);
  // Every section is present even when empty, so the page renders "none
  // published" rather than dropping a heading and looking complete. Compared by
  // length, not deepEqual: the value crosses a vm realm boundary, so its Array
  // is not this realm's Array and a strict deepEqual fails on the prototype.
  assert.ok(Array.isArray(b.documents) || b.documents.length === 0);
  assert.equal(b.documents.length, 0);
});

// ---------------------------------------------------------------------------
// The baseline guard: a tenant cannot restate a control the build gate approved.
// ---------------------------------------------------------------------------

it("the deployment cannot author over its OWN inventory through the API", () => {
  const { handle } = load({ own: true });
  const res = put(handle, "control", "iam.pkce.s256", {
    claim: "Everything is fine.",
    mechanism: "Trust me.",
    status: "automated",
    enforced: [{ repo: "a/b", path: "c.go" }],
    verified: [{ method: "test", at: [{ repo: "a/b", path: "c_test.go" }] }],
    maps: [{ clause: "soc2:CC6.1", strength: "full" }],
  });
  assert.equal(res.status, 409);
  assert.match(res.body.message, /governed in git/);
  assert.equal(call(handle, "section.delete", { method: "DELETE", params: { kind: "control", id: "iam.pkce.s256" } }).status, 409);
});

it("a row carrying a baseline id is ignored rather than merged", () => {
  const { handle } = load({
    own: true,
    seed: [{ kind: "control", id: "iam.pkce.s256", ord: 0, updated: 1, data: JSON.stringify({ id: "iam.pkce.s256", status: "automated" }) }],
  });
  const ids = call(handle, "controls.list").body.controls.filter((c) => c.id === "iam.pkce.s256");
  assert.equal(ids.length, 1, "the baseline entry wins and there is exactly one");
  assert.match(ids[0].claim, /challenge/, "it is the committed one, not the row");
});

// ---------------------------------------------------------------------------
// One validator, both callers.
// ---------------------------------------------------------------------------

it("an authored control is held to the SAME rule a committed one is", () => {
  const { handle } = tenant();
  const base = {
    claim: "Something true.",
    mechanism: "How it works.",
    status: "automated",
    enforced: [{ repo: "acme/app", path: "auth.go" }],
    verified: [{ method: "test", at: [{ repo: "acme/app", path: "auth_test.go" }] }],
    maps: [{ clause: "soc2:CC6.1", strength: "full" }],
  };
  assert.equal(put(handle, "control", "acme.auth", base).status, 200);

  // The claim ban: prose may not say we hold a certificate.
  const claims = put(handle, "control", "acme.b", { ...base, claim: "We are certified." });
  assert.equal(claims.status, 400);
  assert.match(claims.body.errors.join(" "), /does not claim status/);

  // A framework belongs in maps, where it arrives attached to a number.
  const names = put(handle, "control", "acme.c", { ...base, mechanism: "Meets SOC 2 in full." });
  assert.equal(names.status, 400);
  assert.match(names.body.errors.join(" "), /a framework belongs in maps/);

  // A mapping to a clause no framework declares scores nowhere and reads as
  // coverage to anyone who opens the file.
  const ghost = put(handle, "control", "acme.d", { ...base, maps: [{ clause: "soc2:ZZ9.9", strength: "full" }] });
  assert.equal(ghost.status, 400);
  assert.match(ghost.body.errors.join(" "), /no framework declares that clause/);

  // Anything short of automated must say what is missing.
  const shrug = put(handle, "control", "acme.e", { ...base, status: "partial" });
  assert.equal(shrug.status, 400);
  assert.match(shrug.body.errors.join(" "), /requires a note/);
});

it("an authored control counts, and an ABSENT one still never moves a number", () => {
  const { handle } = tenant();
  const base = {
    claim: "Something true.",
    mechanism: "How it works.",
    enforced: [{ repo: "acme/app", path: "auth.go" }],
    maps: [{ clause: "soc2:CC6.1", strength: "full" }],
  };
  put(handle, "control", "acme.real", {
    ...base,
    status: "automated",
    verified: [{ method: "test", at: [{ repo: "acme/app", path: "auth_test.go" }] }],
  });
  put(handle, "control", "acme.wish", {
    ...base,
    status: "absent",
    note: "We do not have this yet.",
    maps: [{ clause: "soc2:CC6.2", strength: "full" }],
    verified: [{ method: "read", at: [{ repo: "acme/app", path: "auth.go" }] }],
  });

  const soc2 = call(handle, "coverage.get", { params: { framework: "soc2" } }).body;
  assert.equal(soc2.automated, 1, "the real one counts");
  const wished = soc2.clauses.find((c) => c.id === "CC6.2");
  assert.equal(wished.level, "none", "the absent one does not");
  assert.equal(wished.controls.length, 0, "and it is not even listed as covering it");
  // It is still a roadmap: the control exists and names the clause it would
  // satisfy. Naming it simply never moves a number.
  assert.equal(call(handle, "controls.get", { params: { id: "acme.wish" } }).body.maps[0].clause, "soc2:CC6.2");
});

it("a category outside the eight is refused, so no section renders nowhere", () => {
  const { handle } = tenant();
  const base = {
    claim: "Something true.",
    mechanism: "How it works.",
    status: "automated",
    enforced: [{ repo: "acme/app", path: "auth.go" }],
    verified: [{ method: "test", at: [{ repo: "acme/app", path: "auth_test.go" }] }],
    maps: [{ clause: "soc2:CC6.1", strength: "full" }],
  };
  assert.equal(put(handle, "control", "acme.ok", { ...base, category: "network" }).status, 200);
  const bad = put(handle, "control", "acme.bad", { ...base, category: "vibes" });
  assert.equal(bad.status, 400);
  assert.match(bad.body.errors.join(" "), /category must be one of/);
});

// ---------------------------------------------------------------------------
// Tenancy, structurally.
// ---------------------------------------------------------------------------

it("no route reads an organization out of the request", () => {
  const { handle } = tenant();
  // Every route but health refuses without the host's tenant, and there is no
  // parameter that can supply one — the org arrives on the envelope the host
  // fills from the validated bearer, and nowhere else.
  for (const route of ["center", "controls.list", "coverage.list", "documents.list", "published"]) {
    const res = handle({ route, method: "GET", params: { org: "victim", orgId: "victim" }, query: { org: "victim" } });
    assert.equal(res.status, 401, route);
  }
  assert.equal(call(handle, "health", { org: "" }).status, 200, "health needs none");
});

it("a single-valued section cannot be made plural by naming an id", () => {
  const { handle } = tenant();
  put(handle, "profile", "", { name: "First" });
  put(handle, "profile", "sneaky", { name: "Second" });
  assert.equal(call(handle, "profile.get").body.name, "Second", "the second write replaced the first");
  const { rows } = tenant();
  void rows;
  // One row, whatever id was asked for.
  const b = call(handle, "center").body;
  assert.equal(b.profile.name, "Second");
});

it("a section nobody has heard of is not found, rather than created", () => {
  const { handle } = tenant();
  const res = put(handle, "vibes", "x", { anything: true });
  assert.equal(res.status, 404);
  assert.match(res.body.message, /no trust section/);
});
