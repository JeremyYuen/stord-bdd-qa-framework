import { Then } from '@cucumber/cucumber'
import { CustomWorld } from '../support/world'
import { validateStatus } from '../utils/apiAssertions'

// Steps that apply to any API feature, so they live here and not in a per-endpoint steps file.
// (Cucumber step text is global: defining this in two files would be an "ambiguous step" error.)

Then('the response status should be {int}', function (this: CustomWorld, status: number) {
  validateStatus(this.response, status)
})
