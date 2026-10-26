// The baseline comparison used by the accessibility scenario (the scan itself needs a browser; this part does not).
// Compiled on the fly: ts-node is already a dependency of the BDD run.
require('ts-node/register/transpile-only')
const test = require('node:test')
const assert = require('node:assert/strict')
const { compareWithBaseline, KNOWN_ISSUES } = require('../../src/utils/accessibility')

test('known issues within their limit are reported as known, not new', () => {
  const r = compareWithBaseline({ 'button-name': 1, 'meta-viewport': 1, 'color-contrast': 1 })
  assert.deepEqual(r.newIssues, [])
  assert.equal(r.known.length, 3)
})

test('a rule that is not in the baseline is new', () => {
  const r = compareWithBaseline({ 'image-alt': 2 })
  assert.equal(r.newIssues.length, 1)
  assert.match(r.newIssues[0], /image-alt/)
})

test('a known rule hitting more elements than recorded is new', () => {
  const r = compareWithBaseline({ 'button-name': KNOWN_ISSUES['button-name'].max + 1 })
  assert.equal(r.newIssues.length, 1)
  assert.match(r.newIssues[0], /more than/)
})

test('a fixed issue is reported so the limit can be removed, and never fails the scenario', () => {
  const r = compareWithBaseline({})
  assert.deepEqual(r.newIssues, [])
  assert.equal(r.fixed.length, Object.keys(KNOWN_ISSUES).length)
})
