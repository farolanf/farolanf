import { describe, expect, it } from 'vitest'

import { IDENTITIES, isoWeek, readCommits } from './commits.mjs'

const asOf = new Date('2026-08-14T00:00:00Z')
const mine = IDENTITIES[0]
const alsoMine = IDENTITIES[1]

function log(...entries) {
  return entries.map(([email, day]) => `${email}\t${day}`)
}

describe('readCommits — the author filter IS the privacy rule', () => {
  it('counts only the owner\'s commits in a repo shared with other authors', () => {
    // A client repo contributes an integer and nothing else. This is the whole
    // reason the filter lives here rather than in a git flag.
    const client = log(
      [mine, '2026-08-10'],
      ['someone-else@example.com', '2026-08-10'],
      ['another@example.com', '2026-08-11'],
      [mine, '2026-08-12'],
    )

    expect(readCommits([client], { asOf }).all).toBe(2)
  })

  it('counts both of the owner\'s identities', () => {
    const repo = log([mine, '2026-08-10'], [alsoMine, '2026-08-11'])

    expect(readCommits([repo], { asOf }).all).toBe(2)
  })

  it('returns numbers and dates only, with no field that could carry a repo name', () => {
    const result = readCommits([log([mine, '2026-08-10'])], { asOf })
    const scalars = Object.entries(result).filter(([key]) => key !== 'weeks')

    for (const [, value] of scalars) {
      expect(['number', 'string']).toContain(typeof value)
    }
    expect(Object.keys(result).sort()).toEqual(['all', 'earliest', 'last30', 'last365', 'repos', 'weeks'])
  })

  it('does not count a repo the owner never committed to', () => {
    const theirs = log(['someone-else@example.com', '2026-08-10'])
    const ours = log([mine, '2026-08-10'])

    expect(readCommits([theirs, ours], { asOf }).repos).toBe(1)
  })

  it('windows 30 and 365 days back from the injected clock', () => {
    const repo = log(
      [mine, '2026-08-13'],   // inside 30
      [mine, '2026-07-01'],   // inside 365, outside 30
      [mine, '2024-01-01'],   // outside both
    )
    const result = readCommits([repo], { asOf })

    expect(result.all).toBe(3)
    expect(result.last30).toBe(1)
    expect(result.last365).toBe(2)
    expect(result.earliest).toBe('2024-01-01')
  })

  it('ignores malformed lines rather than counting them', () => {
    const repo = ['no-tab-here', `${mine}\tnot-a-date`, `${mine}\t2026-08-10`]

    expect(readCommits([repo], { asOf }).all).toBe(1)
  })

  it('reports the requested number of trailing weeks, zero-filling quiet ones', () => {
    const repo = log([mine, '2026-08-13'])
    const { weeks } = readCommits([repo], { asOf, weeks: 4 })

    expect(weeks).toHaveLength(4)
    expect(weeks.at(-1)).toEqual({ week: '2026-W33', commits: 1 })
    expect(weeks[0].commits).toBe(0)
  })

  it('handles a machine with no repos at all', () => {
    const result = readCommits([], { asOf })

    expect(result.all).toBe(0)
    expect(result.earliest).toBe(null)
  })
})

describe('isoWeek', () => {
  it('matches git\'s %G-W%V, including across a year boundary', () => {
    // 2026-01-01 is a Thursday, so it belongs to 2026-W01.
    expect(isoWeek('2026-01-01')).toBe('2026-W01')
    // 2025-12-29 is a Monday and belongs to the ISO year that follows it.
    expect(isoWeek('2025-12-29')).toBe('2026-W01')
    expect(isoWeek('2026-08-14')).toBe('2026-W33')
    expect(isoWeek('2026-05-18')).toBe('2026-W21')
  })
})
