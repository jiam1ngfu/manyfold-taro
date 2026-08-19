/**
 * The draw. This module is the only thing in the app allowed to decide which
 * cards come up and which way up they land.
 *
 * Why it lives server-side and nowhere else:
 *  - the browser must not choose, or the reading is whatever the user reloads until;
 *  - the diviner must not choose either, or the cards become a function of the
 *    question rather than of chance — which is the one thing a tarot reading
 *    cannot be. Agent 2 is handed the result and never asked for it.
 *
 * Randomness is `crypto.getRandomValues` with rejection sampling, so every card
 * and both orientations are uniformly likely — a plain `% n` would quietly bias
 * the low cards. The RNG is injectable purely so tests can be deterministic.
 */

import { DECK, DECK_SIZE, cardById } from '../../shared/tarot/deck';
import { CARDS_PER_READING, SLOT_ORDER, type SlotId } from '../../shared/tarot/types';

/** Uniform integer in [0, max). */
export type RandomSource = (max: number) => number;

/** One committed card. `reversed` is decided here, once, and never re-rolled. */
export interface DrawnCard {
  slot: SlotId;
  cardId: string;
  reversed: boolean;
}

/**
 * Uniform in [0, max) from the platform CSPRNG.
 *
 * Rejection sampling: draw a 32-bit value, discard the tail of the range that
 * would not divide evenly, then take the remainder. The discarded band is at
 * most `max` wide out of 2^32, so the loop practically never runs twice.
 */
export function cryptoRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new RangeError('max must be a positive integer');
  if (max === 1) return 0;
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

/**
 * Three distinct cards, one per slot, each with its own orientation.
 *
 * Partial Fisher–Yates over the deck indices: swapping the chosen index to the
 * front of the remaining range is what guarantees "distinct" without a
 * retry-until-unique loop (which would leak timing and, worse, tempt a bug).
 */
export function drawReading(random: RandomSource = cryptoRandomInt): DrawnCard[] {
  const indices = Array.from({ length: DECK_SIZE }, (_, i) => i);
  const drawn: DrawnCard[] = [];
  for (let position = 0; position < CARDS_PER_READING; position += 1) {
    const remaining = DECK_SIZE - position;
    const pick = position + random(remaining);
    const chosen = indices[pick];
    indices[pick] = indices[position];
    indices[position] = chosen;
    drawn.push({
      slot: SLOT_ORDER[position],
      cardId: DECK[chosen].id,
      reversed: random(2) === 1,
    });
  }
  return drawn;
}

export function serializeDraw(cards: DrawnCard[]): string {
  return JSON.stringify(cards);
}

/**
 * Reads a committed draw back out of D1 and re-checks it.
 *
 * Storage is trusted, but a row written by an older build (or a hand-edited
 * one) must not be able to produce a reading with a duplicate or unknown card.
 * Anything that fails the shape check is treated as no draw at all.
 */
export function parseDraw(raw: string | null): DrawnCard[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== CARDS_PER_READING) return null;

  const seen = new Set<string>();
  const cards: DrawnCard[] = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const entry = parsed[index] as Partial<DrawnCard> | null;
    if (!entry || typeof entry !== 'object') return null;
    const cardId = String(entry.cardId ?? '');
    if (!cardById(cardId) || seen.has(cardId)) return null;
    seen.add(cardId);
    if (entry.slot !== SLOT_ORDER[index]) return null;
    cards.push({ slot: SLOT_ORDER[index], cardId, reversed: entry.reversed === true });
  }
  return cards;
}
