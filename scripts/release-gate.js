/**
 * Release gate: reads the last run (test-results/cucumber-report.json + rtm.json), applies the release checks
 * from scripts/lib/gate.js, prints them, writes a job summary in GitHub Actions, and exits 1 if any check fails.
 *
 *   npm run gate
 *   npm run gate -- --require-coverage     (full-suite pipelines: a High requirement with no result also blocks)
 *
 * Thresholds: GATE_THRESHOLD (default 80), GATE_BLOCK_PRIORITIES (default "High", comma separated, "" turns the rule off),
 * GATE_MAX_SKIPPED (default 0). The dashboard page shows the same rules (see its config.js).
 */
const fs = require('fs')
const path = require('path')
const { evaluateGate } = require('./lib/gate')

const REPORT = path.join('test-results', 'cucumber-report.json')
const RTM = path.join('test-results', 'rtm.json')
const STATS = path.join('test-results', 'run-stats.json')
for (const file of [REPORT, RTM]) {
  if (!fs.existsSync(file)) {
    console.error(`Missing ${file}. Run the suite and "npm run rtm" first.`)
    process.exit(2)
  }
}
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const flaky = new Set((fs.existsSync(STATS) ? read(STATS) : {}).flaky || [])

// One record per scenario; a retried scenario shares an id and the last attempt wins
const byId = new Map()
for (const feature of read(REPORT)) {
  for (const scenario of feature.elements || []) {
    if (scenario.type !== 'scenario') continue
    const tags = (scenario.tags || []).map(t => t.name)
    const results = (scenario.steps || []).map(s => s.result && s.result.status)
    byId.set(scenario.id, {
      id: (tags.find(t => /^@STD-\d+\.\d+$/.test(t)) || scenario.name).replace('@', ''),
      status: results.includes('failed') ? 'failed' : results.every(r => r === 'passed') ? 'passed' : 'skipped',
      severity: tags.includes('@Smoke') ? 'Smoke' : tags.includes('@Regression') ? 'Regression' : '',
      flaky: flaky.has(scenario.name)
    })
  }
}

const options = {
  releaseThreshold: Number(process.env.GATE_THRESHOLD || 80),
  maxSkipped: Number(process.env.GATE_MAX_SKIPPED || 0),
  blockOnUncovered: process.argv.includes('--require-coverage')
}
if (process.env.GATE_BLOCK_PRIORITIES !== undefined) {
  options.blockOnPriorities = process.env.GATE_BLOCK_PRIORITIES.split(',').map(s => s.trim()).filter(Boolean)
}
const gate = evaluateGate([...byId.values()], read(RTM).requirements || [], options)

const lines = gate.checks.map(c => `${c.ok ? 'PASS' : 'FAIL'}  ${c.label} - ${c.detail}${c.warn ? ` (${c.warn})` : ''}`)
console.log(`\nRelease gate: ${gate.ok ? 'READY' : 'NOT READY'}  (${gate.summary.passed}/${gate.summary.total} passed, ${gate.summary.rate}%)\n  ${lines.join('\n  ')}\n`)

const failed = [...byId.values()].filter(t => t.status === 'failed')
if (gate.ok && failed.length) {
  const note = `${failed.length} scenario(s) failed but do not block the release: ${failed.map(t => t.id).join(', ')}`
  console.log(process.env.GITHUB_ACTIONS ? `::warning title=Failures below the gate::${note}` : `WARNING: ${note}`)
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    `## Release gate: ${gate.ok ? 'Ready to deploy' : 'Not ready to deploy'}`, '',
    '| | Check | Detail |', '|---|---|---|',
    ...gate.checks.map(c => `| ${c.ok ? 'Pass' : 'Fail'} | ${c.label} | ${c.detail}${c.warn ? `<br>Note: ${c.warn}` : ''} |`), ''
  ].join('\n')
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)
}
process.exit(gate.ok ? 0 : 1)
