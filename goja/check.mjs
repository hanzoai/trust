// The gatekeeper for controls.json and frameworks.json.
//
// Pure ESM, no dependencies, no I/O — it takes two parsed values and returns the
// list of things wrong with them. `build.mjs` runs it before esbuild, so a
// malformed entry means there is NO bundle. That ordering is the whole point:
// the failure mode we refuse to have is an inventory that parses, scores, and
// quietly reports a number nobody can stand behind.
//
// It also holds the claim ban. This is the one repo where a sentence that drifts
// is a sentence somebody relied on, so the ban is executable rather than a note
// in a README: control prose may not name a framework and may not say we hold
// anything. A framework appears in exactly one place — the `maps` edges — where
// it arrives attached to a number.

const ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const STATUS = ["automated", "partial", "absent"];
const STRENGTH = ["full", "partial"];
const METHOD = ["read", "test", "audit"];

// Prose in a control may not claim a certification. Clause TITLES in
// frameworks.json are exempt: they are the verbatim text of a published
// standard, and A.5.36 really is called "Compliance with policies, rules and
// standards for information security". Rewriting a standard to satisfy our own
// copy rule would be the dishonest move.
const CLAIMS = [
  /\bcertifi(ed|cation)\b/i,
  /\baccredit(ed|ation)\b/i,
  /\battest(ed|ation)\b/i,
  /\bcompliant\b/i,
  /\bcompliance with\b/i,
  /\baudited by\b/i,
  /\bfips[\s-]?(140[\s-]?[23][\s-]?)?(validated|certified|compliant|approved)\b/i,
];

const FRAMEWORK_WORDS = [
  /\bsoc[\s-]?[12]\b/i,
  /\biso[\s-]?270\d\d\b/i,
  /\b800[\s-]?53\b/i,
  /\bfedramp\b/i,
  /\bpci[\s-]?dss\b/i,
  /\bhitrust\b/i,
  /\bhipaa\b/i,
  /\bcsa[\s-]?star\b/i,
];

const isStr = (v) => typeof v === "string" && v.trim() !== "";
const isArr = (v) => Array.isArray(v) && v.length > 0;

// Every string in the control EXCEPT its id and its mappings. Walking the whole
// object rather than a list of field names means a prose field added tomorrow is
// scanned the day it appears, instead of the day someone remembers to add it
// here. `maps` is skipped because framework ids live there by design — that is
// the one place a framework name is allowed to be.
function prose(control) {
  const out = [];
  const walk = (v) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const k of Object.keys(v)) {
        if (k === "maps" || k === "id") continue;
        walk(v[k]);
      }
    }
  };
  walk(control);
  return out.join("\n");
}

function checkPlace(place, where, problems) {
  if (!place || typeof place !== "object") {
    problems.push(`${where}: not an object`);
    return;
  }
  if (!isStr(place.repo)) problems.push(`${where}: repo is required`);
  if (!isStr(place.path)) problems.push(`${where}: path is required`);
  else if (/^[/.]|\s/.test(place.path)) {
    problems.push(`${where}: path must be repo-relative with no spaces (got "${place.path}")`);
  }
  if (place.line !== undefined && (!Number.isInteger(place.line) || place.line < 1)) {
    problems.push(`${where}: line must be a positive whole number when present`);
  }
}

// checkFrameworks returns [problems, clauseIndex] where clauseIndex holds every
// valid "<framework>:<clause>" reference. A mapping outside that set points at
// nothing, and would silently drop out of every score.
export function checkFrameworks(frameworks) {
  const problems = [];
  const index = new Set();

  if (!frameworks || typeof frameworks !== "object" || Array.isArray(frameworks)) {
    return [["frameworks.json: expected an object keyed by framework id"], index];
  }

  for (const id of Object.keys(frameworks)) {
    if (id.charAt(0) === "$") continue; // file metadata, not a framework
    const f = frameworks[id];
    const at = `frameworks.json[${id}]`;
    if (!/^[a-z0-9]+$/.test(id)) problems.push(`${at}: id must be lowercase alphanumeric`);
    if (!f || typeof f !== "object") {
      problems.push(`${at}: not an object`);
      continue;
    }
    for (const k of ["name", "publisher", "edition"]) {
      if (!isStr(f[k])) problems.push(`${at}: ${k} is required`);
    }
    // A count with no unit is not a fact. Both forms, because every count is
    // rendered into a sentence.
    if (!isStr(f.unit)) problems.push(`${at}: unit is required — a count with no unit is not a fact`);
    if (!isStr(f.units)) problems.push(`${at}: units (the plural) is required`);
    if (!isArr(f.clauses)) {
      problems.push(`${at}: clauses must be a non-empty array`);
      continue;
    }
    const seen = new Set();
    for (const c of f.clauses) {
      if (!c || typeof c !== "object" || !isStr(c.id)) {
        problems.push(`${at}: a clause has no id`);
        continue;
      }
      if (seen.has(c.id)) problems.push(`${at}: duplicate clause ${c.id}`);
      seen.add(c.id);
      if (!isStr(c.title)) problems.push(`${at}.${c.id}: title is required`);
      if (c.group !== undefined && !isStr(c.group)) {
        problems.push(`${at}.${c.id}: group must be a non-empty string when present`);
      }
      index.add(`${id}:${c.id}`);
    }
  }
  return [problems, index];
}

export function checkControls(input, clauseIndex) {
  const problems = [];
  // A list, or an envelope carrying one. Read both, validate the list.
  const controls = Array.isArray(input) ? input : input && input.controls;
  if (!Array.isArray(controls)) {
    return ["controls.json: expected a list of controls, or an envelope holding one"];
  }

  const seen = new Set();
  for (let i = 0; i < controls.length; i++) {
    const c = controls[i];
    const at = `controls.json[${(c && c.id) || i}]`;
    if (!c || typeof c !== "object") {
      problems.push(`${at}: not an object`);
      continue;
    }

    if (!isStr(c.id)) problems.push(`${at}: id is required`);
    else if (!ID.test(c.id)) problems.push(`${at}: id must be dotted lowercase, e.g. iam.pkce.s256`);
    else if (seen.has(c.id)) problems.push(`${at}: duplicate id`);
    if (isStr(c.id)) seen.add(c.id);

    for (const k of ["claim", "mechanism"]) {
      if (!isStr(c[k])) problems.push(`${at}: ${k} is required`);
    }
    if (c.title !== undefined && !isStr(c.title)) {
      problems.push(`${at}: title must be a non-empty string when present`);
    }

    if (STATUS.indexOf(c.status) < 0) {
      problems.push(`${at}: status must be one of ${STATUS.join(", ")}`);
    }
    // A control that is not fully automated must say what is missing. This is
    // the single rule that keeps "partial" from becoming a shrug.
    if (c.status !== "automated" && !isStr(c.note)) {
      problems.push(`${at}: status "${c.status}" requires a note saying what is missing`);
    }

    // Where the mechanism lives. Every control names at least one place, so a
    // reviewer always has a file to open — including an absent one, which names
    // the place the absence is visible.
    if (!isArr(c.enforced)) problems.push(`${at}: enforced must name at least one place`);
    else c.enforced.forEach((p, n) => checkPlace(p, `${at}.enforced[${n}]`, problems));

    // How we know. `read` is a person; `test` is something that can fail;
    // `audit` is rows in the trail, and it must name the actions it means.
    if (!isArr(c.verified)) problems.push(`${at}: verified must name at least one check`);
    else
      c.verified.forEach((v, n) => {
        const vat = `${at}.verified[${n}]`;
        if (!v || typeof v !== "object" || METHOD.indexOf(v.method) < 0) {
          problems.push(`${vat}: method must be one of ${METHOD.join(", ")}`);
          return;
        }
        if (v.method === "audit") {
          if (!isArr(v.actions) || !v.actions.every(isStr)) {
            problems.push(`${vat}: an audit check must name the actions that evidence it`);
          }
        } else if (!isArr(v.at)) {
          problems.push(`${vat}: a ${v.method} check must name where it is`);
        } else {
          v.at.forEach((p, m) => checkPlace(p, `${vat}.at[${m}]`, problems));
        }
      });

    if (!isArr(c.maps)) problems.push(`${at}: maps must name at least one clause`);
    else {
      const refs = new Set();
      for (const m of c.maps) {
        if (!m || typeof m !== "object" || !isStr(m.clause)) {
          problems.push(`${at}: a mapping has no clause`);
          continue;
        }
        if (STRENGTH.indexOf(m.strength) < 0) {
          problems.push(`${at} -> ${m.clause}: strength must be one of ${STRENGTH.join(", ")}`);
        }
        // A mapping to a clause no framework declares scores nowhere, and reads
        // as coverage to anyone who opens the file. It is a build failure.
        if (!clauseIndex.has(m.clause)) {
          problems.push(`${at} -> ${m.clause}: no framework declares that clause`);
        }
        if (refs.has(m.clause)) problems.push(`${at}: duplicate mapping to ${m.clause}`);
        refs.add(m.clause);
      }
    }

    const text = prose(c);
    for (const re of CLAIMS) {
      const hit = re.exec(text);
      if (hit) problems.push(`${at}: prose claims "${hit[0]}" — this repo does not claim status`);
    }
    for (const re of FRAMEWORK_WORDS) {
      const hit = re.exec(text);
      if (hit) {
        problems.push(
          `${at}: prose names "${hit[0]}" — a framework belongs in maps, where it carries a number`,
        );
      }
    }
  }
  return problems;
}

export function check(controls, frameworks) {
  const [problems, index] = checkFrameworks(frameworks);
  return problems.concat(checkControls(controls, index));
}

export function assertValid(controls, frameworks) {
  const problems = check(controls, frameworks);
  if (problems.length) {
    throw new Error(
      `trust: the inventory is malformed, so no bundle was built (${problems.length}):\n  ` +
        problems.join("\n  "),
    );
  }
}
