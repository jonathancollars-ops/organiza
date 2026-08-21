# Test Infrastructure & Suite Documentation

## 1. Overview & Architecture

The Organiza test infrastructure is designed for high-determinism, multi-tier validation of mobile application logic, services, storage persistence, WCAG accessibility, and state machines. Tests execute directly in Node.js via `tsx` TypeScript runtime, utilizing a headless in-memory storage environment (`test/setup_env.ts`) that mocks React Native, AsyncStorage, Expo Notifications, Expo Haptics, and Expo FileSystem with zero external runtime dependencies.

```
Organiza Test Architecture:
┌─────────────────────────────────────────────────────────────┐
│                    Test Runner (tsx)                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Tier 1 & 2  │       │    Tier 3    │       │    Tier 4    │
│ Sanity & Ops │       │  Boundaries  │       │  E2E Flows   │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Mock Environment (MemoryStore + Expo/RN Module Interceptors)│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Test Tiers Definition

| Tier | Category | Scope & Purpose |
|---|---|---|
| **Tier 1** | Sanity & Interface Contracts | Verifies domain model schemas, default values, contract types (`AppSettings`, `StudySession`, `AppEvent`, `GamificationData`), and theme palettes. |
| **Tier 2** | Functional & State Transitions | Tests primary operational paths, reactive setting sync, progressive stopwatch counting, calendar dot generation, and Next Activity calculation. |
| **Tier 3** | Boundaries, Sanitization & Adversarial | Validates boundary limits (1-180m focus, 1-60m break, 30s stopwatch threshold), non-numeric fallbacks, WCAG contrast luminance formulas, and corruption recovery. |
| **Tier 4** | E2E Workflows & Multi-Session | Simulates complete user lifecycles: backup export/import roundtrip, multi-subject Pomodoro + Stopwatch study sessions, XP levels, streak maintenance, and checklist management. |

---

## 3. Feature Inventory & Test Coverage Map

| Req | Feature Name | Core File(s) | Test Suite File | Tiers Covered |
|---|---|---|---|---|
| **R1** | Fullscreen & Status Bar Control | `src/types/index.ts`, `src/services/storage.ts`, `src/components/SettingsModal.tsx`, `App.tsx` | `test/r1_fullscreen_statusbar.test.ts` | Tiers 1, 2, 3, 4 |
| **R2** | Pomodoro Sync & Free Stopwatch | `src/screens/StudyScreen.tsx`, `src/services/storage.ts`, `src/types/index.ts` | `test/r2_pomodoro_stopwatch.test.ts` | Tiers 1, 2, 3, 4 |
| **R3** | Agenda Screen, Calendar & Contrast | `src/screens/AgendaScreen.tsx`, `App.tsx`, `src/theme/index.ts` | `test/r3_agenda_screen.test.ts` | Tiers 1, 2, 3, 4 |

---

## 4. Test Suite Inventory

### 4.1. `test/r1_fullscreen_statusbar.test.ts`
- **Tier 1**: Factory default verification (`fullscreen: false`, `theme: 'dark'`, `pomodoroFocusMin: 25`).
- **Tier 2**: Storage persistence of `fullscreen: true` / `fullscreen: false`, theme status bar mapping (`dark-content` for light, `light-content` for dark/amoled), and safe area edge selection (`['bottom']` vs `['top', 'bottom']`).
- **Tier 3**: Legacy settings fallback (missing `fullscreen` defaults to `false`), corrupted JSON storage recovery, and 20 rapid state toggle race-condition checks.
- **Tier 4**: Backup export & import roundtrips preserving fullscreen flag and theme selection.

### 4.2. `test/r2_pomodoro_stopwatch.test.ts`
- **Tier 1**: Initial gamification and streak states (0 XP, Level 1, 0 streak).
- **Tier 2**: Dynamic sync of `timeLeft` when `focusMinutesDefault` or `breakMinutesDefault` change while idle, running timer protection, quick presets (15m, 25m, 45m, 50m, 60m), and stopwatch time formatting (`MM:SS` / `HH:MM:SS`).
- **Tier 3**: Input boundaries & sanitization (1-180m focus, 1-60m break, non-numeric fallbacks), 30-second minimum stopwatch threshold, XP level progression (`Math.floor(XP / 200) + 1`), and streak date state machine.
- **Tier 4**: E2E multi-session simulation logging Pomodoro and Stopwatch sessions, awarding proportional XP, updating streaks, and calculating per-subject study time totals.

### 4.3. `test/r3_agenda_screen.test.ts`
- **Tier 1**: Theme palette constants and category color mappings.
- **Tier 2**: Imminent task / Next activity calculation across time intervals (Early morning countdown `"Começa em X min"`, in-progress status `"EM ANDAMENTO"`, and between-events detection), and interactive calendar multi-dot markings.
- **Tier 3**: WCAG Relative Luminance / Contrast Helper (`getContrastTextColor`) with Hex (#RGB, #RRGGBB), RGB, HSL, and invalid fallbacks, exam week mode filtering, and exclusion of archived subjects/cancelled classes.
- **Tier 4**: Tasks & activities checklist state transitions (toggle completion, strikethrough, subject filtering, creation, and deletion).

---

## 5. Execution Commands

To execute individual suites:
```bash
# Run R1 (Fullscreen & Status Bar)
npx tsx test/r1_fullscreen_statusbar.test.ts

# Run R2 (Pomodoro & Stopwatch)
npx tsx test/r2_pomodoro_stopwatch.test.ts

# Run R3 (Agenda Screen & Contrast)
npx tsx test/r3_agenda_screen.test.ts
```

To run all suites in sequence:
```bash
npx tsx test/r1_fullscreen_statusbar.test.ts && npx tsx test/r2_pomodoro_stopwatch.test.ts && npx tsx test/r3_agenda_screen.test.ts
```
