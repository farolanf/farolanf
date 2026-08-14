/**
 * opencode sessions.
 *
 * Source: ~/.local/share/opencode/opencode.db, table `session`, which already
 * stores per-session token totals — so one aggregate query answers it and there
 * is no per-message rollup to do.
 *
 * Pure: takes the aggregate row, returns totals.
 */

export function readOpencode(row) {
  const output = row?.tokens_output ?? 0
  const input = row?.tokens_input ?? 0
  const cacheRead = row?.tokens_cache_read ?? 0
  const cacheCreate = row?.tokens_cache_write ?? 0

  return {
    output,
    input,
    cacheRead,
    cacheCreate,
    // Disjoint buckets, so all-in is their sum. See sources/codex.mjs for the
    // source where that is not true.
    allIn: output + input + cacheRead + cacheCreate,
    sessions: row?.sessions ?? 0,
    from: row?.first ? String(row.first).slice(0, 10) : null,
    to: row?.last ? String(row.last).slice(0, 10) : null,
  }
}
