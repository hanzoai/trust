// Package trust embeds the trust goja bundle so the unified hanzoai/cloud
// binary can host the compliance logic in-process via the dop251/goja engine
// (HIP-0106), without copying the bundle into the cloud repo.
//
// The control inventory (controls.json), the framework clause catalogs
// (frameworks.json) and the goja/src TypeScript remain the single source of
// truth. This Go file is a read-only embed:
//
//   - Bundle() returns goja/bundle.js — the self-contained, ESM-free logic that
//     serves /v1/trust/*: the inventory, computed coverage, and evidence read
//     out of the audit trail. The Go host runs it in goja, calling
//     globalThis.handle({route,method,params,orgId,body}) per request.
//
// The plugin has NO writes, so the host injects no __db and no __newId and needs
// no per-tenant database. It injects globalThis.__now, and — only to serve
// /v1/trust/evidence — globalThis.__audit, the one narrow function through which
// the bundle reads the platform's audit trail. That trail lives in the
// platform's own store, so the bundle names none of its tables or columns.
// README.md carries both signatures.
//
// The inventory is compiled INTO the bundle, so no request can edit it and no
// tenant can inflate its own coverage. Adding a control is a commit.
//
// Mirrors github.com/hanzoai/captable and github.com/hanzoai/plans (the proven
// precedents).
package trust

import _ "embed"

// Version identifies the embedded bundle for the host's mount log. Bump on any
// change to goja/bundle.js or to the inventory it carries. goja/build.mjs reads
// this const and inlines it, so the Go const and the served payload cannot
// disagree about which inventory is running.
const Version = "0.1.0"

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

// errEmptyBundle is returned if the embed produced no bytes (a build that forgot
// to run goja/build.mjs). Fail loud rather than mount an empty bundle.
var errEmptyBundle = &bundleError{"trust: embedded goja/bundle.js is empty (run `node goja/build.mjs`)"}

type bundleError struct{ msg string }

func (e *bundleError) Error() string { return e.msg }
