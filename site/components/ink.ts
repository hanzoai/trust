import { asColor } from '@hanzo/ui/product/color';

/**
 * The brightest ink on the page.
 *
 * `--foreground` (#e5e5e5) is the reading colour; `--primary` (#fafafa) is one
 * step brighter, and the identity spends it on the few things that carry the
 * eye — the page's name and the headline figures. Everything else reads at
 * `$color12`/`$color11`/`$color10` down the grey ladder.
 *
 * gui types `color` as a token template while any CSS colour is valid at
 * runtime, so `asColor` is the package's own sanctioned crossing.
 */
export const LOUD = asColor('var(--primary)');
