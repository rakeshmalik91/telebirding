import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['scripts/**/*.js'],
      exclude: [
        'lib/**',
        'utils/**',
        'tests/**',
        'node_modules/**',
        'dist/**'
      ]
    }
  },
});
