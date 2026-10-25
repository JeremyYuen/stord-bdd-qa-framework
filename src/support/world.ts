import { World, setWorldConstructor, IWorldOptions } from '@cucumber/cucumber'
import { BrowserContext, Page } from '@playwright/test'
import { ApiClient, ApiResult } from '../utils/apiClient'
import { PostsService } from '../services/PostsService'

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
  posts!: PostsService
  lastResponse?: ApiResult

  // The response of the last "When" step. Fails clearly if a "Then" runs before any request was made.
  get response(): ApiResult {
    if (!this.lastResponse) throw new Error('No API response yet: a When step must make a request first')
    return this.lastResponse
  }

  constructor(options: IWorldOptions) {
    super(options)
  }
}

setWorldConstructor(CustomWorld)
