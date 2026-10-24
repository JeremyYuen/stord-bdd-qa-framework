import { When, Then } from '@cucumber/cucumber'
import { CustomWorld } from '../support/world'
import { PostsService } from '../services/PostsService'

// Steps stay thin: one service call each, the response is kept on the World for the Then steps.

When('I request post {int}', async function (this: CustomWorld, id: number) {
  this.lastResponse = await new PostsService(this.api).getPost(id)
})

When('I request the posts of user {int}', async function (this: CustomWorld, userId: number) {
  this.lastResponse = await new PostsService(this.api).getPostsByUser(userId)
})

When(
  'I create a post titled {string} with body {string} for user {int}',
  async function (this: CustomWorld, title: string, body: string, userId: number) {
    this.lastResponse = await new PostsService(this.api).createPost(title, body, userId)
  }
)

Then('the response status should be {int}', function (this: CustomWorld, status: number) {
  new PostsService(this.api).validateStatus(this.lastResponse!, status)
})

Then('the response should be a valid post', function (this: CustomWorld) {
  new PostsService(this.api).validatePostContract(this.lastResponse!)
})

Then('the post id should be {int}', function (this: CustomWorld, id: number) {
  new PostsService(this.api).validatePostId(this.lastResponse!, id)
})

Then('every returned post should belong to user {int}', function (this: CustomWorld, userId: number) {
  new PostsService(this.api).validateAllPostsBelongToUser(this.lastResponse!, userId)
})

Then(
  'the created post should echo title {string} and body {string} for user {int}',
  function (this: CustomWorld, title: string, body: string, userId: number) {
    new PostsService(this.api).validateCreatedPostEchoed(this.lastResponse!, title, body, userId)
  }
)
