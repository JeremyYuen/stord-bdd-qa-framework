/**
 * Requirements Traceability Matrix (RTM) with UAT evidence.
 *
 *   requirement + acceptance criteria (requirements.json)
 *        <-- @REQ-xx tag --  test case = scenario (feature files)  --> result (last run)
 *
 * Reads the Cucumber JSON report from the last run and writes, to test-results/:
 *   rtm.html  readable report (open in a browser)      rtm.md   same content, for GitHub / VS Code
 *   rtm.csv   flat sheet for Excel                      rtm.json machine-readable (dashboard feed)
 *
 * The automated result says "the acceptance criteria were verified by a test". The UAT sign-off is a
 * human decision recorded in requirements.json ("uat"); this script never sets it.
 * No dependencies beyond dotenv. Usage: `npm run bdd:all && npm run rtm`
 */
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const REPORT = path.join('test-results', 'cucumber-report.json')
const OUT_DIR = 'test-results'

if (!fs.existsSync(REPORT)) {
  console.error(`No ${REPORT} found. Run the suite first (e.g. npm run bdd:all).`)
  process.exit(1)
}

// ---------- 1. Load inputs ----------
const { requirements } = JSON.parse(fs.readFileSync('requirements.json', 'utf8'))
const features = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
const executedAt = fs.statSync(REPORT).mtime

// Scenario titles and source locations come from the feature files (the report only has the
// example-substituted name of each outline row, which is noisy to read)
const catalog = new Map() // STD id -> { title, file, line }
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.feature') ? [path.join(dir, e.name)] : [])
for (const file of walk(path.join('src', 'features'))) {
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((text, i) => {
    const m = text.match(/^\s*Scenario(?: Outline)?:\s*(.*)$/)
    const id = m && m[1].match(/STD-\d+\.\d+/)
    if (id) catalog.set(id[0], { title: m[1].replace(/^\[.*?\]\s*-\s*STD-\d+\.\d+\s*-\s*/, '').replace(/<([^>]+)>/g, '{$1}').trim(), file: file.replace(/\\/g, '/'), line: i + 1 })
  })
}

// ---------- 2. One record per executed scenario run (a retry shares an id: last attempt wins) ----------
const runs = new Map()
for (const feature of features) {
  for (const scenario of feature.elements || []) {
    if (scenario.type !== 'scenario') continue
    const results = (scenario.steps || []).map(s => s.result && s.result.status)
    const tags = (scenario.tags || []).map(t => t.name)
    runs.set(scenario.id, {
      id: (tags.find(t => /^@STD-\d+\.\d+$/.test(t)) || '').replace('@', ''),
      name: scenario.name,
      status: results.includes('failed') ? 'failed' : results.every(r => r === 'passed') ? 'passed' : 'not run',
      reqs: tags.filter(t => t.startsWith('@REQ-')).map(t => t.replace('@', '')),
      severity: tags.includes('@Smoke') ? 'Smoke' : tags.includes('@Regression') ? 'Regression' : ''
    })
  }
}

// ---------- 3. Group runs into test cases (one per scenario definition) ----------
const testCases = new Map()
for (const run of runs.values()) {
  const key = run.id || run.name
  const tc = testCases.get(key) || { id: run.id || '(untagged)', reqs: run.reqs, severity: run.severity, runs: 0, passed: 0, failed: 0, fallbackTitle: run.name }
  tc.runs++
  if (run.status === 'passed') tc.passed++
  if (run.status === 'failed') tc.failed++
  testCases.set(key, tc)
}
for (const tc of testCases.values()) {
  const meta = catalog.get(tc.id) || {}
  tc.title = meta.title || tc.fallbackTitle
  tc.source = meta.file ? `${meta.file}:${meta.line}` : ''
  tc.result = tc.failed > 0 ? 'FAIL' : tc.passed === tc.runs ? 'PASS' : 'NOT RUN'
}
const cases = [...testCases.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

// ---------- 4. Requirement rows ----------
const rows = requirements.map(req => {
  const linked = cases.filter(tc => tc.reqs.includes(req.id))
  const failed = linked.filter(tc => tc.result === 'FAIL').length
  const result = linked.length === 0 ? 'NO RESULT' : failed > 0 ? 'FAILED' : linked.every(tc => tc.result === 'PASS') ? 'VERIFIED' : 'PARTIAL'
  return { ...req, uat: req.uat || { status: 'Pending', reviewer: '', date: '' }, cases: linked, result }
})
const untraced = cases.filter(tc => tc.reqs.length === 0)

const count = (list, fn) => list.filter(fn).length
const summary = {
  requirements: rows.length,
  verified: count(rows, r => r.result === 'VERIFIED'),
  failed: count(rows, r => r.result === 'FAILED'),
  noResult: count(rows, r => r.result === 'NO RESULT'),
  uatAccepted: count(rows, r => r.uat.status === 'Accepted'),
  uatPending: count(rows, r => r.uat.status === 'Pending'),
  uatRejected: count(rows, r => r.uat.status === 'Rejected'),
  testCases: cases.length,
  scenarioRuns: runs.size,
  runsPassed: count([...runs.values()], r => r.status === 'passed'),
  runsFailed: count([...runs.values()], r => r.status === 'failed')
}
const env = {
  ui: process.env.BASE_URL || 'https://www.stord.com',
  api: process.env.API_BASE_URL || 'https://jsonplaceholder.typicode.com',
  executed: executedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

// ---------- 5. Render ----------
const label = { VERIFIED: 'Verified', FAILED: 'Failed', PARTIAL: 'Partial', 'NO RESULT': 'No result' }
const mdMark = { VERIFIED: '✅ Verified', FAILED: '❌ Failed', PARTIAL: '⚠️ Partial', 'NO RESULT': '⚠️ No result' }
const mdCase = { PASS: '✅ PASS', FAIL: '❌ FAIL', 'NOT RUN': '⚠️ NOT RUN' }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const caseList = r => r.cases.map(tc => tc.id).join(', ') || '-'
const uatText = u => u.status + (u.reviewer ? ` (${u.reviewer}${u.date ? ', ' + u.date : ''})` : '')

const md = [
  '# Requirements Traceability Matrix (UAT evidence)',
  '',
  `**Executed:** ${env.executed}  |  **UI target:** ${env.ui}  |  **API target:** ${env.api}`,
  '',
  '## How to read this',
  '- **Requirement**: what the product must do. **Acceptance criteria**: how we know it does it.',
  '- **Test case**: an automated scenario (ID `STD-x.y`) that checks the criteria. One requirement can have several, and one test case can cover several requirements.',
  '- **Automated result**: `Verified` = every linked test case passed. `Failed` = at least one failed. `No result` = nothing ran for it.',
  '- **UAT sign-off**: a person accepting the result. It stays `Pending` until a reviewer records it in `requirements.json`.',
  '',
  '## Summary',
  '',
  '| Measure | Value |',
  '| --- | --- |',
  `| Requirements | ${summary.requirements} |`,
  `| Verified by automation | ${summary.verified} of ${summary.requirements} |`,
  `| Failed | ${summary.failed} |`,
  `| No result (gap) | ${summary.noResult} |`,
  `| UAT sign-off | ${summary.uatAccepted} accepted, ${summary.uatPending} pending, ${summary.uatRejected} rejected |`,
  `| Test cases / scenario runs | ${summary.testCases} / ${summary.scenarioRuns} (${summary.runsPassed} passed, ${summary.runsFailed} failed) |`,
  `| Test cases without a requirement | ${untraced.length ? untraced.map(t => t.id).join(', ') : 'none'} |`,
  '',
  '## 1. Matrix at a glance',
  '',
  '| Requirement | Priority | Description | Test cases | Automated result | UAT sign-off |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(r => `| ${r.id} | ${r.priority || '-'} | ${r.title} | ${caseList(r)} | ${mdMark[r.result]} | ${uatText(r.uat)} |`),
  '',
  '## 2. Requirement detail',
  '',
  ...rows.flatMap(r => [
    `### ${r.id}: ${r.title}`,
    `Area: ${r.area} | Priority: ${r.priority || '-'} | Automated result: ${mdMark[r.result]} | UAT sign-off: ${uatText(r.uat)}`,
    '',
    '**Acceptance criteria**',
    ...(r.acceptanceCriteria || []).map(c => `- ${c}`),
    '',
    '| Test case | What it checks | Severity | Runs | Passed | Result | Source |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...(r.cases.length ? r.cases.map(tc => `| ${tc.id} | ${tc.title} | ${tc.severity || '-'} | ${tc.runs} | ${tc.passed} | ${mdCase[tc.result]} | ${tc.source} |`) : ['| - | No test case linked | - | 0 | 0 | ⚠️ GAP | - |']),
    ''
  ]),
  '## 3. Test case index (cross-reference back to requirements)',
  '',
  '| Test case | What it checks | Requirement(s) | Severity | Runs | Result |',
  '| --- | --- | --- | --- | --- | --- |',
  ...cases.map(tc => `| ${tc.id} | ${tc.title} | ${tc.reqs.join(', ') || '⚠️ none'} | ${tc.severity || '-'} | ${tc.passed}/${tc.runs} | ${mdCase[tc.result]} |`),
  '',
  '## 4. Sign-off',
  '',
  '| Role | Name | Date | Decision |',
  '| --- | --- | --- | --- |',
  '| QA (automation owner) |  |  |  |',
  '| Business / product reviewer |  |  |  |',
  ''
].join('\n')

const css = `
/* Stord-inspired, matching the QA dashboard: dark by default, light alternate. --brand for filled controls, --accent for links. */
:root{color-scheme:dark;--page:#000;--surface:#131313;--ink:#f2f2f2;--ink2:#c4c4c9;--muted:#8b8b93;--hair:#262626;--axis:#3a3a3a;--line:rgba(255,255,255,.28);--ring:rgba(255,255,255,.12);--wash:rgba(255,255,255,.06);--good:#0ca30c;--warn:#fab219;--crit:#d03b3b;--okText:#0ca30c;--brand:#3646f5;--onBrand:#fff;--accent:#6a77ff;--accentWash:#1e2366}
:root[data-theme="light"]{color-scheme:light;--page:#f3f3f5;--surface:#fff;--ink:#0b0b0f;--ink2:#4b4b55;--muted:#8a8a96;--hair:#e4e4ea;--axis:#c8c8d2;--line:rgba(11,11,15,.28);--ring:rgba(11,11,15,.10);--wash:rgba(11,11,15,.045);--okText:#006300;--accent:#3646f5;--accentWash:#d9ddff}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:84px}
body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:28px 16px 80px}
h1{margin:0;font-size:28px;letter-spacing:-.01em}h2{margin:40px 0 12px;font-size:20px}h3{margin:0;font-size:16px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}code{font:12.5px ui-monospace,Consolas,monospace;color:var(--ink2)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
.top{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;justify-content:space-between}
.meta{color:var(--ink2);font-size:13px;margin-top:6px}.meta span{white-space:nowrap}.meta i{color:var(--axis);font-style:normal;margin:0 8px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
button,.btn{font:inherit;font-size:13px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:6px 12px;cursor:pointer}
button:hover{background:var(--wash)}
.card{background:var(--surface);border:1px solid var(--ring);border-radius:12px}
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;margin:20px 0 4px}
.hero{grid-column:span 7;padding:20px 22px}.uat{grid-column:span 5;padding:20px 22px}.tile{grid-column:span 3;padding:14px 18px}
@media (max-width:900px){.hero,.uat{grid-column:span 12}.tile{grid-column:span 6}}
.label{color:var(--ink2);font-size:13px}.hero .big{font-size:56px;font-weight:650;line-height:1.05;letter-spacing:-.02em;margin:4px 0 2px}.hero .big small{font-size:24px;color:var(--ink2);font-weight:500}
.tile b{display:block;font-size:30px;font-weight:650;line-height:1.2;margin-top:2px}.tile .sub{color:var(--ink2);font-size:12.5px}
.meter{display:flex;gap:2px;height:30px;margin:14px 0 8px}.meter .seg{display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:600;border-radius:4px;position:relative;color:#fff;min-width:6px}
.seg.good{background:var(--good)}.seg.crit{background:var(--crit)}.seg.warn{background:var(--warn);color:#0b0b0b}
.track{display:flex;height:30px;margin:14px 0 8px;background:var(--accentWash);border-radius:4px;overflow:hidden}.track .fill{background:var(--accent);min-width:0}
[data-tip]:hover::after,[data-tip]:focus-visible::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--ink);color:var(--surface);padding:4px 9px;border-radius:6px;font-size:12px;font-weight:500;white-space:nowrap;z-index:5;pointer-events:none}
.legend{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--ink2);font-size:13px}.legend span{display:inline-flex;align-items:center;gap:6px}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.d-good{background:var(--good)}.d-crit{background:var(--crit)}.d-warn{background:var(--warn)}.d-none{background:var(--surface);border:2px solid var(--muted)}
.toolbar{position:sticky;top:0;z-index:10;background:var(--page);padding:12px 0;margin-top:28px;border-bottom:1px solid var(--hair);display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.toolbar input[type=search]{font:inherit;font-size:14px;color:var(--ink);background:var(--surface);border:1px solid var(--ring);border-radius:8px;padding:7px 12px;min-width:240px;flex:1 1 240px;max-width:360px}
.chips{display:flex;gap:6px;flex-wrap:wrap}.chip{border-radius:99px;padding:5px 12px}.chip[aria-pressed=true]{background:var(--brand);color:var(--onBrand);border-color:var(--brand)}
.count{color:var(--ink2);font-size:13px;margin-left:auto}
.wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--ring);border-radius:12px;overflow:hidden}
th,td{padding:10px 12px;border-bottom:1px solid var(--hair);text-align:left;vertical-align:top;font-size:14px}
th{background:var(--wash);color:var(--ink2);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}tr:last-child td{border-bottom:0}
tbody tr[data-req]{cursor:pointer}tbody tr:hover td{background:var(--wash)}td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.pill{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:99px;font-size:12.5px;font-weight:600;white-space:nowrap;border:1px solid var(--ring);background:var(--surface)}
.ic{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;flex:none}
.ic-good{background:var(--good)}.ic-crit{background:var(--crit)}.ic-warn{background:var(--warn);color:#0b0b0b}.ic-none{background:transparent;border:2px solid var(--muted)}
.pri{font-size:12px;color:var(--ink2)}.pri-High{font-weight:700;color:var(--ink)}
details.req{background:var(--surface);border:1px solid var(--ring);border-radius:12px;margin:10px 0;overflow:hidden}
details.req>summary{list-style:none;cursor:pointer;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:14px 18px}
details.req>summary>.rid{min-width:86px}details.req>summary>.head{flex:1 1 320px;min-width:0}
details.req>summary::-webkit-details-marker{display:none}
details.req>summary::before{content:"\\25B8";color:var(--muted);transition:transform .15s}details.req[open]>summary::before{transform:rotate(90deg)}
details.req .rid{font-weight:700}.ttl{font-weight:600}.badges{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-left:auto}
.body{padding:0 18px 18px 18px;border-top:1px solid var(--hair)}.body h4{margin:14px 0 4px;font-size:13px;color:var(--ink2);text-transform:uppercase;letter-spacing:.04em}
.crit-list{margin:4px 0 8px;padding:0;list-style:none}.crit-list li{display:flex;gap:8px;padding:2px 0}.crit-list li::before{content:"\\2022";color:var(--muted);font-weight:700}.crit-list.verified li::before{content:"\\2713";color:var(--okText)}
.rowmeta{color:var(--ink2);font-size:13px}
.empty{padding:28px;text-align:center;color:var(--ink2);border:1px dashed var(--axis);border-radius:12px;margin:12px 0}
details.how{margin-top:16px}details.how summary{cursor:pointer;color:var(--ink2);font-size:13px}.how ul{margin:8px 0 0 18px;padding:0;color:var(--ink2);font-size:13.5px}
.sign td{height:44px}footer{margin-top:40px;color:var(--ink2);font-size:12.5px}
[hidden]{display:none!important}
.top>div{min-width:0}
@media (max-width:600px){h1{font-size:22px;overflow-wrap:anywhere}.meta span{white-space:normal}.hero .big{font-size:44px}.count{margin-left:0;width:100%}
details.req>summary .badges{justify-content:flex-start;margin-left:0}main{padding-top:20px}}
@media print{:root{--page:#fff;--surface:#fff;--ink:#0b0b0f;--ink2:#4b4b55;--muted:#8a8a96;--hair:#e4e4ea;--ring:rgba(11,11,15,.10);--wash:rgba(11,11,15,.045);--okText:#006300;--accent:#3646f5}body{background:#fff}.toolbar,.actions{display:none}details.req{break-inside:avoid}tbody tr[data-req]{cursor:auto}}
`

const tag = { VERIFIED: ['good', '✓', 'Verified'], FAILED: ['crit', '✕', 'Failed'], PARTIAL: ['warn', '!', 'Partial'], 'NO RESULT': ['warn', '!', 'No result'] }
const tcTag = { PASS: ['good', '✓', 'Pass'], FAIL: ['crit', '✕', 'Fail'], 'NOT RUN': ['warn', '!', 'Not run'] }
const uatTag = { Accepted: ['good', '✓', 'UAT accepted'], Rejected: ['crit', '✕', 'UAT rejected'], Pending: ['none', '', 'UAT pending'] }
// Status = colored dot + icon + label (never color alone); the text itself stays in ink
const pill = ([kind, icon, text], title) => `<span class="pill"${title ? ` title="${esc(title)}"` : ''}><span class="ic ic-${kind}" aria-hidden="true">${icon}</span>${esc(text)}</span>`
const reqPill = r => pill(tag[r.result])
const uatPill = u => pill(uatTag[u.status] || uatTag.Pending, u.reviewer ? `${u.reviewer} ${u.date || ''}` : 'Awaiting a business reviewer')
const tcLinks = r => r.cases.length ? r.cases.map(tc => `<a href="#tc-${esc(tc.id)}">${esc(tc.id)}</a>`).join(', ') : '<span class="rowmeta">none</span>'

const pct = n => (summary.requirements ? (n / summary.requirements) * 100 : 0)
const seg = (kind, n, name) => n > 0
  ? `<div class="seg ${kind}" style="flex:${n}" tabindex="0" role="img" aria-label="${n} ${name}" data-tip="${n} of ${summary.requirements} ${name}">${pct(n) >= 18 ? n + ' ' + name : ''}</div>`
  : ''
const meter = `<div class="meter" role="group" aria-label="Requirement results">${seg('good', summary.verified, 'verified')}${seg('crit', summary.failed, 'failed')}${seg('warn', summary.noResult + (summary.requirements - summary.verified - summary.failed - summary.noResult), 'no result')}</div>`
const uatPct = pct(summary.uatAccepted)
const passRate = summary.scenarioRuns ? Math.round((summary.runsPassed / summary.scenarioRuns) * 100) : 0
const areas = [...new Set(rows.map(r => r.area))]
const rowText = r => `${r.id} ${r.title} ${r.area} ${r.priority || ''} ${r.cases.map(t => t.id + ' ' + t.title).join(' ')} ${(r.acceptanceCriteria || []).join(' ')}`.toLowerCase()
const statusKey = r => ({ VERIFIED: 'verified', FAILED: 'failed', PARTIAL: 'noresult', 'NO RESULT': 'noresult' })[r.result]

const script = `
(function () {
  var root = document.documentElement;
  try { var saved = localStorage.getItem('rtm-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}
  document.getElementById('theme').addEventListener('click', function () {
    var dark = matchMedia('(prefers-color-scheme: dark)').matches;
    var cur = root.getAttribute('data-theme') || 'dark';
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('rtm-theme', next); } catch (e) {}
  });
  var state = { status: 'all', area: 'all', q: '' };
  var reqEls = [].slice.call(document.querySelectorAll('[data-req]'));
  var tcEls = [].slice.call(document.querySelectorAll('[data-tc]'));
  var count = document.getElementById('count'), empty = document.getElementById('empty');
  function apply() {
    var shown = 0, seen = {};
    reqEls.forEach(function (el) {
      var ok = (state.status === 'all' || el.dataset.status === state.status) &&
               (state.area === 'all' || el.dataset.area === state.area) &&
               (!state.q || el.dataset.text.indexOf(state.q) > -1);
      el.hidden = !ok;
      if (ok && !seen[el.dataset.req]) { seen[el.dataset.req] = 1; shown++; }
    });
    tcEls.forEach(function (el) { el.hidden = !!state.q && el.dataset.text.indexOf(state.q) < 0; });
    count.textContent = 'Showing ' + shown + ' of ' + document.querySelectorAll('tbody tr[data-req]').length + ' requirements';
    empty.hidden = shown !== 0;
  }
  [].forEach.call(document.querySelectorAll('.chip'), function (b) {
    b.addEventListener('click', function () {
      var group = b.dataset.group;
      [].forEach.call(document.querySelectorAll('.chip[data-group="' + group + '"]'), function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      state[group] = b.dataset.value; apply();
    });
  });
  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value.trim().toLowerCase(); apply(); });
  document.getElementById('reset').addEventListener('click', function () {
    state = { status: 'all', area: 'all', q: '' }; document.getElementById('q').value = '';
    [].forEach.call(document.querySelectorAll('.chip'), function (b) { b.setAttribute('aria-pressed', b.dataset.value === 'all' ? 'true' : 'false'); });
    apply();
  });
  var cards = [].slice.call(document.querySelectorAll('details.req'));
  document.getElementById('expand').addEventListener('click', function () { cards.forEach(function (c) { c.open = true; }); });
  document.getElementById('collapse').addEventListener('click', function () { cards.forEach(function (c) { c.open = false; }); });
  [].forEach.call(document.querySelectorAll('tbody tr[data-req]'), function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      var card = document.getElementById(row.dataset.req);
      if (card) { card.open = true; card.scrollIntoView({ block: 'start' }); }
    });
  });
  window.addEventListener('beforeprint', function () { cards.forEach(function (c) { c.open = true; }); });
  apply();
})();
`

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RTM - UAT Evidence</title><style>${css}</style></head><body><main>

<div class="top">
  <div>
    <h1>Requirements Traceability Matrix</h1>
    <div class="meta"><span>UAT evidence</span><i>|</i><span>Executed ${esc(env.executed)}</span><i>|</i><span>UI ${esc(env.ui)}</span><i>|</i><span>API ${esc(env.api)}</span></div>
  </div>
  <div class="actions">
    <button id="expand" type="button">Expand all</button><button id="collapse" type="button">Collapse all</button>
    <button id="theme" type="button" aria-label="Toggle light and dark theme">Theme</button><button type="button" onclick="window.print()">Print</button>
  </div>
</div>

<details class="how"><summary>How to read this</summary><ul>
<li><b>Requirement</b>: what the product must do. <b>Acceptance criteria</b>: how we know it does.</li>
<li><b>Test case</b>: an automated scenario (<code>STD-x.y</code>). A requirement can have several; one test case can cover several requirements.</li>
<li><b>Automated result</b>: Verified = every linked test case passed. Failed = at least one failed. No result = nothing ran for it.</li>
<li><b>UAT sign-off</b>: a person accepting the result. It stays Pending until a reviewer records it in <code>requirements.json</code>.</li></ul></details>

<section class="grid" aria-label="Summary">
  <div class="card hero">
    <div class="label">Requirements verified by automation</div>
    <div class="big">${summary.verified}<small> of ${summary.requirements}</small></div>
    ${meter}
    <div class="legend">
      <span><i class="dot d-good"></i>${summary.verified} verified</span>
      <span><i class="dot d-crit"></i>${summary.failed} failed</span>
      <span><i class="dot d-warn"></i>${summary.requirements - summary.verified - summary.failed} no result</span>
    </div>
  </div>
  <div class="card uat">
    <div class="label">UAT sign-off</div>
    <div class="big" style="font-size:40px;font-weight:650;line-height:1.1;margin:4px 0 2px">${summary.uatAccepted}<small style="font-size:20px;color:var(--ink2);font-weight:500"> of ${summary.requirements} accepted</small></div>
    <div class="track" role="img" aria-label="${summary.uatAccepted} of ${summary.requirements} accepted">${uatPct > 0 ? `<div class="fill" style="width:${uatPct}%"></div>` : ''}</div>
    <div class="legend"><span><i class="dot d-none"></i>${summary.uatPending} pending</span><span><i class="dot d-crit"></i>${summary.uatRejected} rejected</span></div>
  </div>
  <div class="card tile"><div class="label">Test cases</div><b>${summary.testCases}</b><div class="sub">${summary.scenarioRuns} scenario runs</div></div>
  <div class="card tile"><div class="label">Run pass rate</div><b>${passRate}%</b><div class="sub">${summary.runsPassed} of ${summary.scenarioRuns} runs passed</div></div>
  <div class="card tile"><div class="label">Coverage gaps</div><b>${summary.noResult}</b><div class="sub">requirements with no result</div></div>
  <div class="card tile"><div class="label">Untraced tests</div><b>${untraced.length}</b><div class="sub">tests with no requirement tag</div></div>
</section>

<div class="toolbar" role="search">
  <input id="q" type="search" placeholder="Search requirements or tests" aria-label="Search">
  <div class="chips" role="group" aria-label="Filter by result">
    <button class="chip" data-group="status" data-value="all" aria-pressed="true" type="button">All ${rows.length}</button>
    <button class="chip" data-group="status" data-value="verified" aria-pressed="false" type="button">Verified ${summary.verified}</button>
    <button class="chip" data-group="status" data-value="failed" aria-pressed="false" type="button">Failed ${summary.failed}</button>
    <button class="chip" data-group="status" data-value="noresult" aria-pressed="false" type="button">No result ${rows.length - summary.verified - summary.failed}</button>
  </div>
  <div class="chips" role="group" aria-label="Filter by area">
    <button class="chip" data-group="area" data-value="all" aria-pressed="true" type="button">All areas</button>
    ${areas.map(a => `<button class="chip" data-group="area" data-value="${esc(a)}" aria-pressed="false" type="button">${esc(a)}</button>`).join('\n    ')}
  </div>
  <button id="reset" type="button">Reset</button>
  <span class="count" id="count" aria-live="polite"></span>
</div>
<div class="empty" id="empty" hidden>No requirements match these filters.</div>

<h2>1. Matrix at a glance</h2>
<div class="wrap"><table>
<thead><tr><th>Requirement</th><th>Priority</th><th>Description</th><th>Test cases</th><th>Automated result</th><th>UAT sign-off</th></tr></thead>
<tbody>
${rows.map(r => `<tr data-req="${esc(r.id)}" data-status="${statusKey(r)}" data-area="${esc(r.area)}" data-text="${esc(rowText(r))}"><td><b>${esc(r.id)}</b></td><td><span class="pri pri-${esc(r.priority || '')}">${esc(r.priority || '-')}</span></td><td>${esc(r.title)}</td><td>${tcLinks(r)}</td><td>${reqPill(r)}</td><td>${uatPill(r.uat)}</td></tr>`).join('\n')}
</tbody></table></div>

<h2>2. Requirement detail</h2>
${rows.map(r => {
  const runs = r.cases.reduce((a, t) => a + t.runs, 0)
  const passed = r.cases.reduce((a, t) => a + t.passed, 0)
  return `<details class="req" id="${esc(r.id)}" data-req="${esc(r.id)}" data-status="${statusKey(r)}" data-area="${esc(r.area)}" data-text="${esc(rowText(r))}"${r.result === 'FAILED' ? ' open' : ''}>
<summary><span class="rid">${esc(r.id)}</span><span class="head"><span class="ttl">${esc(r.title)}</span><br><span class="rowmeta">${esc(r.area)} | Priority ${esc(r.priority || '-')} | ${r.cases.length} test case${r.cases.length === 1 ? '' : 's'}, ${passed}/${runs} runs passed</span></span><span class="badges">${reqPill(r)}${uatPill(r.uat)}</span></summary>
<div class="body">
<h4>Acceptance criteria</h4>
<ul class="crit-list${r.result === 'VERIFIED' ? ' verified' : ''}">${(r.acceptanceCriteria || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul>
<h4>Test cases</h4>
<div class="wrap"><table><thead><tr><th>Test case</th><th>What it checks</th><th>Severity</th><th>Runs passed</th><th>Result</th><th>Source</th></tr></thead><tbody>
${r.cases.length ? r.cases.map(tc => `<tr><td><a href="#tc-${esc(tc.id)}"><b>${esc(tc.id)}</b></a></td><td>${esc(tc.title)}</td><td>${esc(tc.severity || '-')}</td><td class="num">${tc.passed}/${tc.runs}</td><td>${pill(tcTag[tc.result])}</td><td><code>${esc(tc.source)}</code></td></tr>`).join('') : `<tr><td colspan="6">${pill(['warn', '!', 'Gap: no test case linked'])}</td></tr>`}
</tbody></table></div>
</div></details>`
}).join('\n')}

<h2>3. Test case index <span class="rowmeta">(cross-reference back to requirements)</span></h2>
<div class="wrap"><table>
<thead><tr><th>Test case</th><th>What it checks</th><th>Requirement(s)</th><th>Severity</th><th>Runs passed</th><th>Result</th></tr></thead><tbody>
${cases.map(tc => `<tr id="tc-${esc(tc.id)}" data-tc="${esc(tc.id)}" data-text="${esc((tc.id + ' ' + tc.title + ' ' + tc.reqs.map(q => q + ' ' + ((rows.find(r => r.id === q) || {}).title || '')).join(' ')).toLowerCase())}"><td><b>${esc(tc.id)}</b></td><td>${esc(tc.title)}</td><td>${tc.reqs.length ? tc.reqs.map(q => `<a href="#${esc(q)}">${esc(q)}</a>`).join(', ') : pill(['warn', '!', 'none'])}</td><td>${esc(tc.severity || '-')}</td><td class="num">${tc.passed}/${tc.runs}</td><td>${pill(tcTag[tc.result])}</td></tr>`).join('\n')}
</tbody></table></div>

<h2>4. Sign-off</h2>
<div class="wrap"><table class="sign"><thead><tr><th>Role</th><th>Name</th><th>Date</th><th>Decision</th></tr></thead><tbody>
<tr><td>QA (automation owner)</td><td></td><td></td><td></td></tr>
<tr><td>Business / product reviewer</td><td></td><td></td><td></td></tr></tbody></table></div>

<footer>Generated ${esc(new Date().toISOString().replace('T', ' ').slice(0, 19))} UTC from <code>${esc(REPORT.replace(/\\/g, '/'))}</code> and <code>requirements.json</code>. Requirements are inferred from observed behavior; UAT sign-off is a manual decision.</footer>
</main><script>${script}</script></body></html>`

const csvCell = v => `"${String(v).replace(/"/g, '""')}"`
const csv = [
  ['requirement', 'priority', 'requirement_description', 'acceptance_criteria', 'test_case', 'test_case_title', 'severity', 'runs', 'passed', 'failed', 'test_case_result', 'automated_result', 'uat_status', 'uat_reviewer', 'uat_date', 'source'].join(','),
  ...rows.flatMap(r => (r.cases.length ? r.cases : [null]).map(tc => [
    r.id, r.priority || '', r.title, (r.acceptanceCriteria || []).join(' | '),
    tc ? tc.id : '', tc ? tc.title : 'NO TEST CASE', tc ? tc.severity : '', tc ? tc.runs : 0, tc ? tc.passed : 0, tc ? tc.failed : 0, tc ? tc.result : 'NO RESULT',
    label[r.result], r.uat.status, r.uat.reviewer, r.uat.date, tc ? tc.source : ''
  ].map(csvCell).join(',')))
].join('\n')

const json = { generatedAt: new Date().toISOString(), executedAt: executedAt.toISOString(), environment: env, summary, requirements: rows.map(r => ({ ...r, result: label[r.result], cases: r.cases.map(tc => tc.id) })), testCases: cases, untraced: untraced.map(t => t.id) }

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'rtm.md'), md)
fs.writeFileSync(path.join(OUT_DIR, 'rtm.html'), html)
fs.writeFileSync(path.join(OUT_DIR, 'rtm.csv'), csv)
fs.writeFileSync(path.join(OUT_DIR, 'rtm.json'), JSON.stringify(json, null, 2))

console.log(`RTM: ${summary.verified}/${summary.requirements} requirements verified, ${summary.failed} failed, ${summary.noResult} with no result | ${summary.testCases} test cases, ${summary.runsPassed}/${summary.scenarioRuns} runs passed | UAT: ${summary.uatAccepted} accepted, ${summary.uatPending} pending`)
console.log(`Wrote ${OUT_DIR}/rtm.html, rtm.md, rtm.csv, rtm.json`)
// `npm run rtm:open` passes --open: show the report in the default browser (never used in CI)
if (process.argv.includes('--open')) {
  const file = path.resolve(OUT_DIR, 'rtm.html')
  const opener = process.platform === 'win32' ? `start "" "${file}"` : process.platform === 'darwin' ? `open "${file}"` : `xdg-open "${file}"`
  require('child_process').exec(opener, err => { if (err) console.error(`Could not open the browser. Open ${file} manually.`) })
}
if (summary.failed > 0) process.exitCode = 1
