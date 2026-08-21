import type { Conf } from '@hanzo/ui/gui-config';

/**
 * Registers the Hanzo gui config with the type system.
 *
 * Without this every shorthand style prop — `bg`, `px`, `items`, `justify`,
 * `rounded`, `tag` — is a type error, because gui derives the prop names from
 * whichever config is installed and TypeScript cannot know which that is until
 * a consumer says. `GuiCustomConfig` is declared in `@hanzogui/web`, which is
 * why the augmentation names that package rather than `@hanzo/gui`: an
 * interface merges only with the module that declares it, and every other
 * package on the path re-exports it.
 */
declare module '@hanzogui/web' {
  interface GuiCustomConfig extends Conf {}
}
