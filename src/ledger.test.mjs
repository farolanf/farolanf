import { describe, expect, it } from 'vitest'

import { emptyLedger, reconcile, totals } from './ledger.mjs'

const claudeLike = { output: 100, input: 10, cacheRead: 1000, cacheCreate: 5, allIn: 1115, sessions: 7, from: '2026-06-21', to: '2026-08-10' }

describe('reconcile — the monotonic rule', () => {
  it('a source reporting SMALLER numbers than the ledger holds cannot lower the total', () => {
    // The case this exists for: Claude Code prunes transcripts and could reset
    // its own stats file. A counter that trusted the latest reading would drop.
    const held = reconcile(emptyLedger(), { claude: claudeLike })
    const after = reconcile(held, { claude: { ...claudeLike, output: 1, allIn: 1, sessions: 0 } })

    expect(after.sources.claude.output).toBe(100)
    expect(after.sources.claude.allIn).toBe(1115)
    expect(after.sources.claude.sessions).toBe(7)
  })

  it('a source that disappears entirely is frozen at its last total, not dropped', () => {
    // The uninstalled-tool case. `observed` no longer mentions codex at all.
    const held = reconcile(emptyLedger(), { claude: claudeLike, codex: { output: 42, allIn: 99 } })
    const after = reconcile(held, { claude: claudeLike })

    expect(after.sources.codex.output).toBe(42)
    expect(totals(after).written).toBe(142)
  })

  it('keeps the EARLIEST start ever seen, so the "measured since" date never moves forward', () => {
    const held = reconcile(emptyLedger(), { codex: { ...claudeLike, from: '2026-03-19' } })
    const after = reconcile(held, { codex: { ...claudeLike, from: '2026-07-04' } })

    expect(after.sources.codex.from).toBe('2026-03-19')
  })

  it('does take a genuinely larger reading', () => {
    const held = reconcile(emptyLedger(), { claude: claudeLike })
    const after = reconcile(held, { claude: { ...claudeLike, output: 250, allIn: 2000 } })

    expect(after.sources.claude.output).toBe(250)
    expect(after.sources.claude.allIn).toBe(2000)
  })

  it('counts how many times each source has been seen', () => {
    const once = reconcile(emptyLedger(), { claude: claudeLike })
    const twice = reconcile(once, { claude: claudeLike })

    expect(twice.sources.claude.seen).toBe(2)
  })

  it('starts from an empty ledger without a previous file', () => {
    expect(reconcile(null, { claude: claudeLike }).sources.claude.output).toBe(100)
    expect(emptyLedger().sources).toEqual({})
  })
})

describe('totals', () => {
  it('sums each source\'s DECLARED allIn rather than re-deriving one formula', () => {
    // The regression this pins: codex's cacheRead is a subset of its input, so
    // a shared `output+input+cacheRead+cacheCreate` inflates it by the whole
    // cache-read volume and nothing downstream looks wrong.
    const ledger = reconcile(emptyLedger(), {
      claude: { output: 10, input: 5, cacheRead: 100, cacheCreate: 1, allIn: 116 },
      codex: { output: 3, input: 900, cacheRead: 800, cacheCreate: 0, allIn: 903 },
    })

    expect(totals(ledger).processed).toBe(116 + 903)
    expect(totals(ledger).processed).not.toBe(10 + 5 + 100 + 1 + 3 + 900 + 800 + 0)
  })

  it('reports written as output only, kept apart from processed', () => {
    const ledger = reconcile(emptyLedger(), { claude: claudeLike })
    const t = totals(ledger)

    expect(t.written).toBe(100)
    expect(t.processed).toBe(1115)
  })

  it('spans the earliest and latest dates across all sources', () => {
    const ledger = reconcile(emptyLedger(), {
      a: { ...claudeLike, from: '2026-06-21', to: '2026-08-10' },
      b: { ...claudeLike, from: '2026-03-19', to: '2026-07-21' },
    })
    const t = totals(ledger)

    expect(t.from).toBe('2026-03-19')
    expect(t.to).toBe('2026-08-10')
    expect(t.sourceCount).toBe(2)
  })

  it('handles an empty ledger without throwing', () => {
    expect(totals(emptyLedger()).processed).toBe(0)
    expect(totals(null).from).toBe(null)
  })
})
