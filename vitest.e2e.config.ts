import { defineConfig } from "vitest/config";

// Needs E2E_BASE_URL: the deployed Worker, or `npm run dev` for a local run.
export default defineConfig({ test: { include: ["e2e/**/*.test.ts"], testTimeout: 30_000 } });
