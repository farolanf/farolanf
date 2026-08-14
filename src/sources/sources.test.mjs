import { describe, expect, it } from 'vitest'

import { readClaude } from './claude.mjs'
import { codexAllIn, extractSessionUsage, readCodex } from './codex.mjs'
import { readOpencode } from './opencode.mjs'

describe('readClaude', () => {
  const cache = {
    firstSessionDate: '2026-06-21T00:20:51.002Z',
    lastComputedDate: '2026-08-10',
    totalSessions: 1385,
    totalMessages: 546131,
    modelUsage: {
      'claude-opus-5': { outputTokens: 70, inputTokens: 7, cacheReadInputTokens: 1400, cacheCreationInputTokens: 40 },
      'deepseek/deepseek-v4-flash-0731': { outputTokens: 1, inputTokens: 33, cacheReadInputTokens: 113, cacheCreationInputTokens: 2 },
    },
  }

  it('sums every model, including the non-Anthropic ones routed through the CLI', () => {
    const reading = readClaude(cache)

    expect(reading.output).toBe(71)
    expect(reading.input).toBe(40)
    expect(reading.cacheRead).toBe(1513)
    expect(reading.cacheCreate).toBe(42)
  })

  it('declares allIn as the sum, because its buckets are disjoint', () => {
    expect(readClaude(cache).allIn).toBe(71 + 40 + 1513 + 42)
  })

  it('reports the model COUNT and never a slug, which would name every provider tried', () => {
    const reading = readClaude(cache)

    expect(reading.models).toBe(2)
    expect(JSON.stringify(reading)).not.toContain('deepseek')
    expect(JSON.stringify(reading)).not.toContain('opus')
  })

  it('trims the first-session timestamp to a date', () => {
    expect(readClaude(cache).from).toBe('2026-06-21')
    expect(readClaude(cache).to).toBe('2026-08-10')
  })

  it('falls back to dailyActivity when the summary dates are missing', () => {
    const reading = readClaude({ modelUsage: {}, dailyActivity: [{ date: '2026-06-21' }, { date: '2026-08-10' }] })

    expect(reading.from).toBe('2026-06-21')
    expect(reading.to).toBe('2026-08-10')
  })

  it('survives an empty or absent file', () => {
    expect(readClaude({}).output).toBe(0)
    expect(readClaude(null).models).toBe(0)
  })

  it('treats a model entry missing a field as zero for that field, not as NaN', () => {
    const reading = readClaude({ modelUsage: { a: { outputTokens: 5 }, b: null } })

    expect(reading.output).toBe(5)
    expect(reading.allIn).toBe(5)
  })

  it('reports null dates rather than a malformed one when nothing is recorded', () => {
    expect(readClaude({ modelUsage: {}, firstSessionDate: 'short' }).from).toBe(null)
  })
})

describe('readCodex', () => {
  it('all-in is input + output, because cached is a SUBSET of input', () => {
    // Getting this wrong inflates codex by its whole cache-read volume (~869M as
    // of 2026-08-14) and no downstream number would look wrong.
    const totals = readCodex([
      { usage: { input_tokens: 900, output_tokens: 4, cached_input_tokens: 800 } },
    ])

    expect(totals.allIn).toBe(904)
    expect(totals.allIn).not.toBe(900 + 4 + 800)
    expect(codexAllIn({ input: 900, output: 4 })).toBe(904)
  })

  it('still reports cacheRead for display, as a subset', () => {
    const totals = readCodex([{ usage: { input_tokens: 900, output_tokens: 4, cached_input_tokens: 800 } }])

    expect(totals.cacheRead).toBe(800)
    expect(totals.cacheRead).toBeLessThanOrEqual(totals.input)
  })

  it('spans the earliest and latest session days', () => {
    const totals = readCodex([
      { usage: { output_tokens: 1 }, timestamp: '2026-08-13T02:47:09.728Z' },
      { usage: { output_tokens: 1 }, timestamp: '2026-04-25T03:37:49.161Z' },
    ])

    expect(totals.from).toBe('2026-04-25')
    expect(totals.to).toBe('2026-08-13')
    expect(totals.sessions).toBe(2)
  })

  it('skips sessions with no usage rather than counting them as zero', () => {
    expect(readCodex([{ usage: null }, { usage: { output_tokens: 5 } }]).sessions).toBe(1)
  })
})

describe('extractSessionUsage', () => {
  const line = (total) =>
    JSON.stringify({ timestamp: '2026-08-13T02:47:09.728Z', payload: { type: 'token_count', info: { total_token_usage: total } } })

  it('takes the LAST running total, since earlier events are prefixes of it', () => {
    // Summing them would multiply a session by its own turn count.
    const usage = extractSessionUsage([
      line({ input_tokens: 100, output_tokens: 10 }),
      line({ input_tokens: 250, output_tokens: 30 }),
      line({ input_tokens: 400, output_tokens: 55 }),
    ])

    expect(usage).toEqual({ input_tokens: 400, output_tokens: 55 })
  })

  it('ignores a truncated final line, which is normal in a live session', () => {
    const usage = extractSessionUsage([line({ input_tokens: 400, output_tokens: 55 }), '{"payload":{"token_count"'])

    expect(usage.input_tokens).toBe(400)
  })

  it('returns null for a session that never reported usage', () => {
    expect(extractSessionUsage(['{"type":"message"}', ''])).toBe(null)
  })

  it('ignores a token_count event whose usage is not an object', () => {
    const junk = JSON.stringify({ payload: { type: 'token_count', info: { total_token_usage: 'nope' } } })

    expect(extractSessionUsage([junk])).toBe(null)
  })

  it('reads an event that carries usage at the top level rather than under payload', () => {
    const flat = JSON.stringify({ type: 'token_count', total_token_usage: { output_tokens: 9 } })

    expect(extractSessionUsage([flat])).toEqual({ output_tokens: 9 })
  })
})

describe('readOpencode', () => {
  it('declares allIn as the sum of its four disjoint buckets', () => {
    const row = { sessions: 450, tokens_output: 3, tokens_input: 17, tokens_cache_read: 523, tokens_cache_write: 6, first: '2026-03-19', last: '2026-07-21' }
    const reading = readOpencode(row)

    expect(reading.allIn).toBe(3 + 17 + 523 + 6)
    expect(reading.sessions).toBe(450)
    expect(reading.from).toBe('2026-03-19')
  })

  it('survives a database with no sessions', () => {
    expect(readOpencode(null).allIn).toBe(0)
    expect(readOpencode({}).from).toBe(null)
  })
})
