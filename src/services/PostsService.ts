import { expect } from '@playwright/test'
import { ApiClient, ApiResult } from '../utils/apiClient'

/**
 * Posts endpoints of the mock API. The API-layer equivalent of a page object:
 * paths, payload shapes and assertions live here so steps stay one call each.
 */
export class PostsService {
  constructor(private api: ApiClient) {}

  // ========== ENDPOINTS ==========
  private readonly POSTS = '/posts'
  private post = (id: number): string => `${this.POSTS}/${id}`

  // ========== METHODS ==========

  async getPost(id: number): Promise<ApiResult> {
    const result = await this.api.get(this.post(id))
    console.log(`✓ GET ${this.post(id)} returned ${result.status}`)
    return result
  }

  async getPostsByUser(userId: number): Promise<ApiResult> {
    const result = await this.api.get(`${this.POSTS}?userId=${userId}`)
    console.log(`✓ GET ${this.POSTS}?userId=${userId} returned ${result.status}`)
    return result
  }

  async createPost(title: string, body: string, userId: number): Promise<ApiResult> {
    const result = await this.api.post(this.POSTS, { title, body, userId })
    console.log(`✓ POST ${this.POSTS} returned ${result.status}`)
    return result
  }

  validateStatus(result: ApiResult, expected: number): void {
    expect(result.status).toBe(expected)
    console.log(`✓ Status is ${expected}`)
  }

  // Contract check: every field is present with the right type, not just "some JSON came back"
  validatePostContract(result: ApiResult): void {
    expect(result.body).toEqual({
      userId: expect.any(Number),
      id: expect.any(Number),
      title: expect.any(String),
      body: expect.any(String)
    })
    console.log('✓ Post matches the expected contract')
  }

  validatePostId(result: ApiResult, id: number): void {
    expect(result.body.id).toBe(id)
    console.log(`✓ Returned post has id ${id}`)
  }

  validateAllPostsBelongToUser(result: ApiResult, userId: number): void {
    expect(Array.isArray(result.body)).toBe(true)
    // An empty list would pass a bare .every(), so require at least one post first
    expect(result.body.length).toBeGreaterThan(0)
    expect(result.body.every((post: { userId: number }) => post.userId === userId)).toBe(true)
    console.log(`✓ All ${result.body.length} posts belong to user ${userId}`)
  }

  validateCreatedPostEchoed(result: ApiResult, title: string, body: string, userId: number): void {
    expect(result.body).toMatchObject({ title, body, userId })
    expect(result.body.id).toEqual(expect.any(Number))
    console.log(`✓ Created post echoes the request and was assigned id ${result.body.id}`)
  }
}
