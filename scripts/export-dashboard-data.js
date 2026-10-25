/**
 * Exports the last test run as data for the Stord QA dashboard (a separate static site).
 *
 *   test-results/cucumber-report.json + rtm.json + run-stats.json
 *        -->  <out>/results.json   the latest run in full (summary, layers, every test)
 *             <out>/runs.json      one line per run, appended each time (history for the trend graph)
 *             <out>/rtm.json       the requirements traceability matrix
 *
 * Usage:  npm run bdd:all && npm run rtm && npm run dashboard:export -- --out ../stord-qa-dashboard/data
 * In CI the dashboard repo is checked out and --out points into it, then the change is pushed.
 */
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const OUT = arg('out', 'dashboard-data')
const SUITE = arg('suite', process.env.TEST_SUITE || 'Full suite')
const KEEP_RUNS = 100

const REPORT = path.join('test-results', 'cucumber-report.json')
const RTM = path.join('test-results', 'rtm.json')
const STATS = path.join('test-results', 'run-stats.json')
for (const file of [REPORT, RTM]) {
  if (!fs.existsSync(file)) {
    console.error(`Missing ${file}. Run the suite and then "npm run rtm" first.`)
    process.exit(1)
  }
}
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const report = read(REPORT)
const rtm = read(RTM)
const stats = fs.existsSync(STATS) ? read(STATS) : {}
const flakyNames = new Set(stats.flaky || [])

// ---------- tests: one record per scenario run (a retry shares an id: the last attempt wins) ----------
const byId = new Map()
for (const feature of report) {
  for (const scenario of feature.elements || []) {
    if (scenario.type !== 'scenario') continue
    const tags = (scenario.tags || []).map(t => t.name)
    const results = (scenario.steps || []).map(s => s.result && s.result.status)
    byId.set(scenario.id, {
      id: (tags.find(t => /^@STD-\d+\.\d+$/.test(t)) || '').replace('@', ''),
      name: scenario.name,
      feature: feature.name,
      layer: tags.includes('@API') ? 'api' : 'ui',
      severity: tags.includes('@Smoke') ? 'Smoke' : tags.includes('@Regression') ? 'Regression' : '',
      status: results.includes('failed') ? 'failed' : results.every(r => r === 'passed') ? 'passed' : 'skipped',
      flaky: flakyNames.has(scenario.name),
      durationMs: Math.round((scenario.steps || []).reduce((sum, s) => sum + ((s.result && s.result.duration) || 0), 0) / 1e6),
      requirements: tags.filter(t => t.startsWith('@REQ-')).map(t => t.replace('@', ''))
    })
  }
}
const tests = [...byId.values()]

// ---------- aggregates ----------
const rate = (passed, total) => (total ? Math.round((passed / total) * 1000) / 10 : 0)
const tally = list => {
  const passed = list.filter(t => t.status === 'passed').length
  return { total: list.length, passed, failed: list.filter(t => t.status === 'failed').length, flaky: list.filter(t => t.flaky).length, rate: rate(passed, list.length) }
}
const human = ms => (ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`)
const durationMs = stats.durationMs || tests.reduce((sum, t) => sum + t.durationMs, 0)

const features = [...new Set(tests.map(t => t.feature))].map(name => {
  const list = tests.filter(t => t.feature === name)
  return { name, layer: list[0].layer, ...tally(list) }
})

// ---------- history ----------
fs.mkdirSync(OUT, { recursive: true })
const runsFile = path.join(OUT, 'runs.json')
const history = fs.existsSync(runsFile) ? read(runsFile) : []
const prev = history[history.length - 1]
const runNum = (prev ? prev.runNum : 0) + 1
const runId = `R-${runNum}`
const now = new Date().toISOString()
const summary = { ...tally(tests), skipped: tests.filter(t => t.status === 'skipped').length, duration: human(durationMs), durationMs }
const server = process.env.GITHUB_SERVER_URL
const runUrl = server && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${server}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : ''
const context = {
  generatedAt: now,
  suite: SUITE,
  env: process.env.BASE_URL || 'https://www.stord.com',
  apiEnv: process.env.API_BASE_URL || 'https://jsonplaceholder.typicode.com',
  branch: process.env.GITHUB_REF_NAME || 'local',
  runUrl
}
const reqSummary = rtm.summary || {}

const results = {
  runId, ...context,
  summary: { ...summary, prevRunId: prev ? prev.runId : null, prevRate: prev ? prev.rate : null },
  layers: { ui: tally(tests.filter(t => t.layer === 'ui')), api: tally(tests.filter(t => t.layer === 'api')) },
  requirements: { total: reqSummary.requirements, verified: reqSummary.verified, failed: reqSummary.failed, noResult: reqSummary.noResult, uatAccepted: reqSummary.uatAccepted, uatPending: reqSummary.uatPending },
  features,
  tests
}
const entry = {
  runId, runNum, generatedAt: now, rate: summary.rate, total: summary.total, passed: summary.passed,
  failed: summary.failed, flaky: summary.flaky, skipped: summary.skipped, duration: summary.duration, durationMs,
  suite: SUITE, env: context.env, branch: context.branch, runUrl,
  reqVerified: reqSummary.verified, reqTotal: reqSummary.requirements,
  // Per-test history: lets the dashboard show "new failures", "still failing for N runs" and the flaky leaderboard
  failedNames: tests.filter(t => t.status === 'failed').map(t => t.name),
  flakyNames: tests.filter(t => t.flaky).map(t => t.name)
}
const runs = [...history, entry].slice(-KEEP_RUNS)

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
fs.writeFileSync(runsFile, JSON.stringify(runs, null, 2))
fs.writeFileSync(path.join(OUT, 'rtm.json'), JSON.stringify(rtm, null, 2))

console.log(`Exported ${runId}: ${summary.passed}/${summary.total} passed (${summary.rate}%), ${summary.failed} failed, ${summary.flaky} flaky, ${summary.duration}`)
console.log(`Wrote results.json, runs.json (${runs.length} runs), rtm.json to ${path.resolve(OUT)}`)
