# hanzoai/trust — architecture

A cloud plugin that serves `/v1/trust/*` from inside the unified `hanzoai/cloud`
binary. It publishes a control inventory, computes coverage against published
framework clause lists, lists the artifacts a reviewer asks for, and reads
evidence out of the platform's audit trail.

## Why it exists

Buying a compliance platform buys a dashboard that mirrors what you type into it.
This repo inverts that: an inventory is data, every control names the repo and
path where the mechanism lives, and coverage is a fold over that data rather than
a number anyone sets. Several entries record that a mechanism is weaker than a
Hanzo page claims. That is the point.

## It is a PRODUCT, and there are two kinds of tenant

Any organization can publish a trust centre. What separates the deployment's own
from a customer's is only where the controls come from:

- **the deployment's** inventory is `controls.json`, compiled into the bundle,
  gated at build time by `goja/check.mjs`, unreachable from any request. Adding
  one is a commit. `__own()` is how the bundle learns this tenant is that one.
- **everyone else** authors rows in their own Base/SQLite file.

Both are held to the **same validator** and folded by the **same arithmetic**, so
nobody's numbers — including ours — are arrived at differently from anyone
else's. `frameworks.json` is shared: it is the published standards, and it is the
denominator of every count.

A row carrying a baseline id is dropped rather than merged, so a write cannot
restate a control the build gate approved.

## Shape (HIP-0106, same as captable)

```
controls.json      the deployment's own inventory — gated in git
subprocessors.json the deployment's own disclosure — gated in git, same shape of rule
frameworks.json    the clause universes — the DENOMINATOR of every count
bin/
  surface.mjs      what a browser REACHES, measured against what we disclose
  surface.test.mjs its arithmetic, over the same harness the bundle suite uses
embed.go           //go:embed goja/bundle.js, std-lib only; Version, Bundle(), Schema
goja/
  check.mjs        the rules: schema + the claim ban. ONE module, TWO callers —
                   build.mjs runs it before esbuild, and the bundle imports it so
                   an AUTHORED control is held to the rule a COMMITTED one is
  check.d.mts      its types, hand-written (forty lines of signatures)
  build.mjs        validate -> normalize -> inline -> esbuild
  bundle.js        the artifact, committed (the Go embed reads it)
  src/
    inventory.ts   the compiled-in baseline + the questions worth asking of it
    db.ts          the store seam: ONE record table, and the kinds
    center.ts      a tenant's centre — the fold, validation, reads and writes
    coverage.ts    the fold (takes a control LIST; defaults to the baseline)
    evidence.ts    control id -> audit actions -> the host
    host.ts        __now, __audit
    reply.ts       Ctx, Res, and the answers
    index.ts       dispatch
  test/            95 cases over the BUILT artifact in a bare node:vm
site/              the page — a Next static export that reads the published door
```

## The decisions

**One table, discriminated.** A trust centre is small, read-mostly and
page-shaped: a profile, controls, documents, subprocessors, policies, an FAQ, a
changelog, a risk sheet, none of which join. Eight tables would be eight
migrations, eight reads and eight tests for one shape with a discriminator. The
DDL is `embed.go`'s `Schema`, beside the SQL written against it — a schema in one
repo and the statements in another is how the two come to disagree about a
column. There is no org column: the FILE is the tenant, so a query that could
name another organization would need a column to name it in.

**Tier is a property of the ARTIFACT, and it defaults closed.** The line is who
attested it. Anything the organization asserts is public — controls, coverage,
subprocessors, policies, questions, updates, the risk sheet, and a CAIQ/SIG/VSA
self-assessment, which is self-attested by definition. Anything an independent
auditor signed is gated: a SOC 2 report, an ISO certificate, a penetration test,
an auditor letter. That half is **structural, not conventional** — `KINDS` marks
those four `attested` and the validator refuses `tier: "public"` on one, so there
is no field in which to publish it. A new kind defaults to gated.

**Metadata, never bytes.** A gated document appears in the listing with its
title, its type and its date and no address. That makes "available on request" a
checkable fact rather than a phrase. The bytes and the grant belong to
`cloud/apps/dataroom`.

**Two doors.** `center` is the caller's own, from the validated bearer, and
carries its own documents' addresses. `published` is what a visitor with no
credential reads — a public document addressed by a public name, the way a site
is addressed by its slug. It answers only for an organization that has published,
and an unpublished centre is NOT FOUND rather than empty, because an empty centre
and a centre nobody meant to show read the same and are not the same.

**The clock is the host's.** `src/` contains no `Date.now()`. Every response is a
pure function of its inputs plus `__now()`, which is what lets the suite assert
exact values and what lets the bundle run in goja.

**The trail is behind one function.** `__audit` takes `{actions, from, to, limit}`
and has **no org field**: the host binds it to the tenant it validated, so there
is nothing a caller's parameter could reach. Without it, `/v1/trust/evidence`
answers 501 and says the trail was not read — never an empty list, which reads as
"we looked and found nothing", a different claim and a false one.

**Validate before you bundle, and again before you write.** `check.mjs` runs
first at build. The same module runs at the write boundary, so a control authored
through the API cannot claim a certificate, cannot name a framework in its prose
(a framework belongs in `maps`, where it arrives attached to a number), cannot
shrug with a bare `partial`, and cannot map to a clause no framework declares.

**The bundle is wrapped, and that is load-bearing.** `build.mjs` sets
`lineLimit: 100`. Printed as one line, 174 clause titles and three notes shared
it with every framework name, so ISO A.5.30 "ICT readiness for business
continuity" read as a hedge beside "SOC 2" and `bin/certclaims` — which is
LINE-scoped — refused the repo. Wrapping restores the scoping that gate assumes
and makes a 64 KB inventory diffable in git, which is this repo's whole premise.

**`build.mjs` must run from `goja/`.** esbuild records source paths relative to
the working directory, so `node build.mjs` there and `node goja/build.mjs` from
the root produce different bytes and the staleness test fails on a build that was
otherwise correct.

## How coverage is computed

`none < partial < automated`. A mapping is worth the **weakest** of three things:
what the control claims, how much of the clause that mapping answers
(`full`/`partial`), and whether anything can **fail** on the control's behalf — a
`test` or `audit` check counts, a `read` does not. A clause takes the strongest
mapping pointed at it. An `absent` control is worth nothing however it maps.

The denominator is the framework's whole published clause list, so uncovered
clauses stay visible instead of dropping out of the fraction. Every count is
emitted with its `unit`/`units`, because "12 of 20" is not a fact until you know
what the 20 are.

Nothing emits a boolean. There is no "compliant" field and there will not be one.

## Categories

A control belongs to one of eight groups — `infrastructure`, `data`, `access`,
`network`, `endpoint`, `corporate`, `product`, `incident` — a closed vocabulary,
because the page renders one tile per group and an unrecognised ninth would
render nowhere. All eight are answered now; three of them (endpoint, product,
incident) were empty, and what filled them is worth knowing because it was not
new work.

**Two of the three were mechanisms nobody had inventoried.** `product` is the
shared pipeline's own refusals — the copy gate, the unresolved-merge gate, the
build-argument gate — each a script in `hanzoai/ci/bin` that exits non-zero
ahead of every build, which is a control with a test by construction. `incident`
is the status plane: a prober per endpoint and a public read with no credential.
Both existed and had simply never been written down, which is the ordinary case
and the reason an empty group is worth rendering rather than hiding.

**One was genuinely absent and stayed absent.** Nothing consults the state of the
machine a person signs in from, so `endpoint.posture` names the place in the
sign-in flow where such a signal would be read and records that none is. An
absent control never moves a count; it names the clause it would answer and
reports the gap. Filling a group by inventing a control would have been the one
move this repo exists to refuse.

## Who else touches the data

`subprocessors.json` is `controls.json` one section over and every structural
argument carries: compiled into the bundle, gated by `check.mjs` at build time,
folded with a tenant's own rows by `center.parties()`, and unreachable from any
request. Adding a party is a commit — a party that can read customer data is not
something a request should be able to add or remove.

**`role` is the disclosure, and the schema is what stops it being left implied.**
A `processor` receives or can reach customer data and must say WHAT it receives,
WHERE it is and under WHICH terms — the three a reviewer asks, all required, so
a party cannot be filed without answering them. A `vendor` is a party we buy from
that no customer data reaches, and must still say so in words: an advertising
platform is a purchase, not a route data travels, and "none, and here is why" is
a claim where a blank field is not one. The claim ban applies here too, because a
party's own marketing is the likeliest place a status claim gets copied in, and
repeating one is making it.

`governed(kind, id)` is ONE predicate over both compiled-in sections. The control
guard and the party guard were the same question and a second copy is how the two
come to disagree about what "ours" means.

## What a browser actually reaches

`bin/surface.mjs` measures the half of the disclosure nobody has to take on
trust. It loads each surface as a browser would and asks two questions:

1. no advertising or product-analytics tag may be REACHED — a denylist, narrow
   and loud;
2. any OTHER third party reached must be declared here as an `evidence[].origin`.

The second is what stops the list going stale: a party added to a page is a party
added to the disclosure, in the same change, or there is no release.

**Reached is not the same as present, and both halves are needed.** A tag sitting
in markup behind an enforced policy that omits its origin is never fetched, so
counting it reports a leak that does not happen; a policy sent `-Report-Only`
enforces nothing, so a page carrying only that permits everything however strict
it reads. Measured on the fleet, both errors are live — most surfaces carry the
edge-inserted page-timing script in their markup and refuse it, and one carries a
report-only policy and runs it. Neither a markup scan nor a header scan would
have got that right on its own.

The measure is split for the same reason: a TAG is a fetch, and a URL in an
inline script may be a fetch or a link with nothing to tell them apart — so the
precise measure decides the disclosure rule, and the broad one decides the
denylist, where over-reporting costs a sentence and under-reporting costs the
claim. The ordinary way a tag gets installed is a script that builds a script.

**The surfaces are named in `hanzo.yml`, not in the tool.** Which hosts a
deployment serves is deployment configuration, and a default list compiled in
would be a second copy of it. The cost is stated rather than hidden: the gate
fails on a surface it cannot read, so a fleet outage reds this repo's pipeline.
That is the intended direction — a claim about what a page loads is not one to
keep making while nobody can load it — but it is a real coupling and worth
knowing before it surprises somebody.

## Marks

`site/scripts/marks.mjs` generates `site/components/marks.ts` from simple-icons
(CC0-1.0), the one source, under `hanzo.ai/scripts/gen-marks.mjs`'s policy: one
table is the whole provenance record, pin the current release and take what it
ships, and a party the set does not carry gets a monogram plate. Never a
hand-drawn substitute — a plate that says nothing is honest, and a look-alike is
a claim about somebody else's brand. Eleven parties have a mark and five do not,
each recorded with its reason. The publishers of the three frameworks have none
either, so they wear plates beside their coverage figures.

The OUTPUT differs from hanzo.ai's and the reason is the deployment: that page
serves files out of `public/`, and this one is a static export whose enforced
policy is `img-src 'self' data:`. So the geometry is emitted as a module of path
data and inlined — same bytes, carried a way the page can render.

## What the tests hold

`node goja/test/run.mjs` — 104 cases, all against the built `bundle.js` loaded in
a `node:vm` with only the globals the Go host provides, including a model of the
tenant store. `node bin/surface.test.mjs` is 11 more over the gate's own
arithmetic, on the same harness: the cases that decide a verdict, each written so
that getting it backwards fails. Synthetic inventories are built through the same `build.mjs`, so
the arithmetic under test is the artifact, not a second implementation.

Two of them pin the HOST CONTRACT rather than behaviour, because the host ships
from another repo: one asserts the bundle reaches for nothing outside the
sandbox, and one asserts the `__`-prefixed globals it reads are exactly the five
the host injects — subtracting the ones esbuild declares itself, since a helper
is declared in the file and a host global is not.

Proven to fail, by mutation: making `absent` count breaks the absent case;
disabling the undeclared-clause rule breaks two validator cases; editing
`controls.json` without rebuilding breaks the staleness case.

## Mount

`hanzoai/cloud`'s `apps/trust` imports this module, runs the bundle on the shared
`apps/goja` Base binding (one SQLite file per tenant, one transaction per
request), and injects the two tenant-bound globals through `goja.BaseConfig.Bind`.

```
globalThis.__now()    -> unix milliseconds                       REQUIRED
globalThis.__newId()  -> a collision-resistant id                REQUIRED
globalThis.__db       -> { query, exec } on THIS tenant's file   REQUIRED
globalThis.__own()    -> is this tenant the inventory's owner    REQUIRED
globalThis.__audit(q) -> { rows, total }                         OPTIONAL
```

Route keys: `health`, `center`, `published`, `profile.get`, `controls.list`,
`controls.get`, `frameworks.list`, `coverage.list`, `coverage.get`,
`documents.list`, `subprocessors.list`, `policies.list`, `faq.list`,
`updates.list`, `risk.get`, `evidence.get`, `section.put`, `section.delete`.
`health` is open, `published` takes the org from the address, everything else
needs the validated tenant.
