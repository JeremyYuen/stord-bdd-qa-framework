import { Given, When, Then } from '@cucumber/cucumber'
import { CustomWorld } from '../support/world'
import { GetStartedPage } from '../pages/GetStartedPage'

// Steps stay thin: they only call page object methods, so selectors and waits live in one place.

Given('I am on the Get Started page', async function (this: CustomWorld) {
  await new GetStartedPage(this.page).openGetStartedPage()
})

When('I leave the {string} field empty', async function (this: CustomWorld, field: string) {
  await new GetStartedPage(this.page).leaveFieldEmpty(field)
})

When('I fill the {string} field with {string}', async function (this: CustomWorld, field: string, value: string) {
  await new GetStartedPage(this.page).fillField(field, value)
})

When(
  'I fill in the contact details for {string} {string} at {string} with email {string}',
  async function (this: CustomWorld, first: string, last: string, company: string, email: string) {
    await new GetStartedPage(this.page).fillContactDetails(first, last, company, email)
  }
)

When('I select the country {string}', async function (this: CustomWorld, country: string) {
  await new GetStartedPage(this.page).selectCountry(country)
})

When('I select the service {string}', async function (this: CustomWorld, service: string) {
  await new GetStartedPage(this.page).selectService(service)
})

When('I select the monthly order volume {string}', async function (this: CustomWorld, volume: string) {
  await new GetStartedPage(this.page).selectMonthlyOrderVolume(volume)
})

Then('I should see all the form fields and the submit button', async function (this: CustomWorld) {
  await new GetStartedPage(this.page).validateFormFieldsDisplayed()
})

Then('the fields should show their placeholder text', async function (this: CustomWorld) {
  await new GetStartedPage(this.page).validateFieldPlaceholders()
})

Then('I should see the required error for {string}', async function (this: CustomWorld, field: string) {
  await new GetStartedPage(this.page).validateRequiredErrorDisplayed(field)
})

Then('I should not see an error for {string}', async function (this: CustomWorld, field: string) {
  await new GetStartedPage(this.page).validateNoErrorDisplayed(field)
})

Then(
  'the contact details for {string} {string} at {string} with email {string} should be retained',
  async function (this: CustomWorld, first: string, last: string, company: string, email: string) {
    await new GetStartedPage(this.page).validateContactDetailsEntered(first, last, company, email)
  }
)

Then('the country {string} should be selected', async function (this: CustomWorld, country: string) {
  await new GetStartedPage(this.page).validateCountrySelected(country)
})

Then('the service {string} should be selected', async function (this: CustomWorld, service: string) {
  await new GetStartedPage(this.page).validateServiceSelected(service)
})

Then('the monthly order volume {string} should be selected', async function (this: CustomWorld, volume: string) {
  await new GetStartedPage(this.page).validateMonthlyOrderVolumeSelected(volume)
})

When('I complete all required fields', async function (this: CustomWorld) {
  await new GetStartedPage(this.page).completeRequiredFields()
})

When('I complete all required fields except {string}', async function (this: CustomWorld, field: string) {
  await new GetStartedPage(this.page).completeRequiredFields(field)
})

Then('the submit button should be disabled', async function (this: CustomWorld) {
  await new GetStartedPage(this.page).validateSubmitButtonDisabled()
})

Then('the submit button should be enabled', async function (this: CustomWorld) {
  await new GetStartedPage(this.page).validateSubmitButtonEnabled()
})

Then('I should see the close button', async function (this: CustomWorld) {
  await new GetStartedPage(this.page).validateCloseButtonDisplayed()
})

When('I click the close button', async function (this: CustomWorld) {
  await new GetStartedPage(this.page).clickCloseButton()
})

Then('I should be taken to the Stord home page', async function (this: CustomWorld) {
  await new GetStartedPage(this.page).validateOnHomePage()
})
