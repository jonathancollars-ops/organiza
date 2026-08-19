# Original User Request

## Initial Request — 2026-08-18T14:33:10Z

Audit the entire Organiza mobile codebase (React Native/Expo) for any visual, UX, state management, edge case, or TypeScript/logic bugs, verify and fix all identified issues with rigorous testing, and trigger a verified Android APK build.

Working directory: d:\Antigravity\Organiza
Integrity mode: development

## Requirements

### R1. Comprehensive Visual & UX Bug Audit
Audit all screens and components in `d:\Antigravity\Organiza\src` (`AttendanceScreen.tsx`, `CalendarScreen.tsx`, `GradesScreen.tsx`, `SettingsScreen.tsx`, `TeamsConfigModal.tsx`, etc.):
- Verify layout consistency across Dark and Light themes (theme contrast, text visibility, padding, clipping).
- Check modal animations, dismiss behaviors, safe area insets on mobile devices.
- Verify status indicators (attendance percentage, grade calculations with final exams, alert banners).

### R2. Code Logic, TypeScript & State Management Audit
- Ensure strict TypeScript compilation with zero errors (`npx tsc --noEmit`).
- Verify data persistence (`AsyncStorage` serialization/deserialization, date handling, time zones).
- Audit the Teams, Power Automate, Google Sheets and AI parsing flows (`GoogleSheetsService.ts`, `TeamsService.ts`, `AIParsingService.ts`, `SyncService.ts`) for unhandled exceptions, null/undefined edge cases, malformed CSV/JSON responses.

### R3. Comprehensive Test Verification
- Run all existing test suites (`npx tsx test/e2e_teams_ai.test.ts`, etc.) and ensure 100% pass rate.
- Add any missing test cases covering audited fixes.

### R4. Final Production/Preview APK Build
- Trigger EAS Android build (`npx -y eas-cli build -p android --profile preview --non-interactive`).
- Provide the verified build download link and update all documentation artifacts.

## Acceptance Criteria

### Visual & Code Integrity
- [ ] TypeScript check (`npx tsc --noEmit`) passes with 0 errors.
- [ ] No visual contrast, text truncation, or unhandled theme bugs across all screens.
- [ ] All date/time manipulations correctly handle Brazilian format, leap years, and edge cases.

### Integration & Automated Tests
- [ ] All E2E and unit test suites pass with 100% success (minimum 134 tests).
- [ ] Simulation and real synchronization flows execute without crashing or state corruption.

### Build Delivery
- [ ] EAS Android build succeeds and outputs a valid installable APK URL.
- [ ] Download link and QR code updated in artifacts.
