/**
 * Codex session rollouts.
 *
 * Source: ~/.codex/sessions/**\/rollout-*.jsonl, `token_count` events.
 *
 * Each event carries a running `total_token_usage` for that session, so the LAST
 * one in a file is that session's total and the earlier ones are prefixes of it.
 * Summing every event would multiply a session by its own turn count.
 *
 * Pure: takes lines (or already-extracted usages), returns totals.
 */

/**
 * The last `total_token_usage` in one session file, or null if it has none.
 * Takes an iterable of raw lines so the caller owns the file reading.
 */
export function extractSessionUsage(lines) {
  let latest = null

  for (const line of lines) {
    if (!line.includes('token_count')) continue

    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue // a truncated final line is normal in a live session
    }

    const payload = event?.payload ?? event
    const info = payload?.info ?? payload
    const usage = info?.total_token_usage
    if (usage && typeof usage === 'object') latest = usage
  }

  return latest
}

/**
 * @param {Array<{usage:object, timestamp?:string|null}>} sessions
 */
export function readCodex(sessions) {
  const totals = { output: 0, input: 0, cacheRead: 0, cacheCreate: 0 }
  let counted = 0
  let from = null
  let to = null

  for (const { usage, timestamp } of sessions) {
    if (!usage) continue
    counted += 1
    totals.output += usage.output_tokens ?? 0
    /**
     * `input_tokens` ALREADY INCLUDES `cached_input_tokens`. Cached is reported
     * as a subset for display and must never be added on top — doing so inflates
     * this source by roughly its whole cache-read volume, and nothing downstream
     * would notice.
     */
    totals.input += usage.input_tokens ?? 0
    totals.cacheRead += usage.cached_input_tokens ?? 0

    if (timestamp) {
      const day = timestamp.slice(0, 10)
      if (from === null || day < from) from = day
      if (to === null || day > to) to = day
    }
  }

  return { ...totals, allIn: codexAllIn(totals), sessions: counted, from, to }
}

/**
 * All-in for codex is input + output, because cacheRead is a SUBSET of input
 * rather than a bucket beside it. Summing the four fields the way the other two
 * sources allow inflates codex by its entire cache-read volume — ~869M as of
 * 2026-08-14 — and no downstream number would look wrong.
 */
export function codexAllIn(totals) {
  return totals.input + totals.output
}
