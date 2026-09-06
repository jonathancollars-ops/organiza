# Project Lumen (Lumen Academic OS)

## Product Vision

Project Lumen is an intelligent, offline-first, and privacy-centric academic operating system designed specifically for higher education students. It serves as an all-in-one companion that replaces fragmented student tools (calendars, grade spreadsheets, habit trackers, and notes) with a cohesive, beautifully crafted mobile experience. 

Operating under a strict offline-first philosophy, Lumen ensures complete data sovereignty: student records, schedules, grades, and study history remain entirely on-device, protected from telemetry, cloud leaks, or vendor lock-in.

---

## Core Product Pillars

### 1. Smart Academic Schedule & Temporal Organization
- Comprehensive calendar management tailored to university timetables.
- Interactive analog clock time picker for tactile, ergonomic hour/minute selection.
- Multi-frequency custom recurrence engine supporting daily, weekly, monthly, and multi-month cyclical academic deadlines and billing intervals.
- High-fidelity date handling with month-boundary and leap-year resilience.

### 2. Rigorous Attendance Tracking & Failure Risk Engine
- Automated tracking of university absence thresholds (e.g., 25% statutory limit).
- Proactive predictive risk scoring: calculates remaining allowed absences and triggers graduated warnings before attendance limits are breached.
- Detailed visual audit logs for every class session.

### 3. Academic Performance & Curriculum Analytics
- Multi-semester grade tracking with configurable grading scales and weighted evaluations.
- Real-time GPA / CR (Coeficiente de Rendimento) computation weighted by academic credit hours.
- Clear visual indicators distinguishing approved, borderline, and at-risk coursework.

### 4. Focus, Study Habits & Gamification
- Integrated Pomodoro and Stopwatch study timers with background notification hooks.
- Habit reinforcement through study streaks, session history, and leveling rewards.
- Zero battery drain design with leak-free interval and unmount cleanup.

### 5. Lumen AI: Academic Companion
- Contextual tutoring and study assistance powered by the Google Gemini API.
- Secure, client-side API key management without cloud relay or telemetry logging.
- Structured output modes for flashcard generation, concept simplification, and exam preparation.

### 6. Autonomous Distribution & Update Pipeline
- Production-grade Android release pipeline running on GitHub Actions.
- Self-hosted GitHub Release auto-updater featuring SemVer comparison, download integrity verification, and package name validation to avoid false-positive update alerts.
