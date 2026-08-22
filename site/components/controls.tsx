'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Database,
  KeyRound,
  Laptop,
  Network,
  Package,
  Server,
} from '@hanzogui/lucide-icons-2';
import { Card } from '@hanzo/ui/primitives/Card';
import { CardContent } from '@hanzo/ui/primitives/CardContent';
import { CardFooter } from '@hanzo/ui/primitives/CardFooter';
import { CardHeader } from '@hanzo/ui/primitives/CardHeader';
import { CardTitle } from '@hanzo/ui/primitives/CardTitle';
import { Grid } from '@hanzo/ui/primitives/Grid';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import type { IconLike } from '@hanzo/ui/product/color';
import { Segmented, SearchInput, type Option } from '@hanzo/ui/product/Filters';
import { StatusTag } from '@hanzo/ui/product/StatusTag';
import { CATEGORIES, type Control, type Site, type Status } from '@/lib/trust';
import { Nothing } from './nothing';

/**
 * The register a status reports in. The pill vocabulary knows a hundred
 * lifecycle words and none of these three, and an unknown status renders as
 * "nothing to report" — which is the wrong thing to say about an absent
 * control. So the three are named here, on the grey ladder, no hue spent.
 */
const TONE = { automated: 'settled', partial: 'moving', absent: 'stopped' } as const;

/** A control with no group stated belongs to the corporate one. */
const ALL = '';

const caps = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A mark per group, from the one icon set this page already carries.
 *
 * These are concepts rather than brands, so there is no trademark to borrow and
 * no licence to hold — canonical geometry from a set we ship is the whole of
 * it. Every group has one, including the ones that turn out to be thin: a group
 * rendered without a mark beside its siblings reads as a rendering fault, which
 * is not what we mean to say about it.
 */
const GROUP_MARK: Record<string, IconLike> = {
  infrastructure: Server,
  data: Database,
  access: KeyRound,
  network: Network,
  endpoint: Laptop,
  corporate: Building2,
  product: Package,
  incident: AlertTriangle,
};

const STATES: Option<string>[] = [
  { label: 'All', value: ALL },
  { label: 'Automated', value: 'automated' },
  { label: 'Partial', value: 'partial' },
  { label: 'Absent', value: 'absent' },
];

const Eyebrow = ({ children }: { children: string }) => (
  <Text fontSize="$1" fontWeight="600" color="$color10">
    {children}
  </Text>
);

/** `repo/path:line · symbol` — enough to open the file and find the mechanism. */
const where = (s: Site) => `${s.repo}/${s.path}${s.line ? `:${s.line}` : ''}${s.symbol ? ` · ${s.symbol}` : ''}`;

export function Controls({ controls }: { controls: Control[] }) {
  const [group, setGroup] = useState<string>(ALL);
  const [state, setState] = useState<string>(ALL);
  const [find, setFind] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const shown = useMemo(() => {
    const needle = find.trim().toLowerCase();
    return controls.filter((c) => {
      if (group !== ALL && (c.category ?? 'corporate') !== group) return false;
      if (state !== ALL && c.status !== state) return false;
      if (!needle) return true;
      return `${c.id} ${c.title ?? ''} ${c.claim} ${c.mechanism} ${c.note ?? ''}`.toLowerCase().includes(needle);
    });
  }, [controls, group, state, find]);

  // How many controls each group holds — counted here from the same list the
  // cards below are drawn from, so the tile and the grid cannot disagree.
  const tally = useMemo(() => {
    const n: Record<string, number> = {};
    for (const c of CATEGORIES) n[c] = 0;
    for (const c of controls) n[c.category ?? 'corporate'] = (n[c.category ?? 'corporate'] ?? 0) + 1;
    return n;
  }, [controls]);

  if (controls.length === 0) return <Nothing>No controls are published.</Nothing>;

  const toggle = (id: string) =>
    setOpen((was) => {
      const now = new Set(was);
      if (!now.delete(id)) now.add(id);
      return now;
    });

  return (
    <YStack gap="$4">
      {/* All eight groups, always, each with its mark and its own count.
          A group is a thing this organization ASSERTS a shape for, so one with
          few controls is a fact worth reading and one rendered as a gap in a
          row of tiles is a question nobody asked. Selecting a tile filters;
          selecting it again clears, so there is one control and not two. */}
      <Grid min={128} max={4} gap={12}>
        {CATEGORIES.map((c) => {
          const Icon = GROUP_MARK[c];
          const here = group === c;
          return (
            <YStack
              key={c}
              gap="$1.5"
              p="$3"
              rounded={16}
              borderWidth={1}
              borderColor={here ? '$color8' : '$borderColor'}
              bg={here ? '$color3' : '$color1'}
              cursor="pointer"
              role="button"
              aria-pressed={here}
              onPress={() => setGroup(here ? ALL : c)}
            >
              <XStack gap="$2" items="center" justify="space-between">
                <Icon size={14} color={here ? '$color12' : '$color10'} />
                <Text fontSize="$5" fontWeight="700" color={here ? '$color12' : '$color11'} className="hz-tnum">
                  {tally[c]}
                </Text>
              </XStack>
              <Text fontSize="$1" color="$color10">
                {caps(c)}
              </Text>
            </YStack>
          );
        })}
      </Grid>

      <YStack gap="$3">
        <SearchInput value={find} onChange={setFind} placeholder="Find a control" name="controls" />
        <Segmented options={STATES} value={state} onChange={setState} name="status" />
      </YStack>

      <Text fontSize="$2" color="$color10" className="hz-tnum">
        {shown.length} of {controls.length} shown
      </Text>

      {shown.length === 0 ? (
        // Two different facts, and only one of them is about the reader's typing:
        // a group with nothing in it is something the organization ASSERTS, and
        // all eight are listed so an empty one can be seen rather than inferred.
        <Nothing>
          {find.trim()
            ? 'No control matches that search.'
            : 'Nothing is published in that group.'}
        </Nothing>
      ) : (
        <Grid min={340} max={2} gap={16}>
          {shown.map((c) => {
            const seen = open.has(c.id);
            return (
              <Card key={c.id} rounded={24} gap="$3" bg="$color1" interactive onPress={() => toggle(c.id)}>
                <CardHeader gap="$2">
                  <XStack gap="$3" items="flex-start" justify="space-between" width="100%">
                    <YStack gap="$1" flex={1}>
                      {/* Most controls carry no title — the id IS the name, and
                          printing it twice reads as a rendering bug. */}
                      <CardTitle size="$4" className={c.title ? undefined : 'hz-mono'}>
                        {c.title ?? c.id}
                      </CardTitle>
                      <Text fontSize="$1" color="$color10" className="hz-mono">
                        {c.title ? `${c.id} · ${c.category ?? 'corporate'}` : (c.category ?? 'corporate')}
                      </Text>
                    </YStack>
                    <StatusTag status={c.status} tone={TONE[c.status as Status]} />
                  </XStack>
                </CardHeader>

                <CardContent gap="$2">
                  <Text fontSize="$3" color="$color12">
                    {c.claim}
                  </Text>
                  <Text fontSize="$2" color="$color10">
                    {c.mechanism}
                  </Text>
                </CardContent>

                {seen ? (
                  <CardContent gap="$4" pt="$4" borderTopWidth={1} borderColor="$borderColor">
                    {c.note ? (
                      <YStack gap="$1">
                        <Eyebrow>Note</Eyebrow>
                        <Text fontSize="$2" color="$color11">
                          {c.note}
                        </Text>
                      </YStack>
                    ) : null}

                    <YStack gap="$1">
                      <Eyebrow>Enforced in</Eyebrow>
                      {c.enforced.length === 0 ? (
                        <Text fontSize="$2" color="$color10">
                          No path recorded.
                        </Text>
                      ) : (
                        c.enforced.map((s) => (
                          <Text key={where(s)} fontSize="$2" color="$color11" className="hz-mono path">
                            {where(s)}
                          </Text>
                        ))
                      )}
                    </YStack>

                    <YStack gap="$2">
                      <Eyebrow>Checked by</Eyebrow>
                      {c.verified.length === 0 ? (
                        <Text fontSize="$2" color="$color10">
                          Nothing can fail on this control&apos;s behalf.
                        </Text>
                      ) : (
                        c.verified.map((v) => (
                          <YStack key={v.method} gap="$1">
                            <Text fontSize="$2" color="$color12">
                              {v.method}
                              {v.detail ? ` — ${v.detail}` : ''}
                            </Text>
                            {v.actions && v.actions.length > 0 ? (
                              <XStack gap="$1.5" flexWrap="wrap">
                                {v.actions.map((a) => (
                                  <Text key={a} fontSize="$1" color="$color11" px="$2" py="$1" rounded="$10" bg="$color3" className="hz-mono">
                                    {a}
                                  </Text>
                                ))}
                              </XStack>
                            ) : null}
                          </YStack>
                        ))
                      )}
                    </YStack>

                    <YStack gap="$2">
                      <Eyebrow>Answers</Eyebrow>
                      {c.maps.length === 0 ? (
                        <Text fontSize="$2" color="$color10">
                          No clause is named.
                        </Text>
                      ) : (
                        <XStack gap="$1.5" flexWrap="wrap">
                          {c.maps.map((m) => (
                            <XStack
                              key={m.clause}
                              gap="$1.5"
                              px="$2"
                              py="$1"
                              rounded="$10"
                              bg="$color3"
                              items="center"
                            >
                              <Text fontSize="$1" color="$color12" className="hz-mono">
                                {m.clause}
                              </Text>
                              <Text fontSize="$1" color="$color10">
                                {m.strength}
                              </Text>
                            </XStack>
                          ))}
                        </XStack>
                      )}
                    </YStack>
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
