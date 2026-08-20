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
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Locale } from '../../shared/tarot/deck';
import { copyFor } from '../../shared/tarot/i18n';

export interface FanProps {
  locale: Locale;
  /** How many face-down cards to lay out. */
  count: number;
  /** Positions already picked. They leave a gap in the spread. */
  taken: readonly number[];
  /** True while a turn is in flight — the spread stops taking picks. */
  disabled: boolean;
  onPick: (position: number) => void;
}

/** A small, stable tilt per position, so the spread looks laid by hand rather than printed. */
const tiltFor = (position: number): number => (((position * 37) % 11) - 5) * 0.8;

export default function Fan({ locale, count, taken, disabled, onPick }: FanProps) {
  const copy = copyFor(locale);
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const takenSet = new Set(taken);
  const positions: number[] = [];
  for (let position = 0; position < count; position += 1) {
    if (!takenSet.has(position)) positions.push(position);
  }

  // Picking shortens the spread, so the roving tab stop can fall off the end.
  useEffect(() => {
    setActive((current) => Math.max(0, Math.min(current, positions.length - 1)));
  }, [positions.length]);

  const focusAt = (index: number) => {
    root.current?.querySelectorAll<HTMLButtonElement>('.taro-fan-card')[index]?.focus();
  };

  /* One tab stop for the whole spread; arrows walk it. 78 tab stops would be a
     cruel way to reach the reading. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = positions.length - 1;
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
      {positions.map((position, index) => (
        <button
          key={position}
          type="button"
          className="taro-fan-card"
          style={{ '--taro-tilt': `${tiltFor(position)}deg` } as CSSProperties}
          tabIndex={index === active ? 0 : -1}
          // aria-disabled rather than disabled: a disabled button drops out of the
          // tab order mid-turn and takes the visitor's focus with it.
          aria-disabled={disabled || undefined}
          aria-label={copy.shuffle.cardLabel(position + 1)}
          onFocus={() => setActive(index)}
          onClick={() => {
            if (!disabled) onPick(position);
          }}
        >
          <span className="taro-fan-back" aria-hidden>
            ✳
          </span>
        </button>
      ))}
    </div>
  );
}
