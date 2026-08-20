/**
 * @vitest-environment jsdom
 *
 * The spread the visitor picks from.
 *
 * The load-bearing assertion here is the negative one: nothing in this markup
 * names a card. If a card id or a card name could reach the spread, the browser
 * would be in a position to decide something the Worker has already decided, and
 * the whole trust story of the draw would be a comment rather than a fact.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Fan from '../../src/app/tarot/Fan';
import { DECK, DECK_SIZE } from '../../src/shared/tarot/deck';

afterEach(cleanup);

const backs = (): HTMLButtonElement[] => screen.getAllByRole('button') as HTMLButtonElement[];
const noop = () => undefined;

describe('the spread', () => {
  it('lays out the whole deck', () => {
    render(<Fan locale="zh" count={DECK_SIZE} taken={[]} disabled={false} onPick={noop} />);
    expect(backs()).toHaveLength(78);
  });

  it('names no card anywhere in its markup', () => {
    const { container } = render(
      <Fan locale="zh" count={DECK_SIZE} taken={[]} disabled={false} onPick={noop} />,
    );
    const html = container.innerHTML;
    for (const card of DECK) {
      expect(html, card.id).not.toContain(card.id);
      expect(html, card.id).not.toContain(card.name.zh);
      expect(html, card.id).not.toContain(card.name.en);
    }
  });

  it('takes picked places out, and leaves the rest numbered as they were', () => {
    render(<Fan locale="zh" count={10} taken={[0, 4]} disabled={false} onPick={noop} />);
    const labels = backs().map((card) => card.getAttribute('aria-label'));

    expect(labels).toHaveLength(8);
    expect(labels).not.toContain('第 1 张，背面朝上');
    expect(labels).not.toContain('第 5 张，背面朝上');
    // The gap does not renumber the deck — place 2 is still place 2.
    expect(labels[0]).toBe('第 2 张，背面朝上');
    expect(labels.at(-1)).toBe('第 10 张，背面朝上');
  });

  it('reports the place that was touched', () => {
    const onPick = vi.fn();
    render(<Fan locale="zh" count={10} taken={[]} disabled={false} onPick={onPick} />);

    fireEvent.click(backs()[6]);
    expect(onPick).toHaveBeenCalledWith(6);
  });

  it('reports the original place even after earlier ones are gone', () => {
    const onPick = vi.fn();
    render(<Fan locale="zh" count={10} taken={[0, 1]} disabled={false} onPick={onPick} />);

    fireEvent.click(backs()[0]);
    expect(onPick).toHaveBeenCalledWith(2);
  });

  it('ignores touches while the reader speaks, without dropping the visitor out of the spread', () => {
    const onPick = vi.fn();
    render(<Fan locale="zh" count={10} taken={[]} disabled onPick={onPick} />);
    const card = backs()[3];

    fireEvent.click(card);
    expect(onPick).not.toHaveBeenCalled();
    expect(card.getAttribute('aria-disabled')).toBe('true');
    // aria-disabled rather than disabled: a disabled button leaves the tab order
    // mid-turn and takes the visitor's focus with it.
    expect(card.disabled).toBe(false);
  });

  it('is a single tab stop, walked with the arrow keys', () => {
    render(<Fan locale="zh" count={10} taken={[]} disabled={false} onPick={noop} />);
    const tabbable = () => backs().filter((card) => card.getAttribute('tabindex') === '0');

    expect(tabbable()).toHaveLength(1);
    expect(tabbable()[0]).toBe(backs()[0]);

    fireEvent.keyDown(backs()[0], { key: 'ArrowRight' });
    expect(tabbable()).toHaveLength(1);
    expect(tabbable()[0]).toBe(backs()[1]);

    fireEvent.keyDown(backs()[1], { key: 'End' });
    expect(tabbable()[0]).toBe(backs()[9]);

    fireEvent.keyDown(backs()[9], { key: 'Home' });
    expect(tabbable()[0]).toBe(backs()[0]);
  });

  it('does not walk off either end', () => {
    render(<Fan locale="zh" count={3} taken={[]} disabled={false} onPick={noop} />);
    const tabbable = () => backs().filter((card) => card.getAttribute('tabindex') === '0')[0];

    fireEvent.keyDown(backs()[0], { key: 'ArrowLeft' });
    expect(tabbable()).toBe(backs()[0]);

    fireEvent.keyDown(backs()[0], { key: 'End' });
    fireEvent.keyDown(backs()[2], { key: 'ArrowRight' });
    expect(tabbable()).toBe(backs()[2]);
  });

  it('labels the places in the visitor’s language', () => {
    render(<Fan locale="en" count={3} taken={[]} disabled={false} onPick={noop} />);
    expect(backs()[0].getAttribute('aria-label')).toBe('Card 1, face down');
  });
});
