import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const prose = readme.replace(/<!-- FLEET-CARD -->[\s\S]*?<!-- \/FLEET-CARD -->/, '')

describe('README prose', () => {
  // The daily refresh rewrites only the card fence, so a count typed into the
  // prose goes stale the next day. "5,740 contributions" sat beside a card
  // reading 14,762 for seven weeks before anyone noticed.
  it('never states a contribution count outside the card, because only the card is refreshed', () => {
    expect(prose).not.toMatch(/\d[\d,.]*\s+contributions/i)
  })

  // An em-dash on a page read under my own name reads as machine-written copy.
  it('carries no em-dash', () => {
    expect(readme).not.toMatch(/—/)
  })
})
