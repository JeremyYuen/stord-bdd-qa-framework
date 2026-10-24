import { IncomingWebhook } from '@slack/webhook'
import { BASE_URL } from '../config/env'

/**
 * Two channels: per-scenario failures (SLACK_WEBHOOK_FAILURES) and a run summary
 * (SLACK_WEBHOOK_REGRESSION). Hooks only call this when SLACK_NOTIFY=true.
 */
export class SlackNotifier {
  private failures = process.env.SLACK_WEBHOOK_FAILURES
    ? new IncomingWebhook(process.env.SLACK_WEBHOOK_FAILURES)
    : undefined
  private summary = process.env.SLACK_WEBHOOK_REGRESSION
    ? new IncomingWebhook(process.env.SLACK_WEBHOOK_REGRESSION)
    : undefined

  async sendFailureNotification(scenario: string, errorMessage: string, tags: string[]) {
    // First line only: keeps the alert readable and drops long stack traces
    const mainError = errorMessage.split('\n').find(line => line.trim()) || 'Unknown error'
    await this.send(this.failures, {
      text: `:x: *Test failed:* ${scenario}\n*Error:* ${mainError}\n*Env:* ${BASE_URL}\n*Tags:* ${tags.join(' ')}`
    })
  }

  async sendTestSummary(passed: number, failed: number, durationMs: number, suite = 'Full Suite') {
    const total = passed + failed
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0'
    await this.send(this.summary, {
      text: `${failed === 0 ? ':white_check_mark:' : ':warning:'} *${suite}*: ${passed}/${total} passed (${passRate}%) in ${Math.round(durationMs / 1000)}s on ${BASE_URL}`
    })
  }

  // A Slack outage must never fail the test run
  private async send(webhook: IncomingWebhook | undefined, message: { text: string }) {
    if (!webhook) return
    try {
      await webhook.send(message)
    } catch (error) {
      console.error('Slack notification failed:', (error as Error).message)
    }
  }
}
