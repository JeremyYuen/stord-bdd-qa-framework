# Stord BDD QA Framework

BDD test automation (Cucumber + Playwright + TypeScript) for the live Stord
[Get Started](https://www.stord.com/get-started) lead form, with Allure/HTML/JSON reporting,
a terminal run summary, Slack notifications and GitHub Actions CI.

> **The live form is never submitted.** It creates real leads in a sales pipeline.
> Scenarios fill and validate only, and page objects deliberately expose no submit action.
> Submit-button *state* (disabled/enabled) is asserted instead.

## Quick start

```bash
npm ci
npx playwright install chromium
npm run bdd:smoke
```

Every run ends with a summary block:

```
==================== TEST RUN SUMMARY ====================
PASSED     8
FAILED     0
SKIPPED    0
TOTAL      8
PASS RATE  100.0%
DURATION   5.8s (avg 0.7s per scenario)
SLOWEST    ...
MODE       headless | Env: https://www.stord.com
==========================================================
```

## Commands

| Command | What it runs |
| --- | --- |
| `npm run bdd:smoke` | `@Smoke` scenarios, the fast gate |
| `npm run bdd:regression` | `@Regression` scenarios |
| `npm run bdd:ui` / `bdd:api` | By layer |
| `npm run bdd:all` | Everything |
| `npm run bdd:smoke:headed` / `bdd:headed` | Visible browser, slowed to 300ms per action |
| `npm run bdd:smoke:slack` | Smoke plus Slack notification |
| `npm run allure:serve` | Open the Allure report for the last run |
| `npm run typecheck` | `tsc --noEmit` |

Copy `.env.example` to `.env` for local options (`HEADED`, `SLOW_MO`, `BASE_URL`, Slack webhooks).
CI has no `.env`, so it always runs headless.

## Project structure

```
src/
  features/ui|api/   Gherkin feature files
  pages/             Page objects: LOCATORS section, then METHODS section
  step-definitions/  Thin bindings: one page-object call per step
  support/           hooks.ts (browser lifecycle, screenshots, summary, Slack), world.ts (typed World)
  utils/             apiClient, slackNotifier
  config/            env.ts, timeouts.ts
```

## Test IDs and tags

Each scenario is tagged `@STD-<feature>.<scenario>` (for example `@STD-001.7`), plus:

| Tag | Meaning |
| --- | --- |
| `@UI` / `@API` | Layer. Decides which fixtures the hooks create |
| `@Smoke` | Fast, high-value checks; runs on every push |
| `@Regression` | Deeper coverage |
| `@Complete` | Scenario is finished (use `npm run bdd:WIP` to run only these) |

Every scenario has a one-line `# Why:` comment above it stating the business risk it guards.

## Design decisions

- **State-based assertions on a form that can't be submitted.** The submit button's enabled
  state is the observable gate on what reaches the pipeline, so the suite asserts it from
  empty, complete, one-field-missing and free-email (`gmail`/`yahoo`) starting points.
- **One field at a time.** Required-field checks are Scenario Outlines with one row per field,
  so losing validation on a single field can't hide behind a generic "an error appeared" check.
  Each has a negative twin (phone stays optional) and a recovery check (the error clears).
- **Locators.** Stable id, then label anchor, then role. Hashed CSS-module classes
  (`input-fields_*__xxxx`) are never used. Where the markup forces a workaround (the icon-only
  close button, the custom dropdowns) the page object says why in a comment.
- **Selectors only in page objects.** Step definitions never see a selector.
- **No sleeps.** All timeouts come from `src/config/timeouts.ts`; there is no `waitForTimeout`,
  only Playwright's web-first assertions.
- **Isolation.** One shared browser per run, a fresh context per UI scenario.
- **Test traffic stays out of production analytics.** Marketing tracking calls are blocked in
  `hooks.ts`, and honeypot and tracking fields (`email_confirmation*`, `fbc`, `fbp`,
  `gclid`, `msclkid`) are never touched.
- **Clearly fake data** (for example `qa.automation@example.com`).
- **Failure evidence.** UI failures attach a screenshot to the Cucumber and Allure reports,
  and (when enabled) post to Slack with the scenario, first error line and tags.

## CI

[`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) runs on push to `main`,
on pull requests, and manually (with a tag expression input, default `@Smoke`). It uploads
`test-results/` and `allure-results/` as an artifact on every run, pass or fail. Slack is
enabled only if the webhook secrets exist.

## Current scope and next steps

- **API layer is scaffolding.** `ApiClient` and the `@API` hook wiring exist, but there are
  no API scenarios yet.
- **Parallel execution and retries are off** (commented out in `cucumber.js`). Scenarios are
  already isolated by a fresh context each, so enabling parallel is a config change. Retries
  are off so a real failure is never hidden.
- **Single feature, single browser.** Chromium only, one viewport, no accessibility checks.
