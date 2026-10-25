import { expect } from '@playwright/test'
import { ApiResult } from './apiClient'

/**
 * Assertions every API test needs, whichever endpoint it hits.
 * Endpoint-specific checks (a post's contract, say) live in that endpoint's service.
 */
export function validateStatus(result: ApiResult, expected: number): void {
  expect(result.status).toBe(expected)
  console.log(`✓ Status is ${expected}`)
}
