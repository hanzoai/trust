import { Paragraph } from '@hanzo/ui/primitives/Paragraph';

/**
 * What a section says when there is nothing in it.
 *
 * A trust centre that publishes no subprocessors and a trust centre whose
 * subprocessor list failed to load look identical if both render a blank space,
 * and only one of those is an answer. So an empty list is stated in words, in
 * the section that is empty, in the reader's own terms.
 */
export function Nothing({ children }: { children: string }) {
  return (
    <Paragraph fontSize="$3" color="$color10">
      {children}
    </Paragraph>
  );
}
