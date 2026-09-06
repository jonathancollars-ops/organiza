# Lumen Technology Stack & Architectural Standards

## 1. Core Platform & Runtime
- **Framework:** React Native `0.81.5` / React `19.1.0`
- **Tooling & Engine:** Expo SDK `~54.0.0` (Bare / Prebuild workflow with native Android directory)
- **Language:** TypeScript `^5.9.2`
  - Strict mode enabled (`"strict": true` in `tsconfig.json`)
  - Explicit typing across all data interfaces (`src/types/index.ts`)
  - Zero tolerance for implicit `any` or unchecked `null`/`undefined`

## 2. Navigation Architecture
- **Router:** React Navigation v7
  - `@react-navigation/native` `^7.1.18`
  - `@react-navigation/bottom-tabs` `^7.4.3`
- **Tab Structure:** 5 primary tabs managed via `src/navigation/AppNavigator.tsx`:
  1. `Agenda`: Daily schedule, calendar overview, recurring events.
  2. `Estudos`: Pomodoro timer, stopwatch, study streaks.
  3. `Lumen AI`: Intelligent conversational academic tutor.
  4. `Faltas`: Statutory absence tracker & risk projections.
  5. `Notas`: Semester grade calculations and GPA metrics.

## 3. State Management & Storage
- **Architecture:** Offline-first layered architecture.
- **Local Persistence:** `@react-native-async-storage/async-storage` `2.2.0`
  - Centralized access via `StorageService` (`src/services/storage.ts`).
  - Corrupted storage defense, fallback schemas, and synchronous caching layers.
- **Application State:** React Context API + Custom Hooks:
  - `ThemeContext`: Dynamic theme switching (Light, Dark, AMOLED).
  - `DataContext`: Global data orchestrator and reactive listeners.

## 4. UI & Interaction Components
- **Safe Area Insets:** `react-native-safe-area-context` `5.6.0`
- **Calendar Engine:** `react-native-calendars` `^1.1314.0` localized to Portuguese (`pt-br`).
- **Tactile Inputs:** Custom `InteractiveClockPicker` with circular touch trigonometry (`atan2`).
- **Icons:** `@expo/vector-icons` `^15.0.3` (Feather & Ionicons).
- **Haptics:** `expo-haptics` for tactile micro-feedback.

## 5. Automated Testing & Verification
- **Test Runner:** Jest `^29.2.1` (`ts-jest`, `jest-expo` `~54.0.0`)
- **Testing Framework:** `@testing-library/react-native` `^13.3.3`
- **Test Harness:** Comprehensive suite covering Services, Calculation Engines, Recurrence Rules, and UI Components (34 test suites, 100% passing).
- **Standard:** Every new feature, calculation, or bug fix must include dedicated unit tests in `test/`.

## 6. CI/CD & Android Release Distribution
- **CI Pipeline:** GitHub Actions (`.github/workflows/build-android.yml`)
  - Automated testing & type checking.
  - Native build with Java 17 Temurin, Android SDK Build Tools 36.0.0, Gradle Wrapper.
  - Release APK packaging with SHA256 checksum generation.
- **Auto-Update System:** Custom in-app update checker querying GitHub Releases API with SemVer comparisons and APK package verification.
