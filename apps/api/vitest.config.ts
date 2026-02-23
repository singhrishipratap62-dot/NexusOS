import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Discover all test files under test/
    include: ['test/**/*.test.ts'],
    // 10 s per test is enough for in-memory DB operations; smoke suite gets extra
    testTimeout: 15000,
    hookTimeout: 10000,
    // Single thread: in-memory Prisma mock is not safe to run concurrently
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    // Re-run env vars are picked up from process.env; no need for dotenv here
    env: {
      NODE_ENV: 'test',
      SINGLE_TENANT_ID: 'tenant_day1',
      AUTH_STATIC_TOKEN: 'day1-mvp-token',
      ENABLE_LLM_RATIONALE: 'false',
      BLENDED_HOURLY_RATE: '95',
      IMPLEMENTATION_COST_DEFAULT: '18000',
      ANNUAL_PLATFORM_COST: '4800'
    },
    reporters: ['verbose']
  }
});
