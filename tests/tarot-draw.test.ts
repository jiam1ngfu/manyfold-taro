/**
 * The draw is the one thing in this product that has to be beyond argument:
 * three distinct cards, an orientation nobody chose, and no way for a client or
 * an agent to influence either. These tests hold that line.
 */

import { describe, expect, it } from 'vitest';
import { DECK_SIZE, cardById } from '../src/shared/tarot/deck';
import { CARDS_PER_READING, SLOT_ORDER } from '../src/shared/tarot/types';
import { cryptoRandomInt, drawReading, parseDraw, serializeDraw } from '../src/worker/tarot/draw';

describe('cryptoRandomInt', () => {
  it('stays inside the range', () => {
    for (let i = 0; i < 2000; i += 1) {
      const value = cryptoRandomInt(78);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(78);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('always returns 0 for a range of one', () => {
    expect(cryptoRandomInt(1)).toBe(0);
  });

  it('rejects a range that is not a positive integer', () => {
    expect(() => cryptoRandomInt(0)).toThrow(RangeError);
    expect(() => cryptoRandomInt(-3)).toThrow(RangeError);
    expect(() => cryptoRandomInt(2.5)).toThrow(RangeError);
  });

  it('covers the whole range without a badly skewed tail', () => {
    const buckets = new Array(6).fill(0);
    const rounds = 60_000;
    for (let i = 0; i < rounds; i += 1) buckets[cryptoRandomInt(6)] += 1;
    for (const count of buckets) {
      // Rejection sampling is unbiased; ±12% is far outside sampling noise here
      // but far inside anything a modulo bias would produce.
      expect(count).toBeGreaterThan((rounds / 6) * 0.88);
      expect(count).toBeLessThan((rounds / 6) * 1.12);
    }
  });
});

describe('drawReading', () => {
  it('always deals three distinct real cards, in slot order', () => {
    for (let round = 0; round < 500; round += 1) {
      const cards = drawReading();
      expect(cards).toHaveLength(CARDS_PER_READING);
      expect(cards.map((card) => card.slot)).toEqual([...SLOT_ORDER]);
      expect(new Set(cards.map((card) => card.cardId)).size).toBe(CARDS_PER_READING);
      for (const card of cards) expect(cardById(card.cardId)).not.toBeNull();
    }
  });

  it('takes both cards and orientations from the random source only', () => {
    // A source that always answers 0 picks the first remaining card, upright.
    const zeros = drawReading(() => 0);
    expect(zeros.every((card) => card.reversed)).toBe(false);
    expect(zeros.map((card) => card.cardId)).toEqual(['major-00', 'major-01', 'major-02']);

    // ...and one that always answers max-1 takes the last card and reverses it.
    const highs = drawReading((max) => max - 1);
    expect(highs.every((card) => card.reversed)).toBe(true);
    expect(new Set(highs.map((card) => card.cardId)).size).toBe(CARDS_PER_READING);
  });

  it('reverses roughly half the cards over many rounds', () => {
    let reversed = 0;
    const rounds = 4000;
    for (let i = 0; i < rounds; i += 1) {
      for (const card of drawReading()) if (card.reversed) reversed += 1;
    }
    const ratio = reversed / (rounds * CARDS_PER_READING);
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.55);
  });

  it('reaches the whole deck, not a favoured corner of it', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i += 1) for (const card of drawReading()) seen.add(card.cardId);
    expect(seen.size).toBe(DECK_SIZE);
  });
});

describe('serializeDraw / parseDraw', () => {
  it('round-trips a draw', () => {
    const cards = drawReading();
    expect(parseDraw(serializeDraw(cards))).toEqual(cards);
  });

  it('refuses anything that is not three distinct known cards in slot order', () => {
    expect(parseDraw(null)).toBeNull();
    expect(parseDraw('')).toBeNull();
    expect(parseDraw('not json')).toBeNull();
    expect(parseDraw('{}')).toBeNull();
    expect(parseDraw(JSON.stringify([{ slot: 'situation', cardId: 'major-00', reversed: false }]))).toBeNull();
    expect(
      parseDraw(
        JSON.stringify([
          { slot: 'situation', cardId: 'major-00', reversed: false },
          { slot: 'hidden', cardId: 'major-00', reversed: true },
          { slot: 'guidance', cardId: 'major-02', reversed: false },
        ]),
      ),
      'duplicate cards',
    ).toBeNull();
    expect(
      parseDraw(
        JSON.stringify([
          { slot: 'situation', cardId: 'made-up', reversed: false },
          { slot: 'hidden', cardId: 'major-01', reversed: true },
          { slot: 'guidance', cardId: 'major-02', reversed: false },
        ]),
      ),
      'unknown card id',
    ).toBeNull();
    expect(
      parseDraw(
        JSON.stringify([
          { slot: 'hidden', cardId: 'major-00', reversed: false },
          { slot: 'situation', cardId: 'major-01', reversed: true },
          { slot: 'guidance', cardId: 'major-02', reversed: false },
        ]),
      ),
      'slots out of order',
    ).toBeNull();
  });
});
