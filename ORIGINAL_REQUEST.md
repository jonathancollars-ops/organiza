# Original User Request

## Initial Request — 2026-08-18T14:33:10Z

Audit the entire Organiza mobile codebase (React Native/Expo) for any visual, UX, state management, edge case, or TypeScript/logic bugs, verify and fix all identified issues with rigorous testing, and trigger a verified Android APK build.

Working directory: d:\Antigravity\Organiza
Integrity mode: development

## Requirements

### R1. Comprehensive Visual & UX Bug Audit
Audit all screens and components in `d:\Antigravity\Organiza\src` (`AttendanceScreen.tsx`, `CalendarScreen.tsx`, `GradesScreen.tsx`, `SettingsScreen.tsx`, `TeamsConfigModal.tsx`, etc.):
- Verify layout consistency across Dark and Light themes (theme contrast, text visibility, padding, clipping).
- Check modal animations, dismiss behaviors, safe area insets on mobile devices.
- Verify status indicators (attendance percentage, grade calculations with final exams, alert banners).

### R2. Code Logic, TypeScript & State Management Audit
- Ensure strict TypeScript compilation with zero errors (`npx tsc --noEmit`).
- Verify data persistence (`AsyncStorage` serialization/deserialization, date handling, time zones).
- Audit the Teams, Power Automate, Google Sheets and AI parsing flows (`GoogleSheetsService.ts`, `TeamsService.ts`, `AIParsingService.ts`, `SyncService.ts`) for unhandled exceptions, null/undefined edge cases, malformed CSV/JSON responses.

### R3. Comprehensive Test Verification
- Run all existing test suites (`npx tsx test/e2e_teams_ai.test.ts`, etc.) and ensure 100% pass rate.
- Add any missing test cases covering audited fixes.

### R4. Final Production/Preview APK Build
- Trigger EAS Android build (`npx -y eas-cli build -p android --profile preview --non-interactive`).
- Provide the verified build download link and update all documentation artifacts.

## Acceptance Criteria

### Visual & Code Integrity
- [ ] TypeScript check (`npx tsc --noEmit`) passes with 0 errors.
- [ ] No visual contrast, text truncation, or unhandled theme bugs across all screens.
- [ ] All date/time manipulations correctly handle Brazilian format, leap years, and edge cases.

### Integration & Automated Tests
- [ ] All E2E and unit test suites pass with 100% success (minimum 134 tests).
- [ ] Simulation and real synchronization flows execute without crashing or state corruption.

### Build Delivery
- [ ] EAS Android build succeeds and outputs a valid installable APK URL.
- [ ] Download link and QR code updated in artifacts.

## Follow-up — 2026-08-20T15:25:15Z

Realizar uma auditoria técnica e visual profunda no aplicativo Organiza (React Native / Expo), identificar e corrigir todos os bugs encontrados (lógicos, visuais, de contraste de temas e de persistência de estado), validar a estabilidade com suítes de testes automatizados e elaborar um relatório estratégico detalhado com 10 sugestões de funcionalidades de alto impacto para estudantes universitários.

Working directory: d:\Antigravity\Organiza
Integrity mode: development

## Requirements

### R1. Auditoria Estática, Varredura de Bugs e Correção no Código
Realizar uma análise minuciosa de todos os arquivos em `src/`, identificando e corrigindo imediatamente no código:
- Inconsistências de layout nos 3 temas (`dark`, `amoled`, `light`), incluindo contraste de textos, chips, botões e modais.
- Condições de corrida na persistência assíncrona (`AsyncStorage`) e na inicialização de dados (`loadData`).
- Inconsistências no cálculo de médias parciais, pesos de notas e verificação de frequências/faltas.
- Vazamento de listeners ou timers em componentes desmontados.
- Tratamento de exceções e fallbacks em serviços assíncronos (Google Sheets, IA local/cloud, Notificações).

### R2. Validação e Testes Automatizados
- Garantir que a compilação do TypeScript (`npx tsc --noEmit`) passe com 0 erros.
- Executar e validar todas as suítes de teste existentes (`test/e2e_teams_ai.test.ts`, `test/local_ai_and_universal_hub.test.ts`, `test/google_sheets_and_date.test.ts`, `test/features_and_fixes.test.ts`) e adicionar novos testes de regressão para quaisquer bugs corrigidos.

### R3. Relatório Estratégico com 10 Sugestões de Novas Funcionalidades
Apresentar um relatório aprofundado com 10 ideias inovadoras de funcionalidades para o aplicativo, detalhando para cada uma:
1. Proposta de valor e dor que resolve para o estudante;
2. Como funciona a experiência do usuário (UX);
3. Viabilidade e esforço técnico de implementação.

## Acceptance Criteria

### Correção de Bugs e Qualidade do Código
- [ ] Todos os bugs visuais de contraste e alinhamento identificados foram corrigidos diretamente no código-fonte.
- [ ] O `npx tsc --noEmit` executa com sucesso sem nenhum erro de tipo.
- [ ] 100% dos testes unitários e E2E passam com sucesso.

### Relatório e Propostas
- [ ] O relatório lista todos os bugs encontrados e corrigidos com seus respectivos arquivos alterados.
- [ ] O relatório entrega exatamente 10 sugestões estruturadas, inovadoras e realistas para o app Organiza.
