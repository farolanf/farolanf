/**
 * The stats card.
 *
 * PRIVACY IS STRUCTURAL HERE. `toModel` builds an object whose every field is a
 * number or a date string, and `render` reads only that object. There is nowhere
 * for a repo name, a file path, a branch, a commit message, a model slug or a
 * session id to travel through, so the public card cannot leak one even if a
 * future source starts carrying them.
 *
 * Two SVGs rather than one carrying a `prefers-color-scheme` block. An SVG
 * loaded through `<img>` is an independent document: the media query inside it
 * answers to the OPERATING SYSTEM's setting, not to the GitHub theme the reader
 * actually chose, so a light-mode-on-a-dark-OS visitor gets the wrong card.
 * `<picture>` with a `media` source is resolved by the host page and follows the
 * theme GitHub is rendering.
 *
 * Verified 2026-08-14: unlike external hosts, raw.githubusercontent.com is NOT
 * proxied through camo — the profile page links these SVGs directly, with
 * `cache-control: max-age=300`.
 */

const THEMES = {
  light: {
    bg: '#ffffff',
    border: '#d0d7de',
    text: '#1f2328',
    muted: '#59636e',
    faint: '#818b98',
    accent: '#1a7f37',
    bar: '#2da44e',
    barDim: '#aceebb',
  },
  dark: {
    bg: '#0d1117',
    border: '#30363d',
    text: '#e6edf3',
    muted: '#9198a1',
    faint: '#6e7681',
    accent: '#3fb950',
    bar: '#3fb950',
    barDim: '#1b4721',
  },
}

const W = 495
const H = 320

/**
 * @param {{commits:object, tokens:object, loops:number, liveProducts:number,
 *          contributions:number, today:string}} readings
 */
export function toModel(readings) {
  const { commits, tokens } = readings

  return {
    today: readings.today,
    counters: [
      { value: int(commits.all), label: 'commits' },
      { value: int(commits.last30), label: 'last 30 days' },
      { value: int(readings.loops), label: 'agent loops' },
      { value: int(readings.liveProducts), label: 'live' },
    ],
    countersNote: `authored across ${int(commits.repos)} repos since ${commits.earliest}`,
    tokenCounters: [
      { value: compact(tokens.written), label: 'tokens written' },
      { value: compact(tokens.processed), label: 'tokens processed' },
      { value: int(tokens.sessions), label: 'agent sessions' },
    ],
    tokensNote: `all-time since ${tokens.from}, across ${word(tokens.sourceCount)} coding agents`,
    spark: commits.weeks.map((w) => ({ label: w.week, value: w.commits })),
    footer: `${int(readings.contributions)} contributions in 12 months, mostly agent-authored under human gates.`,
  }
}

export function render(model, themeName) {
  const t = THEMES[themeName]
  if (!t) throw new Error(`unknown theme: ${themeName}`)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="fleet stats">`,
    `<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}`,
    `.n{font-size:21px;font-weight:600;fill:${t.text}}`,
    `.l{font-size:10px;fill:${t.muted}}`,
    `.note{font-size:9.5px;fill:${t.faint}}`,
    `.h{font-size:12px;font-weight:600;fill:${t.text}}`,
    `.d{font-size:10px;fill:${t.faint}}`,
    `.f{font-size:10px;fill:${t.muted}}</style>`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6" fill="${t.bg}" stroke="${t.border}"/>`,
    `<text x="25" y="32" class="h">fleet</text>`,
    `<text x="${W - 25}" y="32" class="d" text-anchor="end">${esc(model.today)}</text>`,
    row(model.counters, 70, 86, 4),
    `<text x="25" y="104" class="note">${esc(model.countersNote)}</text>`,
    row(model.tokenCounters, 146, 162, 3),
    `<text x="25" y="180" class="note">${esc(model.tokensNote)}</text>`,
    `<text x="25" y="208" class="l">commits / week</text>`,
    sparkline(model.spark, t),
    `<text x="25" y="300" class="f">${esc(model.footer)}</text>`,
    `</svg>`,
  ].join('')
}

function row(counters, valueY, labelY, columns) {
  const usable = W - 50
  const step = usable / columns
  return counters
    .map((c, i) => {
      const x = 25 + i * step
      return `<text x="${round(x)}" y="${valueY}" class="n">${esc(c.value)}</text>` +
        `<text x="${round(x)}" y="${labelY}" class="l">${esc(c.label)}</text>`
    })
    .join('')
}

function sparkline(points, t) {
  const x0 = 25
  const top = 216
  const height = 42
  const usable = W - 50
  const gap = 4
  const width = (usable - gap * (points.length - 1)) / points.length
  const peak = Math.max(1, ...points.map((p) => p.value))

  const bars = points
    .map((p, i) => {
      const h = Math.max(2, Math.round((p.value / peak) * height))
      const x = x0 + i * (width + gap)
      const y = top + height - h
      const last = i === points.length - 1
      // The final week is still in progress, so it is drawn dimmed rather than
      // presented as a completed value that happens to be low.
      return `<rect x="${round(x)}" y="${y}" width="${round(width)}" height="${h}" rx="1.5" fill="${last ? t.barDim : t.bar}"/>`
    })
    .join('')

  const first = points[0]?.label ?? ''
  const lastLabel = points.at(-1)?.label ?? ''

  return bars +
    `<text x="${x0}" y="${top + height + 14}" class="note">${esc(first)}</text>` +
    `<text x="${W - 25}" y="${top + height + 14}" class="note" text-anchor="end">${esc(lastLabel)}</text>`
}

export function toShields(model, tokens) {
  return {
    schemaVersion: 1,
    label: 'tokens written',
    message: compact(tokens.written),
    color: 'brightgreen',
    cacheSeconds: 3600,
  }
}

function int(n) {
  return Number(n ?? 0).toLocaleString('en-US')
}

/** 183_033_689 -> "183.0M", 31_809_076_497 -> "31.8B" */
export function compact(n) {
  const value = Number(n ?? 0)
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return String(value)
}

function word(n) {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n)
}

function round(n) {
  return Math.round(n * 10) / 10
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
