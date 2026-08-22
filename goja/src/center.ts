// A tenant's trust centre: what the organization publishes about itself.
//
// The inventory compiled into this bundle is ONE tenant's — the deployment's
// own, governed in git, unreachable from any request. Every other organization
// authors its own, and those are rows. `controls()` is the one place the two
// meet, and a row can never shadow a baseline id, so a tenant cannot rewrite a
// control the build gate approved.
//
// What is PUBLIC and what is GATED is a property of the artifact, not of the
// reader. The line is who attested it: anything WE assert — controls, computed
// coverage, subprocessors, policies, questions, updates, the risk sheet, and a
// self-assessment, which is self-attested by definition — is public. Anything an
// independent auditor signed is gated, and `tier` defaults to gated so a new
// document type is closed until somebody opens it deliberately.
//
// This module serves METADATA and never bytes. A gated document appears in the
// listing with its title and its date and no address, which is what makes
// "available on request" a fact a reader can check rather than a phrase.

import { checkControls, checkFrameworks, checkSubprocessors } from "../check.mjs";
import { Control, CONTROLS, FRAMEWORKS, Subprocessor, SUBPROCESSORS } from "./inventory";
import { drop, get, isKind, Kind, list, newId, own, put, Record_, SINGLE } from "./db";

// The eight groups a control belongs to. A closed vocabulary, because the page
// renders one column per group and an unrecognised ninth would render nowhere.
export const CATEGORIES = [
  "infrastructure",
  "data",
  "access",
  "network",
  "endpoint",
  "corporate",
  "product",
  "incident",
] as const;

// What a document IS, and — for the four an auditor signs — the reason it can
// never be public. `attested` means somebody outside this organization put their
// name to it; those are exactly the artifacts a reviewer asks for and exactly the
// ones that must not be downloadable without a grant.
export const KINDS: Record<string, { label: string; attested: boolean }> = {
  soc2: { label: "SOC 2 report", attested: true },
  iso: { label: "ISO/IEC 27001 certificate", attested: true },
  pentest: { label: "Penetration test report", attested: true },
  letter: { label: "Auditor letter", attested: true },
  caiq: { label: "CAIQ self-assessment", attested: false },
  sig: { label: "SIG self-assessment", attested: false },
  vsa: { label: "VSA self-assessment", attested: false },
  questionnaire: { label: "Security questionnaire", attested: false },
  policy: { label: "Policy", attested: false },
  other: { label: "Document", attested: false },
};

const TIERS = ["public", "gated"];

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const has = (v: unknown): boolean => str(v) !== "";

// ---------------------------------------------------------------------------
// Controls: the baseline and the tenant's own, folded once.
// ---------------------------------------------------------------------------

// The controls THIS tenant answers with. The compiled-in inventory belongs to
// exactly one organization and the host says whether this is it; everyone else
// starts empty and authors their own. A row carrying a baseline id is dropped
// rather than merged: the build gate approved that control, and a write must not
// be able to restate it.
export function controls(): Control[] {
  const base: Control[] = own() ? CONTROLS : [];
  const seen: Record<string, boolean> = {};
  for (let i = 0; i < base.length; i++) seen[base[i].id] = true;

  const out = base.slice();
  const rows = list("control");
  for (let i = 0; i < rows.length; i++) {
    // The id is the record's KEY, not a field inside it — the write strips it
    // so a body cannot name a different row than the address does. Reattaching
    // it here is what makes an authored control a Control; without it every one
    // of them was silently dropped from the fold and scored nothing.
    const c = Object.assign({}, rows[i].data, { id: rows[i].id }) as unknown as Control;
    if (seen[c.id]) continue;
    out.push(c);
  }
  return out;
}

// A control's group. The baseline predates the vocabulary for some entries, so
// an unset one reads "corporate" rather than vanishing from a grid keyed on it.
export function category(c: Control): string {
  const v = str((c as unknown as { category?: string }).category);
  for (let i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i] === v) return v;
  return "corporate";
}

// ---------------------------------------------------------------------------
// Subprocessors: the same two sources, folded by the same rule.
// ---------------------------------------------------------------------------

// Who else touches the data. This is `controls()` one section over, and
// deliberately so: the deployment's own list is compiled in and governed in git,
// because a party that can read customer data is not something a request should
// be able to add or remove; every other organization authors rows. A row
// carrying a baseline id is dropped rather than merged, so a write cannot
// restate a disclosure the build gate approved.
export function parties(): Subprocessor[] {
  const base: Subprocessor[] = own() ? SUBPROCESSORS : [];
  const seen: Record<string, boolean> = {};
  for (let i = 0; i < base.length; i++) seen[base[i].id] = true;

  const out = base.slice();
  const rows = list("subprocessor");
  for (let i = 0; i < rows.length; i++) {
    const s = Object.assign({}, rows[i].data, { id: rows[i].id }) as unknown as Subprocessor;
    if (seen[s.id]) continue;
    out.push(s);
  }
  return out;
}

// Whether a record is part of the deployment's own compiled-in inventory, and
// therefore governed by a commit rather than by a request.
//
// TWO sections have a compiled-in half and the question is the same one for
// both, so it is asked in one place: a second copy is how the control guard and
// the party guard come to disagree about what "ours" means.
const COMPILED: Record<string, { id: string }[]> = {
  control: CONTROLS,
  subprocessor: SUBPROCESSORS,
};

export function governed(kind: string, id: string): boolean {
  if (!own() || !id) return false;
  const rows = Object.prototype.hasOwnProperty.call(COMPILED, kind) ? COMPILED[kind] : null;
  if (!rows) return false;
  for (let i = 0; i < rows.length; i++) if (rows[i].id === id) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Validation. ONE module decides what a control may say — the same one the
// build gate runs — so a control authored through the API is held to the rule a
// control committed to git is held to, including the ban on naming a framework
// in prose and on claiming a certificate.
// ---------------------------------------------------------------------------

export function validate(kind: Kind, id: string, data: Record<string, unknown>): string[] {
  switch (kind) {
    case "control": {
      const c = Object.assign({}, data, { id: id });
      const [, index] = checkFrameworks(FRAMEWORKS);
      const problems = checkControls([c], index) as string[];
      const cat = str(data.category);
      if (cat) {
        let ok = false;
        for (let i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i] === cat) ok = true;
        if (!ok) problems.push("category must be one of " + CATEGORIES.join(", "));
      }
      return problems;
    }
    case "document": {
      const p: string[] = [];
      if (!has(data.title)) p.push("title is required");
      const k = str(data.kind) || "other";
      if (!Object.prototype.hasOwnProperty.call(KINDS, k)) {
        p.push("kind must be one of " + Object.keys(KINDS).join(", "));
        return p;
      }
      const tier = str(data.tier) || "gated";
      if (TIERS.indexOf(tier) < 0) p.push("tier must be public or gated");
      // The tier rule, made structural. A document an independent auditor signed
      // is the artifact a reviewer is asking for, so it may not be published to
      // anyone who loads the page — there is no field here that can say it is.
      if (KINDS[k].attested && tier === "public") {
        p.push(
          "a " + KINDS[k].label + " is attested by someone outside this organization, " +
            "so it is released through a grant rather than published",
        );
      }
      return p;
    }
    // The SAME module the build gate runs, so an authored party is held to the
    // rule a committed one is: it must take a role from the closed pair, say
    // what customer data reaches it, and — if it is a processor — say where it
    // is and under which terms. A name and a sentence is not a disclosure.
    case "subprocessor":
      return checkSubprocessors([Object.assign({}, data, { id: id })]) as string[];
    case "policy":
      return has(data.title) ? [] : ["title is required"];
    case "faq": {
      const p: string[] = [];
      if (!has(data.question)) p.push("question is required");
      if (!has(data.answer)) p.push("answer is required");
      return p;
    }
    case "update": {
      const p: string[] = [];
      if (!has(data.title)) p.push("title is required");
      if (!has(data.at)) p.push("at is required — an update with no date cannot be read in order");
      return p;
    }
    case "profile":
      return has(data.name) ? [] : ["name is required"];
    case "risk":
      return Array.isArray(data.items) ? [] : ["items must be a list of {label, value}"];
  }
  return ["unknown section " + kind];
}

// ---------------------------------------------------------------------------
// Writes.
// ---------------------------------------------------------------------------

export interface Written {
  kind: string;
  id: string;
  updated: number;
}

export function write(
  kind: string,
  id: string,
  body: unknown,
  at: number,
  ord: number,
): { ok: true; wrote: Written } | { ok: false; status: number; message: string; errors?: string[] } {
  if (!isKind(kind)) return { ok: false, status: 404, message: "no trust section " + kind };
  const k = kind as Kind;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, message: "body must be an object" };
  }
  const data = Object.assign({}, body as Record<string, unknown>);

  // A single-valued section has one row and its id is empty, so a caller cannot
  // create a second profile by naming one.
  let key = SINGLE[k] ? "" : str(id) || newId();
  delete data.id;

  if (governed(k, key)) {
    return {
      ok: false,
      status: 409,
      message:
        k + " " + key + " is part of this deployment's own inventory, which is " +
        "governed in git and cannot be authored through the API",
    };
  }

  const errors = validate(k, key, data);
  if (errors.length) {
    return { ok: false, status: 400, message: "the " + k + " is malformed", errors: errors };
  }

  // Documents close by default. Doing it here rather than at the reader means a
  // row written before a tier existed is still gated when it is read.
  if (k === "document" && !has(data.tier)) data.tier = "gated";

  put(k, key, ord, data, at);
  return { ok: true, wrote: { kind: k, id: key, updated: at } };
}

export function remove(kind: string, id: string): { ok: boolean; status: number; message: string } {
  if (!isKind(kind)) return { ok: false, status: 404, message: "no trust section " + kind };
  const k = kind as Kind;
  if (governed(k, id)) {
    return {
      ok: false,
      status: 409,
      message:
        k + " " + id + " is part of this deployment's own inventory and is removed " +
        "by a commit, not by a request",
    };
  }
  const n = drop(k, SINGLE[k] ? "" : id);
  if (!n) return { ok: false, status: 404, message: "no " + k + " " + id };
  return { ok: true, status: 200, message: "" };
}

// ---------------------------------------------------------------------------
// Reads.
// ---------------------------------------------------------------------------

function shaped(rows: Record_[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = Object.assign({}, rows[i].data);
    r.id = rows[i].id;
    r.updated = rows[i].updated;
    out.push(r);
  }
  return out;
}

export function section(kind: Kind): Record<string, unknown>[] {
  return shaped(list(kind));
}

export function single(kind: Kind): Record<string, unknown> | null {
  const r = get(kind, "");
  if (!r) return null;
  const out = Object.assign({}, r.data);
  out.updated = r.updated;
  return out;
}

// A document as a READER sees it. A gated one keeps its title, its kind and its
// date and loses its address — the listing says the artifact exists and that it
// is released through a grant, which is a checkable claim, where a phrase on a
// page is not.
export function document(d: Record<string, unknown>, grant: boolean): Record<string, unknown> {
  const k = str(d.kind) || "other";
  const meta = Object.prototype.hasOwnProperty.call(KINDS, k) ? KINDS[k] : KINDS.other;
  const tier = str(d.tier) || "gated";
  const open = tier === "public" || grant;
  const out: Record<string, unknown> = {
    id: d.id,
    title: d.title,
    kind: k,
    label: meta.label,
    attested: meta.attested,
    tier: tier,
    updated: d.updated,
  };
  if (has(d.note)) out.note = d.note;
  if (open && has(d.href)) out.href = d.href;
  out.released = open;
  return out;
}

export function documents(grant: boolean): Record<string, unknown>[] {
  const rows = section("document");
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) out.push(document(rows[i], grant));
  return out;
}
