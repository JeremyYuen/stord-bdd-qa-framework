@UI @GetStarted @STD-001
Feature: Get Started lead form
  # Live lead-capture form: scenarios fill and validate only. None of them submits it.

  Background:
    Given I am on the Get Started page

  # Why: top of the sales funnel; a missing field or placeholder means lost leads after a bad deploy.
  @Smoke @Layout @STD-001.1 @REQ-GS-01 @Complete
  Scenario: [Get Started] - STD-001.1 - Form displays all fields with their placeholders
    Then I should see all the form fields and the submit button
    And the fields should show their placeholder text

  # Why: one row per field, so losing validation on a single field can't hide behind a generic check.
  @Smoke @Validation @STD-001.2 @REQ-GS-02 @Complete
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
  @Regression @Validation @STD-001.3 @REQ-GS-03 @Complete
  Scenario: [Get Started] - STD-001.3 - Phone is optional and shows no error when left empty
    When I leave the "phone" field empty
    Then I should not see an error for "phone"

  # Why: an error that never clears leaves a stuck form; the second step proves the error existed first.
  @Regression @Validation @STD-001.4 @REQ-GS-02 @Complete
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
  @Regression @Dropdowns @STD-001.5 @REQ-GS-04 @Complete
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
  @Smoke @Validation @STD-001.6 @REQ-GS-06 @Complete
  Scenario: [Get Started] - STD-001.6 - Submit button is disabled on an empty form
    Then the submit button should be disabled

  # Why: happy-path twin of 001.6; a button that never enables is a silent funnel outage.
  @Smoke @Validation @STD-001.7 @REQ-GS-06 @Complete
  Scenario: [Get Started] - STD-001.7 - Submit button is enabled once every required field is complete
    When I complete all required fields
    Then the submit button should be enabled

  # Why: dropping one field at a time isolates what the button depends on, dropdowns included.
  @Regression @Validation @STD-001.8 @REQ-GS-02 @REQ-GS-06 @Complete
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
  @Regression @Validation @STD-001.9 @REQ-GS-07 @Complete
  Scenario Outline: [Get Started] - STD-001.9 - Free email address <email> keeps the submit button disabled
    When I complete all required fields
    And I fill the "work email" field with "<email>"
    Then the submit button should be disabled

    Examples:
      | email                  |
      | qa.automation@gmail.com   |
      | qa.automation@yahoo.com   |
      | qa.automation@hotmail.com |

  # Why: the close control is the visitor's only way out; if it disappears they're trapped.
  @Smoke @Layout @STD-001.10 @REQ-GS-08 @Complete
  Scenario: [Get Started] - STD-001.10 - Close button is displayed on the form
    Then I should see the close button

  # Why: visible isn't working; assert the destination so a dead close button can't strand a prospect.
  @Regression @Navigation @STD-001.11 @REQ-GS-08 @Complete
  Scenario: [Get Started] - STD-001.11 - Close button leaves the form and returns to the home page
    When I click the close button
    Then I should be taken to the Stord home page

  @Smoke @Dropdowns @STD-001.12 @REQ-GS-05 @Complete
  Scenario: [Get Started] - STD-001.12 - Service dropdown offers the expected services
    When I open the "service" dropdown
    Then the "service" dropdown should offer:
      | Warehousing      |
      | Software         |
      | Freight          |
      | Fulfillment      |
      | All Of The Above |

  @Smoke @Dropdowns @STD-001.13 @REQ-GS-05 @Complete
  Scenario: [Get Started] - STD-001.13 - Monthly order volume dropdown offers the expected ranges
    When I open the "monthly order volume" dropdown
    Then the "monthly order volume" dropdown should offer:
      | 200,000+          |
      | 100,000-200,000   |
      | 50,000-100,000    |
      | 25,000-50,000     |
      | 10,000-25,000     |
      | Less Than 10,000  |

  @Regression @Dropdowns @STD-001.14 @REQ-GS-05 @Complete
  Scenario: [Get Started] - STD-001.14 - Country dropdown lists the priority markets first
    When I open the "country" dropdown
    Then the "country" dropdown should start with:
      | United States  |
      | Canada         |
      | United Kingdom |

  # Why: the rule must not over-block; a business address that is rejected is a lost lead.
  @Regression @Validation @DataDriven @STD-001.15 @REQ-GS-07 @Complete
  Scenario Outline: [Get Started] - STD-001.15 - Business email <email> is accepted and enables the submit button
    When I complete all required fields
    And I fill the "work email" field with "<email>"
    Then the submit button should be enabled

    Examples:
      | email                          |
      | qa.automation@example.com      |
      | qa.automation@acme-logistics.com |
      | qa.automation@mail.example.co.uk |

  # Why: names and companies in the wild contain apostrophes, accents and symbols; none may be altered.
  @Regression @Validation @DataDriven @STD-001.16 @REQ-GS-09 @Complete
  Scenario Outline: [Get Started] - STD-001.16 - <label> is retained exactly as typed
    When I fill the "<field>" field with "<value>"
    Then the "<field>" field should contain "<value>"

    Examples:
      | label                  | field      | value                                 |
      | Apostrophe             | last name  | O'Brien                              |
      | Accented and CJK text  | first name | Zoë Müller-Çelik 山田                   |
      | Markup-like text       | company    | <script>alert(1)</script>             |
      | Symbols and spacing    | company    | Smith & Sons (EU) #1                  |

  # Why: boundary data; the form has no max length, so a long entry must not be truncated or break the page.
  @Regression @Validation @DataDriven @STD-001.17 @REQ-GS-09 @Complete
  Scenario Outline: [Get Started] - STD-001.17 - A long <field> of <length> characters is retained in full
    When I fill the "<field>" field with <length> characters
    Then the "<field>" field should contain <length> characters

    Examples:
      | field      | length |
      | first name | 300    |
      | company    | 1000   |

  # Why: accessibility is a legal and a usability risk on a lead form. The live site has known issues (see
  # src/utils/accessibility.ts), so this guards against NEW ones: a new rule, or a known rule hitting more elements.
  @Regression @Accessibility @STD-001.18 @REQ-GS-10 @Complete
  Scenario: [Get Started] - STD-001.18 - The form has no new accessibility violations
    Then the form should have no new accessibility violations
