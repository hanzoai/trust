// Package trust embeds the trust goja bundle so the unified hanzoai/cloud
// binary can host the trust-centre logic in-process via the dop251/goja engine
// (HIP-0106), without copying the bundle into the cloud repo.
//
// A trust centre is a PRODUCT: any organization can publish one. Two things
// make that work without two implementations.
//
//   - The control inventory in controls.json is ONE organization's — this
//     deployment's own. It is compiled into the bundle, so no request can edit
//     it and adding a control is a commit. The host answers __own() to say
//     whether the tenant of a dispatch is that organization.
//   - Every other organization authors rows in its own Base/SQLite file. The
//     SAME fold computes both, so no tenant's numbers are arrived at by
//     different arithmetic than ours, and the SAME validator gates both, so a
//     control authored through the API is held to the rule a committed one is.
//
// The framework clause catalogs (frameworks.json) are shared: they are the
// published standards, and they are the denominator of every count.
//
// This Go file is a read-only embed:
//
//   - Bundle() returns goja/bundle.js — the self-contained, ESM-free logic that
//     serves /v1/trust/*. The Go host runs it in goja, calling
//     globalThis.handle({route,method,params,query,orgId,body}) per request.
//   - Schema is the per-tenant DDL the host runs when a tenant's database first
//     opens. It lives here, beside the bundle whose SQL is written against it,
//     because a schema in one repo and the statements in another is how the two
//     come to disagree about a column.
//
// The host contract, in full:
//
//	globalThis.__now()    -> unix milliseconds                       REQUIRED
//	globalThis.__newId()  -> a collision-resistant id                REQUIRED
//	globalThis.__db       -> { query, exec } on THIS tenant's file   REQUIRED
//	globalThis.__own()    -> is this tenant the inventory's owner    REQUIRED
//	globalThis.__audit(q) -> { rows, total }                         OPTIONAL
//
// __audit is the one narrow function through which the bundle reads the
// platform's audit trail, and it carries no organization: the host binds it to
// the tenant it validated, so a tenant the caller cannot express is a tenant
// the caller cannot cross. Without it /v1/trust/evidence answers 501 and says
// the trail was not read — never an empty list, which reads as "we looked and
// found nothing", a different claim and a false one.
//
// Mirrors github.com/hanzoai/captable and github.com/hanzoai/plans (the proven
// precedents); captable is the read-write one this now matches.
package trust

import _ "embed"

// Version identifies the embedded bundle for the host's mount log. Bump on any
// change to goja/bundle.js or to the inventory it carries. goja/build.mjs reads
// this const and inlines it, so the Go const and the served payload cannot
// disagree about which inventory is running.
//
// The 0.2 line is where the plugin stopped being one organization's page and
// became a product: per-tenant storage, the authoring surface, and the public
// door. The host contract gained three required globals there, which is why it
// was a minor and not a patch — an older host cannot run this bundle.
const Version = "0.2.4"

//go:embed goja/bundle.js
var bundle []byte

// Bundle returns the goja bundle source (goja/bundle.js). The host compiles it
// once and runs it on each pooled goja runtime.
func Bundle() ([]byte, error) {
	if len(bundle) == 0 {
		return nil, errEmptyBundle
	}
	return bundle, nil
}

// Schema is the per-tenant DDL, run idempotently when an organization's
// database first opens.
//
// ONE table. A trust centre is small, read-mostly and page-shaped — a profile,
// some controls, some documents, a subprocessor list, a few policies, an FAQ, a
// changelog, a risk sheet — and none of them join to another. Eight tables
// would be eight migrations, eight reads, eight writes and eight tests for what
// is one shape with a discriminator. `data` is the record's own JSON, and what
// may be in it is decided by goja/check.mjs, which is the same module the build
// gate runs.
//
// There is no org column, and that is the isolation argument: the file IS the
// tenant. A query that could name another organization would need a column to
// name it in, and there is not one.
const Schema = `
CREATE TABLE IF NOT EXISTS record (
  kind    TEXT    NOT NULL,
  id      TEXT    NOT NULL,
  ord     INTEGER NOT NULL DEFAULT 0,
  data    TEXT    NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS record_kind ON record (kind, ord, id);
`

// errEmptyBundle is returned if the embed produced no bytes (a build that forgot
// to run goja/build.mjs). Fail loud rather than mount an empty bundle.
var errEmptyBundle = &bundleError{"trust: embedded goja/bundle.js is empty (run `node goja/build.mjs`)"}

type bundleError struct{ msg string }

func (e *bundleError) Error() string { return e.msg }
