'use client';

import type { ReactNode } from 'react';
import { NextThemeProvider, useThemeSetting } from '@hanzogui/next-theme';
import { GuiProvider } from '@hanzo/gui';
import { config as gui } from '@hanzo/ui/gui-config';

/**
 * The one provider stack, and — the point of this file — the one theme switch.
 *
 * Two token sources are on the page and they read DIFFERENT classes:
 * `@hanzo/ui/theme.css` keys the Hanzo identity off `.dark`, while gui resolves
 * `$color…` through its own root class, `t_light`/`t_dark`. Drive one and the
 * other silently stays behind — near-white text on a near-white page, a green
 * build the whole way.
 *
 * So both classes get written, by one state:
 *
 *   `.dark`   ← NextThemeProvider, via the `value` map below
 *   `.t_dark` ← GuiProvider, from `defaultTheme`
 *
 * There is no light theme here and no switch to reach one: a trust centre is an
 * inverted black surface, stated on `<html>` in the server-rendered markup so
 * the first frame is already right. Pinning it is what `enableSystem={false}`
 * says — the OS preference is a question this page has answered.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      // Left at its default this maps light/dark onto `t_light`/`t_dark` — gui's
      // class, which GuiProvider already writes. That is two writers for one
      // class, and nobody writing the `.dark` theme.css actually reads.
      value={{ light: 'light', dark: 'dark' }}
    >
      <Gui>{children}</Gui>
    </NextThemeProvider>
  );
}

/**
 * Separate component because `useThemeSetting` reads the context the provider
 * above creates. `defaultTheme` is a gui theme NAME, never `'system'`: gui has
 * no theme by that name, and asking for one writes a `t_system` class that
 * nothing matches.
 */
function Gui({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useThemeSetting();

  return (
    <GuiProvider config={gui} defaultTheme={resolvedTheme === 'light' ? 'light' : 'dark'}>
      {children}
    </GuiProvider>
  );
}
