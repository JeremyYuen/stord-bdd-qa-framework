/**
 * Release checks: the rules that decide "can this build ship?". One implementation, used by
 *   - scripts/release-gate.js (CI step that fails the job)
 * and mirrored by the dashboard page (stord-qa-dashboard/assets/app.js, releaseGate()). Keep the two in step:
 * the dashboard README lists the rules.
 *
 * tests:        [{ id, status: 'passed'|'failed'|'skipped', severity: 'Smoke'|'Regression'|'', flaky }]
 * requirements: [{ id, priority, result: 'Verified'|'Failed'|'No result' }]
 */
const DEFAULTS = {
  releaseThreshold: 80,        // pass rate (percent) needed
  blockOnPriorities: ['High'], // a Failed requirement of these priorities blocks the release
  maxSkipped: 0,
  blockOnUncovered: false      // true for full-suite pipelines: a High requirement with no result also blocks
}

function evaluateGate(tests, requirements, options = {}) {
  const cfg = { ...DEFAULTS, ...options }
  const total = tests.length
  const passed = tests.filter(t => t.status === 'passed').length
  const skipped = tests.filter(t => t.status === 'skipped').length
  const rate = total ? Math.round((passed / total) * 1000) / 10 : 0
  const smoke = tests.filter(t => t.severity === 'Smoke')
  const failedSmoke = smoke.filter(t => t.status === 'failed')
  const retriedSmoke = smoke.filter(t => t.flaky)
  const watched = requirements.filter(r => cfg.blockOnPriorities.includes(r.priority))
  const failedReqs = watched.filter(r => r.result === 'Failed')
  const uncovered = watched.filter(r => r.result !== 'Verified' && r.result !== 'Failed')

  const checks = [
    { id: 'pass-rate', ok: rate >= cfg.releaseThreshold, label: `Pass rate at least ${cfg.releaseThreshold}%`, detail: `${rate}% this run` },
    { id: 'every-test-ran', ok: total > 0 && skipped <= cfg.maxSkipped, label: 'Every test ran', detail: total ? `${total} tests, ${skipped} skipped` : 'no tests ran' },
    {
      id: 'smoke', ok: smoke.length > 0 && failedSmoke.length === 0, label: 'Smoke tests all pass',
      detail: !smoke.length ? 'no smoke tests ran' : failedSmoke.length ? `failing: ${failedSmoke.map(t => t.id).join(', ')}` : `${smoke.length} pass${retriedSmoke.length ? `, ${retriedSmoke.length} needed a retry` : ''}`
    }
  ]
  if (cfg.blockOnPriorities.length) {
    const blockers = cfg.blockOnUncovered ? [...failedReqs, ...uncovered] : failedReqs
    checks.push({
      id: 'priority-requirements',
      ok: blockers.length === 0,
      label: `All ${cfg.blockOnPriorities.join('/').toLowerCase()}-priority requirements ${cfg.blockOnUncovered ? 'verified' : 'passing'}`,
      detail: blockers.length ? blockers.map(r => `${r.id} (${r.result === 'Failed' ? 'failed' : 'no result'})`).join(', ') : `${watched.length - uncovered.length} verified`,
      // Not a blocker, but never silent: a partial run (e.g. smoke only) leaves some requirements untested
      warn: !cfg.blockOnUncovered && uncovered.length ? `not covered by this run: ${uncovered.map(r => r.id).join(', ')}` : ''
    })
  }
  return { ok: checks.every(c => c.ok), checks, summary: { total, passed, skipped, rate } }
}

module.exports = { evaluateGate, DEFAULTS }
