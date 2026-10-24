import { APIRequestContext, request } from '@playwright/test'
import { BASE_URL } from '../config/env'

export interface ApiResult {
  status: number
  body: any
}

/**
 * Thin wrapper over Playwright's APIRequestContext so steps deal in
 * (status, body) pairs and never build URLs or headers themselves.
 */
export class ApiClient {
  private token?: string

  private constructor(private ctx: APIRequestContext) {}

  static async create(baseURL: string = BASE_URL): Promise<ApiClient> {
    return new ApiClient(await request.newContext({ baseURL }))
  }

  setToken(token: string) {
    this.token = token
  }

  get(path: string) {
    return this.send('GET', path)
  }

  post(path: string, data?: object) {
    return this.send('POST', path, data)
  }

  dispose() {
    return this.ctx.dispose()
  }

  private async send(method: string, path: string, data?: object): Promise<ApiResult> {
    const response = await this.ctx.fetch(path, {
      method,
      data,
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {}
    })
    const text = await response.text()
    let body: any = text
    try { body = JSON.parse(text) } catch { /* non-JSON body: keep the raw text */ }
    return { status: response.status(), body }
  }
}
