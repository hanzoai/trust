'use client';

import { Grid } from '@hanzo/ui/grid';
import { H1 } from '@hanzo/ui/primitives/H1';
import { Paragraph } from '@hanzo/ui/primitives/Paragraph';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { day, type Center } from '@/lib/trust';
import { LOUD } from './ink';
import { Nothing } from './nothing';

/**
 * The digest.
 *
 * Every figure here is the API's own: the tiles are `inventory`'s fields and the
 * sentences are `inventory.statement` and each `coverage[].statement`, printed
 * as they arrive. Nothing on this page is computed from them, because a number
 * this site derived is a number nobody can check against the inventory in git.
 */
export function Overview({ center }: { center: Center }) {
  const { profile, inventory, coverage } = center;

  const tiles = [
    { label: 'Controls', value: inventory.total },
    { label: 'Automated', value: inventory.automated },
    { label: 'Partial', value: inventory.partial },
    { label: 'Absent', value: inventory.absent },
    { label: 'Unverified', value: inventory.unverified },
  ];

  return (
    <YStack gap="$5">
      <YStack gap="$3">
        <H1 fontSize="$10" lineHeight="$10" fontWeight="700" letterSpacing={-1} color={LOUD}>
          {profile.name}
        </H1>
        {profile.tagline ? (
          <Paragraph fontSize="$5" color="$color11" maxW={680}>
            {profile.tagline}
          </Paragraph>
        ) : null}
        {profile.summary ? (
          <Paragraph fontSize="$4" color="$color11" maxW={680}>
            {profile.summary}
          </Paragraph>
        ) : null}
        <Text fontSize="$1" color="$color10">
          Updated {day(profile.updated)}
        </Text>
      </YStack>

      <Grid columns={{ min: 128, max: 5 }} gap={12}>
        {tiles.map((t) => (
          <YStack key={t.label} gap="$1" p="$4" rounded={24} borderWidth={1} borderColor="$borderColor" bg="$color1">
            <Text fontSize="$9" fontWeight="700" color={LOUD} className="hz-tnum">
              {t.value}
            </Text>
            <Text fontSize="$1" color="$color10">
              {t.label}
            </Text>
          </YStack>
        ))}
      </Grid>

      <Paragraph fontSize="$4" color="$color12">
        {inventory.statement}
      </Paragraph>

      <YStack gap="$2">
        {coverage.length === 0 ? (
          <Nothing>No framework coverage is published.</Nothing>
        ) : (
          coverage.map((c) => (
            <XStack key={c.framework} gap="$2" flexWrap="wrap" items="baseline">
              <Text fontSize="$3" fontWeight="600" color="$color12">
                {c.name}
              </Text>
              <Text fontSize="$3" color="$color10">
                {c.statement}
              </Text>
            </XStack>
          ))
        )}
      </YStack>
    </YStack>
  );
}
