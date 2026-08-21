/**
 * The trust centre document, and the one request that gets it.
 *
 * ONE public GET, no auth, made in the browser — this site is a static export,
 * so nothing here runs at build time and no figure is baked into the HTML. Every
 * number on the page is the one the API answered with, this second.
 */

export const SOURCE = 'https://api.hanzo.ai/v1/trust/published/hanzo';

/** How completely a control is carried out. */
export type Status = 'automated' | 'partial' | 'absent';

/** The eight groups a control belongs to. A closed vocabulary: the page renders
 *  one filter per group, and an unrecognised ninth would filter to nothing. */
export const CATEGORIES = [
  'infrastructure',
  'data',
  'access',
  'network',
  'endpoint',
  'corporate',
  'product',
  'incident',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Profile = {
  name: string;
  tagline?: string;
  summary?: string;
  contact?: string;
  /** Where a reader asks for what is not published. */
  access?: string;
  published: boolean;
  updated: number;
};

export type Inventory = {
  total: number;
  automated: number;
  partial: number;
  absent: number;
  unverified: number;
  statement: string;
};

export type Coverage = {
  framework: string;
  name: string;
  publisher: string;
  edition: string;
  /** The singular and plural noun for a clause of THIS framework. */
  unit: string;
  units: string;
  total: number;
  automated: number;
  partial: number;
  none: number;
  statement: string;
  note?: string;
};

/** Where the mechanism lives. */
export type Site = { repo: string; path: string; symbol?: string; line?: number };

/**
 * What was done to check the control, and what that reading rests on.
 *
 * `at` is WHERE it was checked — the same shape as `enforced`, not a timestamp —
 * and `actions` names the audit actions that carry the evidence, not a count of
 * them. Both are lists.
 */
export type Check = { method: string; at?: Site[]; actions?: string[]; detail?: string };

/** A control answering a clause, and how well. */
export type Mapping = { clause: string; strength: string };

export type Control = {
  id: string;
  title?: string;
  claim: string;
  mechanism: string;
  status: Status;
  note?: string;
  category?: Category;
  enforced: Site[];
  verified: Check[];
  maps: Mapping[];
};

export type Doc = {
  id: string;
  title: string;
  kind: string;
  label: string;
  attested: boolean;
  tier: 'public' | 'gated';
  updated: number;
  note?: string;
  href?: string;
  released: boolean;
};

export type Subprocessor = {
  id: string;
  name: string;
  purpose: string;
  location?: string;
  url?: string;
  dpa?: string;
  updated: number;
};

export type Policy = { id: string; title: string; summary?: string; href?: string; updated: number };

export type Question = { id: string; question: string; answer: string; tags?: string[]; updated: number };

export type Update = { id: string; at: number; title: string; body?: string; updated: number };

export type Center = {
  version: string;
  generated: number;
  org: string;
  profile: Profile;
  inventory: Inventory;
  coverage: Coverage[];
  frameworks: { framework: string; name: string; publisher: string; edition: string; unit: string; units: string; total: number }[];
  controls: Control[];
  documents: Doc[];
  subprocessors: Subprocessor[];
  policies: Policy[];
  faq: Question[];
  updates: Update[];
  risk: { items: { label: string; value: string }[] };
};

const list = <T>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);

/**
 * Read the document.
 *
 * Every failure the network can produce becomes a sentence a reader can act on,
 * because the alternative — a blank panel — is indistinguishable from an
 * organization that publishes nothing. A short document is not an error: a
 * missing list reads as an empty one and the section says so in words.
 */
export async function read(signal?: AbortSignal): Promise<Center> {
  const res = await fetch(SOURCE, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${SOURCE} answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`);

  const body = await res.text();
  let doc: Partial<Center>;
  try {
    doc = JSON.parse(body) as Partial<Center>;
  } catch {
    throw new Error(`${SOURCE} answered ${res.status}, but the body is not JSON`);
  }
  if (!doc || !doc.profile) throw new Error(`${SOURCE} answered a document with no profile`);

  return {
    ...(doc as Center),
    coverage: list(doc.coverage),
    frameworks: list(doc.frameworks),
    controls: list(doc.controls),
    documents: list(doc.documents),
    subprocessors: list(doc.subprocessors),
    policies: list(doc.policies),
    faq: list(doc.faq),
    updates: list(doc.updates),
    risk: { items: list(doc.risk?.items) },
  };
}

/**
 * One date format for the whole page, in UTC.
 *
 * A trust centre is read by two people comparing notes across a timezone, and a
 * document dated the 3rd for one of them and the 4th for the other is a document
 * they cannot talk about.
 */
const DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });

export const day = (ms: number): string => (Number.isFinite(ms) && ms > 0 ? DAY.format(new Date(ms)) : '—');

/** The singular or plural noun for `n` of a framework's clauses. */
export const unit = (n: number, c: Pick<Coverage, 'unit' | 'units'>): string => (n === 1 ? c.unit : c.units);
