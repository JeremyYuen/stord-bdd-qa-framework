import { Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'
import { TIMEOUTS } from '../config/timeouts'
import { validContact } from '../utils/testData'
import { scanAccessibility, A11yResult } from '../utils/accessibility'

/**
 * Stord "Talk to an Expert" lead form (/get-started).
 * Live lead-capture form: tests may fill and validate it, but must NEVER click "Let's Talk".
 */
export class GetStartedPage extends BasePage {

    // ========== LOCATORS ==========
    private firstNameInput = (): Locator => this.page.locator('#firstname')
    private lastNameInput = (): Locator => this.page.locator('#lastname')
    private companyInput = (): Locator => this.page.locator('#company')
    private workEmailInput = (): Locator => this.page.locator('#email')
    private phoneInput = (): Locator => this.page.locator('#phone')
    private submitButton = (): Locator => this.page.getByRole('button', { name: "Let's Talk" })

    // The X is an icon-only <button>: no text, aria-label or id, so role/name locators can't target it
    // (a /close/i role query matches the cookie banner's Close button instead). The stable part of
    // its CSS-module class ("cross-button", minus the hash) identifies the SVG inside the button.
    private closeButton = (): Locator => this.page.locator('button:has(svg[class*="cross-button"])')

    // Custom dropdowns (divs, not <select>) share one structure: <label for=id> + dropdown div,
    // plus a hidden <input id> that holds the chosen value. Anchored from the label, no hashed classes.
    private dropdown = (fieldId: string): Locator => this.page.locator(`label[for="${fieldId}"] + div`)
    private dropdownTrigger = (fieldId: string): Locator => this.dropdown(fieldId).locator('> div').first()
    private dropdownOption = (fieldId: string, option: string): Locator => this.dropdown(fieldId).getByText(option, { exact: true })
    private dropdownHiddenValue = (fieldId: string): Locator => this.page.locator(`#${fieldId}`)

    // Text fields addressed by the friendly names used in feature files (keeps scenarios data-driven)
    private readonly TEXT_FIELD_IDS: Record<string, string> = {
        'first name': 'firstname',
        'last name': 'lastname',
        'company': 'company',
        'work email': 'email',
        'phone': 'phone'
    }
    private fieldId = (fieldName: string): string => {
        const id = this.TEXT_FIELD_IDS[fieldName.toLowerCase()]
        if (!id) throw new Error(`Unknown field "${fieldName}". Expected one of: ${Object.keys(this.TEXT_FIELD_IDS).join(', ')}`)
        return id
    }
    private fieldInput = (fieldName: string): Locator => this.page.locator(`#${this.fieldId(fieldName)}`)

    // Validation message lives in the same wrapper as its field's label and is only added to the DOM
    // after validation fails. Scoped per field so one field's error can't satisfy another's check.
    // .p-error is a semantic class; the hashed input-fields_error__* class is deliberately avoided.
    private fieldError = (fieldName: string): Locator =>
        this.page.locator(`div:has(> label[for="${this.fieldId(fieldName)}"]) .p-error`)

    // Field ids (note: Stord's own id for service has a typo)
    private readonly COUNTRY = 'countries'
    private readonly SERVICE = 'service_intrest'
    private readonly ORDER_VOLUME = 'monthly_order_volume'

    // Dropdowns addressed by friendly name in feature files. Options only exist in the DOM while the list is open.
    private readonly DROPDOWN_IDS: Record<string, string> = {
        'country': this.COUNTRY,
        'service': this.SERVICE,
        'monthly order volume': this.ORDER_VOLUME
    }
    private dropdownId = (name: string): string => {
        const id = this.DROPDOWN_IDS[name.toLowerCase()]
        if (!id) throw new Error(`Unknown dropdown "${name}". Expected one of: ${Object.keys(this.DROPDOWN_IDS).join(', ')}`)
        return id
    }
    // The option list is the dropdown's second child div; each option is a bare child div
    private dropdownOptionList = (name: string): Locator =>
        this.dropdown(this.dropdownId(name)).locator('> div').nth(1).locator('> div')

    // ========== METHODS ==========

    async openGetStartedPage(): Promise<void> {
        await this.goto('/get-started')
        await this.firstNameInput().waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD })
        console.log('✓ Opened Get Started page')
    }

    async validateFormFieldsDisplayed(): Promise<void> {
        await expect(this.firstNameInput()).toBeVisible()
        await expect(this.lastNameInput()).toBeVisible()
        await expect(this.companyInput()).toBeVisible()
        await expect(this.workEmailInput()).toBeVisible()
        await expect(this.phoneInput()).toBeVisible()
        await expect(this.submitButton()).toBeVisible()
        console.log('✓ All form fields and the submit button are displayed')
    }

    async validateFieldPlaceholders(): Promise<void> {
        await expect(this.firstNameInput()).toHaveAttribute('placeholder', 'First')
        await expect(this.lastNameInput()).toHaveAttribute('placeholder', 'Last')
        await expect(this.companyInput()).toHaveAttribute('placeholder', 'Company Inc.')
        await expect(this.workEmailInput()).toHaveAttribute('placeholder', 'name@company.com')
        await expect(this.phoneInput()).toHaveAttribute('placeholder', '(123)456-7890')
        console.log('✓ Field placeholders match')
    }

    async fillContactDetails(first: string, last: string, company: string, email: string): Promise<void> {
        await this.firstNameInput().fill(first)
        await this.lastNameInput().fill(last)
        await this.companyInput().fill(company)
        await this.workEmailInput().fill(email)
        console.log('✓ Filled contact details')
    }

    async validateContactDetailsEntered(first: string, last: string, company: string, email: string): Promise<void> {
        await expect(this.firstNameInput()).toHaveValue(first)
        await expect(this.lastNameInput()).toHaveValue(last)
        await expect(this.companyInput()).toHaveValue(company)
        await expect(this.workEmailInput()).toHaveValue(email)
        console.log('✓ Entered values are retained in the fields')
    }

    // Fake data that satisfies every required field (see utils/testData.ts). The form is never submitted.
    private readonly VALID_FORM = validContact()

    // Completes every required field, optionally leaving one out (to prove it is really required)
    async completeRequiredFields(skipField?: string): Promise<void> {
        const form = this.VALID_FORM
        const fillers: Record<string, () => Promise<void>> = {
            'first name': () => this.fillField('first name', form.first),
            'last name': () => this.fillField('last name', form.last),
            'company': () => this.fillField('company', form.company),
            'work email': () => this.fillField('work email', form.email),
            'country': () => this.selectCountry(form.country),
            'service': () => this.selectService(form.service),
            'monthly order volume': () => this.selectMonthlyOrderVolume(form.volume)
        }
        const skip = skipField?.toLowerCase()
        if (skip && !(skip in fillers)) throw new Error(`Unknown required field "${skipField}". Expected one of: ${Object.keys(fillers).join(', ')}`)
        for (const [name, fill] of Object.entries(fillers)) {
            if (name !== skip) await fill()
        }
        console.log(skip ? `✓ Completed all required fields except ${skip}` : '✓ Completed all required fields')
    }

    async validateCloseButtonDisplayed(): Promise<void> {
        await expect(this.closeButton()).toBeVisible()
        console.log('✓ Close (X) button is displayed')
    }

    async clickCloseButton(): Promise<void> {
        await this.closeButton().click()
        console.log('✓ Clicked the close (X) button')
    }

    async validateOnHomePage(): Promise<void> {
        await expect(this.page).toHaveURL(url => url.pathname === '/', { timeout: TIMEOUTS.PAGE_LOAD })
        console.log('✓ Navigated to the Stord home page')
    }

    // The submit button is only ever inspected, never clicked (live lead form)
    async validateSubmitButtonDisabled(): Promise<void> {
        await expect(this.submitButton()).toBeDisabled()
        console.log('✓ Submit button is disabled')
    }

    async validateSubmitButtonEnabled(): Promise<void> {
        await expect(this.submitButton()).toBeEnabled()
        console.log('✓ Submit button is enabled (not clicked)')
    }

    async fillField(fieldName: string, value: string): Promise<void> {
        await this.fieldInput(fieldName).fill(value)
        console.log(`✓ Filled ${fieldName}`)
    }

    // Validation runs when a field loses focus, so focus then blur simulates "touched and left empty"
    async leaveFieldEmpty(fieldName: string): Promise<void> {
        await this.fieldInput(fieldName).focus()
        await this.fieldInput(fieldName).blur()
        console.log(`✓ Focused and left ${fieldName} empty`)
    }

    async fillFieldWithCharacters(fieldName: string, length: number): Promise<void> {
        await this.fieldInput(fieldName).fill('A'.repeat(length))
        console.log(`✓ Filled ${fieldName} with ${length} characters`)
    }

    async validateFieldValue(fieldName: string, value: string): Promise<void> {
        await expect(this.fieldInput(fieldName)).toHaveValue(value)
        console.log(`✓ ${fieldName} retained exactly: ${value.length > 40 ? value.slice(0, 40) + '…' : value}`)
    }

    async validateFieldHasCharacters(fieldName: string, length: number): Promise<void> {
        await expect(this.fieldInput(fieldName)).toHaveValue('A'.repeat(length))
        console.log(`✓ ${fieldName} retained all ${length} characters`)
    }

    async validateRequiredErrorDisplayed(fieldName: string): Promise<void> {
        await expect(this.fieldError(fieldName)).toHaveText('* Required field')
        console.log(`✓ Required error displayed for ${fieldName}`)
    }

    async validateNoErrorDisplayed(fieldName: string): Promise<void> {
        await expect(this.fieldError(fieldName)).toHaveCount(0)
        console.log(`✓ No error displayed for ${fieldName}`)
    }

    async selectCountry(country: string): Promise<void> {
        await this.selectDropdownOption(this.COUNTRY, country)
        console.log(`✓ Selected country: "${country}"`)
    }

    async validateCountrySelected(country: string): Promise<void> {
        await this.validateDropdownSelected(this.COUNTRY, country)
        console.log(`✓ Country shows and stores: "${country}"`)
    }

    async selectService(service: string): Promise<void> {
        await this.selectDropdownOption(this.SERVICE, service)
        console.log(`✓ Selected service: "${service}"`)
    }

    async validateServiceSelected(service: string): Promise<void> {
        await this.validateDropdownSelected(this.SERVICE, service)
        console.log(`✓ Service shows and stores: "${service}"`)
    }

    async selectMonthlyOrderVolume(volume: string): Promise<void> {
        await this.selectDropdownOption(this.ORDER_VOLUME, volume)
        console.log(`✓ Selected monthly order volume: "${volume}"`)
    }

    async validateMonthlyOrderVolumeSelected(volume: string): Promise<void> {
        await this.validateDropdownSelected(this.ORDER_VOLUME, volume)
        console.log(`✓ Monthly order volume shows and stores: "${volume}"`)
    }

    async openDropdown(name: string): Promise<void> {
        await this.dropdownTrigger(this.dropdownId(name)).click()
        console.log(`✓ Opened the ${name} dropdown`)
    }

    // Exact list, in order: catches a removed, added, renamed or reordered option
    async validateDropdownOptions(name: string, expected: string[]): Promise<void> {
        await expect(this.dropdownOptionList(name)).toHaveText(expected)
        console.log(`✓ ${name} dropdown offers exactly: ${expected.join(' | ')}`)
    }

    // For long lists (country has ~250): assert only the leading, business-prioritized options
    async validateDropdownOptionsStartWith(name: string, expected: string[]): Promise<void> {
        await expect(this.dropdownOptionList(name).first()).toBeVisible()
        const options = await this.dropdownOptionList(name).allTextContents()
        expect(options.slice(0, expected.length)).toEqual(expected)
        console.log(`✓ ${name} dropdown starts with: ${expected.join(' | ')}`)
    }

    // Accessibility: scan the form (not third-party widgets) and compare with the documented known issues
    async scanAccessibility(): Promise<A11yResult> {
        await expect(this.firstNameInput()).toBeVisible()
        return scanAccessibility(this.page)
    }

    // Shared dropdown behavior: open it, click the option by its visible text
    private async selectDropdownOption(fieldId: string, option: string): Promise<void> {
        await this.dropdownTrigger(fieldId).click()
        await this.dropdownOption(fieldId, option).click()
    }

    // Assert the displayed value and the hidden input (what the form would actually submit)
    private async validateDropdownSelected(fieldId: string, option: string): Promise<void> {
        await expect(this.dropdownTrigger(fieldId)).toHaveText(option)
        await expect(this.dropdownHiddenValue(fieldId)).toHaveValue(option)
    }
}
