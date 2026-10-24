@API @Posts @STD-002
Feature: Posts API
  # Runs against a public mock API (API_BASE_URL): stord.com has no public API to test safely.

  # Why: the cheapest API canary; checks the full field contract, not just "200 and some JSON".
  @Smoke @Contract @STD-002.1 @Complete
  Scenario: [Posts API] - STD-002.1 - Get a post returns 200 with the expected contract
    When I request post 1
    Then the response status should be 200
    And the response should be a valid post
    And the post id should be 1

  # Why: a missing resource must be a clean 404, not a 200 with an empty body or a 500.
  @Regression @Negative @STD-002.2 @Complete
  Scenario: [Posts API] - STD-002.2 - Requesting a post that does not exist returns 404
    When I request post 99999
    Then the response status should be 404

  # Why: a filter that quietly returns other users' data is a data-leak bug; also guards against an empty list passing vacuously.
  @Regression @Filtering @STD-002.3 @Complete
  Scenario: [Posts API] - STD-002.3 - Filtering posts by user returns only that user's posts
    When I request the posts of user 1
    Then the response status should be 200
    And every returned post should belong to user 1

  # Why: asserts the 201 and the echoed payload only; this mock never persists, so a follow-up GET would be a false failure.
  @Smoke @Create @STD-002.4 @Complete
  Scenario: [Posts API] - STD-002.4 - Creating a post returns 201 and echoes the data
    When I create a post titled "QA automation post" with body "Created by the demo suite" for user 1
    Then the response status should be 201
    And the created post should echo title "QA automation post" and body "Created by the demo suite" for user 1
