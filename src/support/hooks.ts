import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber'
import { chromium, Browser } from '@playwright/test'
import { CustomWorld } from './world'
import { SlackNotifier } from '../utils/slackNotifier'
import { ApiClient } from '../utils/apiClient'
import { BASE_URL, HEADED, SLOW_MO } from '../config/env'
import { TIMEOUTS } from '../config/timeouts'

setDefaultTimeout(TIMEOUTS.SCENARIO)

let browser: Browser
const slackNotifier = new SlackNotifier()
const stats = {
  passed: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now(),
  failedScenarios: [] as string[],
  slowest: { name: '', ms: 0 }
}

const slackEnabled = () => process.env.SLACK_NOTIFY === 'true'

const formatDuration = (ms: number) => `${(ms / 1000).toFixed(1)}s`

// Once per run: launch one shared browser
BeforeAll(async function () {
  browser = await chromium.launch({ headless: !HEADED, slowMo: SLOW_MO })
  stats.startTime = Date.now()
  console.log(`\nRun started | Mode: ${HEADED ? 'headed' : 'headless'} | Browser: Chromium ${browser.version()} | Env: ${BASE_URL}${SLOW_MO ? ` | SlowMo: ${SLOW_MO}ms` : ''}\n`)
})

// UI scenarios only: a fresh, isolated browser context per scenario
Before({ tags: '@UI' }, async function (this: CustomWorld) {
  // Tall viewport: some pages (e.g. the Stord lead form) are fixed overlays that can't scroll,
  // so controls below the default 720px fold would be unclickable
  this.context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 1400 } })
  // Keep test traffic out of the site's marketing analytics (typed test data would be "identified")
  await this.context.route(/unifyintent\.com|px\.ads\.linkedin\.com/, route => route.abort())
  this.page = await this.context.newPage()
})

// API scenarios only: a request context bound to the base URL
Before({ tags: '@API' }, async function (this: CustomWorld) {
  this.api = await ApiClient.create()
})

After(async function (this: CustomWorld, scenario) {
  const status = scenario.result?.status

  if (status === 'PASSED') stats.passed++
  if (status === 'SKIPPED' || status === 'PENDING' || status === 'UNDEFINED') stats.skipped++

  // Timed here: result.duration isn't final yet while the After hook is still running
  const scenarioMs = Date.now() - this.startTime
  if (scenarioMs > stats.slowest.ms) stats.slowest = { name: scenario.pickle.name, ms: scenarioMs }

  if (status === 'FAILED') {
    stats.failed++
    stats.failedScenarios.push(scenario.pickle.name)
    if (this.page) this.attach(await this.page.screenshot(), 'image/png')
    if (slackEnabled()) {
      await slackNotifier.sendFailureNotification(
        scenario.pickle.name,
        scenario.result?.message || '',
        scenario.pickle.tags.map(t => t.name)
      )
    }
  }

  await this.page?.close()
  await this.context?.close()
  await this.api?.dispose()
})

AfterAll(async function () {
  await browser?.close()

  const total = stats.passed + stats.failed + stats.skipped
  const elapsed = Date.now() - stats.startTime
  const passRate = total > 0 ? ((stats.passed / total) * 100).toFixed(1) : '0.0'
  const lines = [
    '',
    '==================== TEST RUN SUMMARY ====================',
    `PASSED     ${stats.passed}`,
    `FAILED     ${stats.failed}`,
    `SKIPPED    ${stats.skipped}`,
    `TOTAL      ${total}`,
    `PASS RATE  ${passRate}%`,
    `DURATION   ${formatDuration(elapsed)} (avg ${total > 0 ? formatDuration(elapsed / total) : '0.0s'} per scenario)`,
    `SLOWEST    ${stats.slowest.name ? `${formatDuration(stats.slowest.ms)} - ${stats.slowest.name}` : 'n/a'}`,
    `MODE       ${HEADED ? 'headed' : 'headless'} | Env: ${BASE_URL}`,
    ...(stats.failedScenarios.length ? ['FAILED SCENARIOS:', ...stats.failedScenarios.map(name => `  - ${name}`)] : []),
    '==========================================================',
    ''
  ]
  console.log(lines.join('\n'))

  if (slackEnabled()) {
    await slackNotifier.sendTestSummary(stats.passed, stats.failed, Date.now() - stats.startTime, process.env.TEST_SUITE)
  }
})
