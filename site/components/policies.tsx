'use client';

import { ExternalLink } from '@hanzogui/lucide-icons-2';
import { Anchor } from '@hanzo/ui/primitives/Anchor';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { day, type Policy } from '@/lib/trust';
import { Nothing } from './nothing';

/** The written rules, and where to read each one in full. */
export function Policies({ rows }: { rows: Policy[] }) {
  if (rows.length === 0) return <Nothing>No policies are published.</Nothing>;

  return (
    <YStack gap="$3">
      {rows.map((p) => (
        <YStack key={p.id} gap="$2" p="$4" rounded={24} borderWidth={1} borderColor="$borderColor" bg="$color1">
          <XStack gap="$3" items="baseline" justify="space-between" flexWrap="wrap">
            <Text fontSize="$4" fontWeight="600" color="$color12">
              {p.title}
            </Text>
            <Text fontSize="$1" color="$color10" className="hz-tnum">
              {day(p.updated)}
            </Text>
          </XStack>

          {p.summary ? (
            <Text fontSize="$3" color="$color11">
              {p.summary}
            </Text>
          ) : null}

          {p.href ? (
            <Anchor href={p.href} target="_blank" rel="noreferrer">
              <XStack gap="$1.5" items="center">
                <Text fontSize="$3" color="$color12">
                  Read
                </Text>
                <ExternalLink size={13} color="$color10" />
              </XStack>
            </Anchor>
          ) : null}
        </YStack>
      ))}
    </YStack>
  );
}
