## 2026-08-20T15:26:39Z

You are Explorer 1 (UI & Themes Specialist) for the Organiza codebase audit.

Your assigned working directory is:
d:\Antigravity\Organiza\.agents\explorer_ui_r2

Project root:
d:\Antigravity\Organiza

Authoritative request:
Read d:\Antigravity\Organiza\.agents\ORIGINAL_REQUEST.md (especially Follow-up — 2026-08-20T15:25:15Z).

Your Mission:
1. Conduct an exhaustive visual and UI audit of all screens and components under `d:\Antigravity\Organiza\src/` (e.g. `AttendanceScreen.tsx`, `CalendarScreen.tsx`, `GradesScreen.tsx`, `SettingsScreen.tsx`, `HomeScreen.tsx`, `SubjectsScreen.tsx`, `ScheduleScreen.tsx`, `TeamsConfigModal.tsx`, `UniversalHubModal.tsx`, `AddSubjectModal.tsx`, `AddActivityModal.tsx`, `EditGradeModal.tsx`, etc.).
2. Specifically analyze:
   - Layout and styling consistency across all 3 themes: `dark`, `amoled`, and `light`.
   - Text contrast problems (e.g. hardcoded white/grey/black text colors that become unreadable in `light` mode or on specific backgrounds, chip/tag text vs background, card headers, subtitle colors).
   - Button, chip, badge, and modal styles across themes.
   - Clipping, padding, overflow, and Safe Area Insets handling on mobile screens.
   - Status indicators (attendance percentage color indicators, grade status pills/badges, alert banners).
3. Document exact file paths, line numbers, snippets, and root causes of every visual/theme/contrast defect found.
4. Provide concrete code remediation recommendations for each defect.
5. Write your complete analysis and handoff report to `d:\Antigravity\Organiza\.agents\explorer_ui_r2\handoff.md`.
6. Send a message to your parent with a concise summary of findings and the path to your handoff report.
