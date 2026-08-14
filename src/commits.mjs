/**
 * Commits authored by the owner, across every repo on the machine.
 *
 * The filter is by AUTHOR IDENTITY, not by remote. That is both more truthful
 * and stricter on privacy than counting only repos the owner happens to own:
 * client and org repos contribute, but each contributes an integer and nothing
 * else — no name, no path, no branch, no message.
 *
 * The adapter hands over raw `email<TAB>date` lines per repo and this module
 * does the filtering, so the exclusion rule is unit-testable rather than buried
 * in a git flag.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/

export const IDENTITIES = Object.freeze([
  'farolanfaisal@gmail.com',
  '19000494-farolanf@users.noreply.replit.com',
])

/**
 * @param {Array<string[]>} repoLogs one array of "email\tYYYY-MM-DD" lines per repo
 * @param {{asOf: Date, weeks?: number}} options
 */
export function readCommits(repoLogs, { asOf, weeks = 13 }) {
  const mine = new Set(IDENTITIES)
  const cutoff30 = dayString(addDays(asOf, -30))
  const cutoff365 = dayString(addDays(asOf, -365))

  let all = 0
  let last30 = 0
  let last365 = 0
  let earliest = null
  let repos = 0
  const byWeek = new Map()

  for (const lines of repoLogs) {
    let hereMine = 0

    for (const line of lines) {
      const tab = line.indexOf('\t')
      if (tab < 0) continue
      const email = line.slice(0, tab)
      if (!mine.has(email)) continue

      const day = line.slice(tab + 1, tab + 11)
      // Shape, not just length: "not-a-date" is also ten characters, and a bad
      // day would reach isoWeek and put a NaN bar in the sparkline.
      if (!DAY.test(day)) continue

      hereMine += 1
      all += 1
      if (day > cutoff30) last30 += 1
      if (day > cutoff365) last365 += 1
      if (earliest === null || day < earliest) earliest = day

      const week = isoWeek(day)
      byWeek.set(week, (byWeek.get(week) ?? 0) + 1)
    }

    if (hereMine > 0) repos += 1
  }

  return { all, last30, last365, earliest, repos, weeks: recentWeeks(byWeek, asOf, weeks) }
}

/** The last `count` ISO weeks up to and including the one `asOf` falls in. */
function recentWeeks(byWeek, asOf, count) {
  const out = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const label = isoWeek(dayString(addDays(asOf, -7 * i)))
    out.push({ week: label, commits: byWeek.get(label) ?? 0 })
  }
  return out
}

/** ISO-8601 week label, eg. "2026-W33". Matches `git log --date=format:%G-W%V`. */
export function isoWeek(day) {
  const date = new Date(`${day}T00:00:00Z`)
  // Thursday of this week decides both the ISO year and the week number.
  const dayOfWeek = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayOfWeek + 3)
  const isoYear = date.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstOffset = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstOffset + 3)
  const week = 1 + Math.round((date - firstThursday) / (7 * 24 * 60 * 60 * 1000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

function addDays(date, days) {
  const out = new Date(date.getTime())
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function dayString(date) {
  return date.toISOString().slice(0, 10)
}
