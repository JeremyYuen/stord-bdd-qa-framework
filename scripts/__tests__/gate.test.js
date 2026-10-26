// Unit tests for the release checks: every rule has a pass case and a fail case.
const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluateGate } = require('../lib/gate')

const t = (id, status = 'passed', severity = 'Regression', flaky = false) => ({ id, status, severity, flaky })
const healthy = () => [t('S1', 'passed', 'Smoke'), t('R1'), t('R2')]
const reqs = (overrides = {}) => [
  { id: 'REQ-1', priority: 'High', result: 'Verified' },
  { id: 'REQ-2', priority: 'Medium', result: 'Verified' },
  ...Object.entries(overrides).map(([id, [priority, result]]) => ({ id, priority, result }))
]
const check = (gate, id) => gate.checks.find(c => c.id === id)

test('a healthy run is ready', () => {
  const g = evaluateGate(healthy(), reqs())
  assert.equal(g.ok, true)
  assert.equal(g.checks.length, 4)
})

test('pass rate below the threshold blocks, at the threshold passes', () => {
  const eight = Array.from({ length: 10 }, (_, i) => t('T' + i, i < 8 ? 'passed' : 'failed', i === 0 ? 'Smoke' : 'Regression'))
  assert.equal(check(evaluateGate(eight, reqs()), 'pass-rate').ok, true) // exactly 80%
  eight[1].status = 'failed'
  assert.equal(check(evaluateGate(eight, reqs()), 'pass-rate').ok, false) // 70%
})

test('an empty run is never ready', () => {
  const g = evaluateGate([], reqs())
  assert.equal(g.ok, false)
  assert.equal(check(g, 'every-test-ran').ok, false)
  assert.equal(check(g, 'smoke').ok, false)
})

test('skipped tests block unless maxSkipped allows them', () => {
  const tests = [...healthy(), t('K1', 'skipped')]
  assert.equal(check(evaluateGate(tests, reqs()), 'every-test-ran').ok, false)
  assert.equal(check(evaluateGate(tests, reqs(), { maxSkipped: 1 }), 'every-test-ran').ok, true)
})

test('a failed smoke test blocks even with a high pass rate', () => {
  const tests = [t('S1', 'failed', 'Smoke'), ...Array.from({ length: 30 }, (_, i) => t('R' + i))]
  const g = evaluateGate(tests, reqs())
  assert.equal(check(g, 'pass-rate').ok, true)
  assert.equal(check(g, 'smoke').ok, false)
  assert.match(check(g, 'smoke').detail, /S1/)
})

test('no smoke tests at all blocks (a missing canary is not a pass)', () => {
  assert.equal(check(evaluateGate([t('R1'), t('R2')], reqs()), 'smoke').ok, false)
})

test('a flaky smoke test does not block but is mentioned', () => {
  const g = evaluateGate([t('S1', 'passed', 'Smoke', true), t('R1')], reqs())
  assert.equal(check(g, 'smoke').ok, true)
  assert.match(check(g, 'smoke').detail, /needed a retry/)
})

test('a failed High-priority requirement blocks; a failed Medium one does not', () => {
  assert.equal(check(evaluateGate(healthy(), reqs({ 'REQ-3': ['High', 'Failed'] })), 'priority-requirements').ok, false)
  assert.equal(check(evaluateGate(healthy(), reqs({ 'REQ-3': ['Medium', 'Failed'] })), 'priority-requirements').ok, true)
})

test('an uncovered High requirement warns by default (partial runs such as smoke-only stay usable)', () => {
  const c = check(evaluateGate(healthy(), reqs({ 'REQ-3': ['High', 'No result'] })), 'priority-requirements')
  assert.equal(c.ok, true)
  assert.match(c.warn, /REQ-3/)
})

test('an uncovered High requirement blocks when blockOnUncovered is on (full-suite pipelines)', () => {
  const g = evaluateGate(healthy(), reqs({ 'REQ-3': ['High', 'No result'] }), { blockOnUncovered: true })
  assert.equal(check(g, 'priority-requirements').ok, false)
  assert.match(check(g, 'priority-requirements').detail, /REQ-3 \(no result\)/)
})

test('an empty blockOnPriorities list turns the requirement check off', () => {
  const g = evaluateGate(healthy(), reqs({ 'REQ-3': ['High', 'Failed'] }), { blockOnPriorities: [] })
  assert.equal(g.checks.length, 3)
  assert.equal(g.ok, true)
})
