import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
    hookTimeout: 5000,
    // jsdom environment for React component tests when needed
    environment: 'node',
    reporters: ['verbose']
  }
});
