import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      MCP_ACCESS_TOKEN: 'test-access-token-012345678901234',
      SF_FIXTURE_MODE: 'mock',
    },
  },
});
