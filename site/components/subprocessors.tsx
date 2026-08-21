'use client';

import { Anchor } from '@hanzo/ui/primitives/Anchor';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { DataTable, type Column } from '@hanzo/ui/product/DataTable';
import type { Subprocessor } from '@/lib/trust';
import { Nothing } from './nothing';

/** Who else touches the data, what for, and where they are. */
export function Subprocessors({ rows }: { rows: Subprocessor[] }) {
  if (rows.length === 0) return <Nothing>No subprocessors are published.</Nothing>;

  const columns: Column<Subprocessor>[] = [
    { key: 'name', header: 'Name', width: 200 },
    { key: 'purpose', header: 'Purpose' },
    { key: 'location', header: 'Location', width: 180, render: (s) => s.location ?? '—' },
    {
      key: 'links',
      header: 'Links',
      width: 150,
      render: (s) =>
        s.url || s.dpa ? (
          <XStack gap="$3" items="center">
            {s.url ? (
              <Anchor href={s.url} target="_blank" rel="noreferrer" fontSize="$3" color="$color12">
                Site
              </Anchor>
            ) : null}
            {s.dpa ? (
              <Anchor href={s.dpa} target="_blank" rel="noreferrer" fontSize="$3" color="$color12">
                Terms
              </Anchor>
            ) : null}
          </XStack>
        ) : (
          <Text fontSize="$3" color="$color10">
            —
          </Text>
        ),
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(s) => s.id} />;
}
