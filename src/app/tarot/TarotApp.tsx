/**
 * The reading, end to end.
 *
 * Six states, in one direction:
 *   ask → greeting → shuffle → reveal ×3 → reading → outro
 *
 * There is no welcome screen: the first thing on the first paint is the question
 * box. Everything else follows from what the visitor does next.
 *
 * The component holds UI state only. Which cards were drawn, which way up, and
 * whether a card may be turned over yet are all the Worker's answers — this file
 * asks and renders. Reloading mid-round restores from the server, not from
 * anything cached here, so a refresh cannot conjure a different spread.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DECK_SIZE, type Locale } from '../../shared/tarot/deck';
import { copyFor, normalizeLocale } from '../../shared/tarot/i18n';
import {
  FOLLOW_UP_MAX_CHARS,
  QUESTION_MAX_CHARS,
  SLOT_ORDER,
  type DrawnCardView,
  type FollowUpMessage,
  type ReadingView,
} from '../../shared/tarot/types';
import CardSlot from './Card';
import Fan from './Fan';
import Reading, { Prose } from './Reading';
import ShareBox from './ShareBox';
import {
  ApiError,
  errorText,
  fetchReader,
  fetchReading,
  startReading,
  stopShuffle,
  streamDiviner,
} from './api';

type Phase = 'ask' | 'greeting' | 'shuffle' | 'reveal' | 'reading' | 'outro';

const READING_KEY = 'taro.readingId';
const LOCALE_KEY = 'taro.locale';

/** How long the deck shuffles before it is spread out. Long enough to feel like
 *  a ritual, short enough that nobody reaches for the tab bar. */
const SHUFFLE_MS = 2600;

/** The character count stays out of sight until the limit is actually near. */
const COUNTER_FROM = 60;

const phaseFor = (reading: ReadingView): Phase => {
  switch (reading.status) {
    case 'interpreted':
      return 'outro';
    case 'revealed':
    case 'drawn':
      return 'reveal';
    default:
      return 'greeting';
  }
};

const readingPath = (id: string, suffix: string): string =>
  `/api/tarot/readings/${encodeURIComponent(id)}${suffix}`;

/** Adds a freshly turned card without ever duplicating one. */
const withCard = (reading: ReadingView, card: DrawnCardView): ReadingView =>
  reading.cards.some((existing) => existing.index === card.index)
    ? reading
    : {
        ...reading,
        cards: [...reading.cards, card].sort((a, b) => a.index - b.index),
        pending: Math.max(0, reading.pending - 1),
      };

export default function TarotApp() {
  const [locale, setLocale] = useState<Locale>(() =>
    normalizeLocale(localStorage.getItem(LOCALE_KEY) ?? navigator.language),
  );
  const copy = useMemo(() => copyFor(locale), [locale]);

  const [phase, setPhase] = useState<Phase>('ask');
  const [reading, setReading] = useState<ReadingView | null>(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Live text of the turn currently being spoken; null when nobody is speaking. */
  const [spoken, setSpoken] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpMessage[]>([]);
  const [followDraft, setFollowDraft] = useState('');
  const [followOpen, setFollowOpen] = useState(false);
  const [followLive, setFollowLive] = useState<string | null>(null);
  const [suggestsNew, setSuggestsNew] = useState(false);
  const [demoReader, setDemoReader] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  /** Which places in the spread the visitor has already touched. Presentation
   *  only — a place is not a card, and the Worker has already chosen the cards. */
  const [picked, setPicked] = useState<number[]>([]);

  /** Rounds are linked only so the reader knows this visitor was just here. */
  const previousReadingId = useRef<string | null>(null);
  /** Guards the greeting stream against a double start (StrictMode, fast clicks). */
  const greetedFor = useRef<string | null>(null);
  /** Same guard for the draw, which now fires from a timer rather than a click. */
  const drawnFor = useRef<string | null>(null);
  const questionBox = useRef<HTMLTextAreaElement | null>(null);

  /* ───────── boot: language, reader, and any round still in progress ───────── */

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : 'en';
    // The tagline and nothing else: there is no name on this site, so there is
    // none in the tab either.
    document.title = copy.tagline;
    localStorage.setItem(LOCALE_KEY, locale);
  }, [locale, copy]);

  useEffect(() => {
    void fetchReader()
      .then((info) => setDemoReader(info.demo))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(READING_KEY);
    if (!stored) return;
    let cancelled = false;
    void fetchReading(stored)
      .then(({ reading: found }) => {
        if (cancelled) return;
        setReading(found);
        setFollowUps(found.followUps);
        setLocale(found.locale);
        setPhase(phaseFor(found));
        if (found.greeting) greetedFor.current = found.readingId;
        if (found.status !== 'greeting') drawnFor.current = found.readingId;
        // Which places were touched before the reload is not worth storing: a
        // place is not a card. Take that many off the spread and deal the rest.
        setPicked(Array.from({ length: found.cards.length }, (_, i) => i));
      })
      .catch(() => {
        // Gone, expired, or someone else's: start clean rather than explain.
        localStorage.removeItem(READING_KEY);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ───────── one diviner turn ───────── */

  const runTurn = useCallback(
    async (
      path: string,
      body: unknown,
      onEvent: (event: import('../../shared/tarot/types').DivinerEvent) => void,
    ): Promise<void> => {
      setError('');
      try {
        await streamDiviner(path, body, onEvent);
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'rate_limited') {
          setError(copy.errors.rateLimited);
        } else if (caught instanceof ApiError && caught.status === 404) {
          setError(copy.errors.lost);
        } else {
          setError(errorText(caught, copy.errors.generic));
        }
      }
    },
    [copy],
  );

  /* ───────── state 2: the reader catches the question ───────── */

  const runGreeting = useCallback(
    async (id: string) => {
      if (greetedFor.current === id) return;
      greetedFor.current = id;
      setSpoken('');
      await runTurn(readingPath(id, '/greeting'), {}, (event) => {
        if (event.type === 'delta') setSpoken(event.text);
        else if (event.type === 'greeting') {
          setSpoken(null);
          setReading((current) =>
            current && current.readingId === id ? { ...current, greeting: event.text } : current,
          );
        } else if (event.type === 'error') setError(event.message);
      });
      setSpoken(null);
    },
    [runTurn],
  );

  // Resuming into a round whose greeting never finished: pick it back up.
  useEffect(() => {
    if (phase === 'greeting' && reading && !reading.greeting && !busy) {
      void runGreeting(reading.readingId);
    }
  }, [phase, reading, busy, runGreeting]);

  /* ───────── state 1: the question ───────── */

  const submitQuestion = useCallback(async () => {
    if (busy) return;
    const text = question.trim();
    if (!text) {
      setError(copy.ask.empty);
      questionBox.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { reading: created } = await startReading({
        question: text,
        locale,
        previousReadingId: previousReadingId.current,
      });
      localStorage.setItem(READING_KEY, created.readingId);
      setReading(created);
      setFollowUps([]);
      setSuggestsNew(false);
      setPhase('greeting');
      void runGreeting(created.readingId);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'rate_limited') {
        setError(copy.errors.rateLimited);
      } else if (caught instanceof ApiError && caught.code === 'question_too_long') {
        setError(copy.errors.tooLong);
      } else {
        setError(errorText(caught, copy.errors.generic));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, question, locale, copy, runGreeting]);

  /** The field is a line, not a box: it opens one row high and grows downward
   *  with the question instead of reserving room for one nobody has written. */
  const fitQuestionBox = useCallback(() => {
    const box = questionBox.current;
    if (!box) return;
    box.style.height = 'auto';
    // jsdom reports 0 here; leaving the height alone is the honest fallback.
    if (box.scrollHeight) box.style.height = `${box.scrollHeight}px`;
  }, []);

  useEffect(fitQuestionBox, [question, phase, fitQuestionBox]);

  const onQuestionKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on a physical keyboard. On a touch keyboard Enter is how people
    // write a second line, so it is left alone there.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    event.preventDefault();
    void submitQuestion();
  };

  /* ───────── state 3: the shuffle, which runs itself ───────── */

  /**
   * The deck shuffles for a few seconds and then the Worker commits three cards —
   * no button, because there is nothing here for the visitor to decide. The
   * choosing happens next, over the spread, and it is the moment they choose
   * rather than the card: all three are already sealed on the server by the time
   * a single back is on screen.
   */
  useEffect(() => {
    if (phase !== 'shuffle' || !reading) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (drawnFor.current === reading.readingId) return;
      drawnFor.current = reading.readingId;
      setBusy(true);
      void stopShuffle(reading.readingId)
        .then(({ reading: drawn }) => {
          if (cancelled) return;
          setReading(drawn);
          setPicked([]);
          setPhase('reveal');
        })
        .catch((caught: unknown) => {
          if (cancelled) return;
          // Re-arm, so the retry below is a real second attempt.
          drawnFor.current = null;
          setError(errorText(caught, copy.errors.generic));
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, SHUFFLE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phase, reading, copy]);

  /** After a failed draw the deck is still on screen; this deals it again. */
  const retryDraw = useCallback(() => {
    setError('');
    setPhase('greeting');
    window.setTimeout(() => setPhase('shuffle'), 0);
  }, []);

  /* ───────── state 4: picking them out of the spread ───────── */

  const pick = useCallback(async (position: number) => {
    if (!reading || busy) return;
    const index = reading.cards.length;
    if (index >= SLOT_ORDER.length) return;
    setPicked((current) => (current.includes(position) ? current : [...current, position]));
    setBusy(true);
    setSpoken('');
    await runTurn(readingPath(reading.readingId, '/reveal'), { index }, (event) => {
      if (event.type === 'card') {
        setReading((current) => (current ? withCard(current, event.card) : current));
      } else if (event.type === 'delta') {
        setSpoken(event.text);
      } else if (event.type === 'hint') {
        setSpoken(null);
        setReading((current) =>
          current
            ? {
                ...current,
                cards: current.cards.map((card) =>
                  card.index === event.index ? { ...card, hint: event.text } : card,
                ),
              }
            : current,
        );
      } else if (event.type === 'error') setError(event.message);
    });
    setSpoken(null);
    setBusy(false);
  }, [reading, busy, runTurn]);

  /* ───────── state 5: the reading ───────── */

  const listen = useCallback(async () => {
    if (!reading || busy) return;
    setPhase('reading');
    setBusy(true);
    await runTurn(readingPath(reading.readingId, '/interpretation'), {}, (event) => {
      // `delta` is deliberately ignored here: the raw turn is a tagged draft, and
      // watching a machine assemble one is not what anyone came for.
      if (event.type === 'interpretation') {
        setReading((current) =>
          current ? { ...current, interpretation: event.interpretation, status: 'interpreted' } : current,
        );
        setPhase('outro');
      } else if (event.type === 'error') setError(event.message);
    });
    setBusy(false);
  }, [reading, busy, runTurn]);

  // Two lines, alternating, so the wait has a voice instead of a spinner label.
  useEffect(() => {
    if (phase !== 'reading') return;
    const timer = window.setInterval(
      () => setLoadingLine((line) => (line + 1) % copy.result.loading.length),
      9000,
    );
    return () => window.clearInterval(timer);
  }, [phase, copy]);

  /* ───────── state 6: keep going, or start again ───────── */

  const askFollowUp = useCallback(async () => {
    if (!reading || busy) return;
    const text = followDraft.trim();
    if (!text) return;
    setBusy(true);
    setFollowDraft('');
    setSuggestsNew(false);
    setFollowUps((current) => [
      ...current,
      { id: -Date.now(), role: 'user', content: text, createdAt: new Date().toISOString() },
    ]);
    setFollowLive('');
    await runTurn(readingPath(reading.readingId, '/follow-ups'), { message: text }, (event) => {
      if (event.type === 'delta') setFollowLive(event.text);
      else if (event.type === 'followup') {
        setFollowLive(null);
        setFollowUps((current) => [
          ...current,
          { id: Date.now(), role: 'diviner', content: event.text, createdAt: new Date().toISOString() },
        ]);
        setSuggestsNew(event.suggestsNewReading);
      } else if (event.type === 'error') setError(event.message);
    });
    setFollowLive(null);
    setBusy(false);
  }, [reading, busy, followDraft, runTurn]);

  const newRound = useCallback(() => {
    previousReadingId.current = reading?.readingId ?? null;
    localStorage.removeItem(READING_KEY);
    greetedFor.current = null;
    drawnFor.current = null;
    setReading(null);
    setPicked([]);
    setFollowUps([]);
    setFollowDraft('');
    setFollowOpen(false);
    setSuggestsNew(false);
    setQuestion('');
    setSpoken(null);
    setError('');
    setPhase('ask');
    window.setTimeout(() => questionBox.current?.focus(), 0);
  }, [reading]);

  /* ───────── render ───────── */

  const remaining = QUESTION_MAX_CHARS - question.length;
  const revealedCount = reading?.cards.length ?? 0;
  const allRevealed = revealedCount === SLOT_ORDER.length;
  const nextSlot = SLOT_ORDER[revealedCount];

  return (
    <div className={phase === 'ask' ? 'taro is-opening' : 'taro'}>
      {/* The only chrome on the page. There is no mark and no name: the first
          thing anyone sees should be the question, not a logo. */}
      <header className="taro-top">
        <div className="taro-lang" role="group" aria-label={copy.languageLabel}>
          <button
            type="button"
            className={locale === 'zh' ? 'is-on' : ''}
            aria-pressed={locale === 'zh'}
            onClick={() => setLocale('zh')}
          >
            中文
          </button>
          <button
            type="button"
            className={locale === 'en' ? 'is-on' : ''}
            aria-pressed={locale === 'en'}
            onClick={() => setLocale('en')}
          >
            EN
          </button>
        </div>
      </header>

      <main className="taro-stage">
        {error && (
          <p className="taro-error" role="alert">
            {error}
          </p>
        )}

        {/* ── 1 · the question ── */}
        {phase === 'ask' && (
          <section className="taro-ask">
            <h1 className="taro-ask-title">{copy.ask.title}</h1>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitQuestion();
              }}
            >
              <div className="taro-field">
                <textarea
                  ref={questionBox}
                  className="taro-ask-input"
                  value={question}
                  autoFocus
                  rows={1}
                  maxLength={QUESTION_MAX_CHARS}
                  enterKeyHint="send"
                  placeholder={copy.ask.placeholder}
                  aria-label={copy.ask.title}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={onQuestionKeyDown}
                />
              </div>
              {/* Nothing under the line until there is something to say about
                  it, and the row keeps its height either way so the line never
                  moves while you type. */}
              <div className="taro-ask-meta">
                {question.length > 0 && (
                  <span className="taro-keyhint" aria-hidden>
                    {copy.ask.hintKeys}
                  </span>
                )}
                {remaining <= COUNTER_FROM && <span aria-hidden>{copy.ask.remaining(remaining)}</span>}
              </div>
              <button
                type="submit"
                className="taro-primary"
                disabled={busy || question.trim().length === 0}
              >
                {busy ? copy.ask.submitting : copy.ask.submit}
              </button>
            </form>
          </section>
        )}

        {/* ── 2 · the reader catches it ── */}
        {phase === 'greeting' && reading && (
          <section className="taro-greeting">
            <p className="taro-asked">{reading.question}</p>
            {spoken !== null || !reading.greeting ? (
              <p className="taro-speaking">
                {spoken || copy.greeting.thinking}
                <span className="taro-caret" aria-hidden />
              </p>
            ) : (
              <Prose text={reading.greeting} className="taro-voice" />
            )}
            <button
              type="button"
              className="taro-primary"
              disabled={!reading.greeting}
              onClick={() => setPhase('shuffle')}
            >
              {copy.greeting.start}
            </button>
          </section>
        )}

        {/* ── 3 · the shuffle, which needs nothing from the visitor ── */}
        {phase === 'shuffle' && reading && (
          <section className="taro-shuffle">
            <div className="taro-deck" aria-hidden>
              <span className="taro-deck-card" />
              <span className="taro-deck-card" />
              <span className="taro-deck-card" />
              <span className="taro-deck-card" />
              <span className="taro-deck-card" />
            </div>
            <p className="taro-sr-only" role="status">
              {copy.shuffle.live}
            </p>
            <p className="taro-instruction">
              {busy ? copy.shuffle.settling : copy.shuffle.instruction}
            </p>
            {error && (
              <button type="button" className="taro-primary" onClick={retryDraw}>
                {copy.errors.retry}
              </button>
            )}
          </section>
        )}

        {/* ── 4 · turning them over ── */}
        {(phase === 'reveal' || phase === 'reading' || phase === 'outro') && reading && (
          <section className="taro-spread">
            <div className="taro-cards">
              {SLOT_ORDER.map((slot, index) => (
                <CardSlot
                  key={slot}
                  slot={slot}
                  locale={locale}
                  card={reading.cards.find((card) => card.index === index) ?? null}
                  settling={phase === 'reveal' && index === revealedCount && !busy}
                />
              ))}
            </div>

            {phase === 'reveal' && (
              <div className="taro-turn">
                {reading.cards.map((card) =>
                  card.hint ? (
                    <p className="taro-hint" key={card.index}>
                      <span className="taro-hint-slot">{copy.slots[card.slot].title}</span>
                      {card.hint}
                    </p>
                  ) : null,
                )}
                {spoken !== null && (
                  <p className="taro-hint taro-speaking">
                    {spoken}
                    <span className="taro-caret" aria-hidden />
                  </p>
                )}

                {!allRevealed && nextSlot && (
                  <>
                    <p className="taro-instruction">{copy.slots[nextSlot].prompt}</p>
                    <p className="taro-pick-lead">
                      {copy.shuffle.pick}{' '}
                      <span className="taro-pick-count">
                        {copy.shuffle.remaining(SLOT_ORDER.length - revealedCount)}
                      </span>
                    </p>
                    <Fan
                      locale={locale}
                      count={DECK_SIZE}
                      taken={picked}
                      disabled={busy}
                      onPick={(position) => void pick(position)}
                    />
                  </>
                )}

                {allRevealed && (
                  <>
                    <p className="taro-instruction">{copy.reveal.allRevealed}</p>
                    <button
                      type="button"
                      className="taro-primary"
                      disabled={busy}
                      onClick={() => void listen()}
                    >
                      {copy.reveal.listen}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── 5 · the reading ── */}
        {phase === 'reading' && (
          <section className="taro-waiting" aria-live="polite">
            <p className="taro-instruction">{copy.result.loading[loadingLine]}</p>
            <div className="taro-waiting-bar" aria-hidden />
          </section>
        )}

        {/* ── 6 · what comes after ── */}
        {phase === 'outro' && reading?.interpretation && (
          <>
            <Reading
              interpretation={reading.interpretation}
              cards={reading.cards}
              locale={locale}
            />

            {followUps.length > 0 || followLive !== null ? (
              <section className="taro-thread">
                {followUps.map((entry) => (
                  <div
                    key={entry.id}
                    className={entry.role === 'user' ? 'taro-said is-mine' : 'taro-said'}
                  >
                    <Prose text={entry.content} />
                  </div>
                ))}
                {followLive !== null && (
                  <div className="taro-said">
                    <p className="taro-speaking">
                      {followLive}
                      <span className="taro-caret" aria-hidden />
                    </p>
                  </div>
                )}
                {suggestsNew && (
                  <p className="taro-suggest">
                    {copy.outro.suggestsNewReading}{' '}
                    <button type="button" className="taro-link" onClick={newRound}>
                      {copy.outro.newReading}
                    </button>
                  </p>
                )}
              </section>
            ) : null}

            <section className="taro-outro">
              <ShareBox reading={reading} locale={locale} />

              <button type="button" className="taro-secondary" onClick={newRound}>
                {copy.outro.newReading}
              </button>

              {followOpen ? (
                <form
                  className="taro-follow"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void askFollowUp();
                  }}
                >
                  <label htmlFor="taro-follow-input">{copy.outro.continueTitle}</label>
                  <textarea
                    id="taro-follow-input"
                    className="taro-follow-input"
                    value={followDraft}
                    rows={3}
                    autoFocus
                    maxLength={FOLLOW_UP_MAX_CHARS}
                    enterKeyHint="send"
                    placeholder={copy.outro.continuePlaceholder}
                    onChange={(event) => setFollowDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
                      if (window.matchMedia('(pointer: coarse)').matches) return;
                      event.preventDefault();
                      void askFollowUp();
                    }}
                  />
                  <button
                    type="submit"
                    className="taro-secondary"
                    disabled={busy || followDraft.trim().length === 0}
                  >
                    {copy.outro.continueSubmit}
                  </button>
                </form>
              ) : (
                <button type="button" className="taro-link" onClick={() => setFollowOpen(true)}>
                  {copy.outro.continue}
                </button>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="taro-foot">
        {(reading?.demo ?? demoReader) && <p className="taro-demo">{copy.demoNotice}</p>}
        <p className="taro-signature">{copy.signature}</p>
      </footer>
    </div>
  );
}
