'use client';

import { ExternalLink } from '@hanzogui/lucide-icons-2';
import { Anchor } from '@hanzo/ui/primitives/Anchor';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { DataTable, type Column } from '@hanzo/ui/product/DataTable';
import { day, type Doc } from '@/lib/trust';
import { Nothing } from './nothing';
import { Request } from './request';

/**
 * What there is to read, and how to get it.
 *
 * A row with no address is the honest half of this table: the document exists, it
 * has a title and a date, and it is released through a grant. There is exactly ONE
 * place to ask — the panel below — rather than a button per row, so a reader
 * cannot be looking at two request paths and wondering which one is real.
 */
export function Documents({ documents }: { documents: Doc[] }) {
  const columns: Column<Doc>[] = [
    {
      key: 'title',
      header: 'Document',
      render: (d) => (
        <YStack gap="$1">
          <Text fontSize="$3" color="$color12">
            {d.title}
          </Text>
          {d.note ? (
            <Text fontSize="$1" color="$color10">
              {d.note}
            </Text>
          ) : null}
        </YStack>
      ),
    },
    { key: 'label', header: 'Kind', width: 200 },
    { key: 'updated', header: 'Updated', width: 130, mono: true, render: (d) => day(d.updated) },
    {
      key: 'access',
      header: 'Access',
      width: 190,
      render: (d) =>
        d.released && d.href ? (
          <Anchor href={d.href} target="_blank" rel="noreferrer">
            <XStack gap="$1.5" items="center">
              <Text fontSize="$3" color="$color12">
                Read
              </Text>
              <ExternalLink size={13} color="$color10" />
            </XStack>
          </Anchor>
        ) : (
          <Text fontSize="$2" color="$color10">
            Available on request
          </Text>
        ),
    },
  ];

  return (
    <YStack gap="$5">
      {documents.length === 0 ? (
        <Nothing>No documents are published.</Nothing>
      ) : (
        <DataTable columns={columns} rows={documents} rowKey={(d) => d.id} />
      )}
      <Request />
    </YStack>
  );
}
