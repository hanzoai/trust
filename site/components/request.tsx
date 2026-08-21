'use client';

import { useState } from 'react';
import { ExternalLink } from '@hanzogui/lucide-icons-2';
import { Anchor } from '@hanzo/ui/primitives/Anchor';
import { Button } from '@hanzo/ui/primitives/Button';
import { Separator } from '@hanzo/ui/primitives/Separator';
import { Spinner } from '@hanzo/ui/primitives/Spinner';
import { Text } from '@hanzo/ui/primitives/Text';
import { XStack } from '@hanzo/ui/primitives/XStack';
import { YStack } from '@hanzo/ui/primitives/YStack';
import { FieldRow, FieldSwitch, FieldText, FieldTextArea } from '@hanzo/ui/product/Field';
import { ask, file, room, type Room } from '@/lib/dataroom';
import { day } from '@/lib/trust';

/** An address the grant can actually be sent to. The only thing worth refusing here. */
const reachable = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

type Panel = { at: 'shut' } | { at: 'reading' } | { at: 'open'; room: Room } | { at: 'unreachable'; why: string };
type Sent = { at: 'idle' } | { at: 'sending' } | { at: 'done'; state: string } | { at: 'refused'; why: string };

/**
 * Asking for what is not published.
 *
 * The room is read when the panel is opened, not on every visit: a trust centre
 * is read far more often than it is asked of. What comes back is the list of
 * everything the centre holds — readable now, or released through a grant — so a
 * reader can see what exists before asking for it.
 *
 * The write IS the answer. A form that accepts an address and drops it is worse
 * than no form, so this reports the recorded state or it reports that nothing was
 * recorded, and never a thank-you it cannot back.
 */
export function Request() {
  const [panel, setPanel] = useState<Panel>({ at: 'shut' });
  const [sent, setSent] = useState<Sent>({ at: 'idle' });
  const [email, setEmail] = useState('');
  const [party, setParty] = useState('');
  const [reason, setReason] = useState('');
  const [accepted, setAccepted] = useState(false);

  const look = () => {
    setPanel({ at: 'reading' });
    room()
      .then((r) => setPanel({ at: 'open', room: r }))
      .catch((e: unknown) => setPanel({ at: 'unreachable', why: e instanceof Error ? e.message : String(e) }));
  };

  const send = (nda: string) => {
    setSent({ at: 'sending' });
    ask({
      email: email.trim(),
      ...(party.trim() ? { party: party.trim() } : {}),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      ...(nda ? { accept: true } : {}),
    })
      .then((r) => setSent({ at: 'done', state: r.state }))
      .catch((e: unknown) => setSent({ at: 'refused', why: e instanceof Error ? e.message : String(e) }));
  };

  if (panel.at === 'shut') {
    return (
      <XStack gap="$3" items="center" flexWrap="wrap">
        <Button size="sm" rounded="$10" onPress={look}>
          Request access
        </Button>
        <Text fontSize="$2" color="$color10">
          Anything an independent auditor put their name to is released through a grant.
        </Text>
      </XStack>
    );
  }

  if (panel.at === 'reading') {
    return (
      <XStack gap="$3" items="center">
        <Spinner size={16} />
        <Text fontSize="$2" color="$color10">
          Reading the document room.
        </Text>
      </XStack>
    );
  }

  if (panel.at === 'unreachable') {
    return (
      <YStack gap="$3" p="$5" rounded={24} borderWidth={1} borderColor="$borderColor" bg="$color1" role="alert">
        <Text fontSize="$3" color="$color12">
          The document room did not answer, so a request cannot be recorded right now.
        </Text>
        <Text fontSize="$2" color="$color10" className="hz-mono path">
          {panel.why}
        </Text>
        <XStack>
          <Button size="sm" variant="outline" rounded="$10" onPress={look}>
            Try again
          </Button>
        </XStack>
      </YStack>
    );
  }

  const { items, nda } = panel.room;
  const held = items.filter((i) => i.available === 'on request');
  const now = items.filter((i) => i.available === 'now');

  return (
    <YStack gap="$5" p="$5" rounded={24} borderWidth={1} borderColor="$borderColor" bg="$color1">
      {items.length === 0 ? (
        <Text fontSize="$3" color="$color11">
          The document room holds nothing at present. A request recorded here is still answered by a person.
        </Text>
      ) : (
        <YStack gap="$3">
          {now.map((i) => (
            <XStack key={i.id} gap="$3" items="baseline" justify="space-between" flexWrap="wrap">
              <YStack gap="$0.5" flex={1} minW={220}>
                <Anchor href={file(i.id)} target="_blank" rel="noreferrer">
                  <XStack gap="$1.5" items="center">
                    <Text fontSize="$3" color="$color12">
                      {i.name}
                    </Text>
                    <ExternalLink size={13} color="$color10" />
                  </XStack>
                </Anchor>
                {i.summary ? (
                  <Text fontSize="$2" color="$color10">
                    {i.summary}
                  </Text>
                ) : null}
              </YStack>
              <Text fontSize="$1" color="$color10" className="hz-tnum">
                {i.kind} · {day(i.updatedAt)}
              </Text>
            </XStack>
          ))}

          {held.map((i) => (
            <XStack key={i.id} gap="$3" items="baseline" justify="space-between" flexWrap="wrap">
              <YStack gap="$0.5" flex={1} minW={220}>
                <Text fontSize="$3" color="$color12">
                  {i.name}
                </Text>
                <Text fontSize="$2" color="$color10">
                  {i.signed === 'auditor' ? 'Signed by an independent auditor' : 'Released on request'}
                </Text>
              </YStack>
              <Text fontSize="$1" color="$color10" className="hz-tnum">
                {i.kind} · {day(i.updatedAt)}
              </Text>
            </XStack>
          ))}
        </YStack>
      )}

      <Separator />

      {nda ? (
        <YStack gap="$2">
          <Text fontSize="$1" fontWeight="600" color="$color10">
            Terms, verbatim
          </Text>
          <YStack
            p="$3"
            rounded="$5"
            borderWidth={1}
            borderColor="$borderColor"
            maxH={200}
            style={{ overflowY: 'auto' }}
          >
            <Text fontSize="$2" color="$color11">
              {nda}
            </Text>
          </YStack>
          <FieldRow label="I accept these terms">
            <FieldSwitch checked={accepted} onChange={setAccepted} disabled={sent.at !== 'idle'} />
          </FieldRow>
        </YStack>
      ) : null}

      <YStack gap="$2">
        <FieldRow label="Email">
          <FieldText
            value={email}
            onChange={setEmail}
            placeholder="where the grant is sent"
            autoComplete="email"
            id="ask-email"
            disabled={sent.at !== 'idle'}
          />
        </FieldRow>
        <FieldRow label="Company">
          <FieldText value={party} onChange={setParty} placeholder="optional" disabled={sent.at !== 'idle'} />
        </FieldRow>
        <FieldRow label="Reason">
          <FieldTextArea value={reason} onChange={setReason} rows={3} disabled={sent.at !== 'idle'} />
        </FieldRow>
      </YStack>

      {sent.at === 'done' ? (
        <Text fontSize="$3" color="$color12" role="status">
          Recorded, and {sent.state}. Somebody here decides it; the grant goes to {email.trim()}.
        </Text>
      ) : sent.at === 'refused' ? (
        <YStack gap="$1" role="alert">
          <Text fontSize="$3" color="$color12">
            Nothing was recorded, so nobody has your request.
          </Text>
          <Text fontSize="$2" color="$color10" className="hz-mono path">
            {sent.why}
          </Text>
        </YStack>
      ) : (
        <XStack gap="$3" items="center" flexWrap="wrap">
          <Button
            size="sm"
            rounded="$10"
            disabled={sent.at === 'sending' || !reachable(email) || (!!nda && !accepted)}
            isLoading={sent.at === 'sending'}
            onPress={() => send(nda ?? '')}
          >
            Send the request
          </Button>
          <Text fontSize="$2" color="$color10">
            {!reachable(email)
              ? 'An address the grant can be sent to is the one thing this needs.'
              : nda && !accepted
                ? 'Accept the terms above to send.'
                : 'It is written down and answered by a person.'}
          </Text>
        </XStack>
      )}
    </YStack>
  );
}
