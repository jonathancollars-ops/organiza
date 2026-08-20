# Handoff Report — Explorer 2: State, Logic, Calculation & Async Services Audit

**Agent:** Explorer 2 (`explorer_logic_r2`)  
**Mission:** Exhaustive Code & Logic Audit of State, Context, External Services, Grade/Attendance Calculations, Concurrency & Memory Leaks in Organiza Codebase  
**Date:** 2026-08-20  
**Project Root:** `d:/Antigravity/Organiza`  
**Working Directory:** `d:/Antigravity/Organiza/.agents/explorer_logic_r2`

---

## 1. Observation

Direct code observations from static analysis, type checking, and test execution:

### 1.1 TypeScript Compilation & Test Execution
- **Command:** `npx tsc --noEmit`  
  **Result:** Exited with code `0`, no compilation or type errors.
- **Command:** `npx tsx test/e2e_teams_ai.test.ts`, `test/features_and_fixes.test.ts`, `test/google_sheets_and_date.test.ts`, `test/local_ai_and_universal_hub.test.ts`, `test/theme_and_id.test.ts`  
  **Result:** All baseline test suites passed 100%.

---

### 1.2 State Persistence, Concurrency & Data Storage
- **File:** `src/services/storage.ts` (Lines 280–298)  
  `StorageService.addXP(amount, additionalMinutes)` performs an un-synchronized read-modify-write on `AsyncStorage`:
  ```ts
  280: async addXP(amount: number, additionalMinutes: number = 0): Promise<GamificationData> {
  281:   try {
  282:     const current = await this.getGamificationData();
  283:     const newXP = (current.xp || 0) + amount;
  284:     const newMinutes = (current.totalFocusMinutes || 0) + additionalMinutes;
  285:     const newLevel = Math.floor(newXP / 200) + 1;
  286:     const updated: GamificationData = { ...current, xp: newXP, level: newLevel, totalFocusMinutes: newMinutes };
  287:     await this.saveGamificationData(updated);
  288:     return updated;
  ```
  If XP is awarded concurrently (e.g. Pomodoro timer completion while checking off a task), race conditions lead to lost XP increments.

- **File:** `src/services/storage.ts` (Lines 420–436)  
  `StorageService.clearAllData()` omits sensitive keys and configuration:
  ```ts
  420: async clearAllData(): Promise<void> {
  421:   await AsyncStorage.multiRemove([
  422:     EVENTS_KEY,
  423:     SUBJECTS_KEY,
  424:     ATTENDANCES_KEY,
  425:     TASKS_KEY,
  426:     STUDY_SESSIONS_KEY,
  427:     SEMESTERS_KEY,
  428:     SETTINGS_KEY,
  429:     STREAK_KEY,
  430:     AACC_KEY,
  431:     GROUP_PROJECTS_KEY,
  432:     GAMIFICATION_KEY,
  433:     '@organiza_ai_config',
  434:     '@organiza_local_ai_model_info',
  435:   ]);
  436: }
  ```
  `TEAMS_CONFIG_KEY` (`@organiza_teams_config`) containing OAuth access/refresh tokens and `THEME_KEY` (`@organiza_theme`) are NOT cleared.

- **File:** `src/services/storage.ts` (Lines 396–410)  
  `StorageService.importBackup()` omits `streak` restoration:
  ```ts
  396: try {
  397:   if (Array.isArray(backup.events)) await this.saveEvents(backup.events);
  398:   if (Array.isArray(backup.subjects)) await this.saveSubjects(backup.subjects);
  399:   if (Array.isArray(backup.attendances)) await this.saveAttendances(backup.attendances);
  400:   if (Array.isArray(backup.tasks)) await this.saveTasks(backup.tasks);
  401:   if (Array.isArray(backup.studySessions)) await this.saveStudySessions(backup.studySessions);
  402:   if (Array.isArray(backup.semesters)) await this.saveSemesters(backup.semesters);
  403:   if (Array.isArray(backup.aaccActivities)) await this.saveAACCActivities(backup.aaccActivities);
  404:   if (Array.isArray(backup.groupProjects)) await this.saveGroupProjects(backup.groupProjects);
  405:   if (backup.gamification) await this.saveGamificationData(backup.gamification);
  406:   if (backup.settings) {
  407:     await this.saveSettings({ ...DEFAULT_SETTINGS, ...backup.settings });
  408:     if (backup.settings.theme) await this.saveTheme(backup.settings.theme);
  409:   }
  ```
  `STREAK_KEY` is completely ignored during backup import.

- **File:** `App.tsx` (Lines 107–119)  
  Asynchronous 60-second polling timer triggers modal popup over active user workflows:
  ```ts
  107: const timer = setInterval(async () => {
  108:   setCurrentTime(new Date());
  109:   const savedEvents = await StorageService.getEvents();
  110:   const savedAttendances = await StorageService.getAttendances();
  111:   const updatedAttendances = await AttendanceService.generatePendingAttendances(savedEvents, savedAttendances);
  112:   if (updatedAttendances.length > savedAttendances.length) {
  113:     setAttendances(updatedAttendances);
  114:     setAttendanceModalVisible(true);
  115:   }
  116: }, 60000);
  ```

---

### 1.3 Grade Calculations, Final Exam (`AF`/`PF`) & Edge Cases
- **File:** `src/components/GradeEngine.tsx` (Lines 30–136)  
  False Final Exam Trigger on Empty Subject:
  ```ts
  30: export function calculateFinalGrade(gradeGroups: GradeGroup[], passGrade: number): CalcResult {
  ...
  68:     } else {
  69:       hasMissingItems = true;
  70:       missingItemsCount++;
  71:     }
  ...
  81:   const normalAvg = totalWeight > 0 ? totalScore / totalWeight : 0;
  ...
  125:   if (!hasMissingItems && normalAvg < passGrade) {
  126:     inFinal = true;
  ```
  When `gradeGroups` exists with 0 items (e.g. newly created subject with default empty group `Avaliações`), `totalItemsCount === 0` and `hasMissingItems` remains `false`. Thus `!hasMissingItems && (0 < 7.0)` evaluates to `true`, marking `inFinal = true` and `riskLevel = 'failed'` before any exam has even been registered!

- **File:** `src/components/GradeSimulatorModal.tsx` (Lines 44)  
  Falsy fallback bug for 0 target grade:
  ```ts
  44: const passGradeNum = parseFloat(targetPassGrade.replace(',', '.')) || (currentSubject?.passGrade ?? 7.0);
  ```
  If the user inputs `"0"`, `parseFloat("0")` returns `0`, which is falsy in JavaScript `||`, reverting the target pass grade to `7.0` instead of `0`.

---

### 1.4 Attendance & Frequency Limit Calculations
- **File:** `src/screens/AttendanceScreen.tsx` (Lines 42–49)  
  Presence rate calculation without sample size protection:
  ```ts
  42: const calculatePresenceRate = (subjectId: string, maxAbsences: number) => {
  43:   const abs = calculateAbsences(subjectId);
  44:   const pres = calculatePresences(subjectId);
  45:   const totalRecorded = abs + pres;
  46:   if (totalRecorded === 0) return 100.0;
  47:   return (pres / totalRecorded) * 100;
  48: };
  ```
  In the first week of class, 1 absence with 0 presences gives `0.0%` (and with 1 presence gives `50.0%`), immediately displaying a red critical danger banner `< 75%` even if the student is well within the 15 max allowed absences.

- **File:** `src/components/TodaySummaryWidget.tsx` (Lines 41–50)  
  Omission of future-date check for weekly recurring events:
  ```ts
  41: if (e.recurrence === 'weekly') {
  42:   const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
  43:   if (e.recurrenceDays && e.recurrenceDays.length > 0) {
  44:     return e.recurrenceDays.includes(dayOfWeek);
  45:   }
  46:   if (e.date) {
  47:     const baseDayOfWeek = new Date(e.date + 'T12:00:00').getDay();
  48:     return baseDayOfWeek === dayOfWeek;
  49:   }
  50: }
  ```
  Does not verify `selectedDate >= e.date`. If a weekly course starts in the future, it is displayed on past calendar dates matching that weekday.

---

### 1.5 Date & Timezone Shift Anomalies (UTC-3 Brasília)
- **File:** `App.tsx` (Lines 547, 564, 569) & `src/services/AIParsingService.ts` (Line 345):
  ```ts
  App.tsx:547: selectedDate={selectedDate || new Date().toISOString().split('T')[0]}
  App.tsx:564: current={new Date().toISOString().split('T')[0]}
  App.tsx:569: [new Date().toISOString().split('T')[0]]: {
  AIParsingService.ts:345: targetDate = cur.toISOString().split('T')[0];
  ```
  In UTC-3 Brasília, between 21:00 and 23:59, `toISOString().split('T')[0]` shifts the date forward by +1 day.

---

### 1.6 External Services Resilience, CSV Parsing & Fallbacks
- **File:** `src/services/GoogleSheetsService.ts` (Lines 80–105)  
  `fetchNewMessages` timestamp comparison:
  ```ts
  92: const newMessages = allMessages.filter(msg => {
  93:   try {
  94:     return new Date(msg.createdDateTime) > new Date(lastSync);
  95:   } catch {
  96:     return true;
  97:   }
  98: });
  ```
  If Google Sheets rows contain Brazilian formatted dates (`DD/MM/YYYY HH:mm`) or unsorted rows, `new Date("20/08/2026 14:00")` evaluates to `Invalid Date (NaN)`, causing comparison to fail (`false`), preventing new messages from syncing.

- **File:** `src/services/AIParsingService.ts` (Line 212)  
  Strict regex markdown code fence stripping:
  ```ts
  212: cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  ```
  If the LLM outputs conversational prefix/suffix text before or after the code fences, `^```...` fails, causing `JSON.parse` to throw and unnecessarily fall back to mock parsing.

- **File:** `src/services/TeamsService.ts` (Lines 263–265)  
  Strict case-sensitive comparison for content type:
  ```ts
  263: const isHtml = m.body?.contentType === 'html';
  ```
  Does not handle `'HTML'`, `'text/html'`, or unescaped HTML entities in plain text bodies.

- **File:** `src/services/SyncService.ts` (Lines 68–74, 142–181)  
  Ambiguous subject substring matching returning `undefined` creates orphaned attendance records with empty `subjectId: ''` and `eventId: ''`.

---

### 1.7 Memory Leaks & Component Lifecycle
- **File:** `src/screens/StudyScreen.tsx` (Lines 114–124)  
  Uncleaned `setTimeout` in `showToast`:
  ```ts
  114: const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'info') => {
  115:   setToastMessage({ text, type });
  ...
  121:   setTimeout(() => {
  122:     setToastMessage(null);
  123:   }, 4000);
  124: };
  ```
  If the screen unmounts within 4 seconds of a toast (e.g. switching tabs), `setToastMessage(null)` executes on an unmounted component.

- **File:** `src/screens/StudyScreen.tsx` (Lines 127–139)  
  `useEffect` for Pomodoro depends on `[isActive, timeLeft]`, tearing down and creating a new `setInterval` every single second, causing clock drift.

---

## 2. Logic Chain

```
[Observation 1.3: GradeEngine calculateFinalGrade with totalItemsCount = 0]
       │
       ▼
[totalItemsCount is 0, normalAvg is 0, hasMissingItems is false]
       │
       ▼
[Condition (!hasMissingItems && normalAvg < passGrade) evaluates to (true && 0 < 7.0) -> TRUE]
       │
       ▼
[Subject marked as inFinal=true, riskLevel='failed', showing 'Reprovado por Média']
       │
       ▼
[Defect: Empty subject displays alarming failure status before student even starts]
```

```
[Observation 1.5: new Date().toISOString().split('T')[0] in App.tsx:547,564,569]
       │
       ▼
[Local time is 2026-08-20 22:00:00 in UTC-3 Brasília]
       │
       ▼
[new Date().toISOString() returns '2026-08-21T01:00:00.000Z']
       │
       ▼
[Selected/Current date becomes '2026-08-21' (tomorrow)]
       │
       ▼
[Defect: User sees tomorrow's calendar events as 'Today' between 9PM and midnight]
```

```
[Observation 1.2: StorageService.clearAllData multiRemove array]
       │
       ▼
[Keys removed: EVENTS, SUBJECTS, ATTENDANCES, TASKS, SESSIONS, SEMESTERS, SETTINGS, STREAK, AACC, PROJECTS, GAMIFICATION, AI_CONFIG, LOCAL_MODEL]
       │
       ▼
[Missing keys: TEAMS_CONFIG_KEY (@organiza_teams_config), THEME_KEY (@organiza_theme)]
       │
       ▼
[Defect: User clicks 'Limpar Dados' but Microsoft OAuth tokens remain persisted in storage]
```

```
[Observation 1.6: GoogleSheetsService timestamp new Date(msg.createdDateTime) > new Date(lastSync)]
       │
       ▼
[Brazilian Google Sheets formatted dates like '20/08/2026 14:00' passed to new Date()]
       │
       ▼
[V8 Date parser returns NaN (Invalid Date)]
       │
       ▼
[Comparison (NaN > validDate) returns false]
       │
       ▼
[Defect: Sync silently drops new messages from Brazilian format spreadsheets]
```

---

## 3. Caveats

1. **Hardware Native Notifications:** `expo-notifications` behavior depends on Android notification channel permissions and iOS APNs capabilities; background wakeups on suspended iOS apps are handled by OS-level scheduling.
2. **Local Model Binary Execution:** `LocalAIModelService` handles on-device file downloading, sandboxing, and caching of the 1.28 GB Gemma-2B binary. In simulated or dev environments without the binary, it gracefully routes to Cloud Gemini API or the deterministic heuristic parser.
3. **External API Limits:** Google Gemini and OpenAI free tiers have rate limits (e.g. 15 RPM for Gemini 1.5 Flash); the fallback to heuristic parsing ensures zero crash rates even when quotas are exhausted.

---

## 4. Conclusion & Concrete Remediation Recommendations

### Detailed Remediation Plan:

#### 1. Fix `calculateFinalGrade` Zero-Items Bug (`src/components/GradeEngine.tsx`)
In `src/components/GradeEngine.tsx`, check `totalItemsCount > 0` before triggering `inFinal`:
```ts
// Before:
if (!hasMissingItems && normalAvg < passGrade) {
  inFinal = true;
...

// After:
if (totalItemsCount > 0 && !hasMissingItems && normalAvg < passGrade) {
  inFinal = true;
```

#### 2. Universal Date Resiliency (`App.tsx`, `AIParsingService.ts`)
Replace all instances of `new Date().toISOString().split('T')[0]` with `getLocalDateString()`:
```ts
// App.tsx:
import { getLocalDateString } from './src/utils';
// Line 547:
selectedDate={selectedDate || getLocalDateString()}
// Line 564:
current={getLocalDateString()}
// Line 569:
[getLocalDateString()]: {
```

#### 3. Complete Data Cleansing in `StorageService.clearAllData` (`src/services/storage.ts`)
Add `TEAMS_CONFIG_KEY` and `THEME_KEY` to `AsyncStorage.multiRemove`:
```ts
await AsyncStorage.multiRemove([
  EVENTS_KEY,
  THEME_KEY,
  SUBJECTS_KEY,
  ATTENDANCES_KEY,
  TASKS_KEY,
  STUDY_SESSIONS_KEY,
  SEMESTERS_KEY,
  SETTINGS_KEY,
  STREAK_KEY,
  TEAMS_CONFIG_KEY,
  AACC_KEY,
  GROUP_PROJECTS_KEY,
  GAMIFICATION_KEY,
  AI_CONFIG_KEY,
  '@organiza_local_ai_model_info',
]);
```

#### 4. Backup Restoration Completeness (`src/services/storage.ts`)
In `importBackup()`, restore `streak`:
```ts
if (backup.streak) await this.saveStreak(backup.streak);
```

#### 5. Resilient Brazilian Date & Timestamp Parsing (`src/services/GoogleSheetsService.ts`)
In `GoogleSheetsService`, parse timestamps with support for Brazilian format `DD/MM/YYYY HH:mm` and ISO formats:
```ts
private static parseTimestamp(ts: string): number {
  if (!ts) return 0;
  // Try ISO
  let d = new Date(ts);
  if (!isNaN(d.getTime())) return d.getTime();
  // Try DD/MM/YYYY HH:mm
  const brMatch = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (brMatch) {
    const [_, day, month, year, h = '0', m = '0'] = brMatch;
    d = new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m));
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}
```

#### 6. Robust JSON Code Fence Extraction (`src/services/AIParsingService.ts`)
Extract JSON using balanced regex or substring matching:
```ts
let cleanText = rawResponseText.trim();
const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
if (jsonMatch) {
  cleanText = jsonMatch[1].trim();
} else {
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }
}
```

#### 7. Component Lifecycle & Toast Timer Ref Cleanup (`src/screens/StudyScreen.tsx`)
Track toast timer in a `useRef` and clean up in unmount hook:
```ts
const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  return () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopwatchRef.current) clearInterval(stopwatchRef.current);
  };
}, []);
```

#### 8. Weekly Event Past Date Guard (`src/components/TodaySummaryWidget.tsx`)
In `TodaySummaryWidget.tsx`, ensure recurring events only match on or after start date:
```ts
if (e.recurrence === 'weekly') {
  if (e.date && selectedDate < e.date) return false;
  ...
```

---

## 5. Verification Method

Independent commands to verify all findings and validate implementations:

1. **TypeScript Typecheck:**
   ```bash
   npx tsc --noEmit
   ```
2. **E2E Teams & AI Comprehensive Test Suite:**
   ```bash
   npx tsx test/e2e_teams_ai.test.ts
   ```
3. **Features & Edge Cases Suite:**
   ```bash
   npx tsx test/features_and_fixes.test.ts
   ```
4. **Google Sheets & Date Resiliency Suite:**
   ```bash
   npx tsx test/google_sheets_and_date.test.ts
   ```
5. **Local AI Hub & Grade Criteria Extraction Suite:**
   ```bash
   npx tsx test/local_ai_and_universal_hub.test.ts
   ```
6. **Theme & ID Generation Entropy Suite:**
   ```bash
   npx tsx test/theme_and_id.test.ts
   ```
