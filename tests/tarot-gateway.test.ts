/**
 * The meter that stands in for the admin password on the public routes, plus
 * the session cookie those routes use to tell one visitor from another.
 */

import { describe, expect, it } from 'vitest';
import { HttpError, type Env } from '../src/worker/types';
import {
  FOLLOW_UPS_PER_READING,
  HOUR,
  RULES,
  bucketKey,
  consume,
  enforce,
  secondsUntilWindowEnd,
  windowIndex,
} from '../src/worker/tarot/ratelimit';
import {
  isSecureRequest,
  newSessionId,
  readSessionCookie,
  sessionCookieHeader,
} from '../src/worker/tarot/session';

/** A D1 stand-in for the one upsert the limiter runs. */
function fakeEnv(): Env & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (!sql.includes('tarot_rate')) return null;
              const bucket = String(args[0]);
              const next = (counts.get(bucket) ?? 0) + 1;
              counts.set(bucket, next);
              return { count: next } as T;
            },
            async run() {
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { DB: db, counts } as unknown as Env & { counts: Map<string, number> };
}

describe('windows', () => {
  it('buckets by scope, subject and window', () => {
    expect(bucketKey('turns', 'abc', 0, HOUR)).toBe('turns:abc:0');
    expect(bucketKey('turns', 'abc', HOUR + 1, HOUR)).toBe('turns:abc:1');
    expect(windowIndex(HOUR * 3 + 5, HOUR)).toBe(3);
  });

  it('reports a positive wait to the next window', () => {
    expect(secondsUntilWindowEnd(0, HOUR)).toBe(3600);
    expect(secondsUntilWindowEnd(HOUR - 1000, HOUR)).toBe(1);
    expect(secondsUntilWindowEnd(HOUR - 1, HOUR)).toBe(1);
  });
});

describe('consume', () => {
  it('allows up to the limit and refuses past it', async () => {
    const env = fakeEnv();
    const rule = { limit: 3, windowMs: HOUR };
    const results = [];
    for (let i = 0; i < 5; i += 1) results.push(await consume(env, 'turns', 'sess', rule, 1000));
    expect(results.map((outcome) => outcome.allowed)).toEqual([true, true, true, false, false]);
  });

  it('starts fresh in the next window', async () => {
    const env = fakeEnv();
    const rule = { limit: 1, windowMs: HOUR };
    expect((await consume(env, 'turns', 'sess', rule, 1000)).allowed).toBe(true);
    expect((await consume(env, 'turns', 'sess', rule, 2000)).allowed).toBe(false);
    expect((await consume(env, 'turns', 'sess', rule, HOUR + 2000)).allowed).toBe(true);
  });

  it('keeps subjects and scopes apart', async () => {
    const env = fakeEnv();
    const rule = { limit: 1, windowMs: HOUR };
    expect((await consume(env, 'turns', 'a', rule, 0)).allowed).toBe(true);
    expect((await consume(env, 'turns', 'b', rule, 0)).allowed).toBe(true);
    expect((await consume(env, 'shares', 'a', rule, 0)).allowed).toBe(true);
    expect((await consume(env, 'turns', 'a', rule, 0)).allowed).toBe(false);
  });
});

describe('enforce', () => {
  const full = async (env: Env, times: number, options: Parameters<typeof enforce>[1]) => {
    for (let i = 0; i < times; i += 1) await enforce(env, options);
  };

  it('throws 429 once a session is out of budget', async () => {
    const env = fakeEnv();
    const options = { sessionId: 's', ip: null, scope: 'readings', rule: { limit: 2, windowMs: HOUR } };
    await full(env, 2, options);
    await expect(enforce(env, options)).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
    await expect(enforce(env, options)).rejects.toBeInstanceOf(HttpError);
  });

  it('also stops one IP running many sessions', async () => {
    const env = fakeEnv();
    const ipRule = { limit: 3, windowMs: HOUR };
    const rule = { limit: 100, windowMs: HOUR };
    for (let i = 0; i < 3; i += 1) {
      await enforce(env, { sessionId: `s${i}`, ip: '1.2.3.4', scope: 'readings', rule, ipRule });
    }
    await expect(
      enforce(env, { sessionId: 's-new', ip: '1.2.3.4', scope: 'readings', rule, ipRule }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('skips the IP counter when there is no IP to count', async () => {
    const env = fakeEnv();
    await enforce(env, {
      sessionId: 's',
      ip: null,
      scope: 'readings',
      rule: RULES.readings,
      ipRule: RULES.readingsPerIp,
    });
    // One bucket, and it is the session's — no `readings-ip:` counter was touched.
    const keys = [...env.counts.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^readings:s:\d+$/);
  });
});

describe('the budgets themselves', () => {
  it('leave room for a real visitor and not for a bot', () => {
    // One complete reading costs 1 greeting + 3 hints + 1 interpretation.
    const turnsPerReading = 5;
    expect(RULES.turns.limit).toBeGreaterThanOrEqual(RULES.readings.limit * turnsPerReading);
    expect(RULES.readingsPerIp.limit).toBeGreaterThan(RULES.readings.limit);
    expect(RULES.turnsPerIp.limit).toBeGreaterThan(RULES.turns.limit);
    expect(FOLLOW_UPS_PER_READING).toBeGreaterThan(0);
    for (const rule of Object.values(RULES)) {
      expect(rule.windowMs).toBeGreaterThan(0);
      expect(rule.limit).toBeGreaterThan(0);
    }
  });
});

describe('the session cookie', () => {
  it('mints unguessable ids', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const id = newSessionId();
      expect(id).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(500);
  });

  it('reads its own cookie back out of a header', () => {
    const id = newSessionId();
    expect(readSessionCookie(`taro_sid=${id}`)).toBe(id);
    expect(readSessionCookie(`other=1; taro_sid=${id}; more=2`)).toBe(id);
    expect(readSessionCookie(`  taro_sid=${id}  `)).toBe(id);
  });

  it('refuses anything that is not a session id', () => {
    expect(readSessionCookie(undefined)).toBeNull();
    expect(readSessionCookie(null)).toBeNull();
    expect(readSessionCookie('')).toBeNull();
    expect(readSessionCookie('taro_sid=')).toBeNull();
    expect(readSessionCookie('taro_sid=short')).toBeNull();
    expect(readSessionCookie("taro_sid=' OR 1=1 --")).toBeNull();
    expect(readSessionCookie(`taro_sid=${'x'.repeat(200)}`)).toBeNull();
    expect(readSessionCookie('other=value')).toBeNull();
  });

  it('is http-only, same-site and secure on https', () => {
    const id = newSessionId();
    const secure = sessionCookieHeader(id, true);
    expect(secure).toContain(`taro_sid=${id}`);
    expect(secure).toContain('HttpOnly');
    expect(secure).toContain('SameSite=Lax');
    expect(secure).toContain('Path=/');
    expect(secure).toContain('Secure');
    expect(sessionCookieHeader(id, false)).not.toContain('Secure');
  });

  it('knows an https request from a local one', () => {
    expect(isSecureRequest('https://example.com/api/tarot/readings')).toBe(true);
    expect(isSecureRequest('http://localhost:5173/api/tarot/readings')).toBe(false);
  });
});
