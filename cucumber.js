module.exports = {
  default: {
    require: [
      "src/support/**/*.ts",
      "src/step-definitions/**/*.ts"
    ],
    format: [
      "progress-bar",
      "summary",
      "html:test-results/cucumber-report.html",
      "json:test-results/cucumber-report.json",
      "allure-cucumberjs/reporter"
    ],
    paths: ["src/features/**/*.feature"],
    requireModule: ["ts-node/register"],
    // One retry for UI scenarios only (live-site/network hiccups). Hooks report anything that needed it as FLAKY.
    retry: 1,
    retryTagFilter: "@UI",
    // Opt-in parallel workers (npm run bdd:parallel). Reports stay correct, but the console run summary
    // in hooks.ts prints once per worker with partial numbers, so it is off by default.
    parallel: Number(process.env.PARALLEL) || 0,
    timeout: 60000
  }
}
