// The gate's own arithmetic, over the same harness the bundle suite uses.
//
// bin/surface makes a published claim — that no advertising or analytics tag is
// reached from any surface, and that every third party that IS reached is
// disclosed. That claim is worth exactly as much as `permits` and `reached`
// are, so both are exercised here on the cases that actually decide a verdict,
// and each one is written so that getting it backwards fails.
//
//   node bin/surface.test.mjs

import assert from "node:assert/strict";
import { it } from "../goja/test/harness.mjs";
import { mentioned, permits, policy, reached, site } from "./surface.mjs";

const headers = (o) => new Headers(o || {});

// ---------------------------------------------------------------------------
// Whose is it.
// ---------------------------------------------------------------------------

it("a host belongs to the organization that registers the domain", () => {
  assert.equal(site("static.cloudflareinsights.com"), "cloudflareinsights.com");
  assert.equal(site("hanzo.ai"), "hanzo.ai");
  assert.equal(site("docs.hanzo.ai"), "hanzo.ai");
  assert.equal(site("a.b.c.hanzo.works"), "hanzo.works");
  // Two labels on the right are not always the registration. A gate that read
  // them as one would file every co.uk site under one owner.
  assert.equal(site("shop.example.co.uk"), "example.co.uk");
});

// ---------------------------------------------------------------------------
// A fetch is not a link, and the difference decides which rule may fire.
// ---------------------------------------------------------------------------

it("a tag naming a third party is a fetch; an anchor to one is not", () => {
  const html = `
    <a href="https://github.com/hanzoai">source</a>
    <script src="https://cdn.example.com/a.js"></script>
    <img src="https://img.example.net/logo.png">
    <link rel="stylesheet" href="https://fonts.example.org/x.css">
    <iframe src="https://frame.example.io/e"></iframe>
    <script src="/local.js"></script>`;
  const got = reached(html);
  for (const h of ["cdn.example.com", "img.example.net", "fonts.example.org", "frame.example.io"]) {
    assert.ok(got.has(h), h);
  }
  assert.ok(!got.has("github.com"), "an anchor sends nothing until somebody clicks it");
  assert.ok(!got.has(""), "a relative source introduces nobody");
});

it("the broad measure sees a tag a script would build at run time", () => {
  // How a measurement tag is actually installed: no element to read, a string
  // in an inline script that becomes one later. The precise measure cannot see
  // it, which is exactly why the denylist runs over this one.
  const html = `<script>var s=document.createElement('script');
    s.src='https://www.googletagmanager.com/gtm.js?id=GTM-X';</script>`;
  assert.equal(reached(html).size, 0, "no tag names it, so the precise measure is silent");
  assert.ok(mentioned(html).has("www.googletagmanager.com"));
});

// ---------------------------------------------------------------------------
// Would the browser allow it. This is the half a markup scan cannot answer.
// ---------------------------------------------------------------------------

it("no policy at all permits everyone", () => {
  assert.equal(permits(policy(headers(), ""), "anything.example.com"), true);
});

// The case that decides the whole measurement on our own front page. A
// report-only policy changes nothing a browser does; reading it as protection
// reports a surface as defended while it permits everything.
it("a REPORT-ONLY policy is not a policy", () => {
  const h = headers({
    "content-security-policy-report-only": "default-src 'self'; script-src 'self'",
  });
  assert.equal(policy(h, ""), null);
  assert.equal(permits(policy(h, ""), "static.cloudflareinsights.com"), true);
});

it("an enforced policy that omits an origin refuses it", () => {
  const h = headers({ "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'" });
  const p = policy(h, "");
  assert.equal(permits(p, "static.cloudflareinsights.com"), false);
});

it("an enforced policy that names an origin permits it", () => {
  const h = headers({
    "content-security-policy": "script-src 'self' https://static.cloudflareinsights.com",
  });
  assert.equal(permits(policy(h, ""), "static.cloudflareinsights.com"), true);
});

it("a wildcard host, a bare scheme and a star each permit", () => {
  const one = (v) => permits(policy(headers({ "content-security-policy": v }), ""), "a.example.com");
  assert.equal(one("script-src *.example.com"), true);
  assert.equal(one("script-src https:"), true);
  assert.equal(one("default-src *"), true);
  assert.equal(one("script-src 'self'"), false);
});

it("a policy in a meta element counts, because a browser applies it", () => {
  const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`;
  assert.equal(permits(policy(headers(), html), "cdn.example.com"), false);
});

// Two policies both apply, so a browser satisfies BOTH. Taking the last one
// would let a second, laxer header widen the first.
it("two policies intersect rather than the later one winning", () => {
  const html = `<meta http-equiv="Content-Security-Policy" content="script-src 'self'">`;
  const h = headers({ "content-security-policy": "script-src 'self' https://cdn.example.com" });
  assert.equal(permits(policy(h, html), "cdn.example.com"), false);
});

// A directive naming nothing fetchable still restricts, and a policy that
// declares only directives we do not evaluate must not read as a refusal.
it("a policy with no fetching directive restricts nobody", () => {
  const h = headers({ "content-security-policy": "frame-ancestors 'none'; base-uri 'self'" });
  assert.equal(permits(policy(h, ""), "cdn.example.com"), true);
});
