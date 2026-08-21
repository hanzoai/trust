/**
 * The room the documents live in, and the one way to ask for what is not public.
 *
 * The trust document publishes METADATA — a thing exists, this is its name, this
 * is when it changed. The bytes and the grant are the data room's, and so is the
 * request: what a reviewer sends here is written down and answered by a person,
 * which is the whole promise the form makes.
 *
 * Fetched only when a reader opens the request panel. A trust centre is read far
 * more often than it is asked of, and everyone should not pay for a request
 * almost nobody makes.
 */

const ROOM = 'https://api.hanzo.ai/v1/dataroom/trust/center/hanzo';

/**
 * One thing the centre publishes.
 *
 * `available` is what a reader sees and `signed` is why: anything an independent
 * auditor put their name to is released through a grant, everything the
 * organization states itself can be read now.
 */
export type Item = {
  available: 'now' | 'on request';
  body?: string;
  framework?: string;
  id: string;
  kind: string;
  name: string;
  signed: 'self' | 'auditor';
  summary?: string;
  updatedAt: number;
};

export type Room = {
  items: Item[];
  name: string;
  /** The text a party must accept to ask. Empty when the organization asks none. */
  nda?: string;
  slug: string;
};

/** What a party sends. `email` is the only address the eventual grant admits. */
export type Ask = { email: string; party?: string; reason?: string; item?: string; accept?: boolean };

/** The receipt. `state` is `open`: recording an ask decides nothing. */
export type Receipt = { id: string; state: string };

/** Where an item that can be read now is read. */
export const file = (id: string): string => `${ROOM}/file/${encodeURIComponent(id)}`;

export async function room(signal?: AbortSignal): Promise<Room> {
  const res = await fetch(ROOM, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${ROOM} answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`);
  const doc = (await res.json()) as Partial<Room>;
  return { items: Array.isArray(doc.items) ? doc.items : [], name: doc.name ?? '', nda: doc.nda, slug: doc.slug ?? '' };
}

export async function ask(a: Ask): Promise<Receipt> {
  const res = await fetch(`${ROOM}/requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(a),
  });
  if (!res.ok) throw new Error(`the request was not recorded — ${ROOM}/requests answered ${res.status}`);
  return (await res.json()) as Receipt;
}
