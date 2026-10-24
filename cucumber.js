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
    // parallel: 3,
    // retry: 1,
    timeout: 60000
  }
}
