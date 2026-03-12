## ADDED Requirements

### Requirement: Assign title based on overall score
The system SHALL assign a fun title/label to the developer based on their overall score using these ranges:
- 0-10: "Hello World Intern"
- 11-20: "Code Padawan"
- 21-30: "Bug Whisperer"
- 31-40: "Commit Cadet"
- 41-50: "Merge Request Warrior"
- 51-60: "Bug Slayer"
- 61-70: "Pipeline Ninja"
- 71-80: "Code Sensei"
- 81-90: "Open Source Titan"
- 91-100: "Git Overlord"

#### Scenario: Low score title
- **WHEN** a user has an overall score of 15
- **THEN** the system assigns the title "Code Padawan"

#### Scenario: High score title
- **WHEN** a user has an overall score of 92
- **THEN** the system assigns the title "Git Overlord"

### Requirement: Assign category badges
The system SHALL assign a specific badge for each scoring category when the category score exceeds 70:
- Productividad 70+: "Commit Machine"
- Calidad 70+: "Clean Coder"
- Colaboración 70+: "Community Hero"
- Consistencia 70+: "Streak Master"
- Diversidad 70+: "Polyglot Wizard"

#### Scenario: Earning a badge
- **WHEN** a user scores 75 in the Colaboración category
- **THEN** the system awards the "Community Hero" badge

#### Scenario: No badge earned
- **WHEN** a user scores below 70 in a category
- **THEN** no badge is awarded for that category

### Requirement: Display trend emoji
The system SHALL display a visual emoji/icon alongside the score trend: rocket for improving, campfire for stable, and snowflake for declining.

#### Scenario: Improving trend display
- **WHEN** the user's trend is "improving"
- **THEN** the system displays a rocket icon next to the trend label

### Requirement: Generate shareable summary
The system SHALL generate a text-based shareable summary including the user's title, overall score, top badges, and trend that can be copied to clipboard.

#### Scenario: Copy shareable summary
- **WHEN** the user clicks the "Share" button
- **THEN** a formatted text summary is copied to the clipboard containing: title, score, earned badges, and trend
