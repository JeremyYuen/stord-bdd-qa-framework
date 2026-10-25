/**
 * Test data builders. Everything is clearly fake (example.com) because the target is a live
 * lead form: nothing here should ever look like a real prospect.
 */
export interface Contact {
  first: string
  last: string
  company: string
  email: string
  country: string
  service: string
  volume: string
}

// A contact that satisfies every required field; override only what a scenario cares about
export const validContact = (overrides: Partial<Contact> = {}): Contact => ({
  first: 'Jane',
  last: 'Tester',
  company: 'QA Automation Co',
  email: 'qa.automation@example.com',
  country: 'Canada',
  service: 'Fulfillment',
  volume: '10,000-25,000',
  ...overrides
})
