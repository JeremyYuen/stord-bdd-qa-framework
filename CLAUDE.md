# Stord BDD Demo — QA Automation Framework

## What this project is
Demo BDD framework (Cucumber + Playwright + TypeScript) built for a Stord interview.
It tests the live Stord "Get Started" lead form (`https://www.stord.com/get-started`). API scenarios (`STD-002`) run against a public mock API (`API_BASE_URL`), since stord.com has no public API to test.

## Stack
Cucumber JS, Playwright (Chromium), TypeScript, Allure + Cucumber HTML/JSON, Slack notifications, GitHub Actions.

## Project structure
```
src/
  features/ui|api/  # Gherkin feature files
  pages/             # Page objects (LOCATORS section, then METHODS section)
  services/          # API service objects (endpoints, payloads, assertions)
  step-definitions/  # Thin Cucumber step bindings: one page-object/service call per step
  support/           # hooks.ts (browser lifecycle, API client, failure screenshot, Slack), world.ts (typed World)
  utils/             # apiClient, slackNotifier
  config/            # env.ts, timeouts.ts
```

## Environment
- `BASE_URL` defaults to `https://www.stord.com`; override in `.env` (see `.env.example`).

## Test ID convention
`@STD-<feature>.<scenario>`, plus a layer tag (`@UI` or `@API`), a severity tag (`@Smoke` or `@Regression`) and `@Complete` when finished.

## Rules
- **NEVER submit the live lead form.** It creates real leads in Stord's pipeline. Fill and validate only; page objects must not expose a submit action.
- Selectors live in page objects only, never in step definitions.
- Locator order of preference: stable id / label anchor / role. Never hashed CSS-module classes (`input-fields_*__xxxx`). Explain the choice in a comment when it isn't obvious.
- Import timeouts from `src/config/timeouts.ts`; no hardcoded milliseconds and no `waitForTimeout`.
- Use clearly fake test data (e.g. `qa.automation@example.com`). Tracking calls are blocked in `hooks.ts`.
- Honeypot (`email_confirmation*`) and tracking fields (`fbc`, `fbp`, `gclid`, `msclkid`) are never touched.
- Failure screenshots are attached to reports for UI scenarios.

## Key npm scripts
```bash
npm run typecheck            # tsc --noEmit
npm run bdd:smoke            # @Smoke
npm run bdd:regression       # @Regression
npm run bdd:ui | bdd:api     # By layer
npm run bdd:all              # Everything
npm run allure:serve         # Open Allure report
npm run bdd:smoke:slack      # Smoke + Slack notification
```
