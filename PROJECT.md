# Project: Organiza Codebase Audit, Fix, Test & EAS APK Build

## Architecture
- **Framework**: React Native with Expo SDK 52, TypeScript, React Navigation / Expo Navigation, AsyncStorage persistence.
- **UI/UX & Themes**: Dynamic Dark/Light mode theme system with WCAG AA contrast compliance, responsive layout, SafeAreaView handling, and modal interaction ergonomics.
- **Logic & Services**: Academic calculation engines (grades, absences, attendance quotas), study timers/streaks, date/time handling (local timezone resilient), notifications, and cloud/external integrations (Microsoft Teams Graph API, Power Automate webhooks, Google Sheets, Gemini/OpenAI message parsing with offline queue).
- **Testing Track**: Master E2E test suite (134 tests), unit test suites (>750 assertions), and adversarial challenge harnesses.
- **Build Track**: EAS Cloud Build (`preview` profile, Android standalone APK distribution).

## Feature Inventory
| # | Feature / Remediation Item | Description | Milestone | Source | Status |
|---|----------------------------|-------------|-----------|--------|--------|
| 1 | Local Date / Timezone Resiliency | Provide and use `getLocalDateString(d)` to prevent UTC-3 date skipping between 21:00-23:59 | M1 | Explorer 2 | DONE |
| 2 | Grade Calculation Parity | Unify `GradesScreen.tsx` grade calculation with `GradeEngine.tsx` (omit future un-graded assignments) | M1 | Explorer 2 | DONE |
| 3 | Root Streak State Hydration | Hydrate and maintain `streak` in `App.tsx` state for `<AchievementsModal />` | M1 | Explorer 2 | DONE |
| 4 | Network Request Timeouts | Add `AbortSignal.timeout(15000)` / timeout safeguards across Teams, AI and Google Sheets services | M1 | Explorer 2 | DONE |
| 5 | CSV Parsing & Recurrence Guards | Handle multi-line CSV fields in GoogleSheetsService & guard undefined recurrenceDays in TodaySummaryWidget | M1 | Explorer 2 | DONE |
| 6 | Theme WCAG AA Contrast Ratios | Fix hardcoded `#000` on primary in Light mode (`TeamsConfigModal`) and low contrast alert badge colors | M2 | Explorer 1 | DONE |
| 7 | Modal Backdrop Dismiss & Gestures | Enable backdrop touch-to-dismiss on transparent modals (`EventModal`, `EventTypeModal`, etc.) | M2 | Explorer 1 | DONE |
| 8 | KeyboardAvoidingView & Scroll | Add `KeyboardAvoidingView` and `ScrollView` to modal forms to prevent keyboard occlusion | M2 | Explorer 1 | DONE |
| 9 | Safe Area Inset Handling | Replace hardcoded `paddingTop: 50` with dynamic SafeAreaView in full-screen modals for iOS & Android | M2 | Explorer 1 | DONE |
| 10 | Header Viewport Responsiveness | Adapt top navigation bar / header action buttons for 360px-390px mobile screens | M2 | Explorer 1 | DONE |
| 11 | Cold-Start Hydration State | Add `isInitializing` loading splash/indicator to prevent empty-state flash before storage load | M2 | Explorer 1 | DONE |
| 12 | Test Environment Mocks & Fixes | Add `expo-haptics`/`expo-modules-core` mocks in `setup_env.ts` and AI parser regex refinements | M3 | Explorer 3 | DONE |
| 13 | Full Test Suite Execution | Execute all 18+ test suites and achieve 100% pass rate with >750 total passing tests (min 134 master) | M3 | Explorer 3 | IN_PROGRESS |
| 14 | Additional Unit Test Suites | Add dedicated unit test suites for `GoogleSheetsService`, `theme`, and `id` utilities | M3 | Explorer 3 | DONE |
| 15 | EAS Android Preview APK Build | Execute `npx -y eas-cli build -p android --profile preview --non-interactive` and capture artifact link | M4 | Explorer 3 | IN_PROGRESS |
| 16 | Documentation & Artifact Updates | Update README.md, changelog, and audit reports with verified APK build URL and test metrics | M4 | Explorer 3 | IN_PROGRESS |

| 17 | Lumen 3.0 Rebranding & Discreet Icon | Complete rebranding to Lumen with matte obsidian satin prism icon, 3.0.0 manifest | M5 | User Request | DONE |
| 18 | Automatic Semester Engine | Clock-based semester calculation (Jan-Jun .1, Jul-Dec .2) without manual setup | M5 | User Request | DONE |
| 19 | Weighted Cumulative CR & What-If Simulation | Weighted average by subject credits with What-If simulations (Stop now, Target CR, Best case) | M5 | User Request | DONE |
| 20 | Degree Matrix & % Completion | Progress bar, semester-by-semester matrix and clean completion confirmations | M5 | User Request | DONE |
| 21 | Socratic AI Tutor & Local Edge Models | Socratic method tutor, subject context switcher, 3 download tiers (340MB, 1.18GB, 2.45GB) | M5 | User Request | DONE |
| 22 | Weekly Schedule Modal & Teams Deprecation | Header button for Grade Horária Semanal and complete removal of legacy Teams code | M5 | User Request | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Logic, State & Integration Fixes | Date timezone utility, Grade parity, Streak hydration, Network timeouts, CSV & recurrence guards | Survey complete | DONE |
| 2 | Visual, UX & Safe Area Fixes | Theme contrast, modal dismiss, KeyboardAvoidingView, SafeArea insets, Header responsive layout | M1 | DONE |
| 3 | Comprehensive Test Verification | Test mocks, regex fixes, unit test expansion, 100% pass across all test suites | M1, M2 | DONE |
| 4 | EAS Android APK Build & Artifacts | Trigger EAS preview build, obtain standalone APK download link, update documentation | M3 | DONE |
| 5 | Lumen 3.0 Major Evolution | Lumen AI Tutor, CR Tracker, Degree Matrix, Auto Semesters, Discreet Icon & Full 5 Tabs | M4 | DONE |

## Interface Contracts
### `src/utils/date.ts` (or `src/utils/index.ts`) ↔ Consumers
- `export function getLocalDateString(d: Date = new Date()): string`
- `export function formatDisplayDate(dateStr: string): string`
- `export function parseLocalDate(dateStr: string): Date`

### `src/theme/index.ts` ↔ UI Components
- `Colors.light.warningDark: '#B45309'`
- `Colors.light.dangerDark: '#B91C1C'`
- `Colors.light.successDark: '#047857'`
- `getContrastTextColor(backgroundColor: string): string`
