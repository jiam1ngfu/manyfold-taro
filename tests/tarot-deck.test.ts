import { describe, expect, it } from 'vitest';
import {
  DECK,
  DECK_SIZE,
  LOCALES,
  cardById,
  cardKeywords,
  cardLabel,
} from '../src/shared/tarot/deck';

describe('deck', () => {
  it('is a full 78-card deck: 22 majors and 56 minors', () => {
    expect(DECK_SIZE).toBe(78);
    expect(DECK.filter((card) => card.arcana === 'major')).toHaveLength(22);
    expect(DECK.filter((card) => card.arcana === 'minor')).toHaveLength(56);
  });

  it('has unique ids', () => {
    expect(new Set(DECK.map((card) => card.id)).size).toBe(DECK_SIZE);
  });

  it('is complete in both locales', () => {
    for (const card of DECK) {
      for (const locale of LOCALES) {
        expect(card.name[locale].trim(), `${card.id} name.${locale}`).not.toBe('');
        expect(card.upright[locale].trim(), `${card.id} upright.${locale}`).not.toBe('');
        expect(card.reversed[locale].trim(), `${card.id} reversed.${locale}`).not.toBe('');
      }
      expect(card.mark.trim(), `${card.id} mark`).not.toBe('');
    }
  });

  it('gives every minor a suit and every major a number in range', () => {
    for (const card of DECK) {
      if (card.arcana === 'minor') {
        expect(card.suit).toBeTruthy();
        expect(card.number).toBeGreaterThanOrEqual(1);
        expect(card.number).toBeLessThanOrEqual(14);
      } else {
        expect(card.suit).toBeUndefined();
        expect(card.number).toBeGreaterThanOrEqual(0);
        expect(card.number).toBeLessThanOrEqual(21);
      }
    }
  });

  it('looks cards up by id and rejects unknown ones', () => {
    expect(cardById('major-00')?.arcana).toBe('major');
    expect(cardById('cups-03')?.suit).toBe('cups');
    expect(cardById('nope')).toBeNull();
  });

  it('labels orientation in the visitor language', () => {
    const moon = cardById('major-18')!;
    expect(cardLabel(moon, false, 'zh')).toContain('正位');
    expect(cardLabel(moon, true, 'zh')).toContain('逆位');
    expect(cardLabel(moon, true, 'en')).toContain('reversed');
  });

  it('returns keywords for the drawn orientation, not both', () => {
    const card = cardById('swords-14')!;
    expect(cardKeywords(card, false, 'zh')).toBe(card.upright.zh);
    expect(cardKeywords(card, true, 'en')).toBe(card.reversed.en);
  });
});
