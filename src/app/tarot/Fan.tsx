/**
 * The spread deck: the whole pack laid out face down, for the visitor to pick from.
 *
 * A position in this spread carries no identity. The three cards were committed
 * by the Worker the moment the shuffle stopped, so touching the seventh back
 * rather than the fortieth changes nothing about what turns over — exactly as it
 * changes nothing at a physical table, where the deck is already shuffled and
 * every back is the same. What the visitor chooses here is the moment, not the
 * card. Nothing in this component knows a card id, and there is no prop through
 * which it could be told one.
 *
 * Picking marks a back and leaves it lying in the sweep. Nothing turns over here:
 * the whole spread stays face down until all three are set aside and the visitor
 * says so.
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Locale } from '../../shared/tarot/deck';
import { copyFor } from '../../shared/tarot/i18n';

export interface FanProps {
  locale: Locale;
  /** How many face-down cards to lay out. */
  count: number;
  /** Positions the visitor has set aside. They stay in the spread, lit. */
  chosen: readonly number[];
  /** True while the spread should stop taking touches. */
  disabled: boolean;
  /** Touching a back marks it; touching it again takes the mark off. */
  onPick: (position: number) => void;
}

/** A small, stable tilt per position, so the spread looks laid by hand rather than printed. */
const tiltFor = (position: number): number => (((position * 37) % 11) - 5) * 0.8;

export default function Fan({ locale, count, chosen, disabled, onPick }: FanProps) {
  const copy = copyFor(locale);
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const chosenSet = new Set(chosen);
  const positions = Array.from({ length: count }, (_, position) => position);

  // The spread no longer shortens as cards are picked, but a shorter deck still
  // can, so the roving tab stop is kept inside it.
  useEffect(() => {
    setActive((current) => Math.max(0, Math.min(current, count - 1)));
  }, [count]);

  const focusAt = (index: number) => {
    root.current?.querySelectorAll<HTMLButtonElement>('.taro-fan-card')[index]?.focus();
  };

  /* One tab stop for the whole spread; arrows walk it. 78 tab stops would be a
     cruel way to reach the reading. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = count - 1;
    let next = active;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(last, active + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(0, active - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    setActive(next);
    focusAt(next);
  };

  return (
    <div
      className={`taro-fan${disabled ? ' is-waiting' : ''}`}
      role="group"
      aria-label={copy.shuffle.spreadLabel}
      ref={root}
      onKeyDown={onKeyDown}
    >
      {positions.map((position) => {
        const isChosen = chosenSet.has(position);
        return (
          <button
            key={position}
            type="button"
            className={`taro-fan-card${isChosen ? ' is-chosen' : ''}`}
            style={{ '--taro-tilt': `${tiltFor(position)}deg` } as CSSProperties}
            tabIndex={position === active ? 0 : -1}
            // aria-disabled rather than disabled: a disabled button drops out of the
            // tab order mid-turn and takes the visitor's focus with it.
            aria-disabled={disabled || undefined}
            // A back that has been set aside is a pressed toggle, not a revealed
            // card — which is exactly what it looks like on screen.
            aria-pressed={isChosen}
            aria-label={copy.shuffle.cardLabel(position + 1)}
            onFocus={() => setActive(position)}
            onClick={() => {
              if (!disabled) onPick(position);
            }}
          >
            <span className="taro-fan-back" aria-hidden>
              ✳
            </span>
          </button>
        );
      })}
    </div>
  );
}
