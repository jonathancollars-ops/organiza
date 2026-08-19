## 2026-08-18T15:01:23Z
You are Worker 2 (UI, UX & Safe Area Specialist) for Milestone 2 of the Organiza project.
Your working directory is: d:\Antigravity\Organiza\.agents\worker_m2_ui
Read ORIGINAL_REQUEST.md at: d:\Antigravity\Organiza\ORIGINAL_REQUEST.md
Read PROJECT.md at: d:\Antigravity\Organiza\PROJECT.md
Read Explorer 1's survey report at: d:\Antigravity\Organiza\.agents\explorer_ui_survey\survey_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
1. Theme & WCAG AA Contrast Ratios (`src/theme/index.ts`, `src/components/TeamsConfigModal.tsx`, `src/screens/GradesScreen.tsx`, `src/screens/AttendanceScreen.tsx`, `src/components/TodaySummaryWidget.tsx`):
   - In `src/theme/index.ts`, add dark badge text colors to `Colors.light` (`warningDark: '#B45309'`, `dangerDark: '#B91C1C'`, `successDark: '#047857'`) and ensure `Colors.dark` provides accessible badge contrasts.
   - In `src/components/TeamsConfigModal.tsx`, replace all hardcoded `#000000` text on primary buttons (lines 970, 988, 1040, 1062, 1133, 1160, 1466, 1508) with `getContrastTextColor(colors.primary)`.
   - Update status/alert badge text in `GradesScreen.tsx`, `AttendanceScreen.tsx`, and `TodaySummaryWidget.tsx` to use the high-contrast dark text variants in light mode.
2. Modal Dismiss & Backdrop Tap (`src/components/EventModal.tsx`, `src/components/EventTypeModal.tsx`, `src/components/GradeEngine.tsx`):
   - Add backdrop touch-to-dismiss (`TouchableOpacity` wrapper on `modalOverlay`) so tapping outside bottom/center sheets dismisses the modal gracefully.
3. KeyboardAvoidingView & Scroll Ergonomics:
   - In `EventModal.tsx`, `GradeEngine.tsx`, `SubjectModal.tsx`, `ExamModal.tsx`, `AnalyticsAndAACCModal.tsx`, and `GroupProjectsModal.tsx`, wrap modal forms in `KeyboardAvoidingView` (with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`) and `ScrollView` (`keyboardShouldPersistTaps="handled"`) to prevent keyboard occlusion on mobile screens.
4. Safe Area Insets (`src/components/SubjectModal.tsx`, `src/components/ExamModal.tsx`, `src/components/PendingAttendanceModal.tsx`, `src/components/EditSubjectModal.tsx`, `src/components/GradeSimulatorModal.tsx`):
   - Replace hardcoded `paddingTop: 50` on iOS with dynamic `SafeAreaView` from `react-native-safe-area-context` or `useSafeAreaInsets()`.
5. Header Viewport Responsiveness (`App.tsx`):
   - In `App.tsx`, adapt header action icons and title to fit 360px-390px mobile screens without wrapping or overflow.
6. Cold-Start Loading State (`App.tsx`):
   - In `App.tsx`, add `isInitializing: boolean` (initial true, set false after `loadData()` completes) and display an elegant loading indicator or splash during cold boot so empty states don't flash before storage loads.
7. Verification:
   - Run `npx tsc --noEmit` to ensure 0 TypeScript errors.
   - Run all test suites: `npx tsx test/e2e_teams_ai.test.ts`, `npx tsx test/google_sheets_and_date.test.ts`, and project tests.
8. Deliver your handoff report to `d:\Antigravity\Organiza\.agents\worker_m2_ui\handoff.md` and message parent when complete.
