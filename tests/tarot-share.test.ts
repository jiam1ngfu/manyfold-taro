/**
 * Sharing, and the one promise it makes: a link is a photograph, not a window.
 *
 * The D1 stand-in below is deliberately dumb — it stores the exact string the
 * store hands it and returns exactly that string back. That is the whole point:
 * if the snapshot were a reference to the live reading rather than a copy of it,
 * these tests would notice.
 */

import { describe, expect, it } from 'vitest';
import { copyFor } from '../src/shared/tarot/i18n';
import type { Interpretation } from '../src/shared/tarot/types';
import type { Env } from '../src/worker/types';
import type { DrawnCard } from '../src/worker/tarot/draw';
import type { ReadingRecord } from '../src/worker/tarot/flow';
import {
  buildShareSnapshot,
  createShare,
  loadShare,
  newShareToken,
  toReadingView,
} from '../src/worker/tarot/store';

const CARDS: DrawnCard[] = [
  { slot: 'situation', cardId: 'major-00', reversed: false },
  { slot: 'hidden', cardId: 'cups-03', reversed: true },
  { slot: 'guidance', cardId: 'swords-14', reversed: false },
];

const INTERPRETATION: Interpretation = {
  conclusion: '可以试。但不要今天就辞。',
  overview: '整体偏向行动。',
  perCard: [
    { slot: 'situation', text: '一' },
    { slot: 'hidden', text: '二' },
    { slot: 'guidance', text: '三' },
  ],
  connections: '连起来是一条线。',
  response: '回到你的问题。',
  actions: ['先谈一次', '写下条件'],
  reflection: '你在等什么？',
  closing: '牌收好了。',
};

const finished = (overrides: Partial<ReadingRecord> = {}): ReadingRecord => ({
  id: 'r1',
  sessionId: 's1',
  question: '我要不要换工作？',
  locale: 'zh',
  status: 'interpreted',
  greeting: '我听见了。',
  cards: CARDS,
  revealed: 3,
  hints: ['a', 'b', 'c'],
  interpretation: INTERPRETATION,
  contextId: 'ctx',
  activeTaskId: null,
  agentId: 'agent-1',
  demo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

/** Just enough D1 for the share table. */
function fakeEnv(): Env {
  const rows = new Map<string, string>();
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.includes('INSERT INTO tarot_shares')) {
                rows.set(String(args[0]), String(args[2]));
              }
              return { success: true };
            },
            async first<T>() {
              if (sql.includes('FROM tarot_shares')) {
                const snapshot = rows.get(String(args[0]));
                return snapshot ? ({ snapshot } as T) : null;
              }
              return null;
            },
          };
        },
      };
    },
  };
  return { DB: db } as unknown as Env;
}

describe('buildShareSnapshot', () => {
  it('carries the three cards, their positions, orientations and one sentence', () => {
    const snapshot = buildShareSnapshot(finished(), {
      token: 't',
      includeQuestion: false,
      createdAt: '2026-02-02T00:00:00.000Z',
    });
    expect(snapshot.cards).toEqual([
      { slot: 'situation', cardId: 'major-00', reversed: false },
      { slot: 'hidden', cardId: 'cups-03', reversed: true },
      { slot: 'guidance', cardId: 'swords-14', reversed: false },
    ]);
    expect(snapshot.conclusion).toBe('可以试。');
    expect(snapshot.signature).toBe(copyFor('zh').signature);
    expect(snapshot.locale).toBe('zh');
  });

  it('leaves the question out unless the visitor asked for it', () => {
    const without = buildShareSnapshot(finished(), {
      token: 't',
      includeQuestion: false,
      createdAt: 'x',
    });
    expect(without.question).toBeNull();

    const with_ = buildShareSnapshot(finished(), {
      token: 't',
      includeQuestion: true,
      createdAt: 'x',
    });
    expect(with_.question).toBe('我要不要换工作？');
  });

  it('never carries the private parts of the reading', () => {
    const snapshot = buildShareSnapshot(finished(), {
      token: 't',
      includeQuestion: true,
      createdAt: 'x',
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('我听见了'); // greeting
    expect(serialized).not.toContain('先谈一次'); // actions
    expect(serialized).not.toContain('你在等什么'); // reflection
    expect(serialized).not.toContain('s1'); // session
    expect(serialized).not.toContain('agent-1');
    expect(serialized).not.toContain('ctx');
  });

  it('refuses to freeze a reading that is not finished', () => {
    expect(() =>
      buildShareSnapshot(finished({ interpretation: null }), {
        token: 't',
        includeQuestion: false,
        createdAt: 'x',
      }),
    ).toThrow();
    expect(() =>
      buildShareSnapshot(finished({ cards: null }), {
        token: 't',
        includeQuestion: false,
        createdAt: 'x',
      }),
    ).toThrow();
  });
});

describe('a share link is frozen', () => {
  it('does not change when the reading it came from changes', async () => {
    const env = fakeEnv();
    const reading = finished();
    const snapshot = await createShare(env, reading, true);

    // The round moves on: re-read, re-worded, re-drawn.
    reading.interpretation = { ...INTERPRETATION, conclusion: '不要去。' };
    reading.question = '完全不同的问题';
    reading.cards = [
      { slot: 'situation', cardId: 'major-13', reversed: true },
      { slot: 'hidden', cardId: 'major-16', reversed: true },
      { slot: 'guidance', cardId: 'major-10', reversed: false },
    ];

    const loaded = await loadShare(env, snapshot.token);
    expect(loaded).toEqual(snapshot);
    expect(loaded?.conclusion).toBe('可以试。');
    expect(loaded?.question).toBe('我要不要换工作？');
    expect(loaded?.cards[0].cardId).toBe('major-00');
  });

  it('gives every share its own record, so a new one never overwrites an old one', async () => {
    const env = fakeEnv();
    const reading = finished();
    const first = await createShare(env, reading, false);
    reading.interpretation = { ...INTERPRETATION, conclusion: '第二次的结论。' };
    const second = await createShare(env, reading, false);

    expect(second.token).not.toBe(first.token);
    expect((await loadShare(env, first.token))?.conclusion).toBe('可以试。');
    expect((await loadShare(env, second.token))?.conclusion).toBe('第二次的结论。');
  });

  it('returns null for a token that was never issued', async () => {
    expect(await loadShare(fakeEnv(), 'nope')).toBeNull();
  });
});

describe('share tokens', () => {
  it('are long, url-safe and not repeated', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const token = newShareToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
      tokens.add(token);
    }
    expect(tokens.size).toBe(500);
  });
});

describe('toReadingView', () => {
  it('shows only the cards already turned over', () => {
    const view = toReadingView(
      finished({ status: 'drawn', revealed: 1, hints: ['第一张的提示'], interpretation: null }),
      [],
    );
    expect(view.cards).toHaveLength(1);
    expect(view.cards[0].cardId).toBe('major-00');
    expect(view.cards[0].hint).toBe('第一张的提示');
    expect(view.pending).toBe(2);
    expect(JSON.stringify(view)).not.toContain('cups-03');
    expect(JSON.stringify(view)).not.toContain('swords-14');
  });

  it('shows nothing at all before the shuffle is stopped', () => {
    const view = toReadingView(
      finished({ status: 'greeting', cards: null, revealed: 0, hints: [], interpretation: null }),
      [],
    );
    expect(view.cards).toEqual([]);
    expect(view.pending).toBe(0);
  });

  it('shows all three once the reading is done', () => {
    const view = toReadingView(finished(), []);
    expect(view.cards).toHaveLength(3);
    expect(view.pending).toBe(0);
    expect(view.interpretation?.conclusion).toBe('可以试。但不要今天就辞。');
  });
});
