import { vi } from "vitest";

// A tiny stand-in for the Supabase client. Every query builder method is chainable (select, eq, update, ...), and
// awaiting the chain (or calling maybeSingle/single) resolves to the next scripted result for that table.
//
//   const db = fakeClient({ orders: [{ data: order }, { data: { id: "o1" } }] });
//   db.from("orders")...            -> first result, then the second, then the last one again
//   db.rpc("spend_wallet", args)    -> rpcs.spend_wallet (default { data: null, error: null })
//   db.calls                        -> every call made, in order, so tests can assert what was written

export type Result = { data?: unknown; error?: unknown; count?: number | null };
export type Call = { table: string; ops: [method: string, args: unknown[]][] };

const settle = (r: Result | undefined) => ({ data: null, error: null, count: null, ...r });

function chain(result: Result | undefined, ops: Call["ops"]) {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(settle(result)).then(resolve, reject);
        return (...args: unknown[]) => {
          ops.push([String(prop), args]);
          return proxy;
        };
      },
    },
  );
  return proxy as Record<string, (...a: unknown[]) => unknown> & PromiseLike<ReturnType<typeof settle>>;
}

export function fakeClient(tables: Record<string, Result[]> = {}, rpcs: Record<string, Result> = {}) {
  const used: Record<string, number> = {};
  const calls: Call[] = [];
  const client = {
    calls,
    from: vi.fn((table: string) => {
      const queue = tables[table] ?? [];
      const i = Math.min(used[table] ?? 0, Math.max(queue.length - 1, 0));
      used[table] = (used[table] ?? 0) + 1;
      const call: Call = { table, ops: [] };
      calls.push(call);
      return chain(queue[i], call.ops);
    }),
    rpc: vi.fn((name: string, args?: unknown) => {
      const call: Call = { table: `rpc:${name}`, ops: [["args", [args]]] };
      calls.push(call);
      return chain(rpcs[name], call.ops);
    }),
    /** Calls made on one table, e.g. db.on("wallet_transactions") */
    on: (table: string) => calls.filter((c) => c.table === table),
    /** True if any call on `table` used `method` (e.g. "insert", "update", "delete"). */
    did: (table: string, method: string) => calls.some((c) => c.table === table && c.ops.some(([m]) => m === method)),
    /** The arguments passed to `method` on `table`, e.g. the row that was inserted. */
    argsOf: (table: string, method: string) => calls.filter((c) => c.table === table).flatMap((c) => c.ops.filter(([m]) => m === method).map(([, a]) => a)),
  };
  return client;
}

/** A client for `createClient()` from "@/lib/supabase/server": the session plus whatever tables the route reads. */
export function fakeAuthClient(user: { id: string; email?: string } | null, tables: Record<string, Result[]> = {}, rpcs: Record<string, Result> = {}, authError: { status?: number } | null = null) {
  const base = fakeClient(tables, rpcs);
  return Object.assign(base, {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: authError })),
      getClaims: vi.fn(async () => ({ data: user ? { claims: { sub: user.id, email: user.email } } : null, error: null })),
    },
  });
}
