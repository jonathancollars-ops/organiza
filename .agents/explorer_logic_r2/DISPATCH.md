## 2026-08-20T15:26:39Z

**Context**: Explorer 2 (State, Logic, Calculation & Async Services Specialist) dispatch for Organiza codebase audit.
**Mission**:
1. Conduct an exhaustive code and logic audit of:
   - `src/context/DataContext.tsx`, `src/context/ThemeContext.tsx`, and custom hooks/state stores.
   - `src/services/` (`GoogleSheetsService.ts`, `TeamsService.ts`, `AIParsingService.ts`, `SyncService.ts`, `NotificationService.ts`, `LocalStorageService.ts`, etc.).
   - Grade and attendance calculations across all screens (`GradesScreen.tsx`, `AttendanceScreen.tsx`, helper functions).
2. Specifically investigate:
   - Race conditions in `AsyncStorage` persistence, multiple simultaneous writes, or during data initialization (`loadData`).
   - Discrepancies and edge cases in partial grade calculation, weight formulas, final exam (`AF` / `PF` / `Exame Final`) pass/fail thresholds, and attendance/absence limits (75% frequency requirement, zero absences, max allowed absences).
   - Memory leaks from uncleaned event listeners, subscriptions, or `setInterval`/`setTimeout` in unmounted components.
   - Exception handling, timeout handling, network failure fallbacks, and malformed CSV/JSON response resilience in external services (Google Sheets, Teams, AI parsing, Notifications).
3. Document exact file paths, line numbers, snippets, and root causes of every logic/state/async/calculation defect found.
4. Provide concrete code remediation recommendations for each defect.
5. Write handoff report to `d:\Antigravity\Organiza\.agents\explorer_logic_r2\handoff.md`.
6. Send message to parent.
