'use client';

import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { MARKS } from './marks';

/**
 * The one tile every mark on this page renders through.
 *
 * Two branches, one footprint. A party we hold a freely-licensed mark for gets
 * its canonical geometry; a party we do not gets a monogram plate of exactly the
 * same size, so a missing logo never reflows the row it sits in and no row is
 * quietly worth more than its neighbour for having one.
 *
 * The plate is not a placeholder for a mark we mean to add later — for most of
 * these there is nothing to add. A brand mark is somebody else's property and
 * the set we take from carries only the ones that are free to redistribute, so
 * the honest rendering of "no licence" is a uniform plate. Drawing a look-alike
 * would be inventing a mark and attributing it to them.
 *
 * Drawn in one grey, never in brand colour: this is a directory of parties, and
 * a page where twelve logos compete in twelve palettes is a page nobody reads.
 */
export function Mark({ id, name, size = 24 }: { id?: string; name: string; size?: number }) {
  const paths = id ? MARKS[id] : undefined;
  const inner = Math.round(size * 0.66);

  return (
    <XStack
      width={size}
      height={size}
      rounded={Math.round(size / 4)}
      bg="$color3"
      items="center"
      justify="center"
      shrink={0}
      aria-hidden
    >
      {paths ? (
        <svg width={inner} height={inner} viewBox="0 0 24 24" focusable="false">
          {paths.map((d) => (
            <path key={d} d={d} fill="var(--muted-foreground)" />
          ))}
        </svg>
      ) : (
        <Text fontSize={Math.round(size * 0.44)} lineHeight={size} fontWeight="600" color="$color11">
          {name.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </XStack>
  );
}
