/**
 * The deck: first stacked and shuffling, then swept open for the visitor to pick from.
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
 *
 * The two stages are one component on purpose. A shuffling stack and a spread
 * deck are the same 78 cards a second apart, so they are the same 78 elements:
 * gathered, each card is translated to the middle of the space its own spread
 * will occupy and scaled up into a deck you can see; released, it travels back
 * to where it was always going to lie. That is the whole animation — no cards
 * appear, none are thrown away, and the space the deck occupies never changes
 * size, so the table stays put under it.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import type { Locale } from '../../shared/tarot/deck';
import { copyFor } from '../../shared/tarot/i18n';

export interface FanProps {
  locale: Locale;
  /** How many face-down cards to lay out. */
  count: number;
  /** Positions the visitor has set aside. They stay in the spread, lit. */
  chosen: readonly number[];
  /** True while the deck is still a stack, shuffling. */
  gathered?: boolean;
  /** True while the spread should stop taking touches. */
  disabled: boolean;
  /** Touching a back marks it; touching it again takes the mark off. */
  onPick: (position: number) => void;
}

/** A small, stable tilt per position, so the spread looks laid by hand rather than printed. */
const tiltFor = (position: number): number => (((position * 37) % 11) - 5) * 0.8;

/** The same, an order of magnitude smaller: a squared-up stack, but not a printed one. */
const stackTiltFor = (position: number): number => (((position * 29) % 7) - 3) * 0.5;

/** Long enough for the last card in the sweep to land. Matches `.taro-fan.is-spreading`. */
const SPREAD_MS = 1500;

const calmMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Fan({
  locale,
  count,
  chosen,
  gathered = false,
  disabled,
  onPick,
}: FanProps) {
  const copy = copyFor(locale);
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [stage, setStage] = useState<'stacked' | 'spreading' | 'open'>(
    gathered ? 'stacked' : 'open',
  );

  const chosenSet = new Set(chosen);
  const positions = Array.from({ length: count }, (_, position) => position);

  // The spread no longer shortens as cards are picked, but a shorter deck still
  // can, so the roving tab stop is kept inside it.
  useEffect(() => {
    setActive((current) => Math.max(0, Math.min(current, count - 1)));
  }, [count]);

  /* Where each card would have to travel to sit in the middle of the spread.
     Measured off the laid-out flow — `offsetLeft` ignores transforms, so this
     reads the same whether the deck is currently stacked or open, and the two
     stages never have to agree on a number by hand. */
  const measure = useCallback(() => {
    const el = root.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll<HTMLButtonElement>('.taro-fan-card'));
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    // Every read first. Interleaving reads and writes would lay the spread out
    // 78 times over.
    const home = cards.map(
      (card) =>
        [
          cx - (card.offsetLeft + card.offsetWidth / 2),
          cy - (card.offsetTop + card.offsetHeight / 2),
        ] as const,
    );
    cards.forEach((card, index) => {
      const [dx, dy] = home[index];
      card.style.setProperty('--taro-gx', `${Math.round(dx)}px`);
      card.style.setProperty('--taro-gy', `${Math.round(dy)}px`);
    });
  }, []);

  // Before the first paint, so the stack is never seen assembling itself.
  useLayoutEffect(() => {
    measure();
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // The spread rewraps with the window; the middle of it moves when it does.
    const watcher = new ResizeObserver(() => measure());
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [measure, count]);

  /* Leaving the stack is the one moment worth animating. Arriving in it is not:
     the deck is stacked from its first frame, so there is nothing to travel
     from. `wasGathered` keeps the two apart without making the timer a
     dependency of its own effect. */
  const wasGathered = useRef(gathered);
  useEffect(() => {
    const leaving = wasGathered.current && !gathered;
    wasGathered.current = gathered;

    if (gathered) {
      setStage('stacked');
      return;
    }
    if (!leaving || calmMotion()) {
      setStage('open');
      return;
    }
    setStage('spreading');
    const timer = window.setTimeout(() => setStage('open'), SPREAD_MS);
    return () => window.clearTimeout(timer);
  }, [gathered]);

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

  const stageClass =
    stage === 'stacked' ? ' is-gathered' : stage === 'spreading' ? ' is-spreading' : '';

  return (
    <div
      className={`taro-fan${disabled ? ' is-waiting' : ''}${stageClass}`}
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
            style={
              {
                '--taro-tilt': `${tiltFor(position)}deg`,
                '--taro-stack': `${stackTiltFor(position)}deg`,
                // Drives the stagger: the sweep opens left to right, the way a
                // hand opens a deck across a table.
                '--taro-i': position,
              } as CSSProperties
            }
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
            {/* The card's face carries the shuffle, so that the riffle and the
                sweep are two transforms on two elements rather than one fight.
                It carries the back art too, as a background rather than an
                image: all 78 backs are the same one picture, and the spread
                stays 78 elements instead of 156. */}
            <span className="taro-fan-face" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
