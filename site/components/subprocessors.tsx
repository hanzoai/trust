'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from '@hanzogui/lucide-icons-2';
import { Anchor } from '@hanzo/ui/primitives/Anchor';
import { Card } from '@hanzo/ui/primitives/Card';
import { CardContent } from '@hanzo/ui/primitives/CardContent';
import { CardFooter } from '@hanzo/ui/primitives/CardFooter';
import { CardHeader } from '@hanzo/ui/primitives/CardHeader';
import { CardTitle } from '@hanzo/ui/primitives/CardTitle';
import { Grid } from '@hanzo/ui/primitives/Grid';
import { Paragraph } from '@hanzo/ui/primitives/Paragraph';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { Segmented, type Option } from '@hanzo/ui/product/Filters';
import { StatusTag } from '@hanzo/ui/product/StatusTag';
import type { Subprocessor } from '@/lib/trust';
import { Mark } from './mark';
import { Nothing } from './nothing';

/**
 * Who else touches the data, and the distinction that is the whole section.
 *
 * A PROCESSOR receives or can reach customer data. A VENDOR is a party we buy
 * from that no customer data reaches — an advertising platform we place
 * advertisements on is a purchase, not a route data travels. Rendering the two
 * as one undifferentiated list is what makes a subprocessor page useless: a
 * reader cannot tell the party that holds every byte from the one we pay for
 * clicks, so the long list reads as either alarming or meaningless.
 *
 * So the role leads, the field that carries it is always shown, and the counts
 * are printed above the grid. Nothing here is computed by this page — every
 * value is the one the API answered with, and the arithmetic is a length.
 */
const ALL = '';

const TONE = { processor: 'moving', vendor: 'settled' } as const;

const SAYS: Record<string, string> = {
  processor: 'receives or can reach customer data',
  vendor: 'a party we buy from, that no customer data reaches',
};

const Eyebrow = ({ children }: { children: string }) => (
  <Text fontSize="$1" fontWeight="600" color="$color10">
    {children}
  </Text>
);

/** `repo/path` for a declaration, or the bare host for a party a browser reaches. */
const where = (e: Subprocessor['evidence'][number]) =>
  e.origin ? e.origin : `${e.repo}/${e.path}${e.symbol ? ` · ${e.symbol}` : ''}`;

export function Subprocessors({ rows }: { rows: Subprocessor[] }) {
  const [role, setRole] = useState<string>(ALL);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const counts = useMemo(() => {
    const n = { processor: 0, vendor: 0 };
    for (const s of rows) if (s.role === 'processor' || s.role === 'vendor') n[s.role] += 1;
    return n;
  }, [rows]);

  const shown = useMemo(() => rows.filter((s) => role === ALL || s.role === role), [rows, role]);

  if (rows.length === 0) return <Nothing>No subprocessors are published.</Nothing>;

  const options: Option<string>[] = [
    { label: 'All', value: ALL },
    { label: `Processors (${counts.processor})`, value: 'processor' },
    { label: `Vendors (${counts.vendor})`, value: 'vendor' },
  ];

  const toggle = (id: string) =>
    setOpen((was) => {
      const now = new Set(was);
      if (!now.delete(id)) now.add(id);
      return now;
    });

  return (
    <YStack gap="$4">
      <Paragraph fontSize="$3" color="$color11" maxW={680}>
        A processor receives or can reach customer data. A vendor is a party we buy from that no
        customer data reaches. Every entry says which it is and what it receives, and names the file
        the relationship is declared in — or, where a browser reaches it, the host it is reached at.
      </Paragraph>

      <Segmented options={options} value={role} onChange={setRole} name="role" />

      <Text fontSize="$2" color="$color10" className="hz-tnum">
        {shown.length} of {rows.length} shown
      </Text>

      {shown.length === 0 ? (
        <Nothing>Nothing is published in that group.</Nothing>
      ) : (
        <Grid min={340} max={2} gap={16}>
          {shown.map((s) => {
            const seen = open.has(s.id);
            return (
              <Card key={s.id} rounded={24} gap="$3" bg="$color1" interactive onPress={() => toggle(s.id)}>
                <CardHeader gap="$2">
                  <XStack gap="$3" items="flex-start" justify="space-between" width="100%">
                    <XStack gap="$3" items="center" flex={1}>
                      <Mark id={s.mark} name={s.name} />
                      <YStack gap="$1" flex={1}>
                        <CardTitle size="$4">{s.name}</CardTitle>
                        <Text fontSize="$1" color="$color10">
                          {s.location ?? '—'}
                        </Text>
                      </YStack>
                    </XStack>
                    <StatusTag status={s.role} tone={TONE[s.role as keyof typeof TONE] ?? 'stopped'} />
                  </XStack>
                </CardHeader>

                <CardContent gap="$2">
                  <Text fontSize="$3" color="$color12">
                    {s.purpose}
                  </Text>
                  {/* The classification, in words, always shown. A role badge on
                      its own is a label; this is the claim it stands for. */}
                  <Text fontSize="$2" color="$color10">
                    {s.data}
                  </Text>
                </CardContent>

                {seen ? (
                  <CardContent gap="$4" pt="$4" borderTopWidth={1} borderColor="$borderColor">
                    <YStack gap="$1">
                      <Eyebrow>What this means</Eyebrow>
                      <Text fontSize="$2" color="$color11">
                        {SAYS[s.role] ?? 'Unclassified.'}
                      </Text>
                    </YStack>

                    <YStack gap="$1">
                      <Eyebrow>Declared in</Eyebrow>
                      {s.evidence.length === 0 ? (
                        <Text fontSize="$2" color="$color10">
                          No declaration is recorded.
                        </Text>
                      ) : (
                        s.evidence.map((e) => (
                          <YStack key={where(e)} gap="$0.5">
                            <Text fontSize="$2" color="$color11" className="hz-mono path">
                              {where(e)}
                            </Text>
                            {e.note ? (
                              <Text fontSize="$1" color="$color10">
                                {e.note}
                              </Text>
                            ) : null}
                          </YStack>
                        ))
                      )}
                    </YStack>

                    {s.url || s.terms ? (
                      <XStack gap="$3" items="center" flexWrap="wrap">
                        {s.url ? (
                          <Anchor href={s.url} target="_blank" rel="noreferrer" fontSize="$2" color="$color12">
                            Site
                          </Anchor>
                        ) : null}
                        {s.terms ? (
                          <Anchor href={s.terms} target="_blank" rel="noreferrer" fontSize="$2" color="$color12">
                            Processing terms
                          </Anchor>
                        ) : null}
                      </XStack>
                    ) : null}
                  </CardContent>
                ) : null}

                <CardFooter gap="$1.5" items="center">
                  {seen ? <ChevronDown size={14} color="$color10" /> : <ChevronRight size={14} color="$color10" />}
                  <Text fontSize="$1" color="$color10">
                    {seen ? 'Hide evidence' : 'Evidence'}
                  </Text>
                </CardFooter>
              </Card>
            );
          })}
        </Grid>
      )}
    </YStack>
  );
}
