'use client';

import { useMemo, useState } from 'react';
import { Accordion } from '@hanzo/ui/primitives/Accordion';
import { AccordionContent } from '@hanzo/ui/primitives/AccordionContent';
import { AccordionItem } from '@hanzo/ui/primitives/AccordionItem';
import { AccordionTrigger } from '@hanzo/ui/primitives/AccordionTrigger';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { SearchInput } from '@hanzo/ui/product/Filters';
import type { Question } from '@/lib/trust';
import { Nothing } from './nothing';

/**
 * The questions a security review asks, answered once.
 *
 * The search reads the ANSWER as well as the question, because a reviewer
 * arrives with a word from their own questionnaire — "retention", "MFA" — and
 * that word is almost never in the heading.
 */
export function Faq({ rows }: { rows: Question[] }) {
  const [find, setFind] = useState('');

  const shown = useMemo(() => {
    const needle = find.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((q) =>
      `${q.question} ${q.answer} ${(q.tags ?? []).join(' ')}`.toLowerCase().includes(needle),
    );
  }, [rows, find]);

  if (rows.length === 0) return <Nothing>No questions are published.</Nothing>;

  return (
    <YStack gap="$4">
      <SearchInput value={find} onChange={setFind} placeholder="Search the answers" name="faq" />

      {shown.length === 0 ? (
        <Nothing>No question matches that search.</Nothing>
      ) : (
        <Accordion type="multiple" gap="$2">
          {shown.map((q) => (
            <AccordionItem
              key={q.id}
              value={q.id}
              rounded={24}
              borderWidth={1}
              borderColor="$borderColor"
              bg="$color1"
              overflow="hidden"
            >
              <AccordionTrigger px="$4" py="$3" headingLevel={3} bg="transparent">
                <Text fontSize="$3" fontWeight="600" color="$color12" text="left">
                  {q.question}
                </Text>
              </AccordionTrigger>
              <AccordionContent px="$4" pb="$4" bg="transparent">
                <YStack gap="$2">
                  <Text fontSize="$3" color="$color11">
                    {q.answer}
                  </Text>
                  {q.tags && q.tags.length > 0 ? (
                    <XStack gap="$1.5" flexWrap="wrap">
                      {q.tags.map((t) => (
                        <Text key={t} fontSize="$1" color="$color10" px="$2" py="$1" rounded="$10" bg="$color3">
                          {t}
                        </Text>
                      ))}
                    </XStack>
                  ) : null}
                </YStack>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </YStack>
  );
}
