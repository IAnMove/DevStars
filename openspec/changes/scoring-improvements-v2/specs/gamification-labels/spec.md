## MODIFIED Requirements

### Requirement: Assign title based on overall score
The system SHALL assign a title with a description to the developer based on their overall score. Each title SHALL include a `description` field explaining what the title represents. The title object structure SHALL be `{ title: string, description: string }`.

Titles and descriptions:
- 0-10: "Hello World Intern" — "Just getting started. Everyone begins somewhere!"
- 11-20: "Code Padawan" — "Learning the ways of the code. Building first projects."
- 21-30: "Bug Whisperer" — "Starting to understand codebases and fix things."
- 31-40: "Commit Cadet" — "Regular contributor with growing habits."
- 41-50: "Merge Request Warrior" — "Solid contributor who collaborates through PRs."
- 51-60: "Bug Slayer" — "Experienced developer with consistent output."
- 61-70: "Pipeline Ninja" — "Highly active across multiple projects and languages."
- 71-80: "Code Sensei" — "Veteran developer with strong habits and broad impact."
- 81-90: "Open Source Titan" — "Top-tier contributor driving open source forward."
- 91-100: "Git Overlord" — "Elite developer. Exceptional across all dimensions."

#### Scenario: Title with description
- **WHEN** a user has an overall score of 45
- **THEN** the system assigns the title "Merge Request Warrior" with description "Solid contributor who collaborates through PRs."

#### Scenario: High score title with description
- **WHEN** a user has an overall score of 88
- **THEN** the system assigns the title "Open Source Titan" with description "Top-tier contributor driving open source forward."
