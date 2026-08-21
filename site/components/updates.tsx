'use client';

import { useMemo } from 'react';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { day, type Update } from '@/lib/trust';
import { Nothing } from './nothing';

/** What changed, newest first. */
export function Updates({ rows }: { rows: Update[] }) {
  const feed = useMemo(() => [...rows].sort((a, b) => b.at - a.at), [rows]);

  if (feed.length === 0) return <Nothing>No updates are published.</Nothing>;

  return (
    <YStack gap="$5">
      {feed.map((u) => (
        <XStack key={u.id} gap="$4" items="flex-start" flexWrap="wrap">
          <Text fontSize="$2" color="$color10" width={110} className="hz-tnum">
            {day(u.at)}
          </Text>
          <YStack gap="$1.5" flex={1} minW={240}>
            <Text fontSize="$4" fontWeight="600" color="$color12">
              {u.title}
            </Text>
            {u.body ? (
              <Text fontSize="$3" color="$color11">
                {u.body}
              </Text>
            ) : null}
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}
