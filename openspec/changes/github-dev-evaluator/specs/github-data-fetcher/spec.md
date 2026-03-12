## ADDED Requirements

### Requirement: Fetch user profile data
The system SHALL retrieve the public profile of a GitHub user given their username, including: login, name, avatar URL, bio, public repos count, followers, following, and account creation date.

#### Scenario: Valid username
- **WHEN** a valid GitHub username is provided
- **THEN** the system returns the user's profile data with all fields populated

#### Scenario: Invalid username
- **WHEN** a non-existent GitHub username is provided
- **THEN** the system returns a clear error indicating the user was not found

### Requirement: Fetch user repositories
The system SHALL retrieve all public repositories for a given user, including: name, description, language, stars, forks, created date, last push date, and whether it is a fork.

#### Scenario: User with repositories
- **WHEN** a user with public repositories is queried
- **THEN** the system returns a list of all public repos with their metadata

#### Scenario: User with no repositories
- **WHEN** a user with zero public repositories is queried
- **THEN** the system returns an empty list and signals insufficient data

### Requirement: Fetch commit activity
The system SHALL retrieve commit activity data for the user across their repositories, including commit counts per week for the last year and total commit counts.

#### Scenario: Active user
- **WHEN** a user with recent commits is queried
- **THEN** the system returns weekly commit counts for the past 52 weeks

### Requirement: Fetch pull request and issue data
The system SHALL retrieve the user's public pull requests and issues, including: PR state (open/closed/merged), issue state, creation dates, and associated repositories.

#### Scenario: User with PRs and issues
- **WHEN** a user with pull requests and issues is queried
- **THEN** the system returns lists of PRs and issues with their metadata and states

### Requirement: Handle GitHub API rate limits
The system SHALL monitor remaining API rate limit and inform the user when limits are approached or exceeded. The system MUST NOT make API calls when the rate limit is exhausted.

#### Scenario: Rate limit approaching
- **WHEN** the remaining rate limit drops below 10 requests
- **THEN** the system warns the user about limited remaining requests

#### Scenario: Rate limit exhausted
- **WHEN** the rate limit reaches zero
- **THEN** the system stops making API calls and displays the reset time to the user

### Requirement: Normalize API data
The system SHALL transform raw GitHub API responses into a standardized internal data model that is independent of the API version used.

#### Scenario: Data normalization
- **WHEN** raw GitHub API data is received
- **THEN** the data is transformed into the internal model with consistent date formats, computed fields (e.g., repo age), and null-safe defaults
