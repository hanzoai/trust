#!/usr/bin/env node
// What a visitor's browser actually reaches, measured against what we disclose.
//
//   bin/surface.mjs hanzo.ai hanzo.works trust.hanzo.ai …
//
// The subprocessor list answers "who touches the data". For everything that
// happens on a server that is a claim a reader has to take on trust, and the
// evidence is a path in a repository they may not be able to open. For the
// BROWSER half it is not a claim at all: a page either loads a third party or it
// does not, and anyone can check. So this measures it, on every release.
//
// TWO RULES, and the second is the one that keeps the list honest:
//
//   1. No advertising or product-analytics tag may be REACHED. This is a
//      denylist and it is the narrow, loud rule — those parties exist to follow
//      a person between sites, and one appearing here is never an accident.
//   2. Any OTHER third-party origin that is reached must be declared in
//      subprocessors.json, as an `evidence[].origin`. That is the rule that
//      cannot go stale: a party added to a page is a party added to the
//      disclosure, in the same change, or there is no release.
//
// REACHED IS NOT THE SAME AS PRESENT, and getting that wrong in either
// direction gives the wrong answer. A tag sitting in the markup behind an
// enforcing policy that omits its origin is never fetched, so nothing about the
// visitor reaches it — counting it would report a leak that does not happen. And
// a policy sent `-Report-Only` enforces NOTHING, so a page carrying only that
// permits everything however strict it reads — counting it as protection would
// miss a leak that does. So a third party is reached when the markup names it
// AND the enforced policy would allow it, and the two halves are measured
// together because neither alone is the fact.
//
// Node's own fetch and one regex pass. No parser, no dependency, no browser: a
// gate that needs a headless browser to run does not run.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Parties whose product IS following a person between sites. Matched on the
// registrable domain, so a regional or versioned host of the same service is
// caught by the same entry. Keeping this narrow is deliberate: it is the list of
// things that may never appear, so every addition has to be defensible, and the
// SECOND rule already covers everything not named here.
const TRACKERS = [
  "google-analytics.com", "googletagmanager.com", "analytics.google.com",
  "doubleclick.net", "googlesyndication.com", "googleadservices.com",
  "facebook.net", "facebook.com", "connect.facebook.net",
  "hotjar.com", "hotjar.io", "segment.com", "segment.io",
  "posthog.com", "mixpanel.com", "amplitude.com", "fullstory.com",
  "clarity.ms", "logrocket.com", "logrocket.io", "heap.io", "heapanalytics.com",
  "intercom.io", "intercomcdn.com", "matomo.cloud", "plausible.io",
  "quantserve.com", "scorecardresearch.com", "adroll.com", "criteo.com",
  "taboola.com", "outbrain.com", "bing.com", "clarity.microsoft.com",
  "tiktok.com", "analytics.tiktok.com", "snapchat.com", "sc-static.net",
  "linkedin.com", "licdn.com", "twitter.com", "ads-twitter.com", "t.co",
  "pinterest.com", "pinimg.com", "reddit.com", "redditstatic.com",
];

// A subresource is a fetch the page makes on its own. A LINK is not one: an
// anchor to another site sends nothing until a person clicks it, and counting
// hrefs would file every party we merely link to as one that receives data.
// That distinction is the whole reason this reads attributes rather than
// grepping the document for URLs.
const SUBRESOURCE = [
  /<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi,
  /<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi,
  /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi,
  /<iframe\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi,
  /<source\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi,
  /<video\b[^>]*?\b(?:src|poster)\s*=\s*["']([^"']+)["']/gi,
  /<audio\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi,
  /<embed\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi,
  /<object\b[^>]*?\bdata\s*=\s*["']([^"']+)["']/gi,
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

// The registrable domain, near enough for this: the last two labels, or three
// where the second-to-last is a known two-part public suffix. This decides
// whether a host is ours and whether it is a tracker, and both questions want
// "the same organization" rather than "the same string".
const TWO_PART = new Set(["co", "com", "net", "org", "ac", "gov", "edu"]);
export function site(host) {
  const p = String(host).toLowerCase().replace(/\.$/, "").split(".");
  if (p.length <= 2) return p.join(".");
  return TWO_PART.has(p[p.length - 2]) && p[p.length - 1].length === 2
    ? p.slice(-3).join(".")
    : p.slice(-2).join(".");
}

const host = (u) => {
  const m = /^(?:https?:)?\/\/([^/?#"'\s\\]+)/i.exec(String(u).trim());
  if (!m) return ""; // relative — same origin, so nobody new
  const h = m[1].split("@").pop().split(":")[0].toLowerCase();
  return h.indexOf(".") > 0 ? h : "";
};

// Every host the markup NAMES as a subresource. Precise, and precision is what
// this one is for: it drives the disclosure rule, and a rule that fires on
// something a page merely links to would be turned off within a week.
export function reached(html) {
  const out = new Set();
  for (const re of SUBRESOURCE) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(html)); ) {
      const h = host(m[1] || "");
      if (h) out.add(h);
    }
  }
  return out;
}

// Every host named ANYWHERE, inline script bodies included. Broad, and breadth
// is what THIS one is for.
//
// The two exist because one measure cannot serve both rules. A tag is a fetch;
// a URL sitting in an inline script may be a fetch or may be the href of a link
// the page will render, and nothing in the text tells them apart — so the
// broad measure over-reports and may not decide the disclosure rule. But the
// ordinary way a tag gets installed is exactly an inline script that builds a
// script element at run time, which the tag measure cannot see at all. So the
// broad one decides the DENYLIST, where over-reporting costs a sentence in a
// review and under-reporting costs the claim: those names have no innocent
// reason to be in the document, linked or fetched.
export function mentioned(html) {
  const out = new Set();
  for (const u of html.match(/(?:https?:)?\/\/[a-z0-9][-a-z0-9.]*\.[a-z]{2,}/gi) || []) {
    const h = host(u);
    if (h) out.add(h);
  }
  return out;
}

// The ENFORCED policy. A `-Report-Only` header is deliberately not read: it
// changes nothing a browser does, and treating it as protection is exactly how
// a surface comes to look defended while permitting everything.
export function policy(headers, html) {
  const parts = [];
  const h = headers.get("content-security-policy");
  if (h) parts.push(h);
  const meta =
    /<meta\b[^>]*http-equiv\s*=\s*["']content-security-policy["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html);
  if (meta) parts.push(meta[1]);
  if (!parts.length) return null;

  const directives = new Map();
  for (const p of parts) {
    for (const clause of p.split(";")) {
      const t = clause.trim().split(/\s+/).filter(Boolean);
      if (!t.length) continue;
      const name = t.shift().toLowerCase();
      // Several policies apply together and a browser must satisfy every one,
      // so the narrowest wins: intersect rather than overwrite.
      const had = directives.get(name);
      directives.set(name, had ? had.filter((s) => t.indexOf(s) >= 0) : t);
    }
  }
  return directives;
}

// Would this policy let the page fetch from that host? Asked per host and not
// per directive, because we do not know which kind of subresource it will be —
// so a host any fetching directive admits counts as permitted. Erring open is
// the safe direction for a gate: it reports a party as reached when it might
// not be, never the reverse.
const FETCHING = [
  "script-src", "script-src-elem", "style-src", "style-src-elem", "img-src",
  "font-src", "connect-src", "frame-src", "media-src", "object-src", "child-src",
  "worker-src", "manifest-src",
];

export function permits(directives, host) {
  if (!directives) return true; // no enforced policy is no restriction
  const lists = [];
  for (const d of FETCHING) if (directives.has(d)) lists.push(directives.get(d));
  if (directives.has("default-src")) lists.push(directives.get("default-src"));
  if (!lists.length) return true;

  for (const list of lists) {
    for (const raw of list) {
      const s = raw.replace(/^['"]|['"]$/g, "").toLowerCase();
      if (s === "*") return true;
      if (s === "https:" || s === "http:") return true;
      if (s.startsWith("'")) continue; // 'self', 'none', 'unsafe-inline', a hash
      const bare = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
      if (!bare || bare.indexOf(".") < 0) continue;
      if (bare === host) return true;
      if (bare.startsWith("*.") && host.endsWith(bare.slice(1))) return true;
    }
  }
  return false;
}

async function look(host) {
  const res = await fetch(`https://${host}`, {
    redirect: "follow",
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
  });
  const html = await res.text();
  return { host, status: res.status, html, directives: policy(res.headers, html) };
}

function declared() {
  const file = JSON.parse(readFileSync(join(root, "subprocessors.json"), "utf8"));
  const rows = Array.isArray(file) ? file : file.subprocessors;
  const byOrigin = new Map();
  for (const s of rows) {
    for (const e of s.evidence || []) {
      if (e && typeof e.origin === "string" && e.origin.trim()) {
        byOrigin.set(e.origin.trim().toLowerCase(), s);
      }
    }
  }
  return byOrigin;
}

async function main(surfaces) {
  if (!surfaces.length) {
    console.error(
      "surface: name the hosts to measure — the surfaces are a property of the\n" +
        "         deployment, not of this repository, so there is no default list\n" +
        "         here to fall out of step with the one that is deployed.\n" +
        "         usage: bin/surface.mjs <host> [host …]",
    );
    process.exit(2);
  }

  const disclosed = declared();
  // Ours is DERIVED from what we were asked to measure: the zones these
  // surfaces live in are ours by definition, so there is no second list of our
  // own domains to keep in step with the first.
  const ours = new Set(surfaces.map(site));

  const pages = await Promise.all(
    surfaces.map((h) =>
      look(h).catch((err) => ({ host: h, error: String((err && err.message) || err) })),
    ),
  );

  const failures = [];
  const notes = [];

  for (const p of pages) {
    if (p.error) {
      failures.push(`${p.host}: could not be read — ${p.error}`);
      continue;
    }
    if (p.status >= 400) {
      failures.push(`${p.host}: answered ${p.status}, so nothing was measured`);
      continue;
    }

    const outside = (h) => !ours.has(site(h));
    const third = [...reached(p.html)].filter(outside).sort();
    const enforced = p.directives ? "enforced" : "NO ENFORCED POLICY";
    const live = third.filter((h) => permits(p.directives, h));
    const refused = third.filter((h) => !permits(p.directives, h));

    console.log(
      `${p.host}  ${p.status}  ${enforced}  ` +
        `${live.length} reached, ${refused.length} refused by policy`,
    );

    for (const h of refused) {
      notes.push(`${p.host}: ${h} is in the markup and the enforced policy refuses it`);
    }

    // Rule 1, over the broad measure.
    for (const h of [...mentioned(p.html)].filter(outside).sort()) {
      const s = site(h);
      if (!TRACKERS.some((t) => s === t || h === t)) continue;
      if (!permits(p.directives, h)) {
        notes.push(`${p.host}: names ${h} and the enforced policy refuses it`);
        continue;
      }
      failures.push(
        `${p.host}: reaches ${h} — an advertising or analytics tag. ` +
          `The trust centre says none is reached from any Hanzo surface.`,
      );
    }

    // Rule 2, over the precise one.
    for (const h of live) {
      const row = disclosed.get(h);
      if (!row) {
        failures.push(
          `${p.host}: reaches ${h}, which no party in subprocessors.json declares. ` +
            `Add it as an evidence origin on the party that receives it, or stop reaching it.`,
        );
      } else {
        console.log(`    ${h} → ${row.name} (${row.role})`);
      }
    }
  }

  for (const n of notes) console.log(`  note  ${n}`);

  if (failures.length) {
    console.error("");
    for (const f of failures) console.error(`surface: ${f}`);
    console.error(`\nsurface: ${failures.length} finding(s) across ${surfaces.length} surface(s)`);
    process.exit(1);
  }
  console.log(
    `\nsurface: OK — ${surfaces.length} surface(s); every third party reached is a declared one, ` +
      `and no advertising or analytics tag is reached from any of them`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2).filter((a) => !a.startsWith("-")));
}
