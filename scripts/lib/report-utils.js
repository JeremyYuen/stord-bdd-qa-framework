/**
 * Helpers shared by the dashboard exporter and its unit tests (scripts/__tests__).
 * Plain functions, no file or network access, so they are easy to test.
 */

// ---------- cleaning text that will be published on a web page ----------
const ANSI = /\u001b\[[0-9;]*m/g
// Home folders and credentials must never be published with the results
const HOME_PATHS = [/[A-Za-z]:[\\/]Users[\\/][^\\/\s]+/gi, /\/Users\/[^/\s]+/g, /\/home\/[^/\s]+/g]
const SECRETS = [
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /(authorization|x-api-key|api[_-]?key|token|password)(["']?\s*[:=]\s*["']?)[^\s"',}]+/gi
]

// root: the project folder, removed first so paths read relative ("src/pages/X.ts")
function makeScrubber(root = process.cwd()) {
  const rootPattern = new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\\/g, '[\\\\/]') + '[\\\\/]?', 'gi')
  return text => {
    let out = String(text || '').replace(ANSI, '').replace(rootPattern, '')
    HOME_PATHS.forEach(re => { out = out.replace(re, '~') })
    SECRETS.forEach((re, i) => { out = out.replace(re, i === 2 ? '$1$2[redacted]' : '[redacted]') })
    return out
  }
}

// A BASE_URL with credentials or a query string must not be published
function cleanUrl(value) {
  try {
    const u = new URL(value)
    u.username = ''; u.password = ''; u.search = ''; u.hash = ''
    return u.href.replace(/\/$/, '')
  } catch (e) {
    return value
  }
}

// ---------- failures ----------
function splitError(raw, scrub) {
  const text = scrub(raw)
  const at = text.search(/\n\s+at /)
  const message = (at > -1 ? text.slice(0, at) : text).trim().slice(0, 1500)
  const frames = at > -1
    ? text.slice(at).split('\n').map(l => l.trim()).filter(l => l.startsWith('at ') && !l.includes('node_modules') && !l.includes('node:internal'))
    : []
  return { message, stack: frames.slice(0, 8) }
}

// Heuristic, like Allure's categories.json: first matching rule wins. It routes triage; it never feeds the release gate.
const CATEGORY_RULES = [
  ['environment', /ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|net::ERR|socket hang up|fetch failed|getaddrinfo/i],
  ['element', /element\(s\) not found|Timeout \d+ms exceeded|waiting for (locator|selector)|strict mode violation|not visible|detached from/i],
  ['assertion', /expect\(|AssertionError|Expected:[\s\S]*Received:/i]
]
function categorize(status, message) {
  if (status === 'undefined' || status === 'pending' || status === 'ambiguous') return 'definition'
  const hit = CATEGORY_RULES.find(([, re]) => re.test(message))
  return hit ? hit[0] : 'unknown'
}

module.exports = { makeScrubber, cleanUrl, splitError, categorize }
