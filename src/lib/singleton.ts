/**
 * Process-wide singletons.
 *
 * Next.js bundles route handlers, server components and metadata routes into
 * different module graphs, so a plain module-level `const cache = new Map()`
 * can end up instantiated more than once in the same Node process. Everything
 * that must be unique per process (GitHub cache, rate limiter, queue, SQLite
 * handle) is stored on globalThis through this helper.
 */
const STORE_KEY = "__githubstars_singletons__";

type Store = Record<string, unknown>;

export function singleton<T>(name: string, create: () => T): T {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  const store = (g[STORE_KEY] ??= {});
  if (!(name in store)) store[name] = create();
  return store[name] as T;
}
