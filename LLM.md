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
frameworks.json    the clause universes — the DENOMINATOR of every count
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
because the page renders one column per group and an unrecognised ninth would
render nowhere. **Three of the eight are empty in our own inventory** (endpoint,
product, incident) and the page shows them empty rather than hiding them: a group
we assert nothing in is a fact worth publishing.

## What the tests hold

`node goja/test/run.mjs` — 95 cases, all against the built `bundle.js` loaded in
a `node:vm` with only the globals the Go host provides, including a model of the
tenant store. Synthetic inventories are built through the same `build.mjs`, so
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
