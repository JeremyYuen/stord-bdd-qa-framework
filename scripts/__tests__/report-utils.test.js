// Unit tests for the exporter's helpers: what gets published and how failures are categorised.
//   npm run test:unit
const test = require('node:test')
const assert = require('node:assert/strict')
const { makeScrubber, cleanUrl, splitError, categorize } = require('../lib/report-utils')

const scrub = makeScrubber('C:\\work\\demo')

test('scrub removes colour codes and the project folder', () => {
  assert.equal(scrub('\u001b[31mError\u001b[0m in C:\\work\\demo\\src\\a.ts'), 'Error in src\\a.ts')
  assert.equal(scrub('see C:/work/demo/src/a.ts'), 'see src/a.ts') // forward slashes too
})

test('scrub hides user names in home folders on every OS', () => {
  assert.equal(scrub('C:\\Users\\jeremy\\x'), '~\\x')
  assert.equal(scrub('/Users/jeremy/x'), '~/x')
  assert.equal(scrub('/home/runner/work/x'), '~/work/x')
})

test('scrub redacts tokens and credentials', () => {
  const out = scrub('Authorization: Bearer abcdefghij123456 and ghp_abcdefghijklmnopqrstuvwxyz0123456789 and {"password":"hunter2hunter2"} token=abc123')
  for (const secret of ['abcdefghij123456', 'ghp_abcdefghij', 'hunter2', 'abc123']) assert.ok(!out.includes(secret), `${secret} leaked: ${out}`)
  assert.match(out, /\[redacted\]/)
})

test('scrub leaves ordinary text alone', () => {
  const text = 'Expected: 404\nReceived: 200'
  assert.equal(scrub(text), text)
})

test('cleanUrl drops credentials, query and trailing slash', () => {
  assert.equal(cleanUrl('https://user:pw@www.stord.com/?key=abc#x'), 'https://www.stord.com')
  assert.equal(cleanUrl('https://api.example.com/v1/'), 'https://api.example.com/v1')
  assert.equal(cleanUrl('not a url'), 'not a url') // never throws
})

test('splitError separates the message from project stack frames only', () => {
  const raw = 'Error: boom\n    at foo (C:\\work\\demo\\src\\a.ts:1:1)\n    at bar (C:\\work\\demo\\node_modules\\x\\y.js:2:2)\n    at node:internal/process:1:1'
  const { message, stack } = splitError(raw, scrub)
  assert.equal(message, 'Error: boom')
  assert.deepEqual(stack, ['at foo (src\\a.ts:1:1)'])
})

test('splitError caps very long messages', () => {
  assert.equal(splitError('x'.repeat(5000), scrub).message.length, 1500)
})

// ---- failure categories: one realistic message per bucket, plus the rules' known limits ----
const cases = [
  ['assertion', 'failed', 'Error: expect(received).toBe(expected)\n\nExpected: 404\nReceived: 200'],
  ['element', 'failed', "expect(locator).toHaveText(expected) failed\nError: element(s) not found"],
  ['element', 'failed', 'TimeoutError: locator.click: Timeout 10000ms exceeded.'],
  ['environment', 'failed', 'Error: getaddrinfo ENOTFOUND jsonplaceholder.typicode.com'],
  ['environment', 'failed', 'page.goto: net::ERR_CONNECTION_REFUSED at https://www.stord.com'],
  ['definition', 'undefined', 'Undefined. Implement with the following snippet'],
  ['definition', 'ambiguous', 'Multiple step definitions match'],
  ['unknown', 'failed', 'something nobody planned for']
]
for (const [expected, status, message] of cases) {
  test(`categorize: ${expected} <- ${message.split('\n')[0].slice(0, 50)}`, () => assert.equal(categorize(status, message), expected))
}

test('categorize: a network error wins over an assertion (rule order is documented behaviour)', () => {
  assert.equal(categorize('failed', 'expect(received).toBe(expected) after ECONNRESET'), 'environment')
})
