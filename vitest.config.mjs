import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      /**
       * Load-bearing. Without it a file no test imports is ABSENT from the report,
       * so deleting the last test for a module RAISES the percentage.
       */
      all: true,
      include: ['src/**/*.mjs'],
      exclude: ['src/**/*.test.mjs'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      /**
       * A ratchet, not a target. Each figure sits a little under what the suite
       * actually reaches, so the gate fires on a regression rather than on noise.
       *
       * Everything under src/ is pure — no fs, no exec, no network — so there is
       * no layer here that a unit test could only assert a mock of, and nothing
       * is ungated. The IO adapter lives in scripts/ and is deliberately outside
       * the report: it reads this machine's home directory, and a unit test of it
       * would assert the fixture rather than the filesystem.
       */
      thresholds: {
        // Reaches 100/98.13/100/100 on 2026-08-14. The three uncovered branches
        // are unreachable-in-practice fallbacks (a source key absent from a
        // freshly-built ledger, a formatter's guard against a value the callers
        // never produce); each is a decision to leave, not an oversight.
        'src/**': { statements: 99, branches: 97, functions: 99, lines: 99 },
      },
    },
  },
})
