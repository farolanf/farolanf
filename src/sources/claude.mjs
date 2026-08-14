/**
 * Claude Code's own cumulative usage rollup.
 *
 * Source: ~/.claude/stats-cache.json, field `modelUsage`.
 *
 * Why this and not a scan of ~/.claude/projects/**\/*.jsonl: Claude Code prunes
 * transcripts, so a directory scan is a ~30-day counter wearing an all-time
 * label and it goes DOWN after every cleanup. This file is persisted — its
 * `dailyActivity` retains days whose transcripts are already deleted — and it
 * carries every model routed through the CLI, including the non-Anthropic ones.
 *
 * Pure: takes the parsed file, returns totals. Reads nothing.
 */

/** @returns {{output:number,input:number,cacheRead:number,cacheCreate:number,sessions:number,messages:number,from:string|null,to:string|null,models:number}} */
export function readClaude(statsCache) {
  const usage = statsCache?.modelUsage ?? {}
  const totals = { output: 0, input: 0, cacheRead: 0, cacheCreate: 0 }

  for (const model of Object.values(usage)) {
    totals.output += model?.outputTokens ?? 0
    totals.input += model?.inputTokens ?? 0
    totals.cacheRead += model?.cacheReadInputTokens ?? 0
    totals.cacheCreate += model?.cacheCreationInputTokens ?? 0
  }

  const days = statsCache?.dailyActivity ?? []

  return {
    ...totals,
    // Every bucket here is disjoint, so all-in is simply their sum. Stated
    // per-source because codex's are NOT disjoint; see sources/codex.mjs.
    allIn: totals.output + totals.input + totals.cacheRead + totals.cacheCreate,
    sessions: statsCache?.totalSessions ?? 0,
    messages: statsCache?.totalMessages ?? 0,
    // `firstSessionDate` is when stats tracking began, which is later than the
    // first token ever spent. Reported as-is; the card says "measured since".
    from: dateOnly(statsCache?.firstSessionDate) ?? days[0]?.date ?? null,
    to: statsCache?.lastComputedDate ?? days.at(-1)?.date ?? null,
    // Count only. The slugs name every provider tried and never leave this module.
    models: Object.keys(usage).length,
  }
}

function dateOnly(value) {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null
}
