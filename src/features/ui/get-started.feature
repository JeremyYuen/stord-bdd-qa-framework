@UI @GetStarted @STD-001
Feature: Get Started lead form
  # Live lead-capture form: scenarios fill and validate only. None of them submits it.

  Background:
    Given I am on the Get Started page

  # Why: top of the sales funnel; a missing field or placeholder means lost leads after a bad deploy.
  @Smoke @Layout @STD-001.1 @Complete
  Scenario: [Get Started] - STD-001.1 - Form displays all fields with their placeholders
    Then I should see all the form fields and the submit button
    And the fields should show their placeholder text

  # Why: one row per field, so losing validation on a single field can't hide behind a generic check.
  @Smoke @Validation @STD-001.2 @Complete
  Scenario Outline: [Get Started] - STD-001.2 - Required error is shown when <field> is left empty
    When I leave the "<field>" field empty
    Then I should see the required error for "<field>"

    Examples:
      | field      |
      | first name |
      | last name  |
      | company    |
      | work email |

  # Why: negative twin of 001.2; phone made mandatory by accident would silently drop leads.
  @Regression @Validation @STD-001.3 @Complete
  Scenario: [Get Started] - STD-001.3 - Phone is optional and shows no error when left empty
    When I leave the "phone" field empty
    Then I should not see an error for "phone"

  # Why: an error that never clears leaves a stuck form; the second step proves the error existed first.
  @Regression @Validation @STD-001.4 @Complete
  Scenario Outline: [Get Started] - STD-001.4 - Required error clears once <field> has a valid value
    Given I leave the "<field>" field empty
    And I should see the required error for "<field>"
    When I fill the "<field>" field with "<value>"
    Then I should not see an error for "<field>"

    Examples:
      | field      | value                       |
      | first name | Jane                        |
      | last name  | Tester                      |
      | company    | QA Automation Co            |
      | work email | qa.automation@example.com   |

  # Why: re-renders can wipe earlier input and sales routes on these fields; checked without submitting.
  @Regression @Dropdowns @STD-001.5 @Complete
  Scenario: [Get Started] - STD-001.5 - Completed form keeps every entered value without being submitted
    When I fill in the contact details for "Jane" "Tester" at "QA Automation Co" with email "qa.automation@example.com"
    And I select the country "Canada"
    And I select the service "Fulfillment"
    And I select the monthly order volume "10,000-25,000"
    Then the contact details for "Jane" "Tester" at "QA Automation Co" with email "qa.automation@example.com" should be retained
    And the country "Canada" should be selected
    And the service "Fulfillment" should be selected
    And the monthly order volume "10,000-25,000" should be selected

  # Why: we can't submit the live form, so button state is the only gate against blank leads.
  @Smoke @Validation @STD-001.6 @Complete
  Scenario: [Get Started] - STD-001.6 - Submit button is disabled on an empty form
    Then the submit button should be disabled

  # Why: happy-path twin of 001.6; a button that never enables is a silent funnel outage.
  @Smoke @Validation @STD-001.7 @Complete
  Scenario: [Get Started] - STD-001.7 - Submit button is enabled once every required field is complete
    When I complete all required fields
    Then the submit button should be enabled

  # Why: dropping one field at a time isolates what the button depends on, dropdowns included.
  @Regression @Validation @STD-001.8 @Complete
  Scenario Outline: [Get Started] - STD-001.8 - Submit button stays disabled when <field> is missing
    When I complete all required fields except "<field>"
    Then the submit button should be disabled

    Examples:
      | field                |
      | first name           |
      | last name            |
      | company              |
      | work email           |
      | country              |
      | service              |
      | monthly order volume |

  # Why: work-email rule is enforced silently via button state; the rest of the form is valid so email is the only variable.
  @Regression @Validation @STD-001.9 @Complete
  Scenario Outline: [Get Started] - STD-001.9 - Free email address <email> keeps the submit button disabled
    When I complete all required fields
    And I fill the "work email" field with "<email>"
    Then the submit button should be disabled

    Examples:
      | email                  |
      | qa.automation@gmail.com |
      | qa.automation@yahoo.com |

  # Why: the close control is the visitor's only way out; if it disappears they're trapped.
  @Smoke @Layout @STD-001.10 @Complete
  Scenario: [Get Started] - STD-001.10 - Close button is displayed on the form
    Then I should see the close button

  # Why: visible isn't working; assert the destination so a dead close button can't strand a prospect.
  @Regression @Navigation @STD-001.11 @Complete
  Scenario: [Get Started] - STD-001.11 - Close button leaves the form and returns to the home page
    When I click the close button
    Then I should be taken to the Stord home page
