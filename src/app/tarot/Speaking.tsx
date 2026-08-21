/**
 * The reader's voice while it is still arriving.
 *
 * Every stream event carries the whole sentence-so-far, so the plain render
 * replaces the paragraph each time and the words simply appear. This cuts that
 * text into pieces and lets each new piece surface instead — out of focus and a
 * little low, resolving over about a second — while the pieces already on screen
 * are left alone. The pieces are keyed by position, so one that has arrived
 * keeps its DOM node and therefore keeps its finished animation: only what is
 * genuinely new ever moves.
 *
 * There is deliberately no stagger here. The reader's own cadence is the
 * stagger — a phrase that arrives in one chunk resolves as one phrase, which is
 * how a sentence forms in someone's mouth, and a word that arrives alone
 * surfaces alone. A number in this file would only overwrite that with a
 * metronome.
 *
 * One piece per character in Chinese and per word everywhere else: a word broken
 * into letters reads as a ransom note, and a Chinese sentence has no spaces to
 * break on. Whitespace gets a piece of its own but not the inline-block, because
 * an inline-block whose only content is a space collapses to nothing — which
 * would quietly glue every English word to the next.
 */

const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}';
const PIECES = new RegExp(`[${CJK}]|\\s+|[^\\s${CJK}]+`, 'gu');

export interface SpeakingProps {
  text: string;
  /** Where the voice is speaking from, when that place styles it differently. */
  className?: string;
}

export default function Speaking({ text, className }: SpeakingProps) {
  const pieces = text.match(PIECES) ?? [];
  return (
    <p className={className ? `taro-speaking ${className}` : 'taro-speaking'}>
      {/* Said once, plainly, for anyone listening rather than watching. */}
      <span className="taro-sr-only">{text}</span>
      {/* The caret lives in here with the words rather than beside them, so that
          a parent laying its children out in a column — the hint under a card
          does — keeps the cursor at the end of the sentence instead of putting
          it on a line of its own. */}
      <span aria-hidden>
        {pieces.map((piece, index) => (
          <span className={/\s/.test(piece) ? undefined : 'taro-word'} key={index}>
            {piece}
          </span>
        ))}
        <span className="taro-caret" />
      </span>
    </p>
  );
}
