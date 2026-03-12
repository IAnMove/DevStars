## ADDED Requirements

### Requirement: Support predefined time periods
The system SHALL support four predefined time segments for evaluation: last 30 days, last 6 months, last 1 year, and all-time (full account history).

#### Scenario: Select 30-day period
- **WHEN** the user selects the "Last 30 days" time segment
- **THEN** the system calculates all scores using only activity data from the last 30 days

#### Scenario: Select all-time period
- **WHEN** the user selects the "All time" time segment
- **THEN** the system calculates scores using the complete available activity history

### Requirement: Calculate evolution across periods
The system SHALL calculate scores for all time periods simultaneously and present the evolution of the overall score and each category score across the different periods.

#### Scenario: Score evolution display
- **WHEN** a user's evaluation is completed
- **THEN** the system shows how the overall score and category scores change across the four time periods

### Requirement: Detect score trends
The system SHALL determine whether the user's score is trending upward, downward, or stable by comparing the most recent period (30 days) against the longer periods.

#### Scenario: Improving developer
- **WHEN** the 30-day score is at least 10 points higher than the 1-year score
- **THEN** the system labels the trend as "improving" with a positive indicator

#### Scenario: Declining activity
- **WHEN** the 30-day score is at least 10 points lower than the 1-year score
- **THEN** the system labels the trend as "declining" with a warning indicator

#### Scenario: Stable developer
- **WHEN** the 30-day score is within 10 points of the 1-year score
- **THEN** the system labels the trend as "stable" with a neutral indicator

### Requirement: Filter activity data by time range
The system SHALL filter all normalized GitHub data (commits, PRs, issues, repos) to only include items within the selected time range before passing data to the scoring engine.

#### Scenario: Time-filtered scoring
- **WHEN** a 6-month time segment is selected
- **THEN** only commits, PRs, issues, and repo activity from the last 6 months are included in the score calculation
