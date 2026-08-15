# hanzoai/trust

Compliance as data. A control inventory you can diff, coverage computed from it,
and evidence pulled from the audit trail — served by the unified `hanzoai/cloud`
binary at `/v1/trust/*`.

The thing it refuses to do is the reason it exists. It does not claim a
certification, it does not emit a boolean "compliant", and it will not count a
control we do not have. A control marked `absent` still names the clause it
would satisfy — that is a roadmap, and it is useful — but naming it never moves
a number. `goja/check.mjs` enforces that in the build, not in a review.

## The three things

**1. An inventory that is data.** `controls.json`. Each control names what it
asserts, the mechanism, the repo and file path where it is enforced, how it is
verified, and the framework clauses it maps to. Every path in it was opened and
read before it was written down.

**2. Coverage, computed.** `frameworks.json` declares each framework's full
clause list — that list is the denominator. Coverage folds the controls onto it
and reports how many clauses have an automated control, how many are partial,
and how many have none. Counting only the clauses some control happened to name
would produce 100% every time.

**3. Evidence from the trail.** A control verified `audit` declares the action
names that evidence it. `/v1/trust/evidence` hands those to the host and returns
the rows, scoped to the caller's own organization.

## Routes

All read-only, all `GET`, all under `/v1/trust`. Everything except `health`
requires the validated bearer; the organization comes from the token and is
never read from a parameter or a body.

| HTTP | route key | answers |
|---|---|---|
| `GET /v1/trust/health` | `health` | `{"service":"trust","status":"ok"}` |
| `GET /v1/trust/controls` | `controls.list` | every control, plus the inventory's own counts |
| `GET /v1/trust/controls/:id` | `controls.get` | one control |
| `GET /v1/trust/frameworks` | `frameworks.list` | each framework, its source, its unit, its clause count |
| `GET /v1/trust/coverage` | `coverage.list` | per-framework counts — what a badge reads |
| `GET /v1/trust/coverage/:framework` | `coverage.get` | every clause of one framework with its status and the controls behind it |
| `GET /v1/trust/evidence?control=&from=&to=&limit=` | `evidence.get` | the audit rows evidencing one control over a window |

`from` and `to` take an RFC 3339 date — `2026-01-01` or a full instant. Both are
optional; omitting one leaves that end unbounded. A malformed bound is a `400`
rather than a silently widened window.

A `POST`, `PUT`, `PATCH` or `DELETE` to any of these is `405` with the reason:
the inventory is build-time data governed in git, and the trail is written by the
platform. Neither is authorable through this API — which is the property that
makes the evidence worth reading.

## The plugin contract (HIP-0106)

Same shape as `hanzoai/captable` and `hanzoai/plans`:

```
goja/src/*.ts     the logic, in TypeScript
goja/build.mjs    validates the inventory, inlines it, bundles with esbuild
goja/bundle.js    the artifact — self-contained, ESM-free, committed
embed.go          //go:embed goja/bundle.js, std-lib only
```

The Go host compiles the bundle once, pools the runtimes, and calls:

```
globalThis.handle({ route, method, params, orgId, body }) -> { status, body }
```

Path values arrive in `params` and query values in `query`; they mean the same
thing to every handler, so they are merged once at the boundary. `orgId` is the
gateway-minted, validated tenant.

### What the host injects

```
globalThis.__now()    -> unix milliseconds                       REQUIRED
globalThis.__audit(q) -> { rows, total }                         OPTIONAL
```

There is **no `__db`** and **no `__newId`**: this plugin has no writes and needs
no per-tenant database. `__now` is the only clock — `src/` contains no
`Date.now()`, so every response is a pure function of its inputs.

`__audit` is the one seam to the audit trail. That trail lives in the platform's
own store, not in a per-tenant Base file, so the bundle names none of its tables
or columns and issues no SQL. The host implements the query:

```ts
__audit({ actions, from, to, limit }) -> { rows: unknown[], total: number }
```

The query carries **no organization**. The host binds `__audit` to the tenant it
validated, per request, so the bundle has no field in which to name another one —
a tenant the caller cannot express is a tenant the caller cannot cross. Rows pass
straight through; the bundle reads no field off one, so the projection can change
without touching this repo.

Without `__audit`, `/v1/trust/evidence` answers `501` and says the trail was not
read. It never returns an empty list, because an empty list reads as "we looked
and found nothing" — a different claim, and a false one.

## Adding a control

1. Read the source. Find the file that actually enforces the thing.
2. Add an entry to `controls.json`:

```json
{
  "id": "iam.pkce.s256",
  "title": "Only the S256 proof key method is accepted",
  "claim": "One sentence a reviewer could test.",
  "mechanism": "How it works, in plain words.",
  "status": "automated",
  "enforced": [{ "repo": "hanzoai/iam", "path": "internal/oidc/pkce.go", "symbol": "VerifyPKCE" }],
  "verified": [{ "method": "test", "at": [{ "repo": "hanzoai/iam", "path": "internal/oidc/pkce_test.go", "symbol": "TestVerifyPKCE_PlainRejected" }] }],
  "maps": [{ "clause": "soc2:CC6.1", "strength": "full" }]
}
```

3. `node goja/build.mjs` — it validates before it bundles, so a mistake is a
   build failure rather than a wrong number.
4. `npm --prefix goja test`.
5. Commit `controls.json` **and** the regenerated `goja/bundle.js`. A test
   rebuilds in memory and compares, so a stale bundle fails.

### The fields, exactly

- **`status`** — `automated` (it runs with nobody in the loop), `partial` (it
  runs but does not cover the whole assertion), `absent` (we do not have it).
  Anything other than `automated` **requires** a `note` saying what is missing.
  The build refuses a `partial` that shrugs.
- **`enforced`** — repo-relative paths only. Write one after you have opened it.
- **`verified`** — `test` (an automated test at `at`, it can fail), `read` (a
  person read the source, it cannot fail on its own), `audit` (rows in the trail;
  `actions` names them, and this is what `/v1/trust/evidence` queries). Whether a
  control counts as *verified* is derived from this, never declared: only `test`
  and `audit` count, because only they can fail.
- **`maps`** — `"<framework>:<clause>"` with `strength` `full` or `partial`. The
  clause must exist in `frameworks.json` or the build fails: a mapping to nothing
  scores nowhere while reading like coverage to anyone who opens the file.

### What the prose may not say

`goja/check.mjs` refuses any control whose text claims a certification,
accreditation, attestation, compliance, or a validated module — and refuses any
control that names a framework at all. A framework appears in exactly one place,
the `maps` edges, where it arrives attached to a number. Clause titles in
`frameworks.json` are exempt: they are the published standard's own words, and
rewriting them to satisfy our copy rule would be the dishonest move.

## How coverage is computed

One lattice, `none < partial < automated`. A mapping is worth the **weakest** of
three things — what the control claims, how much of the clause the mapping
answers, and whether anything can *fail* on the control's behalf. A clause takes
the **strongest** mapping pointed at it; an `absent` control contributes `none`
regardless of what its mapping claims.

| control | mapping | evidence | contributes |
|---|---|---|---|
| `automated` | `full` | test or audit | automated |
| `automated` | `full` | read only | partial |
| `automated` | `partial` | any | partial |
| `partial` | either | any | partial |
| `absent` | either | any | **none** |

Frameworks count in different units, so every number carries its own — `unit` is
`criterion` for the Trust Services Criteria, `control` for ISO/IEC 27001:2022
Annex A, and `family` for the SP 800-53 families. "12 of 20 families have at
least one automated control" is a sentence that survives being quoted. "20 of 20
families covered" would not be, which is why the unit travels with the count.

## Build and test

```
node goja/build.mjs          # validate + regenerate bundle.js
npm --prefix goja test       # build, then the suite
npm --prefix goja run typecheck
go build ./...               # the embed
```

The suite covers the coverage arithmetic against synthetic inventories, the
validator against deliberately broken ones, the dispatch surface against the
built bundle in a bare `node:vm`, and the committed bundle against a fresh
in-memory build.
