import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Unit tests for the backend: route handlers and lib code, with Supabase, Paystack, R2 and email mocked.
// No network, no database, no real secrets. See tests/README.md.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
  resolve: {
    alias: {
      "@": root("./src"),
      // `server-only` throws when imported outside a React Server environment; tests run in plain Node.
      "server-only": root("./tests/stubs/server-only.ts"),
    },
  },
});
