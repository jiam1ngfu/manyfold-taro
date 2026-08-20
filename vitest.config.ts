// Standalone vitest config, deliberately NOT importing vite.config.ts: the tests
// are pure Node tests over src/worker modules, and the Cloudflare Vite plugin
// rejects the environment options vitest injects.
//
// The react plugin is here only so the component tests under tests/ui can be
// written as .tsx; those files opt into jsdom individually with a
// `@vitest-environment` pragma, and everything else still runs in node.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
