# Track Specification: Deep Codebase Hardening & Polish

## 1. Overview
This track delivers comprehensive runtime hardening, defensive programming, and edge-case polish across the entire Project Lumen codebase. The objective is to identify and eradicate silent runtime defects—issues that pass TypeScript compilation but can crash the application, leak memory, corrupt storage, or cause confusing states in real-world student usage.

---

## 2. Functional Requirements

### FR-1: Empty State Polish & Zero-State UX
- **Target Screens:** `AgendaScreen`, `EstudosScreen`, `FaltasScreen`, `NotasScreen`, `LumenAIScreen`.
- **Behavior:** Every screen must gracefully handle empty datasets (no events, no subjects, no notes, no streak history).
- **UX Requirement:** Display clean, themed iconography, helpful explanatory microcopy, and a prominent primary call-to-action (CTA) button that opens the relevant creation modal or action sheet.

### FR-2: Storage Resilience & Corrupt State Defense
- **Target:** `StorageService.ts` and related persistence layers.
- **Behavior:** Implement resilient parsing for all stored keys (`@events`, `@subjects`, `@attendance`, `@streaks`, `@app_settings`).
- **Defense:** In the event of disk read errors or malformed JSON, catch errors, restore valid default models, and log diagnostic warnings rather than crashing the component tree. Ensure write operations handle disk exhaustion or quota rejections gracefully.

### FR-3: Timer Memory Leak Prevention & Lifecycle Hygiene
- **Target:** `EstudosScreen.tsx`, Pomodoro engine, and Stopwatch hooks.
- **Behavior:** Ensure all `setInterval` and `setTimeout` subscriptions are unconditionally cleared upon component unmount, tab change, or application backgrounding.
- **Defense:** Prevent `setState` calls on unmounted components and eliminate background thread CPU drain.

### FR-4: Recurrence & Temporal Calculation Resiliency
- **Target:** Recurrence logic in event engines (`src/utils/recurrence.ts` and `AgendaScreen.tsx`).
- **Behavior:** Safeguard multi-month and monthly recurrence rules against edge-case calendar anomalies:
  - 31st day events falling on 28/29/30-day months (clamp to end-of-month).
  - Leap year transitions (February 29th).
  - Guard against negative intervals or recurrence calculations producing infinite loops.

### FR-5: Input Sanitization & Numerical Immunity (Anti-NaN)
- **Target:** Grade inputs, credit hours, absence maximums, and percentage calculators.
- **Behavior:** Guard all numerical transformations against `NaN`, `Infinity`, empty strings, negative numbers, or comma-versus-period locale mismatches.
- **Defense:** Fallback to sanitized default numbers before performing GPA or statutory attendance math.

### FR-6: Update Checker Deduplication & Reliability
- **Target:** `UpdateModal` and update detection service.
- **Behavior:** Ensure dismissed update alerts do not re-prompt continuously on every cold start. Compare SemVer strings rigorously and verify release asset tags to avoid false positives.

---

## 3. Non-Functional Requirements
- **Performance:** Zero frame drops during animations, modal transitions, or timer ticks.
- **Themes:** All new empty states, badges, and alerts must support Light, Dark, and AMOLED True Black themes with WCAG 2.1 AA contrast.
- **Type Safety:** 100% strict TypeScript typing without type assertions (`as any`) or unhandled undefined checks.

---

## 4. Acceptance Criteria
- [ ] Every screen displays a polished empty state when data is empty.
- [ ] Corrupted storage entries fail safely and restore default data structures without crashing.
- [ ] Pomodoro and Stopwatch timers exhibit zero memory leaks or unmounted state updates.
- [ ] Calendar recurrence calculations accurately handle Feb 29 and month-end dates.
- [ ] No calculations in Faltas or Notas produce `NaN` or `Infinity`.
- [ ] All existing 34 test suites and all newly introduced hardening test suites pass (100% green).
- [ ] Strict TypeScript compilation passes with zero errors.

---

## 5. Out of Scope
- Migrating local storage to a remote cloud database (Lumen remains strictly offline-first).
- Full UI restructuring (changes focus strictly on hardening, edge cases, and polish).
