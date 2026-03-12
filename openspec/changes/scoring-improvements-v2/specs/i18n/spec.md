## ADDED Requirements

### Requirement: Support multiple languages
The system SHALL support English (en) and Spanish (es) as interface languages. English SHALL be the default language.

#### Scenario: Default language
- **WHEN** a user visits the app for the first time
- **THEN** the interface is displayed in English

#### Scenario: Switch to Spanish
- **WHEN** the user selects Spanish from the language selector
- **THEN** all UI text, titles, badges, descriptions, and labels switch to Spanish

### Requirement: Language selector
The system SHALL display a language selector accessible from all pages that allows switching between available languages.

#### Scenario: Language selector visible
- **WHEN** the user is on any page
- **THEN** a language selector (dropdown or toggle) is visible

### Requirement: Translate all UI strings
The system SHALL translate the following string categories:
- Page titles and descriptions
- Button labels and input placeholders
- Category names (Productividad, Calidad, etc.)
- Gamification titles and their descriptions
- Badge names
- Trend labels
- Time period labels
- Error messages
- Disclaimer text

#### Scenario: Category names in Spanish
- **WHEN** the language is set to Spanish
- **THEN** category names display as "Productividad", "Calidad", "Colaboracion", "Consistencia", "Diversidad"

#### Scenario: Category names in English
- **WHEN** the language is set to English
- **THEN** category names display as "Productivity", "Quality", "Collaboration", "Consistency", "Diversity"

### Requirement: Persist language preference
The system SHALL persist the selected language in localStorage so it is remembered across sessions.

#### Scenario: Language persistence
- **WHEN** the user selects Spanish and reloads the page
- **THEN** the interface remains in Spanish

### Requirement: Fallback to English
The system SHALL fall back to English for any missing translation key.

#### Scenario: Missing translation
- **WHEN** a translation key exists in English but not in the selected language
- **THEN** the English version is displayed
