'use client';

import { HanzoLogo } from '@hanzo/logo/react';
import { Anchor } from '@hanzo/ui/primitives/Anchor';
import { Button } from '@hanzo/ui/primitives/Button';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { LOUD } from './ink';

/**
 * The bar at the top: the mark, and the index of the page.
 *
 * The index is ONE row at every width. On a phone it runs off the side and is
 * dragged (`.rail`); wrapping it to three lines instead would push the document
 * itself below the fold on the screen that can least afford it. `here` is the
 * section the reader is actually looking at, so the strip is a position report
 * and not decoration.
 *
 * `@hanzo/logo` ships no `'use client'`, so it is imported from inside one.
 */
export function Chrome({
  items,
  here,
  contact,
}: {
  items: { id: string; title: string }[];
  here: string;
  contact?: string;
}) {
  return (
    // A real <header>, and the sticky lives on IT: sticky is bounded by the
    // parent box, so putting it on an inner stack inside a header the same
    // height as itself gives the element nowhere to travel and it never sticks.
    // gui has no `tag`, and this page is a web export, so the landmark is HTML.
    <header style={{ position: 'sticky', top: 0, zIndex: 40 }}>
      <YStack bg="$background" borderBottomWidth={1} borderColor="$borderColor">
        <XStack px="$4" py="$3" gap="$3" items="center" justify="space-between">
          <XStack gap="$2.5" items="center">
            <HanzoLogo size={22} />
            <Text fontSize="$5" fontWeight="700" color={LOUD} letterSpacing={-0.4}>
              Trust
            </Text>
          </XStack>

          {contact ? (
            <Anchor href={contact} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" rounded="$10">
                Contact
              </Button>
            </Anchor>
          ) : null}
        </XStack>

        <XStack className="rail" px="$4" pb="$2.5" gap="$1">
          {items.map((i) => {
            const at = i.id === here;
            return (
              <Anchor
                key={i.id}
                id={`rail-${i.id}`}
                href={`#${i.id}`}
                px="$3"
                py="$1.5"
                rounded="$10"
                borderWidth={1}
                borderColor={at ? '$color7' : 'transparent'}
                bg={at ? '$color5' : 'transparent'}
                hoverStyle={{ bg: '$color3' }}
              >
                <Text
                  fontSize="$2"
                  fontWeight={at ? '700' : '500'}
                  color={at ? '$color12' : '$color10'}
                  whiteSpace="nowrap"
                >
                  {i.title}
                </Text>
              </Anchor>
            );
          })}
        </XStack>
      </YStack>
    </header>
  );
}
