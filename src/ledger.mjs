/**
 * The monotonic ledger — what makes the token counter genuinely all-time.
 *
 * Every source it reads is a cache that can shrink or vanish: Claude Code prunes
 * transcripts and could reset its own stats file, codex session files age out,
 * a tool could be uninstalled entirely. A counter that reports whatever the
 * sources say today would go DOWN when that happens, and a number falling
 * silently is the absence-reads-as-health failure this whole design is against.
 *
 * So reconcile takes the MAX of what was ever observed, never the latest, and
 * keeps the EARLIEST start date ever seen. A source that disappears freezes at
 * its last known total instead of dropping to zero.
 */

/**
 * `allIn` is stored rather than recomputed, because it is NOT the same formula
 * for every source: codex's `cacheRead` is a subset of its `input`, while Claude
 * Code's and opencode's buckets are disjoint. Each source declares its own, and
 * this module only ever sums what it was given.
 */
const FIELDS = ['output', 'input', 'cacheRead', 'cacheCreate', 'allIn', 'sessions', 'messages']

export function emptyLedger() {
  return { version: 1, sources: {} }
}

/**
 * @param {object} previous the ledger as last persisted
 * @param {Record<string, object>} observed this run's readings, keyed by source
 */
export function reconcile(previous, observed) {
  const next = { version: 1, sources: { ...(previous?.sources ?? {}) } }

  for (const [name, reading] of Object.entries(observed)) {
    const held = next.sources[name] ?? {}
    const merged = {}

    for (const field of FIELDS) {
      // max, never latest: a shrunken source cannot lower the all-time number.
      merged[field] = Math.max(held[field] ?? 0, reading?.[field] ?? 0)
    }

    merged.from = earliest(held.from, reading?.from)
    merged.to = latest(held.to, reading?.to)
    merged.seen = (held.seen ?? 0) + 1

    next.sources[name] = merged
  }

  // A source absent from `observed` is left exactly as it was, frozen rather
  // than dropped — that is the uninstalled-tool case.
  return next
}

/** Sums every source in the ledger into the figures the card shows. */
export function totals(ledger) {
  const sum = { output: 0, input: 0, cacheRead: 0, cacheCreate: 0, allIn: 0, sessions: 0 }
  let from = null
  let to = null

  for (const source of Object.values(ledger?.sources ?? {})) {
    for (const field of Object.keys(sum)) sum[field] += source[field] ?? 0
    from = earliest(from, source.from)
    to = latest(to, source.to)
  }

  return {
    ...sum,
    // Written is what the models actually produced. Processed is everything that
    // moved through them, cache reads included — a throughput figure, and the
    // reason the two are labelled differently on the card. It sums each source's
    // declared `allIn` rather than re-deriving one formula for all of them.
    written: sum.output,
    processed: sum.allIn,
    from,
    to,
    sourceCount: Object.keys(ledger?.sources ?? {}).length,
  }
}

function earliest(a, b) {
  if (!a) return b ?? null
  if (!b) return a
  return a < b ? a : b
}

function latest(a, b) {
  if (!a) return b ?? null
  if (!b) return a
  return a > b ? a : b
}
