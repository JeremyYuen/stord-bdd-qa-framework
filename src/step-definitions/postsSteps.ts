import { When, Then } from '@cucumber/cucumber'
import { CustomWorld } from '../support/world'

// Steps stay thin: one service call each. The response is kept on the World for the Then steps.

When('I request post {int}', async function (this: CustomWorld, id: number) {
  this.lastResponse = await this.posts.getPost(id)
})

When('I request the posts of user {int}', async function (this: CustomWorld, userId: number) {
  this.lastResponse = await this.posts.getPostsByUser(userId)
})

When(
  'I create a post titled {string} with body {string} for user {int}',
  async function (this: CustomWorld, title: string, body: string, userId: number) {
    this.lastResponse = await this.posts.createPost(title, body, userId)
  }
)

Then('the response should be a valid post', function (this: CustomWorld) {
  this.posts.validatePostContract(this.response)
})

Then('the post id should be {int}', function (this: CustomWorld, id: number) {
  this.posts.validatePostId(this.response, id)
})

Then('every returned post should belong to user {int}', function (this: CustomWorld, userId: number) {
  this.posts.validateAllPostsBelongToUser(this.response, userId)
})

Then(
  'the created post should echo title {string} and body {string} for user {int}',
  function (this: CustomWorld, title: string, body: string, userId: number) {
    this.posts.validateCreatedPostEchoed(this.response, title, body, userId)
  }
)
