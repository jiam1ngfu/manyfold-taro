/**
 * One card in the spread, face down or face up.
 *
 * The face is drawn from the deck entry — no image assets, so a card that was
 * drawn a second ago renders instantly and a reversed card is genuinely the same
 * card turned around rather than a different picture.
 *
 * The component is told what to show; it never decides. A face-down slot has no
 * card prop at all, which is also the literal truth over the wire: the browser
 * has not been told what that card is yet.
 */

import type { JSX } from 'react';
import { cardById, type CardGlyph, type Locale } from '../../shared/tarot/deck';
import { copyFor } from '../../shared/tarot/i18n';
import type { DrawnCardView, SlotId } from '../../shared/tarot/types';

/* ───────── glyphs ───────── */

const GLYPHS: Record<CardGlyph, JSX.Element> = {
  star: (
    <path d="M32 6 38 24 56 24 41 35 47 53 32 42 17 53 23 35 8 24 26 24Z" />
  ),
  wands: (
    <>
      <path d="M32 8 32 56" strokeWidth="4" />
      <path d="M32 20 20 10M32 20 44 10M32 36 22 28M32 36 42 28" strokeWidth="3" />
    </>
  ),
  cups: (
    <>
      <path d="M16 14h32c0 14-6 22-16 24-10-2-16-10-16-24Z" />
      <path d="M32 38v12M22 52h20" strokeWidth="4" />
    </>
  ),
  swords: (
    <>
      <path d="M32 6 38 22 32 52 26 22Z" />
      <path d="M18 44h28" strokeWidth="4" />
    </>
  ),
  pentacles: (
    <>
      <circle cx="32" cy="32" r="22" fill="none" strokeWidth="3" />
      <path d="M32 14 44 48 16 27 48 27 20 48Z" fill="none" strokeWidth="3" />
    </>
  ),
};

function Glyph({ glyph }: { glyph: CardGlyph }) {
  return (
    <svg className="taro-glyph" viewBox="0 0 64 64" aria-hidden focusable="false">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="currentColor">
        {GLYPHS[glyph]}
      </g>
    </svg>
  );
}

/* ───────── the card ───────── */

export interface CardSlotProps {
  slot: SlotId;
  locale: Locale;
  /** Present only once the visitor has turned this card over. */
  card: DrawnCardView | null;
  /** Face-down cards animate in place while the deck is still settling. */
  settling?: boolean;
}

export default function CardSlot({ slot, locale, card, settling = false }: CardSlotProps) {
  const copy = copyFor(locale);
  const slotCopy = copy.slots[slot];
  const entry = card ? cardById(card.cardId) : null;
  const faceUp = Boolean(card && entry);

  return (
    <figure className={`taro-slot${faceUp ? ' is-up' : ''}`}>
      <div className={`taro-card${faceUp ? ' is-up' : ''}${settling ? ' is-settling' : ''}`}>
        <div className="taro-card-inner">
          <div className="taro-card-face taro-card-back" aria-hidden={faceUp}>
            <span className="taro-card-back-mark">✳</span>
          </div>
          <div className="taro-card-face taro-card-front" aria-hidden={!faceUp}>
            {entry && card && (
              <div className={`taro-card-art${card.reversed ? ' is-reversed' : ''}`}>
                <span className="taro-card-mark">{entry.mark}</span>
                <Glyph glyph={entry.glyph} />
                <span className="taro-card-name">{entry.name[locale]}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <figcaption className="taro-slot-caption">
        <span className="taro-slot-title">{slotCopy.title}</span>
        {faceUp && entry && card ? (
          <span className="taro-card-label">
            <strong>{entry.name[locale]}</strong>
            <span className={card.reversed ? 'taro-orient is-reversed' : 'taro-orient'}>
              {card.reversed ? copy.reveal.reversed : copy.reveal.upright}
            </span>
          </span>
        ) : (
          <span className="taro-card-label muted">{copy.reveal.faceDown}</span>
        )}
      </figcaption>
    </figure>
  );
}
