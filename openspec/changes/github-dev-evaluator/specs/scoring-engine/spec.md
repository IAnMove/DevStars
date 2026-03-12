## ADDED Requirements

### Requirement: Calculate overall score
The system SHALL calculate an overall developer score from 0 to 100 as a weighted average of five category scores: Productividad (25%), Calidad (20%), Colaboración (20%), Consistencia (20%), Diversidad (15%).

#### Scenario: Complete data available
- **WHEN** all five category scores are calculated
- **THEN** the system produces a single overall score between 0 and 100, rounded to the nearest integer

#### Scenario: Partial data available
- **WHEN** one or more categories cannot be calculated due to insufficient data
- **THEN** the system recalculates weights proportionally among available categories and marks missing categories as "N/A"

### Requirement: Calculate Productividad score
The system SHALL calculate the Productividad category (0-100) based on: total commits in the period, number of repositories created, and average commits per active week.

#### Scenario: Highly productive user
- **WHEN** a user has more than 500 commits and 20+ repos in the evaluated period
- **THEN** the Productividad score SHALL be 80 or above

#### Scenario: Low activity user
- **WHEN** a user has fewer than 10 commits in the evaluated period
- **THEN** the Productividad score SHALL be below 20

### Requirement: Calculate Calidad score
The system SHALL calculate the Calidad category (0-100) based on: ratio of merged PRs to total PRs, average PR size (commits per PR), and code review participation (comments on others' PRs).

#### Scenario: High quality contributor
- **WHEN** a user has a PR merge ratio above 80% and participates in code reviews
- **THEN** the Calidad score SHALL be 70 or above

### Requirement: Calculate Colaboración score
The system SHALL calculate the Colaboración category (0-100) based on: contributions to repositories not owned by the user, issues opened on external repos, and PR contributions to open source projects.

#### Scenario: Active open source contributor
- **WHEN** a user has contributions to 10+ external repositories
- **THEN** the Colaboración score SHALL be 60 or above

### Requirement: Calculate Consistencia score
The system SHALL calculate the Consistencia category (0-100) based on: number of active weeks out of total weeks in the period, longest streak of consecutive active weeks, and standard deviation of weekly activity.

#### Scenario: Consistent contributor
- **WHEN** a user has been active in 80%+ of weeks in the period with low variance
- **THEN** the Consistencia score SHALL be 75 or above

### Requirement: Calculate Diversidad score
The system SHALL calculate the Diversidad category (0-100) based on: number of distinct programming languages used, variety of contribution types (commits, PRs, issues, reviews), and breadth of project topics.

#### Scenario: Polyglot developer
- **WHEN** a user has repos in 5+ different programming languages
- **THEN** the Diversidad score SHALL be 60 or above

### Requirement: Provide score breakdown
The system SHALL return a detailed breakdown showing: each category name, its weight, its individual score (0-100), its weighted contribution to the overall score, and the key metrics that drove the score.

#### Scenario: Score breakdown request
- **WHEN** a score is calculated for a user
- **THEN** the system returns the full breakdown with all categories, individual scores, and contributing metrics
