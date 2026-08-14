#!/usr/bin/env node
/**
 * The IO adapter. Reads this machine, hands numbers to the pure modules in
 * src/, writes the card, and commits only when a number actually changed.
 *
 *   node scripts/stats.mjs --dry-run   read everything, write nothing, print it
 *   node scripts/stats.mjs             write, commit and push if anything moved
 *
 * Everything that decides is in src/. This file only fetches and persists.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render, toModel, toShields } from '../src/card.mjs'
import { readCommits } from '../src/commits.mjs'
import { emptyLedger, reconcile, totals } from '../src/ledger.mjs'
import { readClaude } from '../src/sources/claude.mjs'
import { extractSessionUsage, readCodex } from '../src/sources/codex.mjs'
import { readOpencode } from '../src/sources/opencode.mjs'

const HOME = homedir()
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER = join(HOME, '.local/state/profile-stats/ledger.json')
const PROJECTS = join(HOME, 'prj')

const dryRun = process.argv.includes('--dry-run')

// ---------------------------------------------------------------- sources

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function claudeReading() {
  const cache = readJson(join(HOME, '.claude/stats-cache.json'))
  return cache ? readClaude(cache) : null
}

function codexReading() {
  const root = join(HOME, '.codex/sessions')
  if (!existsSync(root)) return null

  const sessions = []
  for (const file of walk(root, '.jsonl')) {
    const text = safeRead(file)
    if (text === null) continue
    const lines = text.split('\n')
    const usage = extractSessionUsage(lines)
    if (usage) sessions.push({ usage, timestamp: firstTimestamp(lines) })
  }

  // readCodex sets `allIn` to input + output, because cached is a subset of input.
  return readCodex(sessions)
}

function opencodeReading() {
  const db = join(HOME, '.local/share/opencode/opencode.db')
  if (!existsSync(db)) return null

  const sql =
    "select count(*), sum(tokens_input), sum(tokens_output), sum(tokens_cache_read), " +
    "sum(tokens_cache_write), date(min(time_created)/1000,'unixepoch'), " +
    "date(max(time_created)/1000,'unixepoch') from session"

  const out = sh('sqlite3', [db, sql])
  if (out === null) return null

  const [sessions, input, output, cacheRead, cacheWrite, first, last] = out.trim().split('|')
  return readOpencode({
    sessions: num(sessions),
    tokens_input: num(input),
    tokens_output: num(output),
    tokens_cache_read: num(cacheRead),
    tokens_cache_write: num(cacheWrite),
    first,
    last,
  })
}

function commitReading(asOf) {
  const logs = []
  for (const entry of readdirSync(PROJECTS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const repo = join(PROJECTS, entry.name)
    if (!existsSync(join(repo, '.git'))) continue

    // No --author here on purpose: the identity filter lives in src/commits.mjs
    // where it is unit-testable, and this only fetches.
    const out = sh('git', ['-C', repo, 'log', '--format=%ae\t%ad', '--date=format:%Y-%m-%d'])
    if (out !== null) logs.push(out.split('\n').filter(Boolean))
  }
  return readCommits(logs, { asOf })
}

function loopCount() {
  const dir = join(HOME, '.config/clawchan/agendas')
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.env')).length
  } catch {
    return 0
  }
}

function liveProductCount() {
  const path = join(PROJECTS, 'tiraisoft-site/src/data/products.ts')
  const text = safeRead(path)
  if (text === null) return 0
  return (text.match(/status:\s*'live'/g) ?? []).length
}

function contributionCount() {
  const query =
    '{viewer{contributionsCollection{contributionCalendar{totalContributions}}}}'
  const out = sh('gh', ['api', 'graphql', '-f', `query=${query}`, '--jq',
    '.data.viewer.contributionsCollection.contributionCalendar.totalContributions'])
  return out === null ? 0 : num(out.trim())
}

// ---------------------------------------------------------------- helpers

function* walk(dir, ext) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path, ext)
    else if (entry.name.endsWith(ext)) yield path
  }
}

function safeRead(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function firstTimestamp(lines) {
  for (const line of lines) {
    const match = line.match(/"timestamp":"([^"]{10})/)
    if (match) return match[1]
  }
  return null
}

function sh(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function git(args) {
  return execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' })
}

// ---------------------------------------------------------------- run

const asOf = new Date()
const today = asOf.toISOString().slice(0, 10)
const stamp = today.replace(/-/g, '')

const observed = {}
const claude = claudeReading()
if (claude) observed.claude = claude
const codex = codexReading()
if (codex) observed.codex = codex
const opencode = opencodeReading()
if (opencode) observed.opencode = opencode

const previous = readJson(LEDGER, emptyLedger())
const ledger = reconcile(previous, observed)
const tokens = totals(ledger)

const commits = commitReading(asOf)
const readings = {
  commits,
  tokens,
  loops: loopCount(),
  liveProducts: liveProductCount(),
  contributions: contributionCount(),
  today,
}

const model = toModel(readings)
const svgs = { light: render(model, 'light'), dark: render(model, 'dark') }
const shields = toShields(model, tokens)

if (dryRun) {
  for (const [name, reading] of Object.entries(observed)) {
    console.log(`${name.padEnd(10)} output=${fmt(reading.output)} input=${fmt(reading.input)} ` +
      `cacheRead=${fmt(reading.cacheRead)} sessions=${fmt(reading.sessions)} ${reading.from}..${reading.to}`)
  }
  console.log('')
  console.log(`tokens written   ${fmt(tokens.written)}`)
  console.log(`tokens processed ${fmt(tokens.processed)}`)
  console.log(`agent sessions   ${fmt(tokens.sessions)}  since ${tokens.from}`)
  console.log('')
  console.log(`commits all-time ${fmt(commits.all)} across ${commits.repos} repos since ${commits.earliest}`)
  console.log(`commits 30d/365d ${fmt(commits.last30)} / ${fmt(commits.last365)}`)
  console.log(`weeks            ${commits.weeks.map((w) => w.commits).join(', ')}`)
  console.log(`loops ${readings.loops}  live ${readings.liveProducts}  contributions ${fmt(readings.contributions)}`)

  const out = join(REPO, 'stats-dryrun')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'fleet-light.svg'), svgs.light)
  writeFileSync(join(out, 'fleet-dark.svg'), svgs.dark)
  console.log(`\nSVGs written to ${out} (not committed)`)
  process.exit(0)
}

mkdirSync(dirname(LEDGER), { recursive: true })
writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`)

mkdirSync(join(REPO, 'stats'), { recursive: true })
const files = {
  'stats/fleet-light.svg': svgs.light,
  'stats/fleet-dark.svg': svgs.dark,
  'stats/fleet.json': `${JSON.stringify(shields, null, 2)}\n`,
}

let changed = false
for (const [path, content] of Object.entries(files)) {
  const full = join(REPO, path)
  if (safeRead(full) !== content) {
    writeFileSync(full, content)
    changed = true
  }
}

if (!changed) {
  console.log('no change')
  process.exit(0)
}

// Only the cache-buster inside the fence moves; nothing else in the README is touched.
const readmePath = join(REPO, 'README.md')
const readme = readFileSync(readmePath, 'utf8')
const restamped = readme.replace(
  /(<!-- FLEET-CARD -->[\s\S]*?<!-- \/FLEET-CARD -->)/,
  (block) => block.replace(/\?v=\d{8}/g, `?v=${stamp}`),
)
if (restamped !== readme) writeFileSync(readmePath, restamped)

git(['add', 'stats', 'README.md'])
git(['commit', '-m', `chore(stats): refresh the fleet card (${today})`, '--', 'stats', 'README.md'])
git(['push'])
console.log(`pushed ${today}`)

function fmt(n) {
  return Number(n ?? 0).toLocaleString('en-US')
}
