## 2026-08-20T15:33:53Z
You are Worker 1 (UI, Themes & Visual Remediation Specialist) for the Organiza project.

Your assigned working directory is:
d:\Antigravity\Organiza\.agents\worker_ui_r2

Project root:
d:\Antigravity\Organiza

Authoritative request:
Read d:\Antigravity\Organiza\.agents\ORIGINAL_REQUEST.md and the explorer report at d:\Antigravity\Organiza\.agents\explorer_ui_r2\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive File Write Ownership:
- `src/theme/index.ts`
- `src/components/AIImportModal.tsx`
- `src/components/AIGradeCriteriaModal.tsx`
- `src/components/AchievementsModal.tsx`
- `src/components/AnalyticsAndAACCModal.tsx`
- `src/components/GroupProjectsModal.tsx`
- `src/components/TeamsConfigModal.tsx`
- `src/components/SettingsModal.tsx`
- `src/components/SubjectDetailsModal.tsx`
- `src/components/OnboardingModal.tsx`

Your Mission:
1. Implement the UI & theme contrast remediations documented in `d:\Antigravity\Organiza\.agents\explorer_ui_r2\handoff.md`:
   - In `src/theme/index.ts`: Add `getCategoryColor(category: string, theme: ThemeType = 'dark'): string` so that `'Saúde/Academia'` returns `#059669` (or a high-contrast dark green) in `light` theme and `#00FFAA` in `dark`/`amoled` themes. Ensure `getContrastTextColor` correctly handles high-luminance tokens.
   - In `src/components/AIImportModal.tsx`: Fix primary/action buttons with `backgroundColor: colors.primary` and `colors.success` so their text color uses `getContrastTextColor(colors.primary)` / `getContrastTextColor(colors.success)` (not hardcoded `#fff`).
   - In `src/components/AIGradeCriteriaModal.tsx`: Fix amber badge text contrast (`theme === 'light' ? '#b45309' : '#FBBF24'`) and action button text contrast.
   - In `src/components/AchievementsModal.tsx`: Fix success badge text colors in light mode to use `colors.successDark` over `colors.successLight`.
   - In `src/components/AnalyticsAndAACCModal.tsx`: Fix percentage badge text colors in light mode to use `colors.successDark`.
   - In `src/components/GroupProjectsModal.tsx`: Fix 100% completion badge text to use `colors.successDark` in light mode, and ensure Kanban column header texts are properly contrasted (`colors.successDark` / `colors.warningDark` in light mode).
   - In `src/components/TeamsConfigModal.tsx`: Ensure ActivityIndicator colors use `getContrastTextColor(colors.primary)`, and terminal console log colors use high-visibility neon colors (e.g. `#34D399` or `#00FFAA`) on the black `#0a0a0c` console background regardless of active theme.
   - In `src/components/SettingsModal.tsx`, `src/components/SubjectDetailsModal.tsx`, `src/components/OnboardingModal.tsx`: Replace legacy `SafeAreaView` from `react-native` with `SafeAreaView` from `react-native-safe-area-context` with `edges={['top', 'bottom']}`.
2. Verify TypeScript type safety: run `npx tsc --noEmit` and ensure 0 errors.
3. Run existing theme tests: `npx tsx test/theme_and_id.test.ts` and ensure 100% pass.
4. Write your completion report to `d:\Antigravity\Organiza\.agents\worker_ui_r2\handoff.md`.
5. Send a completion message back to your parent.
