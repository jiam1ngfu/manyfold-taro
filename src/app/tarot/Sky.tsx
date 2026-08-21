/**
 * The stars over the reading room.
 *
 * A sky on a screen has three tiers or it has none: a few stars you could point
 * at, a scatter you can resolve, and a wash you cannot. Miss the tiers and every
 * speck is the same speck, which is a texture — and a texture cannot be watched
 * twinkling, because no part of it is large enough to be worth watching. The
 * wash is the tiled dust in tarot.css. The two tiers above it are here.
 *
 * Where they go: a grid of cells, one star to a cell, thrown off its centre by
 * up to half a cell, and roughly a quarter of the cells left empty. Pure
 * randomness clumps and leaves holes; a bare grid reads as a grid; a jittered
 * grid with voids in it is the thing that looks scattered and is not. The grid
 * covers the top half of the field only, because that is where the mask in
 * tarot.css still has light to give.
 *
 * How bright: one draw per star, raised to a power so most come out near the
 * floor and a handful near the ceiling, and everything else — size, colour,
 * period, depth of flicker — follows from that one number, so no star is
 * assembled out of unrelated dice:
 *
 *   · bigger when brighter — a brighter point source blooms wider;
 *   · whiter when brighter — dim things go blue, and blue here is the deck's
 *     own ink, so the field never leaves the two inks the cards are printed in;
 *   · slower when brighter — big things are steadier.
 *
 * What does *not* vary is the depth of the cycle: every star in this tier goes
 * all the way out and all the way back, so its swing is simply its brightness.
 * An earlier version set the swing as a fraction of the light — deeper for the
 * faint stars, which is what the atmosphere really does to a point source — and
 * it was wrong here for the reason most physical arguments are wrong in a
 * picture: a fraction is not what an eye is handed. An eye is handed absolute
 * alpha, and the brightest star swung 0.238 of it while the median swung 0.124,
 * which is a sky that changes without ever being seen to change. Taking the
 * floor to zero is what buys the whole of the light back as movement.
 *
 * One star in each quarter of the field is a lantern: bigger, near-white, with a
 * real glow, and a cycle that is mostly quiet — one shallow breath, then a slow
 * wide bloom, then down. Four is the whole budget. A background that only
 * breathes is exhausted in ten seconds; what makes a sky worth glancing up at
 * again is that something in it occasionally happens, and that you cannot
 * predict which corner.
 *
 * The field is drawn from a fixed seed, so it is the same sky on every visit and
 * every reload. A sky that reshuffles itself is a screensaver; a sky that
 * doesn't is a place.
 */

import { memo, type CSSProperties } from 'react';

/** Thirty-five cells, an eighth of them empty, so thirty-odd stars.
 *
 *  The count is the design and not a performance note. Fifty-six specks over one
 *  window is a little under a hundred and sixty pixels apart at a desktop width,
 *  which is close enough that the field reads as one grey wash and no single dot
 *  is ever the thing you are looking at. Cutting it and spending the room on
 *  size is the whole trade: a star has to be an object before it can be seen to
 *  do anything.
 *
 *  What is written here is the *roll*, though, and the roll is no longer the
 *  field. Since every star in this tier now goes out for part of its cycle, only
 *  about two thirds of them are alight at any moment — so a roll of twenty-five,
 *  which is what this was when the stars merely dimmed, quietly became a sky of
 *  fifteen. Thirty-five cells at an eighth empty puts the *lit* count back to
 *  about twenty, which is the density that was actually wanted. Count the ones
 *  you can see, not the ones you made. */
const COLS = 7;
const ROWS = 5;
const VOID = 0.12;

/** The band the grid is laid into, in percent of the field box.
 *
 *  The box is inset -6vh on every side, so it stands 112vh tall and starts 6vh
 *  above the window: field 7% is 2vh down the screen, field 50% is 50vh down,
 *  and the mask over the whole thing is full to 28vh and gone by 72vh.
 *
 *  So TOP is not padding. The grid used to start at zero, which put half of the
 *  first row above the top edge of the window — a quarter of the field drawn
 *  where nobody could see it, and, once, a lantern cut in half by the sill. The
 *  field still overhangs, because the wheel needs somewhere to turn from and a
 *  sky that stops dead at the window is a ceiling; what overhangs now is empty
 *  margin rather than stars.
 *
 *  BOTTOM stops the grid where the mask still gives about half its light, so no
 *  star is ever placed into the part of the fade where it would arrive as a
 *  crumb. Below that line the wash carries on alone, which is what makes the
 *  bottom of the window read as distance rather than as an edge. */
const TOP = 7;
const BOTTOM = 50;

/** Any fixed number does; this one spells something. */
const SEED = 0x5eed;

interface Star {
  /** Where, in percent of the field box. */
  x: number;
  y: number;
  /** The core, in px — not the element, which tarot.css draws six times this
   *  wide so the light has somewhere to fall off into. Fractional on purpose: a
   *  core rendered off the pixel grid is antialiased into a soft point, which is
   *  what a star looks like. */
  size: number;
  /** Its own brightness, and the ceiling of its cycle. */
  lit: number;
  /** The floor of its cycle. Zero for a star, which is the point — it goes out.
   *  A third of the light for a lantern, which is the only thing here that
   *  doesn't. */
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
      /* Every cell draws its full hand before any of it is used, empty cells
         included. Deciding first and drawing after would work too, but this way
         the sequence a star gets does not depend on how many of its neighbours
         happened to survive, so a change to VOID moves the voids without
         rebuilding every star behind them. */
      const jitterX = rand() - 0.5;
      const jitterY = rand() - 0.5;
      const empty = rand() < VOID;
      const t = rand() ** 1.7;
      const spin = rand();
      if (empty) continue;

      /* 0.46 is a floor, not a taste: the brightest speck in the printed wash
         behind this field comes out at 0.17 alpha, and a live star that cannot
         beat the dead paint it hangs in front of is worse than no star, because
         it puts the eye on the one layer that will never move. */
      const lit = 0.46 + 0.42 * t;

      stars.push({
        x: ((col + 0.5 + jitterX * 0.94) / COLS) * 100,
        y: TOP + ((row + 0.5 + jitterY * 0.94) / ROWS) * (BOTTOM - TOP),
        size: 2.5 + 2.1 * t,
        lit,
        /* Zero, and not a dim floor. A star in this tier goes out — that is the
           event the cycle is built around, and a floor of any height turns the
           event back into a value that merely varies. The whole of a star's
           light is therefore also the whole of its swing, which is why the
           period below can be twice what it was without the sky going back to
           sleep: there is more than twice as much light being moved. */
        lo: 0,
        white: 30 + 60 * t,
        /* Six to twelve and a half seconds, against three to seven before. The
           cycle now has a stretch of darkness and a long climb out of it to pay
           for, and rushing either would read as a blink. It stays inside the
           rate an eye reads as movement because the amplitude went up by more
           than the period did. */
        dur: 6 + 3 * t + 3.5 * spin,
        delay: 0,
        lantern: false,
      });
    }
  }

  for (const star of stars) star.delay = -rand() * star.dur;

  /* The brightest star in each quarter of the field. Picking the brightest
     rather than a random one keeps a lantern from landing on a speck, and
     picking one per quarter keeps all four from landing in the same corner —
     the point of a rare event is that it can come from anywhere. A quarter can
     in principle come up empty once the voids are cut, and an empty quarter is
     simply a quarter without a lantern. */
  for (const quarter of [0, 1, 2, 3]) {
    const here = stars.filter(
      (star) => (star.x > 50 ? 1 : 0) + (star.y > (TOP + BOTTOM) / 2 ? 2 : 0) === quarter,
    );
    if (here.length === 0) continue;
    const brightest = here.reduce((best, star) => (star.lit > best.lit ? star : best));
    brightest.lantern = true;
    /* Taken clear of the tier below rather than nudged past its top: a lantern
       is a different kind of thing from a star, and a hierarchy the eye has to
       measure to notice is not a hierarchy. */
    brightest.size += 1.8;
    brightest.lit = 0.95;
    brightest.white = 96;
    /* The one floor left in the sky. Everything else here goes out; a field in
       which everything goes out has nothing to hang on, and the coming and going
       stops reading as coming and going because there is no fixed thing to read
       it against. So a lantern breathes deeper than any star and still never
       leaves. */
    brightest.lo = 0.95 * 0.32;
    brightest.dur = 30 + rand() * 18;
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
   the sky has no business being diffed a node at a time while the reader is
   talking. */
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
