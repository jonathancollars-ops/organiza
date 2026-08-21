# Project: Organiza Mobile (React Native / Expo) — Comprehensive Audit & Strategic Roadmap

## Architecture
- **Framework**: React Native with Expo SDK (TypeScript strict mode)
- **State Management**: React Context (`DataContext`, `ThemeContext`), `AsyncStorage` via `StorageService`
- **UI & Themes**: 3 themes (`dark`, `amoled`, `light`) via `src/theme/index.ts`, custom contrast algorithm `getContrastTextColor`
- **Core Domains**:
  - Academic Schedule & Calendar (`App.tsx`, `CalendarScreen.tsx`, `ScheduleScreen.tsx`, `dateUtils.ts`)
  - Grades & Final Exam Simulator (`GradeEngine.tsx`, `GradesScreen.tsx`, `GradeSimulatorModal.tsx`)
  - Attendance & LDB Compliance (`AttendanceScreen.tsx`, `AttendanceService.ts`, `PendingAttendanceModal.tsx`)
  - Study Hub & Pomodoro (`StudyScreen.tsx`, `gamification.ts`)
  - External Integrations & AI (`TeamsService.ts`, `GoogleSheetsService.ts`, `AIParsingService.ts`, `SyncService.ts`, `LocalAIInferenceService.ts`)

## Feature Inventory & Bug Remediations
| # | Feature / Bug Remediation | Description | Milestone | Status |
|---|---------------------------|-------------|-----------|--------|
| 1 | Category Color Light Contrast | Fix `Saúde/Academia` `#00FFAA` unreadable on light theme | M2 | DONE |
| 2 | Safe Area Insets Modernization | Replace legacy `SafeAreaView` with `react-native-safe-area-context` (`App.tsx`, modals) | M2 | DONE |
| 3 | Button & Banner Text Contrast | Use `getContrastTextColor` for buttons/banners with `colors.primary`, `colors.danger`, `colors.success` | M2 | DONE |
| 4 | Badges & Kanban Contrast in Light Theme | Use `colors.successDark`, `colors.warningDark` in light mode badges | M2 | DONE |
| 5 | Teams Modal Terminal Log Contrast | Fix hardcoded ActivityIndicators and dark terminal log text | M2 | DONE |
| 6 | GradeEngine Zero-Items Bug | Fix `calculateFinalGrade` marking empty subjects as failed | M3 | DONE |
| 7 | GradeSimulator 0-Grade Bug | Fix `parseFloat` falsy evaluation for target grade 0 | M3 | DONE |
| 8 | Timezone UTC-3 Shift Bug | Replace `toISOString().split('T')[0]` with `getLocalDateString()` | M3 | DONE |
| 9 | StorageService Data Cleansing & Backup | Include `TEAMS_CONFIG_KEY`, `THEME_KEY`, `streak` restoration in backup | M3 | DONE |
| 10 | Google Sheets BR Date Parsing | Support `DD/MM/YYYY HH:mm` timestamps in sync comparison | M3 | DONE |
| 11 | AI Parser Code Fence Extraction | Robust regex/substring JSON extraction around LLM text | M3 | DONE |
| 12 | StudyScreen Memory & Interval Leaks | Toast timeout ref cleanup and stable Pomodoro interval | M3 | DONE |
| 13 | Weekly Recurring Start Date Guard | Ensure recurring events only show on/after start date | M3 | DONE |
| 14 | Automated Test Expansion & Regressions | Add comprehensive regression suite for all fixes + 0 TS errors | M4 | DONE |
| 15 | Strategic 10-Feature Innovation Report | Document 10 high-impact student features with value prop, UX, feasibility | M5 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Codebase Survey & Audit | Deep static/visual/logic audit | None | DONE |
| M2 | UI, Themes & Visual Remediations | Fix all 17 UI/theme contrast and safe area defects | M1 | DONE |
| M3 | State, Logic, Calc & Async Remediations | Fix calculation bugs, UTC-3 shifts, storage, leaks | M1 | DONE |
| M4 | Test Validation & Regression Expansion | Expand tests with 100% pass + 0 TS errors | M2, M3 | DONE |
| M5 | Strategic 10-Feature Innovation Report | Exhaustive report on student features & bug inventory | M1, M4 | DONE |
| M6 | Multi-Agent Verification Gate & Delivery | Reviewers, Challengers & Forensic Auditor verification | M2, M3, M4, M5 | DONE |

## Code Layout
- `src/theme/index.ts` — Theme tokens, colors, contrast helper
- `src/components/GradeEngine.tsx` — Grade calculation formulas
- `src/components/GradeSimulatorModal.tsx` — Final exam simulator
- `src/components/AIImportModal.tsx` — Universal AI import modal
- `src/components/AIGradeCriteriaModal.tsx` — Syllabus criteria modal
- `src/components/AchievementsModal.tsx` — Achievements & gamification modal
- `src/components/AnalyticsAndAACCModal.tsx` — AACC hours modal
- `src/components/GroupProjectsModal.tsx` — Group project kanban modal
- `src/components/TeamsConfigModal.tsx` — Teams integration modal
- `src/components/TodaySummaryWidget.tsx` — Widget summary
- `src/components/SettingsModal.tsx`, `SubjectDetailsModal.tsx`, `OnboardingModal.tsx` — App modals
- `src/screens/StudyScreen.tsx`, `AttendanceScreen.tsx`, `GradesScreen.tsx`, `CalendarScreen.tsx` — Main screens
- `src/services/storage.ts` — AsyncStorage persistence
- `src/services/GoogleSheetsService.ts` — Google Sheets integration
- `src/services/AIParsingService.ts` — AI extraction service
- `src/services/TeamsService.ts` — Microsoft Teams integration
- `src/utils/date.ts` — Date formatting and timezone handling
- `test/` — Automated test suites
- `d:\Antigravity\Organiza\.agents\STRATEGIC_FEATURE_REPORT.md` — Strategic Innovation & Product Roadmap Report
