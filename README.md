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
| `npm run bdd:parallel` | Everything, 3 parallel workers (opt-in) |
| `npm run allure:serve` | Open the Allure report for the last run (needs Java installed locally) |
| `npm run rtm` | Build the Requirements Traceability Matrix from the last run |
| `npm run rtm:open` | Same, then open the report (`rtm.html`) in your browser |
| `npm run dashboard:export` | Export the last run as dashboard data (`results.json`, `runs.json`, `rtm.json`); use `-- --out <folder>` |
| `npm run typecheck` | `tsc --noEmit` |

Copy `.env.example` to `.env` for local options (`HEADED`, `SLOW_MO`, `BASE_URL`, `API_BASE_URL`, Slack webhooks).
CI has no `.env`, so it always runs headless.

## Project structure

```
src/
  features/ui|api/   Gherkin feature files
  pages/             Page objects: LOCATORS section, then METHODS section
  services/          API equivalent of page objects: endpoints, payloads and assertions
  step-definitions/  Thin bindings: one page-object or service call per step
  support/           hooks.ts (browser lifecycle, screenshots, summary, Slack), world.ts (typed World)
  utils/             apiClient, apiAssertions (shared API checks), testData (builders), slackNotifier
  config/            env.ts, timeouts.ts
```

## Test IDs and tags

Each scenario is tagged `@STD-<feature>.<scenario>` (for example `@STD-001.7`), plus:

| Tag | Meaning |
| --- | --- |
| `@UI` / `@API` | Layer. Decides which fixtures the hooks create |
| `@Smoke` | Fast, high-value checks; the default CI gate |
| `@Regression` | Deeper coverage |
| `@Validation` / `@Layout` / `@Dropdowns` / `@Navigation` | Category, for slicing (e.g. `--tags "@Smoke and @Validation"`) |
| `@DataDriven` | Scenario Outlines driven by an Examples table (email domains, special characters, boundary lengths) |
| `@REQ-GS-02` etc. | Requirement ID this scenario verifies (feeds the RTM) |
| `@Contract` / `@Negative` / `@Filtering` / `@Create` | API categories |
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

## Requirements traceability (RTM) and UAT evidence

`requirements.json` holds each requirement with its **acceptance criteria**, priority and a manual **UAT
sign-off** field. Every scenario carries one or more `@REQ-<area>-<n>` tags linking it to a requirement.
`npm run rtm` joins the two with the last run's `test-results/cucumber-report.json` and writes:

| File | For |
| --- | --- |
| `test-results/rtm.html` | The readable report: open in a browser. Summary tiles and status bar, search and filters, matrix, collapsible detail per requirement, reverse index. Light and dark themes, prints cleanly |
| `test-results/rtm.md` | Same content for GitHub and VS Code |
| `test-results/rtm.csv` | One row per requirement and test case, for Excel |
| `test-results/rtm.json` | Machine-readable feed for an external dashboard |

How to read it: **requirement** (what the product must do) -> **acceptance criteria** (how we know) ->
**test cases** (automated scenarios, `STD-x.y`) -> **automated result**. Cross-references run both ways:
each requirement lists its test cases, and the test case index lists the requirements each one covers.
A requirement with no results, or a scenario with no requirement tag, shows up as a gap.

- **Automated result**: `Verified` = every linked test case passed; `Failed` = at least one failed;
  `No result` = nothing ran for it.
- **UAT sign-off** is a person accepting the result (`Pending`, `Accepted` or `Rejected`, with reviewer
  and date) recorded in `requirements.json`. Automation never sets it, so it stays `Pending` until a
  reviewer decides.

> The requirements are inferred from the form's observed behavior and labels (no Stord spec exists),
> and the catalog says so.

## Data-driven testing

Test data lives where it is easiest to read and review:

- **Examples tables** drive the `@DataDriven` outlines: free versus business email domains
  (`gmail`, `yahoo`, `hotmail` rejected; business domains accepted), special characters
  (apostrophes, accents, CJK, markup-like text), and boundary lengths (300 and 1000 characters).
- **Data tables** hold the exact expected dropdown option lists.
- **`src/utils/testData.ts`** is a builder: `validContact({ email: ... })` gives a complete, clearly
  fake contact and lets a scenario override only what it cares about.
- Only behavior the form promises is asserted. Behavior that looks like a gap is recorded as a finding.

## CI

[`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) drives Stord's live
production site, so it is deliberately **not** triggered by pushes or pull requests. It runs on
a weekday schedule and manually (with a tag expression input, default `@Smoke`). A concurrency
group stops two runs hitting the site at once. It generates the Allure report on the runner
(Java is preinstalled there) and uploads it with `test-results/` on every run, pass or fail.
Slack is enabled only if the webhook secrets exist.

**Dashboard publishing (optional).** A separate static dashboard repo (the `stord-qa-dashboard` project, served by
Vercel) shows the trend, run history, every test and the RTM. When the repository variable `DASHBOARD_REPO` and
the secret `DASHBOARD_TOKEN` (a fine-grained token with Contents read and write on that repo only) both exist, CI
runs `npm run dashboard:export` into a checkout of the dashboard repo and pushes the new run; Vercel redeploys from
there. If either is missing the step is skipped, so the pipeline never depends on it.

## Current scope and next steps

- **API layer targets a public mock API, not Stord.** stord.com has no public API that is safe
  to test, so `@API` scenarios (`STD-002.x`: contract, 404, filtering, create) run against
  `API_BASE_URL` (default `jsonplaceholder.typicode.com`). The mock never persists writes, so
  the create scenario asserts the 201 and echoed payload only. API failures attach the last
  response to the report, the counterpart of the UI screenshot.
- **Retries are on for `@UI` only** (`retry: 1`): one retry absorbs live-site and network noise. API calls are deterministic, so they never retry. A failed attempt that is retried is not counted as a failure and sends no Slack alert, and a scenario that only passed on retry is reported as **FLAKY** in the run summary, so retries cannot hide instability.
- **Parallel execution is opt-in** (`npm run bdd:parallel`, 3 workers). Scenarios are isolated, so it works, but the console summary prints once per worker with partial totals, which is why it is off by default.
- **Single feature, single browser.** Chromium only, one viewport, no accessibility checks.

## Findings from exploratory testing

Observed on the live form while building the suite. These are reported, not asserted as expected
behavior, so the suite stays green and honest:

- A whitespace-only last name is accepted (no error, submit stays enabled).
- A malformed address such as `notanemail` leaves the submit button enabled, so email format is
  not validated client-side.
- Free-email rejection (`gmail`, `yahoo`) is silent: the button stays disabled with no message.
- The icon-only close button has no accessible name (no text, `aria-label` or id).
- The dropdown required-field errors only appear on submit, so they are untested on the live site.
- The email label promises "Gmail and other free emails will not be accepted", but only `gmail`,
  `yahoo` and `hotmail` are rejected. `outlook`, `icloud`, `aol`, `proton`, `live`, `msn`,
  `gmx` and `yandex` addresses all enable the submit button.
- There is no maximum length (1000 characters are accepted) and phone takes any text, including letters.
