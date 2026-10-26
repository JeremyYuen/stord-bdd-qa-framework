import AxeBuilder from '@axe-core/playwright'
import { Page } from '@playwright/test'

// Accessibility scan with a baseline. We test a live site we do not own, so "zero violations" would fail on
// day one. Instead: every issue found by the exploratory scan is listed here with a reason. The scenario fails
// when a NEW rule appears or a known rule affects MORE elements. Fixing an issue never fails it; the scenario
// output says when a limit can be lowered.
export const KNOWN_ISSUES: Record<string, { max: number; why: string }> = {
  'button-name': { max: 1, why: 'The close (X) button in the form header has no accessible name (WCAG 4.1.2)' },
  'color-contrast': { max: 2, why: 'The "Make a Selection" placeholder is too light on the dark form (WCAG 1.4.3)' },
  'meta-viewport': { max: 1, why: 'The viewport meta tag disables pinch-zoom with user-scalable=no (WCAG 1.4.4)' }
}

// Not part of what a visitor uses, so not scanned:
//  - the cookie-consent widget is third-party (OneTrust)
//  - the tracking inputs (fbc, fbp, gclid, msclkid) are hidden and filled by scripts, never by the visitor
export const EXCLUDED_FROM_SCAN = ['#onetrust-consent-sdk', '#onetrust-banner-sdk', '#fbc', '#fbp', '#gclid', '#msclkid']

export interface A11yResult {
  newIssues: string[] // not in the baseline, or worse than the baseline: these fail the scenario
  known: string[]     // in the baseline and within its limit
  fixed: string[]     // in the baseline but no longer found: lower or remove the limit
}

// Pure comparison, kept apart from the browser so it can be unit tested
export function compareWithBaseline(found: Record<string, number>): A11yResult {
  const result: A11yResult = { newIssues: [], known: [], fixed: [] }
  for (const [rule, count] of Object.entries(found)) {
    const known = KNOWN_ISSUES[rule]
    if (!known) result.newIssues.push(`${rule}: ${count} element(s), not in the known-issues list`)
    else if (count > known.max) result.newIssues.push(`${rule}: ${count} element(s), more than the ${known.max} known (${known.why})`)
    else result.known.push(`${rule}: ${count} of ${known.max} known - ${known.why}`)
  }
  for (const [rule, known] of Object.entries(KNOWN_ISSUES)) {
    if (!(rule in found)) result.fixed.push(`${rule}: no longer found, remove it from KNOWN_ISSUES (${known.why})`)
  }
  return result
}

export async function scanAccessibility(page: Page): Promise<A11yResult> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  for (const selector of EXCLUDED_FROM_SCAN) builder = builder.exclude(selector)
  const scan = await builder.analyze()
  const found: Record<string, number> = {}
  for (const violation of scan.violations) found[violation.id] = violation.nodes.length
  return compareWithBaseline(found)
}
