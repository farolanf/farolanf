import { describe, expect, it } from 'vitest'

import { compact, render, toModel, toShields } from './card.mjs'

const readings = {
  today: '2026-08-14',
  loops: 19,
  liveProducts: 4,
  contributions: 5740,
  commits: {
    all: 9043,
    last30: 2232,
    last365: 5604,
    repos: 69,
    earliest: '2022-09-07',
    weeks: [
      { week: '2026-W21', commits: 96 },
      { week: '2026-W32', commits: 770 },
      { week: '2026-W33', commits: 578 },
    ],
  },
  tokens: {
    written: 183033689,
    processed: 31809077497,
    sessions: 2254,
    from: '2026-03-19',
    to: '2026-08-13',
    sourceCount: 3,
  },
}

describe('toModel', () => {
  it('formats the headline counters the way the card shows them', () => {
    const model = toModel(readings)

    expect(model.counters.map((c) => c.value)).toEqual(['9,043', '2,232', '19', '4'])
    expect(model.tokenCounters.map((c) => c.value)).toEqual(['183.0M', '31.8B', '2,254'])
  })

  it('says what was measured and from when, so the counter is a fact and not a guess', () => {
    const model = toModel(readings)

    expect(model.countersNote).toBe('authored across 69 repos since 2022-09-07')
    expect(model.tokensNote).toBe('all-time since 2026-03-19, across three coding agents')
  })

  it('keeps written and processed under labels that hold them apart', () => {
    const model = toModel(readings)

    expect(model.tokenCounters[0].label).toBe('tokens written')
    expect(model.tokenCounters[1].label).toBe('tokens processed')
  })
})

describe('render — privacy is structural', () => {
  const model = toModel(readings)

  it.each(['light', 'dark'])('%s emits no path, repo name, model slug or session id', (theme) => {
    const svg = render(model, theme)

    for (const leak of ['/home/', 'sunnie', 'jira-recurring', 'farolanf', '.git', 'claude-opus', 'deepseek', '.jsonl']) {
      expect(svg).not.toContain(leak)
    }
  })

  it('carries only numbers, labels and dates through to the output', () => {
    // The model is the only thing render reads, so if the model cannot hold a
    // string like a repo name, the card cannot print one.
    const strings = JSON.stringify(model)

    expect(strings).not.toMatch(/[a-z-]+\/[a-z-]+/)
  })

  it('renders both themes as valid standalone SVG of a fixed size', () => {
    for (const theme of ['light', 'dark']) {
      const svg = render(model, theme)
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).toContain(`width="495"`)
    }
  })

  it('gives the two themes different backgrounds', () => {
    expect(render(model, 'light')).toContain('#ffffff')
    expect(render(model, 'dark')).toContain('#0d1117')
  })

  it('refuses an unknown theme rather than rendering an unstyled card', () => {
    expect(() => render(model, 'solarized')).toThrow(/unknown theme/)
  })

  it('draws one bar per week and dims the last, which is still in progress', () => {
    const svg = render(model, 'dark')
    const bars = svg.match(/<rect x="[\d.]+" y="\d+" width="[\d.]+" height="\d+" rx="1.5"/g)

    expect(bars).toHaveLength(3)
    expect(svg).toContain('#1b4721') // the dimmed final bar
  })

  it('escapes text rather than letting it break the document', () => {
    const hostile = toModel({ ...readings, commits: { ...readings.commits, earliest: '<script>' } })

    expect(render(hostile, 'light')).not.toContain('<script>')
    expect(render(hostile, 'light')).toContain('&lt;script&gt;')
  })
})

describe('compact', () => {
  it('scales to the unit a reader can hold in their head', () => {
    expect(compact(183033689)).toBe('183.0M')
    expect(compact(31809077497)).toBe('31.8B')
    expect(compact(2254)).toBe('2.3K')
    expect(compact(999)).toBe('999')
    expect(compact(1.5e12)).toBe('1.5T')
    expect(compact(null)).toBe('0')
  })
})

describe('degenerate readings', () => {
  it('renders a card on a machine with no history at all', () => {
    const empty = toModel({
      today: '2026-08-14',
      loops: 0,
      liveProducts: 0,
      contributions: 0,
      commits: { all: 0, last30: 0, repos: 0, earliest: null, weeks: [] },
      tokens: { written: 0, processed: 0, sessions: 0, from: null, sourceCount: 0 },
    })

    expect(() => render(empty, 'light')).not.toThrow()
    expect(empty.tokensNote).toContain('zero coding agents')
  })

  it('spells source counts past the words it knows as a number', () => {
    const many = toModel({ ...readings, tokens: { ...readings.tokens, sourceCount: 11 } })

    expect(many.tokensNote).toContain('across 11 coding agents')
  })
})

describe('toShields', () => {
  it('emits a valid shields.io endpoint payload', () => {
    const payload = toShields(toModel(readings), readings.tokens)

    expect(payload.schemaVersion).toBe(1)
    expect(payload.message).toBe('183.0M')
  })
})
