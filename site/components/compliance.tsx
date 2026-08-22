'use client';

import { Card } from '@hanzo/ui/primitives/Card';
import { CardContent } from '@hanzo/ui/primitives/CardContent';
import { CardDescription } from '@hanzo/ui/primitives/CardDescription';
import { CardHeader } from '@hanzo/ui/primitives/CardHeader';
import { CardTitle } from '@hanzo/ui/primitives/CardTitle';
import { Grid } from '@hanzo/ui/grid';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { unit, type Coverage } from '@/lib/trust';
import { Mark } from './mark';
import { Nothing } from './nothing';

/**
 * One card per framework: who publishes it, which edition, and how many of its
 * clauses an automated control answers.
 *
 * The denominator carries its own noun — a framework counts criteria, another
 * counts controls, a third counts families — so "12 of 61" is printed as
 * "12 of 61 criteria". A bare count against a framework whose unit the reader
 * has to guess is the shape of every number nobody can check.
 */
export function Compliance({ coverage }: { coverage: Coverage[] }) {
  if (coverage.length === 0) return <Nothing>No framework coverage is published.</Nothing>;

  return (
    <Grid columns={{ min: 320, max: 2 }} gap={16}>
      {coverage.map((c) => (
        <Card key={c.framework} rounded={24} gap="$4" bg="$color1">
          <CardHeader gap="$1">
            {/* The publisher's plate, never a facsimile of their emblem. A
                standards body's mark is a trademark, none of these three
                publish a freely-licensed one, and putting a look-alike beside a
                coverage figure would be the exact kind of borrowed authority
                this page exists to avoid. */}
            <XStack gap="$3" items="center">
              <Mark name={c.publisher} size={28} />
              <YStack gap="$0.5" flex={1}>
                <CardTitle size="$5">{c.name}</CardTitle>
                <CardDescription size="$2">
                  {c.publisher} · {c.edition}
                </CardDescription>
              </YStack>
            </XStack>
          </CardHeader>

          <CardContent gap="$3">
            <XStack gap="$6" flexWrap="wrap">
              {[
                { label: 'Automated', value: c.automated },
                { label: 'Partial', value: c.partial },
                { label: 'None', value: c.none },
              ].map((n) => (
                <YStack key={n.label} gap="$0.5">
                  <Text fontSize="$7" fontWeight="700" color="$color12" className="hz-tnum">
                    {n.value}
                  </Text>
                  <Text fontSize="$1" color="$color10">
                    {n.label}
                  </Text>
                </YStack>
              ))}
            </XStack>

            <Text fontSize="$3" color="$color11">
              of {c.total} {unit(c.total, c)}
            </Text>

            {c.note ? (
              <Text fontSize="$2" color="$color10">
                {c.note}
              </Text>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </Grid>
  );
}
