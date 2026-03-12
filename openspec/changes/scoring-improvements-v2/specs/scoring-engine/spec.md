## MODIFIED Requirements

### Requirement: Calculate Productividad score
The system SHALL calculate the Productividad category (0-100) using reduced thresholds and logarithmic scaling:
- commitScore: `min(log2(totalCommits + 1) / log2(401), 1) * 40` (400 commits = max)
- repoScore: `min(log2(repoCount + 1) / log2(16), 1) * 30` (15 repos = max)
- frequencyScore: `min(commitsPerActiveWeek / 10, 1) * 30` (10/week = max)

#### Scenario: Highly productive user
- **WHEN** a user has more than 300 commits and 15+ repos in the evaluated period
- **THEN** the Productividad score SHALL be 85 or above

#### Scenario: Moderately active user
- **WHEN** a user has 100 commits and 8 repos
- **THEN** the Productividad score SHALL be between 55 and 75

### Requirement: Calculate Calidad score
The system SHALL calculate the Calidad category (0-100) with more generous scaling:
- mergeRatio contribution: `mergeRatio * 60` (reduced from 70)
- volume contribution: `min(log2(totalPRs + 1) / log2(26), 1) * 40` (25 PRs = max, increased from 30)

#### Scenario: High quality contributor
- **WHEN** a user has a PR merge ratio above 75% and 15+ PRs
- **THEN** the Calidad score SHALL be 75 or above

### Requirement: Calculate Colaboracion score
The system SHALL calculate the Colaboracion category (0-100) with reduced thresholds:
- externalRepos: `min(log2(count + 1) / log2(9), 1) * 40` (8 repos = max)
- externalPRs: `min(log2(count + 1) / log2(16), 1) * 35` (15 PRs = max)
- externalIssues: `min(log2(count + 1) / log2(11), 1) * 25` (10 issues = max)

#### Scenario: Active open source contributor
- **WHEN** a user has contributions to 5+ external repositories
- **THEN** the Colaboracion score SHALL be 60 or above

### Requirement: Calculate Consistencia score
The system SHALL calculate the Consistencia category (0-100) with adjusted scaling:
- activeRatio: unchanged at `ratio * 40`
- longestStreak: `min(longestStreak / 12, 1) * 30` (12 weeks = max, reduced from 20)
- consistency: unchanged at `consistency * 30`

#### Scenario: Consistent contributor
- **WHEN** a user has been active in 70%+ of weeks with a streak of 10+ weeks
- **THEN** the Consistencia score SHALL be 75 or above

### Requirement: Calculate Diversidad score
The system SHALL calculate the Diversidad category (0-100) with reduced language threshold:
- languageScore: `min(languageCount / 5, 1) * 60` (5 languages = max, reduced from 8)
- contributionTypes: unchanged at `(types / 3) * 40`

#### Scenario: Polyglot developer
- **WHEN** a user has repos in 4+ different programming languages
- **THEN** the Diversidad score SHALL be 65 or above

## ADDED Requirements

### Requirement: Calculate Seniority score
The system SHALL calculate a new Seniority category (weight 0.15) based on account age and sustained activity over time. The scoring MUST distinguish between genuine long-term developers and accounts with old registration but recent-only activity.

Metrics:
- `accountAgeYears`: Years since GitHub account creation
- `activeYears`: Number of distinct years with meaningful activity (repos pushed or created)
- `activeYearRatio`: `activeYears / accountAgeYears` — measures sustained engagement vs dormancy
- `avgCommitsPerYear`: `totalCommits / accountAgeYears` — normalized productivity over career

Scoring formula:
- ageScore: `min(accountAgeYears / 8, 1) * 25` (8 years = max age contribution)
- sustainedScore: `activeYearRatio * 40` (full marks only if active most of their account life)
- avgActivityScore: `min(log2(avgCommitsPerYear + 1) / log2(101), 1) * 35` (100 commits/year avg = max)

Total = ageScore + sustainedScore + avgActivityScore, capped at 100.

This ensures a 10-year account with only recent bursts scores low on sustained engagement, while a developer active over many years scores high.

#### Scenario: Veteran sustained developer
- **WHEN** a user has a 7-year-old account with activity in 6 of those years and 80+ avg commits/year
- **THEN** the Seniority score SHALL be 85 or above

#### Scenario: Old account recent-only activity
- **WHEN** a user has a 10-year-old account but only pushed repos in the last year with 500 commits this month
- **THEN** the Seniority score SHALL be below 40 (high age but low sustained ratio)

#### Scenario: New active developer
- **WHEN** a user has a 1-year-old account with consistent activity and 200 commits
- **THEN** the Seniority score SHALL be between 40 and 60 (limited by account age)

### Requirement: Rebalance category weights with Seniority
The overall score weights SHALL be rebalanced to accommodate the new Seniority category:
- Productividad: 20% (was 25%)
- Calidad: 15% (was 20%)
- Colaboracion: 20% (unchanged)
- Consistencia: 15% (was 20%)
- Diversidad: 15% (unchanged)
- Seniority: 15% (new)

#### Scenario: Weight sum
- **WHEN** all category weights are summed
- **THEN** the total equals 1.0 (100%)
