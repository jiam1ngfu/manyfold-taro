/**
 * The stars over the reading room.
 *
 * The field behind this one — the tiled dust in tarot.css — is a printed sky:
 * every dot in it is fixed, and the whole sheet can only ever brighten and dim
 * as one. That is fine for dust and wrong for stars. A sky where every star
 * agrees on when to be bright is not a sky, it is a dimmer switch; the eye
 * learns the beat in one cycle and stops looking. So the stars anyone can
 * actually see are cut loose from each other and given here, one element each,
 * with their own period, their own phase, and their own depth of flicker.
 *
 * Where they go: a grid of cells, one star to a cell, thrown off its centre by
 * up to half a cell. Pure randomness clumps and leaves holes; a bare grid reads
 * as a grid; a jittered grid is the thing that looks scattered and is not. The
 * grid covers the top 70% of the field only, which is where the mask in
 * tarot.css still has light to give — a star placed under it would be DOM spent
 * on nothing.
 *
 * How bright: the draw is squared and a bit more (`^2.1`), so most stars come
 * out faint and a handful come out bright, which is the distribution a real
 * field has and the reason it reads as depth rather than as confetti. Size,
 * colour, period and flicker all follow from that one number, so no star is
 * assembled out of unrelated dice:
 *
 *   · bigger when brighter — a brighter point source blooms wider;
 *   · whiter when brighter — dim things go blue, and blue here is the deck's
 *     own ink, so the field never leaves the two inks the cards are printed in;
 *   · slower when brighter — big things are steadier;
 *   · and shallower when brighter, which is the load-bearing one. A star's
 *     swing is set *against* its brightness: the dimmest lose half their light
 *     at the bottom of a cycle, the brightest a quarter. That is what the
 *     atmosphere actually does to a point source — a larger apparent source
 *     averages the distortion out — and, more to the point here, it is what
 *     stops a field of equal-amplitude dots reading as a string of fairy
 *     lights.
 *
 * One star in each quarter of the field is a lantern: it holds still for most
 * of a minute and then blooms once, wide and slow, and goes back down. Four is
 * the whole budget. A background that only breathes is exhausted in ten
 * seconds — what makes a sky worth glancing up at again is that something in it
 * occasionally happens, and that you cannot predict which corner.
 *
 * The field is drawn from a fixed seed, so it is the same sky on every visit
 * and every reload. A sky that reshuffles itself is a screensaver; a sky that
 * doesn't is a place.
 */

import { memo, type CSSProperties } from 'react';

/** One star to a cell. 56 of them: dense enough to be a field at a phone's
 *  width, few enough that the whole sky costs sixty nodes. */
const COLS = 8;
const ROWS = 7;

/** How far down the field the grid reaches, in percent. 70 lands exactly where
 *  the mask in tarot.css finishes fading out, so the last row is the first row
 *  you cannot see. */
const DEPTH = 70;

/** Any fixed number does; this one spells something. */
const SEED = 0x5eed;

interface Star {
  /** Where, in percent of the field box. */
  x: number;
  y: number;
  /** Across, in px. Fractional on purpose — a dot rendered off the pixel grid
   *  is antialiased into a soft point, which is what a star looks like. */
  size: number;
  /** Its own brightness, and the ceiling of its flicker. */
  lit: number;
  /** The floor of its flicker. */
  lo: number;
  /** How much of the mix is white rather than the deck's blue, in percent. */
  white: number;
  /** Its own period and its own place in it — the negative delay is what puts
   *  the field out of step with itself from the first frame, rather than
   *  letting it start as one wave and drift apart over a minute. */
  dur: number;
  delay: number;
  lantern: boolean;
}

/** mulberry32. Small, fast, and — the only property that matters here — the
 *  same sequence in every browser, which is what makes the sky reproducible. */
const source = (seed: number): (() => number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const field = (): Star[] => {
  const rand = source(SEED);
  const stars: Star[] = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const jitterX = rand() - 0.5;
      const jitterY = rand() - 0.5;
      const lit = 0.17 + 0.74 * rand() ** 2.1;
      /* Deep at the faint end, shallow at the bright one. */
      const swing = 0.62 - 0.4 * lit;
      stars.push({
        x: ((col + 0.5 + jitterX * 0.98) / COLS) * 100,
        y: ((row + 0.5 + jitterY * 0.98) / ROWS) * DEPTH,
        size: 1.7 + 2 * lit,
        lit,
        lo: lit * (1 - swing),
        white: 34 + 58 * lit,
        dur: 5.2 + 8.4 * lit + 4.5 * rand(),
        delay: 0,
        lantern: false,
      });
    }
  }

  for (const star of stars) star.delay = -rand() * star.dur;

  /* The brightest star in each quarter of the field. Picking the brightest
     rather than a random one keeps a lantern from landing on a speck, and
     picking one per quarter keeps all four from landing in the same corner —
     the point of a rare event is that it can come from anywhere. */
  for (const quarter of [0, 1, 2, 3]) {
    const here = stars.filter(
      (star) => (star.x > 50 ? 1 : 0) + (star.y > DEPTH / 2 ? 2 : 0) === quarter,
    );
    const brightest = here.reduce((best, star) => (star.lit > best.lit ? star : best));
    brightest.lantern = true;
    brightest.size += 0.5;
    brightest.lo = brightest.lit * 0.6;
    brightest.dur = 37 + rand() * 19;
    brightest.delay = -rand() * brightest.dur;
  }

  return stars;
};

const STARS = field();

const varsFor = (star: Star): CSSProperties =>
  ({
    '--taro-x': `${star.x.toFixed(2)}%`,
    '--taro-y': `${star.y.toFixed(2)}%`,
    '--taro-size': `${star.size.toFixed(2)}px`,
    '--taro-lit': star.lit.toFixed(3),
    '--taro-lo': star.lo.toFixed(3),
    '--taro-white': `${star.white.toFixed(1)}%`,
    '--taro-dur': `${star.dur.toFixed(2)}s`,
    '--taro-delay': `${star.delay.toFixed(2)}s`,
  }) as CSSProperties;

/* Nothing here changes, ever — no props, no state, no clock. Memoised because
   the page it sits behind re-renders on every token of a streamed reading, and
   the sky has no business being diffed sixty nodes at a time while the reader
   is talking. */
function Sky() {
  return (
    <div className="taro-sky" aria-hidden>
      <div className="taro-sky-field">
        {STARS.map((star, index) => (
          <i
            className={star.lantern ? 'taro-star is-lantern' : 'taro-star'}
            key={index}
            style={varsFor(star)}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(Sky);
