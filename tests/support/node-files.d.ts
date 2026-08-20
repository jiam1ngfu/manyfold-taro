/**
 * Just enough of `node:fs`, `node:url` and `node:crypto` for the art test.
 *
 * Same bargain as node-sqlite.d.ts: the Worker builds against
 * @cloudflare/workers-types and must not grow Node typings, because
 * `src/worker/` genuinely cannot use Node built-ins. Only the test harness runs
 * on Node, so the handful of functions it touches are declared here instead of
 * pulling @types/node into the project that typechecks the Worker.
 *
 * Everything is typed in terms of Uint8Array rather than Buffer — it is all the
 * test needs, and it keeps a Node-only global out of the worker's type space.
 */

interface ImportMeta {
  readonly url: string;
}

declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function readdirSync(path: string): string[];
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'node:crypto' {
  interface Hash {
    update(data: Uint8Array): Hash;
    digest(encoding: 'hex'): string;
  }

  export function createHash(algorithm: string): Hash;
}
