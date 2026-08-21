'use client';

import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { Nothing } from './nothing';

/** The sheet a reviewer copies into their own register: label, value, nothing else. */
export function Risk({ items }: { items: { label: string; value: string }[] }) {
  if (items.length === 0) return <Nothing>No risk profile is published.</Nothing>;

  return (
    <YStack rounded={24} borderWidth={1} borderColor="$borderColor" bg="$color1" overflow="hidden">
      {items.map((i, n) => (
        <XStack
          key={i.label}
          gap="$4"
          px="$4"
          py="$3"
          items="baseline"
          justify="space-between"
          flexWrap="wrap"
          borderTopWidth={n === 0 ? 0 : 1}
          borderColor="$borderColor"
        >
          <Text fontSize="$3" color="$color10">
            {i.label}
          </Text>
          <Text fontSize="$3" color="$color12" text="right">
            {i.value}
          </Text>
        </XStack>
      ))}
    </YStack>
  );
}
