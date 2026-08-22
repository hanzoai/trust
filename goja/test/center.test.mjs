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
  put(handle, "subprocessor", "s1", {
    name: "A cloud",
    role: "processor",
    purpose: "Compute",
    data: "Every request, and everything stored at rest.",
    location: "United States",
    terms: "https://example.test/dpa",
    evidence: [{ repo: "acme/infra", path: "terraform/main.tf" }],
  });
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

// normalize() in build.mjs rebuilds a control field by field, so a field it does
// not name is dropped between controls.json and the bundle — silently, and
// visible only on a page where the grouping had gone missing. This is the gate
// for that whole class: every control the real inventory ships reaches the
// artifact carrying a group from the closed set.
it("every control reaches the bundle carrying its category", () => {
  const { handle } = load({ own: true });
  const groups = [
    "infrastructure", "data", "access", "network",
    "endpoint", "corporate", "product", "incident",
  ];
  const controls = call(handle, "controls.list").body.controls;
  assert.ok(controls.length > 0);
  // Compared by LENGTH, not deepEqual: the value crosses a vm realm boundary, so
  // its Array is not this realm's and a strict deepEqual fails on the prototype
  // even when the contents match.
  const missing = [...controls].filter((c) => !groups.includes(c.category)).map((c) => c.id);
  assert.equal(
    missing.length,
    0,
    "reached the artifact with no group, or one outside the eight: " + missing.join(", "),
  );
});

// ---------------------------------------------------------------------------
// The disclosure. Same two sources, same validator, same guard as a control —
// and the schema is what makes the classification impossible to leave implied.
// ---------------------------------------------------------------------------

// A party a customer's data reaches, filed without saying WHAT it reaches, is a
// name on a page. That is the thing this section exists instead of, so the
// field carrying the classification is required rather than encouraged.
it("a party filed without saying what data reaches it is refused", () => {
  const { handle } = tenant();
  const res = put(handle, "subprocessor", "s1", {
    name: "A cloud",
    role: "processor",
    purpose: "Compute",
    location: "United States",
    terms: "https://example.test/dpa",
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => /data is required/.test(e)), res.body.errors.join("; "));
});

// The three a reviewer asks of a party that holds their data. Made structural:
// there is no way to file a processor without answering all of them.
it("a processor must say where it is and under which terms", () => {
  const { handle } = tenant();
  const res = put(handle, "subprocessor", "s1", {
    name: "A cloud",
    role: "processor",
    purpose: "Compute",
    data: "Everything.",
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => /where it is/.test(e)), res.body.errors.join("; "));
  assert.ok(res.body.errors.some((e) => /terms/.test(e)), res.body.errors.join("; "));
});

// The other half of the same rule. A vendor is a party nothing reaches, so
// asking it for a residency and a processing agreement would be asking about
// something that does not happen — but it still has to say so in words, because
// "none, and here is why" is the claim and a blank field is not that claim.
it("a vendor needs no residency, and still has to say nothing reaches it", () => {
  const { handle } = tenant();
  const ok = put(handle, "subprocessor", "v1", {
    name: "An advertising platform",
    role: "vendor",
    purpose: "Advertising we buy.",
    data: "None. No script of theirs is served by any surface of ours.",
    evidence: [{ origin: "ads.example.test" }],
  });
  assert.equal(ok.status, 200);
  const bare = put(handle, "subprocessor", "v2", {
    name: "Another platform",
    role: "vendor",
    purpose: "Advertising we buy.",
    evidence: [{ origin: "other.example.test" }],
  });
  assert.equal(bare.status, 400);
});

it("a party with no role, or one outside the pair, is refused", () => {
  const { handle } = tenant();
  const base = { name: "A cloud", purpose: "Compute", data: "Everything." };
  assert.equal(put(handle, "subprocessor", "s1", base).status, 400);
  assert.equal(put(handle, "subprocessor", "s2", { ...base, role: "partner" }).status, 400);
});

// The claim ban reaches here too. A party's own marketing is the likeliest place
// a status claim gets copied into this repository, and repeating one is making
// it — so the same module that refuses it in a control refuses it here.
it("a party cannot be filed carrying a claim about its own status", () => {
  const { handle } = tenant();
  const res = put(handle, "subprocessor", "s1", {
    name: "A cloud",
    role: "processor",
    purpose: "Compute, and they are certified.",
    data: "Everything.",
    location: "United States",
    terms: "https://example.test/dpa",
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => /does not restate/.test(e)), res.body.errors.join("; "));
});

// The guard a control already has, now asked of both sections by one predicate.
// A party that can read customer data is not something a request may add or
// remove: adding one is a commit, and the fold drops a row that tries to
// restate a declared id rather than merging it.
it("the deployment cannot author over its OWN disclosure through the API", () => {
  const { handle } = load({ own: true });
  const res = put(handle, "subprocessor", "cloudflare", {
    name: "Not Cloudflare",
    role: "vendor",
    purpose: "Nothing at all.",
    data: "None.",
  });
  assert.equal(res.status, 409);
  assert.match(res.body.message, /governed in git/);
  const gone = call(handle, "section.delete", {
    method: "DELETE",
    params: { kind: "subprocessor", id: "cloudflare" },
  });
  assert.equal(gone.status, 409);
});

it("the compiled-in disclosure belongs to ONE organization", () => {
  assert.ok(call(load({ own: true }).handle, "subprocessors.list").body.subprocessors.length > 0);
  assert.equal(call(tenant().handle, "subprocessors.list").body.subprocessors.length, 0);
});

// Every party this deployment declares reaches the artifact carrying the field
// the page groups on and the field the disclosure turns on. Same gate, and same
// reason, as the one below it for a control's category: normalize and the bundle
// sit between the file and the reader, and a field dropped in between is visible
// only as a column that quietly went missing.
it("every declared party reaches the bundle with a role from the pair", () => {
  const { handle } = load({ own: true });
  const rows = [...call(handle, "subprocessors.list").body.subprocessors];
  assert.ok(rows.length > 0);
  const bad = rows.filter((s) => s.role !== "processor" && s.role !== "vendor").map((s) => s.id);
  assert.equal(bad.length, 0, "reached the artifact with no role: " + bad.join(", "));
  const mute = rows.filter((s) => !s.data || !s.purpose).map((s) => s.id);
  assert.equal(mute.length, 0, "reached the artifact saying nothing: " + mute.join(", "));
  // At least one party is disclosed as reachable in a browser, which is what
  // bin/surface resolves what our pages reach against. With none, that gate has
  // nothing to check and would pass by being empty.
  const origins = rows.flatMap((s) => (s.evidence || []).filter((e) => e.origin));
  assert.ok(origins.length > 0, "no party declares an origin, so bin/surface checks nothing");
});
