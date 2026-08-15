# hanzoai/trust — architecture

A cloud plugin that serves `/v1/trust/*` from inside the unified `hanzoai/cloud`
binary. It publishes a control inventory, computes coverage against published
framework clause lists, and reads evidence out of the platform's audit trail.

## Why it exists

Buying a compliance platform buys a dashboard that mirrors what you type into it.
This repo inverts that: the inventory is a file in git, every entry names the
repo and path where the mechanism lives, and coverage is a fold over that file
rather than a number anyone sets. Several entries record that a mechanism is
weaker than a Hanzo page claims. That is the point of the file.

## Shape (HIP-0106, same as captable and plans)

```
controls.json      the inventory — the product
frameworks.json    the clause universes — the DENOMINATOR of every count
embed.go           //go:embed goja/bundle.js, std-lib only, Version + Bundle()
goja/
  check.mjs        the build gate: schema + the claim ban
  build.mjs        validate -> normalize -> inline -> esbuild
  bundle.js        the artifact, committed (the Go embed reads it)
  src/
    inventory.ts   inlined data + the questions worth asking of it
    coverage.ts    the fold
    evidence.ts    control id -> audit actions -> the host
    host.ts        the ONLY seam: __now, __audit
    reply.ts       Ctx, Res, and the five answers
    index.ts       dispatch
  test/            77 cases over the BUILT artifact in a bare node:vm
```

## The decisions

**No database, no writes.** The inventory is compiled into the bundle, so a
request cannot reach it and a tenant cannot inflate its own coverage. Every route
is a `GET`; anything else is `405` with the reason. The host injects no `__db`
and no `__newId` — this is the read-only sibling of the captable mount.

**The clock is the host's.** `src/` contains no `Date.now()`. Every response is a
pure function of its inputs plus `__now()`, which is what lets the suite assert
exact values and what lets the bundle run in goja.

**The trail is behind one function.** The audit rows live in the platform's own
store, not in a per-tenant Base file, so the bundle names no table and no column.
It hands `{actions, from, to, limit}` to `__audit` and passes rows straight
through. The query has **no org field**: the host binds `__audit` to the tenant
it validated, so there is no field a caller's parameter could reach.

**Validate before you bundle.** `check.mjs` runs first. A control with an unknown
status, a mapping to a clause no framework declares, or a sentence that claims a
certification stops the build — there is no artifact and therefore no number to
misread. The claim ban walks every string in a control except `id` and `maps`, so
a prose field added later is scanned the day it appears.

**One shape past the edge.** The inventory has been authored two ways
(`enforced`/`verified`/`maps`-as-edges and `source`/`check`/`evidence`/
`maps`-as-lists). `build.mjs` `normalize()` reads either and emits the first,
once. Everything downstream sees one shape.

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

## What the tests hold

`node goja/test/run.mjs` — 77 cases, all against the built `bundle.js` loaded in
a `node:vm` with only the globals the Go host provides. Synthetic inventories are
built through the same `build.mjs`, so the arithmetic under test is the artifact,
not a second implementation.

Proven to fail, by mutation: making `absent` count breaks the absent case;
disabling the undeclared-clause rule breaks two validator cases; editing
`controls.json` without rebuilding breaks the staleness case.

## Mount

`hanzoai/cloud` imports `github.com/hanzoai/trust`, compiles `Bundle()` once,
and dispatches `handle({route, method, params, query, orgId})`. Route keys:
`health`, `controls.list`, `controls.get`, `frameworks.list`, `coverage.list`,
`coverage.get`, `evidence.get`. Only `health` is open; everything else needs the
validated tenant.
