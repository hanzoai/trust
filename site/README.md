# trust.hanzo.ai

The page. It is a shell — a Next.js static export with no server, no build-time
data and no database — that reads the whole trust centre from the API in the
reader's browser, on every visit.

That is the one decision everything else follows from. A trust page compiled
from a snapshot is stale the moment a control changes, and a stale compliance
number is the exact failure the inventory in this repository exists to refuse.
So no figure on this page is written here: every count, every sentence and every
date arrives in one response and is printed as it came.

## The data

One public GET, no credential:

    https://api.hanzo.ai/v1/trust/published/hanzo

`lib/trust.ts` holds the shape and makes the request. `lib/dataroom.ts` holds the
second, smaller conversation — the catalogue of what exists to read and the POST
that records a request for what is released through a grant. The room is read
only when a reader opens the request panel, because a trust centre is read far
more often than it is asked of.

Nine sections, in this order: Overview, Compliance, Controls, Documents,
Subprocessors, Policies, Knowledge Base, Updates, Risk Profile. Each is one
component under `components/`, and `app/page.tsx` states the order once — the
index in the header, the anchors and the scroll position report all read that
same array, so a section cannot exist in the nav and nowhere on the page.

An empty list is stated in words in the section that is empty. A section that
publishes nothing says so; it never shows a placeholder, and it never shows
anything the API did not send.

## Run it

    pnpm install
    pnpm build       # -> ./out
    pnpm dev         # port 3005
    pnpm typecheck

`out/` is what ships. To see the page against a document while the API is not
reachable, serve `out/` and answer the request from the browser's own network
layer — the page will otherwise render its error state, which is the correct
behaviour and worth looking at too.

## Stack

- Next 15, `output: 'export'`, `trailingSlash`, unoptimized images.
- **[@hanzo/ui](https://npmjs.com/package/@hanzo/ui) 8.1.6** on **@hanzo/gui
  8.1.1** — components and design tokens both. Imported per member
  (`@hanzo/ui/primitives/Button`), never off the root barrel, which drags the
  whole library into the first load.
- No Tailwind, no Radix, no shadcn. `app/global.css` is the one stylesheet and
  holds six rules: what a component cannot know, which is how far a heading sits
  below a sticky header and how a strip of section links scrolls on a phone.
- Dark, and only dark. `<html className="dark t_dark">` is server-rendered so the
  first frame is already the ground; `app/providers.tsx` keeps both classes
  written from one state (@hanzo/ui's tokens key off `.dark`, gui resolves
  `$color…` through `t_dark` — driving one and not the other is silent).
- `gui.d.ts` registers the config with TypeScript. Without it every shorthand
  style prop is a type error, because gui derives the prop names from whichever
  config is installed.

## The copy rule

`ci/bin/certclaims` runs over this source and fails a line that claims a
certificate, or hedges, beside the name of a framework. Nothing here names a
framework at all: every framework name on the page arrives from the API at
runtime. Keep it that way — say the true, positive thing, and let the document
say the rest.
