// @hanzo/trust — goja bundle entry.
//
// SELF-CONTAINED, NO ESM, NO node: imports. Bundled by esbuild into
// goja/bundle.js and run verbatim inside the dop251/goja engine embedded in
// hanzoai/cloud (HIP-0106), the way hanzoai/captable and hanzoai/plans ship.
//
//   globalThis.__now()    -> unix millis                       (required)
//   globalThis.__newId()  -> a fresh id                        (required for writes)
//   globalThis.__db       -> { query, exec } on THIS tenant     (required)
//   globalThis.__own()    -> is this tenant the baseline's      (required)
//   globalThis.__audit(q) -> { rows, total }                   (optional)
//   globalThis.handle({ route, method, params, query, orgId, body }) -> { status, body }
//   globalThis.trust      -> the same answers with no request around them
//
// A trust centre is a PRODUCT: any organization can publish one. The inventory
// compiled in at build time belongs to exactly one of them — the deployment's
// own — and the host says whose. Everyone else authors rows. One fold serves
// both, so no tenant's numbers are computed by different arithmetic than ours.
//
// TWO DOORS, and the difference is who is asking. `center` is the caller's OWN
// centre, resolved from the validated bearer, and it carries the addresses of
// its own documents. `published` is what a visitor with no credential reads: the
// same document with every gated artifact reduced to the fact that it exists.
// Neither door serves bytes.

import { documents, parties, section, single, controls as own, remove, write } from "./center";
import { framework, summary } from "./coverage";
import { query as evidence } from "./evidence";
import { now } from "./host";
import { control as baseControl, framework as declared, ids, VERSION } from "./inventory";
import { Ctx, notFound, ok, readOnly, Res } from "./reply";

interface Req {
  route?: string;
  method?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  orgId?: string;
  body?: unknown;
}

type Handler = (ctx: Ctx, req: Req) => Res;

function frameworks() {
  return ids().map((id) => {
    const f = declared(id);
    return {
      framework: id,
      name: f ? f.name : "",
      publisher: f ? f.publisher : "",
      edition: f ? f.edition : "",
      unit: f ? f.unit : "",
      units: f ? f.units : "",
      total: f ? f.clauses.length : 0,
    };
  });
}

// One control by id, over the tenant's own fold rather than the baseline alone —
// so an organization can read back a control it authored.
function find(id: string) {
  const cs = own();
  for (let i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
  return baseControl(id);
}

// The whole centre in one answer. The page is one request, because a trust page
// that renders in nine round trips renders nine different instants.
//
// `grant` decides only whether a gated document carries its address. Everything
// else is identical between the two doors, which is what keeps the public page
// and the owner's view from drifting into two descriptions of one organization.
function center(org: string, grant: boolean): Record<string, unknown> {
  const cs = own();
  const s = summary(cs);
  const profile = single("profile") || {};
  return {
    version: VERSION,
    generated: now(),
    org: org,
    profile: profile,
    controls: cs,
    coverage: s.frameworks,
    inventory: s.controls,
    frameworks: frameworks(),
    documents: documents(grant),
    subprocessors: parties(),
    policies: section("policy"),
    faq: section("faq"),
    updates: section("update"),
    risk: single("risk") || { items: [] },
  };
}

const routes: Record<string, Handler> = {
  health: () => ok({ service: "trust", status: "ok", version: VERSION }),

  center: (ctx) => ok(center(ctx.org, true)),

  // The public door. It answers only for an organization that has said its
  // centre is public: an unpublished one is NOT FOUND rather than empty, because
  // an empty centre and a centre nobody meant to show read the same and are not
  // the same. No credential reaches here, so nothing gated does either.
  published: (ctx) => {
    const p = single("profile");
    if (!p || p.published !== true) {
      return notFound("no published trust centre for " + ctx.org);
    }
    return ok(center(ctx.org, false));
  },

  "profile.get": () => ok(single("profile") || {}),

  "controls.list": () => {
    const cs = own();
    return ok({ version: VERSION, ...summary(cs).controls, controls: cs });
  },

  "controls.get": (ctx) => {
    const c = find(ctx.params.id || "");
    return c ? ok(c) : notFound("no control " + (ctx.params.id || "") + " in this trust centre");
  },

  "frameworks.list": () => ok({ frameworks: frameworks() }),

  "coverage.list": () => {
    const cs = own();
    return ok({ version: VERSION, generated: now(), ...summary(cs) });
  },

  "coverage.get": (ctx) => {
    const id = ctx.params.framework || "";
    const d = framework(id, own());
    if (!d) return notFound("no framework " + id + " is mapped", { frameworks: ids() });
    return ok({ version: VERSION, generated: now(), ...d });
  },

  "documents.list": () => ok({ documents: documents(true) }),
  "subprocessors.list": () => ok({ subprocessors: parties() }),
  "policies.list": () => ok({ policies: section("policy") }),
  "faq.list": () => ok({ faq: section("faq") }),
  "updates.list": () => ok({ updates: section("update") }),
  "risk.get": () => ok(single("risk") || { items: [] }),

  "evidence.get": evidence,

  // ONE write route for every section. What may be in a record is decided by
  // center.validate, which runs the SAME module the build gate runs, so a
  // control authored here is held to the rule a committed one is held to.
  "section.put": (ctx, req) => {
    const kind = ctx.params.kind || "";
    const at = now();
    // The body is an ENVELOPE — { ord, data } — because the record itself is an
    // open object and the host binds the section and the id from the URL onto a
    // struct. `data` is the record; `ord` is where the organization wants it in
    // its own section.
    const env = (req.body || {}) as Record<string, unknown>;
    const ord = typeof env.ord === "number" ? (env.ord as number) : 0;
    const r = write(kind, ctx.params.id || "", env.data, at, ord);
    if (!r.ok) {
      const body: Record<string, unknown> = { success: false, message: r.message };
      if (r.errors) body.errors = r.errors;
      return { status: r.status, body: body };
    }
    return ok(r.wrote);
  },

  "section.delete": (ctx) => {
    const r = remove(ctx.params.kind || "", ctx.params.id || "");
    if (!r.ok) return { status: r.status, body: { success: false, message: r.message } };
    return ok({ kind: ctx.params.kind, id: ctx.params.id, deleted: true });
  },
};

// A route that changes something, and the method it answers to. Everything not
// named here is a read, so a route added tomorrow is read-only until somebody
// says otherwise — which is the safe direction for a surface whose whole value
// is that its numbers are not editable by the party they describe.
const WRITES: Record<string, string> = {
  "section.put": "PUT",
  "section.delete": "DELETE",
};

const READ_ONLY =
  "the trust inventory is read here: this deployment's own controls are " +
  "build-time data governed in git, and the audit trail is written by the platform.";

globalThis.handle = (req: Req): Res => {
  req = req || {};
  const route = req.route || "";
  const fn = routes[route];
  if (!fn) return notFound("no trust route " + route);

  const method = (req.method || "GET").toUpperCase();
  const wants = WRITES[route];
  if (wants) {
    if (method !== wants) return readOnly(READ_ONLY);
  } else if (method !== "GET" && method !== "HEAD") {
    return readOnly(READ_ONLY);
  }

  // The organization is the host's, always. `health` needs none; `published`
  // takes the one the host resolved from the address, which is a public name and
  // not a claim of authority; every other route takes the validated bearer's.
  const org = req.orgId || "";
  if (route !== "health" && !org) {
    return { status: 401, body: { success: false, message: "missing tenant" } };
  }

  // Path values and query values arrive in separate bags and mean the same
  // thing to every handler below, so they are merged once, here.
  const params: Record<string, string> = {};
  const bags = [req.params, req.query];
  for (let i = 0; i < bags.length; i++) {
    const bag = bags[i];
    if (!bag) continue;
    for (const k in bag) {
      if (Object.prototype.hasOwnProperty.call(bag, k)) params[k] = bag[k];
    }
  }

  try {
    return fn({ org, params }, req);
  } catch (err) {
    return {
      status: 500,
      body: { success: false, message: String((err && (err as Error).message) || err) },
    };
  }
};

// The same answers with no request around them — what the tests fold, and what a
// Go caller uses when it wants a number rather than a response.
globalThis.trust = {
  version: VERSION,
  controls: () => own(),
  frameworks: () => ids(),
  summary: summary,
  framework: framework,
};

declare global {
  // eslint-disable-next-line no-var
  var handle: (req: Req) => Res;
  // eslint-disable-next-line no-var
  var trust: {
    version: string;
    controls: () => unknown[];
    frameworks: () => string[];
    summary: typeof summary;
    framework: typeof framework;
  };
}
