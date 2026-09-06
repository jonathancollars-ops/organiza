# Implementation Plan: Deep Codebase Hardening & Polish

## Phase 1: Backend & Storage Engine Hardening (Core Resilience)
- [x] Task: Storage Defensive Layer & Fallback Engine
  - [x] Write failing test for corrupted AsyncStorage payload in `test/hardening_phase1.test.ts`
  - [x] Implement defensive try/catch and schema validator with fallback defaults in `StorageService.ts`
  - [x] Ensure all promise rejections in storage write calls are gracefully handled
- [x] Task: Recurrence Date & Leap-Year Boundary Hardening
  - [x] Write failing test for 31st-of-month and February 29th leap year recurrence in `test/hardening_phase1.test.ts`
  - [x] Implement month-end date clamping and boundary-safe logic in recurrence engine
- [x] Task: Numerical Sanitization (Anti-NaN Defense)
  - [x] Write failing test for malformed numeric inputs producing NaN in GPA/Absence math
  - [x] Implement robust numeric sanitizers in `AttendanceService.ts` and grade calculation helpers
- [x] Task: Phase 1 Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Security & Input Boundary Defense
- [x] Task: Modal Input Sanitization & Boundary Auditing
  - [x] Audit and sanitize all text/number inputs in EventModal, SubjectModal, and GradeModal
  - [x] Prevent negative durations, unbounded integers, and prototype pollution
- [x] Task: Gemini AI Offline Fallback & Key Isolation
  - [x] Verify offline handling when device lacks internet during AI requests
  - [x] Ensure graceful user-facing error message instead of uncaught network promise rejection
- [x] Task: Phase 2 Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Frontend UI Polish, Empty States & Timer Hygiene
- [x] Task: Timer Lifecycle Hygiene & Memory Leak Elimination
  - [x] Audit `EstudosScreen.tsx` Pomodoro and Stopwatch intervals
  - [x] Ensure all `setInterval` and `setTimeout` handlers are unconditionally cleared on unmount, blur, and tab switch
- [x] Task: Polished Zero-State UX Across All 5 Screens
  - [x] Implement informative, themed empty states for `AgendaScreen` (no events)
  - [x] Implement empty state for `EstudosScreen` (no streak or history yet)
  - [x] Implement empty state for `FaltasScreen` (no subjects enrolled)
  - [x] Implement empty state for `NotasScreen` (no grades recorded)
  - [x] Implement empty state for `LumenAIScreen` (suggested academic prompt chips)
- [x] Task: Theme Contrast & Touch Target Audit (WCAG 2.1 AA)
  - [x] Verify all empty state icons, typography, and CTA buttons meet 4.5:1 contrast across Light, Dark, and AMOLED
  - [x] Verify 44x44dp minimum hit area on all newly introduced action buttons
- [x] Task: Phase 3 Verification & Checkpoint (Refer to workflow.md)

## Phase 4: QA Automated Testing & Regression Harness
- [x] Task: Automated Hardening Test Suites
  - [x] Write comprehensive unit tests for all edge cases in `test/`
  - [x] Verify corrupted storage recovery suite
  - [x] Verify calendar recurrence boundary suite
  - [x] Verify NaN immunity suite
- [x] Task: Full Regression Harness & Strict TypeScript Check
  - [x] Run full test suite (`npm test`) and verify 100% green status
  - [x] Run strict TypeScript type check (`npx tsc --noEmit`) with zero errors
- [x] Task: Phase 4 Verification & Checkpoint (Refer to workflow.md)
