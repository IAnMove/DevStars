## 1. Project Setup

- [x] 1.1 Initialize Next.js project with TypeScript and Tailwind CSS
- [x] 1.2 Install dependencies: recharts, octokit/rest (GitHub API client)
- [x] 1.3 Configure project structure: `src/lib/`, `src/components/`, `src/app/` directories
- [x] 1.4 Set up environment variable for optional GitHub token (`GITHUB_TOKEN`)

## 2. GitHub Data Fetcher

- [x] 2.1 Create TypeScript types/interfaces for GitHub API responses and internal data model
- [x] 2.2 Implement API route `/api/github/[username]` as proxy for GitHub API calls
- [x] 2.3 Implement `fetchUserProfile()` - fetch and normalize user profile data
- [x] 2.4 Implement `fetchUserRepos()` - fetch all public repos with pagination
- [x] 2.5 Implement `fetchCommitActivity()` - fetch weekly commit stats across repos
- [x] 2.6 Implement `fetchPullRequestsAndIssues()` - fetch PRs and issues via search API
- [x] 2.7 Implement rate limit monitoring and expose remaining/reset info
- [x] 2.8 Implement `normalizeGitHubData()` - transform raw API data into internal model

## 3. Scoring Engine

- [x] 3.1 Implement `calculateProductividad()` - score based on commits, repos, commits/week
- [x] 3.2 Implement `calculateCalidad()` - score based on PR merge ratio, review activity
- [x] 3.3 Implement `calculateColaboracion()` - score based on external contributions
- [x] 3.4 Implement `calculateConsistencia()` - score based on active weeks, streaks, variance
- [x] 3.5 Implement `calculateDiversidad()` - score based on languages, contribution types
- [x] 3.6 Implement `calculateOverallScore()` - weighted average with missing category handling
- [x] 3.7 Implement `getScoreBreakdown()` - return detailed breakdown with metrics per category

## 4. Time Segmentation

- [x] 4.1 Implement `filterByTimePeriod()` - filter normalized data by 30d, 6m, 1y, all-time
- [x] 4.2 Implement `calculateEvolution()` - compute scores across all four time periods
- [x] 4.3 Implement `detectTrend()` - compare 30d vs 1y scores and assign trend label

## 5. Gamification Labels

- [x] 5.1 Implement `getTitle()` - map overall score to fun title (10 tiers)
- [x] 5.2 Implement `getCategoryBadges()` - award badges for categories scoring 70+
- [x] 5.3 Implement `getTrendEmoji()` - return rocket/campfire/snowflake for trend
- [x] 5.4 Implement `generateShareableSummary()` - create formatted text for clipboard sharing

## 6. Dashboard UI - Landing Page

- [x] 6.1 Create landing page with search input for GitHub username
- [x] 6.2 Add input validation and error handling for empty/invalid usernames
- [x] 6.3 Style landing page with hero section and brief app description

## 7. Dashboard UI - Results Page

- [x] 7.1 Create results page layout with user profile header (avatar, name, bio, member since)
- [x] 7.2 Build overall score display component with color coding and gamification title
- [x] 7.3 Build radar chart component for category breakdown using Recharts
- [x] 7.4 Build category detail cards showing individual scores, metrics, and badges
- [x] 7.5 Build evolution line chart component showing score across time periods
- [x] 7.6 Build time period selector (tabs/toggle) that updates all displayed data
- [x] 7.7 Build progressive loading UI with per-section loading indicators
- [x] 7.8 Build share button with clipboard copy and success toast
- [x] 7.9 Add rate limit status display in footer/header
- [x] 7.10 Ensure responsive design for mobile, tablet, and desktop viewports

## 8. Integration & Polish

- [x] 8.1 Wire up data fetcher → scoring engine → time segmentation → UI data flow
- [x] 8.2 Add error states (user not found, API error, insufficient data)
- [x] 8.3 Add disclaimer about public data limitations
- [x] 8.4 Test with diverse GitHub profiles (active, inactive, new accounts)
- [x] 8.5 Configure deployment to Vercel
