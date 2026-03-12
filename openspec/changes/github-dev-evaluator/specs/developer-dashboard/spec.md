## ADDED Requirements

### Requirement: Search by GitHub username
The system SHALL display a search input on the landing page where users can enter a GitHub username and initiate an evaluation.

#### Scenario: Submit valid username
- **WHEN** the user types a GitHub username and submits the search
- **THEN** the system starts fetching data and shows a loading state

#### Scenario: Submit empty username
- **WHEN** the user submits without entering a username
- **THEN** the system shows a validation error requesting a username

### Requirement: Display overall score prominently
The system SHALL display the overall score (0-100) as a large, visually prominent element with the assigned gamification title below it. The score SHALL use color coding: red (0-30), orange (31-50), yellow (51-70), green (71-100).

#### Scenario: Score display
- **WHEN** the evaluation is complete
- **THEN** the overall score is displayed in large format with color coding and the gamification title

### Requirement: Display category breakdown
The system SHALL display a radar/spider chart showing all five category scores and a detailed card for each category with its individual score, key metrics, and earned badge (if any).

#### Scenario: Category breakdown view
- **WHEN** the evaluation is complete
- **THEN** a radar chart and individual category cards are displayed with scores and metrics

### Requirement: Display evolution chart
The system SHALL display a line chart showing the overall score across the four time periods (30d, 6m, 1y, all-time) with the trend indicator.

#### Scenario: Evolution visualization
- **WHEN** scores for all time periods are calculated
- **THEN** a line chart shows score progression across periods with the trend emoji

### Requirement: Time period selector
The system SHALL provide a toggle/tab component to switch between time periods, updating all displayed scores and charts to reflect the selected period.

#### Scenario: Switch time period
- **WHEN** the user selects "Last 6 months" from the time period selector
- **THEN** all scores, charts, and badges update to reflect 6-month data

### Requirement: Show loading progress
The system SHALL display progressive loading as GitHub data is fetched, showing which data categories have been loaded and an overall progress indicator.

#### Scenario: Loading state
- **WHEN** data is being fetched from GitHub API
- **THEN** the UI shows a progress indicator with labels for each data type being loaded

### Requirement: Display user profile header
The system SHALL display the evaluated user's GitHub profile information: avatar, name, username, bio, and account age at the top of the results page.

#### Scenario: Profile header display
- **WHEN** user profile data is loaded
- **THEN** the avatar, name, username, bio, and "member since" date are displayed

### Requirement: Show rate limit status
The system SHALL display the current GitHub API rate limit status (remaining/total) and warn when limits are low.

#### Scenario: Rate limit visible
- **WHEN** the dashboard is active
- **THEN** the remaining API calls are shown in the footer/header area

### Requirement: Responsive design
The system SHALL be fully responsive and usable on mobile, tablet, and desktop viewports.

#### Scenario: Mobile viewport
- **WHEN** the dashboard is viewed on a screen narrower than 768px
- **THEN** all content is accessible with appropriate layout adjustments (stacked cards, scrollable charts)

### Requirement: Share results
The system SHALL provide a "Share" button that copies the gamification summary to clipboard and optionally generates a shareable URL.

#### Scenario: Share button action
- **WHEN** the user clicks "Share"
- **THEN** the formatted summary is copied to clipboard and a success toast notification appears
