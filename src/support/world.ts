import { World, setWorldConstructor, IWorldOptions } from '@cucumber/cucumber'
import { BrowserContext, Page } from '@playwright/test'
import { ApiClient, ApiResult } from '../utils/apiClient'

/**
 * Per-scenario state shared between steps. Typed so step definitions
 * get autocomplete instead of reaching for `this: any`.
 */
export class CustomWorld extends World {
  // The world is built fresh for each scenario, so this is the scenario's start time
  readonly startTime = Date.now()

  // UI scenarios (@UI)
  context!: BrowserContext
  page!: Page

  // API scenarios (@API)
  api!: ApiClient
  lastResponse?: ApiResult

  constructor(options: IWorldOptions) {
    super(options)
  }
}

setWorldConstructor(CustomWorld)
