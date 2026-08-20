/**
 * The deck and its pictures, kept in step.
 *
 * `cardArt` derives a URL from a card id, which is the cheapest possible index —
 * and the easiest to break silently, because a missing or misnamed file is not a
 * type error, not a build error, and not visible in any other test. It is a card
 * that turns over blank in production, or worse, one that turns over as another
 * card.
 *
 * So: every id resolves to a file, every file answers to an id, and no two cards
 * share a picture. The last one is the check that catches a copy-paste.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARD_BACK_ART, cardArt, DECK, DECK_SIZE } from '../src/shared/tarot/deck';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));

/** The file a URL like `/cards/major-00.webp` is actually served from. */
const served = (url: string): string => `${PUBLIC}${url.replace(/^\//, '')}`;

const read = (url: string): Uint8Array => readFileSync(served(url));

/** The four-byte marks a decoder looks at first, compared without a Buffer. */
const marks = (bytes: Uint8Array, offset: number, text: string): boolean =>
  [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));

describe('the card art', () => {
  it('has a file for every card in the deck, and one back', () => {
    for (const card of DECK) {
      expect(() => read(cardArt(card.id)), card.id).not.toThrow();
    }
    expect(() => read(CARD_BACK_ART)).not.toThrow();
  });

  it('has no file that is not a card', () => {
    const onDisk = readdirSync(`${PUBLIC}cards`).sort();
    const expected = [...DECK.map((card) => `${card.id}.webp`), 'back.webp'].sort();
    expect(onDisk).toEqual(expected);
    expect(onDisk).toHaveLength(DECK_SIZE + 1);
  });

  it('serves real images, not empty files', () => {
    for (const url of [...DECK.map((card) => cardArt(card.id)), CARD_BACK_ART]) {
      const bytes = read(url);
      // A RIFF container holding a WEBP form, and not a truncated one.
      expect(marks(bytes, 0, 'RIFF'), url).toBe(true);
      expect(marks(bytes, 8, 'WEBP'), url).toBe(true);
      expect(bytes.byteLength, url).toBeGreaterThan(1024);
    }
  });

  it('gives every card its own picture', () => {
    const seen = new Map<string, string>();
    for (const card of DECK) {
      const digest = createHash('sha256').update(read(cardArt(card.id))).digest('hex');
      const twin = seen.get(digest);
      expect(twin, `${card.id} has the same picture as ${twin}`).toBeUndefined();
      seen.set(digest, card.id);
    }
    expect(seen.size).toBe(DECK_SIZE);
  });
});
