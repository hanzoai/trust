// hanzoai/trust — Go embed module.
//
// This repo's PRIMARY artifact is the control inventory (controls.json,
// frameworks.json) and the goja bundle built from goja/src/*.ts. This tiny Go
// module exists ONLY so the unified hanzoai/cloud binary (HIP-0106) can embed
// the trust goja bundle WITHOUT copying it into the cloud repo. Cloud imports
// github.com/hanzoai/trust and gets Bundle().
//
// std-lib only — no third-party Go deps. The TypeScript in goja/src and the two
// JSON data files stay the single source of truth; the Go layer is a read-only
// embed, exactly like github.com/hanzoai/captable and github.com/hanzoai/plans.
module github.com/hanzoai/trust

go 1.26.5
