'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Activity, Bell, FileText, HelpCircle, Layers, Lock, ScrollText, ShieldCheck, Users } from '@hanzogui/lucide-icons-2';
import { Anchor } from '@hanzo/ui/primitives/Anchor';
import { Button } from '@hanzo/ui/primitives/Button';
import { Grid } from '@hanzo/ui/primitives/Grid';
import { H2 } from '@hanzo/ui/primitives/H2';
import { Paragraph } from '@hanzo/ui/primitives/Paragraph';
import { Section } from '@hanzo/ui/primitives/Section';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import type { IconLike } from '@hanzo/ui/product/color';
import { Skeleton } from '@hanzo/ui/product/Skeleton';
import { Chrome } from '@/components/chrome';
import { Compliance } from '@/components/compliance';
import { Controls } from '@/components/controls';
import { Documents } from '@/components/documents';
import { Faq } from '@/components/faq';
import { Overview } from '@/components/overview';
import { Policies } from '@/components/policies';
import { Risk } from '@/components/risk';
import { Subprocessors } from '@/components/subprocessors';
import { Updates } from '@/components/updates';
import { day, read, SOURCE, type Center } from '@/lib/trust';

/**
 * The order of the document, stated once.
 *
 * The index in the header, the anchors, the scroll position report and the
 * bodies all read this array, so a section cannot exist in the nav and nowhere
 * on the page, or arrive in an order the index disagrees with.
 */
const SECTIONS: { id: string; title: string; icon: IconLike; body: (c: Center) => ReactNode }[] = [
  { id: 'overview', title: 'Overview', icon: ShieldCheck, body: (c) => <Overview center={c} /> },
  { id: 'compliance', title: 'Compliance', icon: Layers, body: (c) => <Compliance coverage={c.coverage} /> },
  { id: 'controls', title: 'Controls', icon: Lock, body: (c) => <Controls controls={c.controls} /> },
  { id: 'documents', title: 'Documents', icon: FileText, body: (c) => <Documents documents={c.documents} /> },
  { id: 'subprocessors', title: 'Subprocessors', icon: Users, body: (c) => <Subprocessors rows={c.subprocessors} /> },
  { id: 'policies', title: 'Policies', icon: ScrollText, body: (c) => <Policies rows={c.policies} /> },
  { id: 'faq', title: 'Knowledge Base', icon: HelpCircle, body: (c) => <Faq rows={c.faq} /> },
  { id: 'updates', title: 'Updates', icon: Bell, body: (c) => <Updates rows={c.updates} /> },
  { id: 'risk', title: 'Risk Profile', icon: Activity, body: (c) => <Risk items={c.risk.items} /> },
];

const IDS = SECTIONS.map((s) => s.id);
const NAV = SECTIONS.map((s) => ({ id: s.id, title: s.title }));

/** The three things the one request can be: still out, answered, or refused. */
type Answer = { at: 'waiting' } | { at: 'ready'; center: Center } | { at: 'failed'; why: string };

export default function Page() {
  const [answer, setAnswer] = useState<Answer>({ at: 'waiting' });
  const [again, setAgain] = useState(0);
  const [here, setHere] = useState(IDS[0]);

  useEffect(() => {
    const stop = new AbortController();
    read(stop.signal)
      .then((center) => setAnswer({ at: 'ready', center }))
      .catch((e: unknown) => {
        if (stop.signal.aborted) return;
        setAnswer({ at: 'failed', why: e instanceof Error ? e.message : String(e) });
      });
    return () => stop.abort();
  }, [again]);

  // Which section the reader is actually looking at: the last one whose top has
  // passed under the header. Deterministic, unlike comparing the visible area of
  // sections that differ in height by a factor of fifty.
  //
  // The floor is the exception, and it is not cosmetic: the last three sections
  // share the final screen, so their tops never pass the line and the index
  // reports a heading that scrolled away two screens ago. At the bottom of the
  // document the reader is at the last section, whatever the arithmetic says.
  useEffect(() => {
    if (answer.at !== 'ready') return;
    const look = () => {
      const page = document.documentElement;
      if (window.scrollY + window.innerHeight >= page.scrollHeight - 2) {
        setHere(IDS[IDS.length - 1]);
        return;
      }
      const seen = IDS.filter((id) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top <= 96 : false;
      });
      setHere(seen.length > 0 ? seen[seen.length - 1] : IDS[0]);
    };
    look();
    window.addEventListener('scroll', look, { passive: true });
    return () => window.removeEventListener('scroll', look);
  }, [answer.at]);

  // On a phone the index is wider than the screen, so the section being read has
  // to be dragged into view — otherwise the position report is off-screen.
  useEffect(() => {
    document.getElementById(`rail-${here}`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [here]);

  return (
    <YStack minH="100svh" bg="$background">
      <Chrome
        items={NAV}
        here={here}
        contact={answer.at === 'ready' ? (answer.center.profile.contact ?? answer.center.profile.access) : undefined}
      />

      {answer.at === 'waiting' ? <Waiting /> : null}
      {answer.at === 'failed' ? <Failed why={answer.why} retry={() => { setAnswer({ at: 'waiting' }); setAgain((n) => n + 1); }} /> : null}

      {answer.at === 'ready' ? (
        <>
          <Section maxWidth={1120}>
            <YStack gap="$10">
              {SECTIONS.map((s) => (
                <section key={s.id} id={s.id}>
                  <YStack gap="$5">
                    <XStack gap="$2.5" items="center">
                      <s.icon size={15} color="$color10" />
                      <H2 fontSize="$6" fontWeight="600" letterSpacing={-0.4} color="$color12">
                        {s.title}
                      </H2>
                    </XStack>
                    {s.body(answer.center)}
                  </YStack>
                </section>
              ))}
            </YStack>
          </Section>

          <Section maxWidth={1120} py="$8" borderTopWidth={1} borderColor="$borderColor">
            <XStack gap="$3" justify="space-between" flexWrap="wrap">
              <Text fontSize="$1" color="$color10">
                Document {answer.center.version} for {answer.center.org}, generated {day(answer.center.generated)}.
              </Text>
              <Anchor href={SOURCE} target="_blank" rel="noreferrer" fontSize="$1" color="$color11">
                Read the same document this page reads
              </Anchor>
            </XStack>
          </Section>
        </>
      ) : null}
    </YStack>
  );
}

/**
 * The wait, shaped like the thing that is coming.
 *
 * Blocks the size of the real content, so nothing jumps when the document
 * lands — and no number, no name and no sentence is drawn before the API has
 * said one.
 */
function Waiting() {
  return (
    <Section maxWidth={1120}>
      <YStack gap="$7" aria-busy={true}>
        <YStack gap="$3">
          <Skeleton height={44} width={280} rounded={12} />
          <Skeleton.Text lines={2} />
        </YStack>
        <Grid min={128} max={5} gap={12}>
          {[0, 1, 2, 3, 4].map((n) => (
            <Skeleton key={n} height={96} rounded={24} />
          ))}
        </Grid>
        <Grid min={320} max={2} gap={16}>
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} height={180} rounded={24} />
          ))}
        </Grid>
      </YStack>
    </Section>
  );
}

/**
 * The refusal, said plainly.
 *
 * The one thing this panel must never do is stand in for the document: an
 * outage that renders as an empty page reads as an organization with nothing to
 * publish, and an outage that renders as stale numbers is worse than either.
 */
function Failed({ why, retry }: { why: string; retry: () => void }) {
  return (
    <Section maxWidth={1120}>
      <YStack gap="$4" p="$6" rounded={24} borderWidth={1} borderColor="$borderColor" bg="$color1" role="alert">
        <H2 fontSize="$6" fontWeight="600" color="$color12">
          The trust centre did not load
        </H2>
        <Paragraph fontSize="$3" color="$color11" maxW={560}>
          Nothing on this page is stored in it — every figure is read live from the API on each visit, so there is
          nothing to show until that request succeeds.
        </Paragraph>
        <Text fontSize="$2" color="$color10" className="hz-mono path">
          {why}
        </Text>
        <XStack gap="$3" items="center" flexWrap="wrap">
          <Button size="sm" rounded="$10" onPress={retry}>
            Try again
          </Button>
          <Anchor href="mailto:security@hanzo.ai" fontSize="$2" color="$color11">
            security@hanzo.ai
          </Anchor>
        </XStack>
      </YStack>
    </Section>
  );
}
