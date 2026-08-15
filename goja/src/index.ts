// @hanzo/trust — goja bundle entry.
//
// SELF-CONTAINED, NO ESM, NO node: imports. Bundled by esbuild into
// goja/bundle.js and run verbatim inside the dop251/goja engine embedded in
// hanzoai/cloud (HIP-0106), the way hanzoai/captable and hanzoai/plans ship.
//
//   globalThis.__now()    -> unix millis                       (required)
//   globalThis.__audit(q) -> { rows, total }                   (optional)
//   globalThis.handle({ route, method, params, query, orgId }) -> { status, body }
//   globalThis.trust      -> the same answers with no request around them
//
// The inventory is inlined at build time by goja/build.mjs, which validates it
// first. A malformed entry means there is no bundle, so it can never become a
// silent zero in a score.
//
// Every route is a read. There is no __db and no __newId: the inventory is
// build-time data governed in git, and the trail is written by the platform.

import { framework, summary } from "./coverage";
import { query as evidence } from "./evidence";
import { now } from "./host";
import { CONTROLS, control, framework as declared, ids, VERSION } from "./inventory";
import { Ctx, notFound, ok, readOnly, Res } from "./reply";

interface Req {
  route?: string;
  method?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  orgId?: string;
  body?: unknown;
}

type Handler = (ctx: Ctx) => Res;

const routes: Record<string, Handler> = {
  health: () => ok({ service: "trust", status: "ok", version: VERSION }),

  "controls.list": () => ok({ version: VERSION, ...summary().controls, controls: CONTROLS }),

  "controls.get": (ctx) => {
    const c = control(ctx.params.id || "");
    return c ? ok(c) : notFound("no control " + (ctx.params.id || "") + " in the inventory");
  },

  "frameworks.list": () =>
    ok({
      frameworks: ids().map((id) => {
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
      }),
    }),

  "coverage.list": () => ok({ version: VERSION, generated: now(), ...summary() }),

  "coverage.get": (ctx) => {
    const id = ctx.params.framework || "";
    const d = framework(id);
    if (!d) return notFound("no framework " + id + " is mapped", { frameworks: ids() });
    return ok({ version: VERSION, generated: now(), ...d });
  },

  "evidence.get": evidence,
};

const WRITE =
  "trust is read-only: the control inventory is build-time data governed in git, " +
  "and the audit trail is written by the platform. Neither can be authored here.";

globalThis.handle = (req: Req): Res => {
  req = req || {};
  const route = req.route || "";
  const fn = routes[route];
  if (!fn) return notFound("no trust route " + route);

  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return readOnly(WRITE);

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
    return fn({ org, params });
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
  controls: () => CONTROLS,
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
    controls: () => typeof CONTROLS;
    frameworks: () => string[];
    summary: typeof summary;
    framework: typeof framework;
  };
}
