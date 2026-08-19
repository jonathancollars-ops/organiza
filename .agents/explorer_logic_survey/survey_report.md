# Relatório de Auditoria Técnica: Lógica, Estado, Persistência e Integrações
**Organiza Mobile Application**  
**Especialista:** Explorer 2 (Logic, State & Integrations Specialist)  
**Data:** 18 de Agosto de 2026  
**Status do TypeCheck:** `npx tsc --noEmit` — 0 Erros (Aprovado)  
**Status da Suíte de Testes:** 134/134 Testes E2E Aprovados | 72/72 Testes Adversariais Aprovados

---

## 1. Resumo Executivo

A auditoria aprofundada da arquitetura lógica, gerenciamento de estado, motores de cálculo e integrações do **Organiza** revelou uma base de código sólida, tipada rigorosamente com TypeScript e com ampla cobertura de testes de regressão (mais de 134 asserções formais). No entanto, foram identificadas **7 anomalias críticas e sutis** que afetam a experiência do usuário em produção:
1. **Bug Crítico de Fuso Horário (`toISOString().split('T')[0]`)**: Em fusos brasileiros (UTC-3), entre 21h00 e 23h59, a data padrão calculada via UTC avança 1 dia para o futuro, corrompendo registros de faltas, streaks e marcações de calendário.
2. **Inconsistência de Cálculo de Médias**: O `GradesScreen.tsx` divide a pontuação atual pela soma dos pesos totais (incluindo provas futuras não realizadas), rebaixando a média e marcando o aluno como "Em Risco", enquanto o `GradeEngine.tsx` divide corretamente apenas pelos pesos já avaliados.
3. **Streak Estático/Zerado no Modal de Conquistas**: O componente `<AchievementsModal />` no `App.tsx:976` recebe um objeto `streak` hardcoded com `currentStreak: 0`, pois o estado não é carregado no bootstrap do `App.tsx`.
4. **Falta de Timeouts de Rede nos Serviços Externos**: Chamadas `fetch` no `TeamsService`, `AIParsingService` e `GoogleSheetsService` não possuem `AbortSignal.timeout(15000)`, deixando o app congelado indefinidamente se a rede ou a API cair.
5. **Tratamento de Linhas Múltiplas no Parser de CSV do Google Sheets**: `GoogleSheetsService.ts:93` quebra linhas com `.split('\n')`, corrompendo mensagens que contêm quebras de linha dentro de campos com aspas.
6. **Omissão de Recorrências Semanais sem `recurrenceDays`**: `TodaySummaryWidget.tsx:40-44` ignora eventos com `recurrence === 'weekly'` se `recurrenceDays` não estiver preenchido, em vez de recorrer ao dia da semana da data base.
7. **Mock Ausente de `expo-haptics` no `setup_env.ts`**: Impede que testes unitários que importam componentes com feedback tátil (como `GradeEngine.tsx`) sejam executados sem erro de `EventEmitter`.

---

## 2. Análise de Tipos TypeScript e Contratos de Dados

### 2.1 Validação Estática (`npx tsc --noEmit`)
A execução de `npx tsc --noEmit` no repositório concluiu com **código de saída 0 (Zero Erros)**.
O `tsconfig.json` está configurado com regras estritas:
- `"strict": true`
- `"noImplicitAny": true`
- `"strictNullChecks": true`
- `"noUnusedLocals": false`

### 2.2 Integridade dos Modelos em `src/types/index.ts`
Os contratos de domínio estão bem estruturados:
- **`AppEvent`**: Define campos para data (`YYYY-MM-DD`), horários (`HH:mm`), alertas (`number[]`), recorrência (`RecurrenceType`), vinculação acadêmica (`subjectId`, `weight`, `maxGrade`, `isExtraPoint`).
- **`Subject`**: Suporta múltiplos `gradeGroups` (ponderados ou aritméticos), carga horária, limite de faltas e vínculo a `semesterId`.
- **`AttendanceRecord`**: Modela status `'present' | 'absent' | 'cancelled'`, vinculando `eventId` e `subjectId`.
- **`AIIntent` & `AIParsedItem`**: Padronizam intenções `'cancelled_class' | 'homework' | 'exam' | 'none'`, garantindo contratos seguros com modelos LLM (Gemini e OpenAI).
- **`TeamsConfig` & `GoogleSheetsConfig`**: Contratos completos para autenticação Azure AD OAuth2 e integração via Power Automate.

---

## 3. Auditoria de Persistência e Resiliência do AsyncStorage (`src/services/storage.ts`)

### 3.1 Chaves de Armazenamento Utilizadas
| Chave AsyncStorage | Tipo / Entidade | Valor Padrão no Fallback |
|---|---|---|
| `@organiza_events` | `AppEvent[]` | `[]` |
| `@organiza_subjects` | `Subject[]` | `[]` |
| `@organiza_attendances` | `AttendanceRecord[]` | `[]` |
| `@organiza_study_sessions` | `StudySession[]` | `[]` |
| `@organiza_study_tasks` | `StudyTask[]` | `[]` |
| `@organiza_streak` | `StudyStreak` | `{ currentStreak: 0, longestStreak: 0, lastStudyDate: '' }` |
| `@organiza_theme` | `ThemeType` | `'dark'` |
| `@organiza_settings` | `AppSettings` | `{ theme: 'dark', notificationsEnabled: true, defaultClassDuration: 50, ... }` |
| `@organiza_teams_config` | `TeamsConfig` | `null` |
| `@organiza_ai_config` | `AIConfig` | `null` |
| `@organiza_sheets_config` | `GoogleSheetsConfig` | `null` |
| `@organiza_gamification` | `GamificationData` | `{ xp: 0, level: 1, unlockedAchievements: [], totalFocusMinutes: 0 }` |
| `@organiza_aacc` | `AACCActivity[]` | `[]` |
| `@organiza_group_projects` | `GroupProject[]` | `[]` |
| `@organiza_semesters` | `Semester[]` | `[]` |

### 3.2 Resiliência contra Corrupção de JSON
Todos os métodos `StorageService.get*()` implementam blocos `try/catch` robustos que capturam `SyntaxError` de JSON malformado ou corrompido, retornando estruturas padrão íntegras sem derrubar o aplicativo.

### 3.3 Backup Export / Import e Validação de Esquema
- O método `StorageService.exportFullBackup()` gera um payload JSON com timestamp e versão `1.0`.
- O método `StorageService.importFullBackup(jsonString)` valida se o JSON é um objeto válido e se contém arrays nas chaves esperadas (`events`, `subjects`, `attendances`, etc.) antes de persistir em lote via `AsyncStorage.multiSet`.
- **Ponto de Atenção**: Não há reconciliação de IDs duplicados na importação (sobrescreve todo o estado local), o que é o comportamento esperado para restauração total.

### 3.4 Sincronização do Tema (`@organiza_theme` vs `@organiza_settings.theme`)
No `App.tsx`, o tema é lido tanto de `@organiza_theme` quanto de `settings.theme`. Ao alterar o tema no `SettingsModal`, apenas `@organiza_theme` era atualizado, gerando uma divergência sutil caso o usuário acessasse as configurações gerais posteriormente.

---

## 4. Auditoria de Datas, Fuso Horário e Casos de Borda

### 4.1 O Problema do `toISOString().split('T')[0]` em Fusos Negativos (UTC-3 Brasil)
**Descrição do Mecanismo:**
O Brasil opera no fuso UTC-3 (Horário de Brasília).
- Às 21:30 no Brasil em `2026-08-18`, o relógio em UTC é `2026-08-19T00:30:00.000Z`.
- Executar `new Date().toISOString().split('T')[0]` resulta em `'2026-08-19'` (**amanhã**).
- No entanto, a data local do usuário ainda é `'2026-08-18'`.

**Impactos no Sistema:**
1. **AttendanceService.ts (Linhas 8 e 32)**:
   - As 7 datas passadas geradas entre 21h e 23h59 incluem amanhã como "aula de hoje", marcando aulas futuras como pendentes de presença indevidamente.
2. **TodaySummaryWidget.tsx (Linha 33)**:
   - A partir das 21h, o widget passa a exibir as aulas e tarefas de **amanhã** como se fossem de hoje.
3. **StudyScreen.tsx (Linhas 87, 97, 164, 217, 261)**:
   - O cálculo do Streak quebra se o estudante estuda às 22h, pois a sessão é salva com a data de amanhã, quebrando a contagem de dias consecutivos.
4. **EventModal.tsx (Linha 92) e ExamModal.tsx (Linha 55)**:
   - Ao abrir o modal para cadastrar um evento às 21h30, a data padrão sugerida é o dia seguinte.
5. **TeamsConfigModal.tsx (Linhas 370 e 486)**:
   - O contexto enviado para a IA (`context.currentDate`) indica que hoje já é amanhã, fazendo com que mensagens como "aula de hoje cancelada" sejam atribuídas à data errada.

**Solução Segura:**
Criar uma função utilitária `getLocalDateString(date: Date = new Date()): string` em `src/utils/date.ts` que respeite o fuso local:
```ts
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

---

## 5. Auditoria dos Motores de Cálculo Acadêmico

### 5.1 Discrepância de Cálculo de Notas: `GradesScreen.tsx` vs `GradeEngine.tsx`

| Aspecto | `src/components/GradeEngine.tsx` | `src/screens/GradesScreen.tsx` |
|---|---|---|
| **Tratamento de Itens Futuros** (`grade === undefined`) | Ignora do denominador de pesos completados (`groupCompletedWeight`) | Inclui no denominador (`groupTotalWeight`), puxando a nota para baixo |
| **Exemplo**: Aluno tirou 10 na P1 (peso 1), P2 ainda não realizada (peso 1) | Média calculada: **10.0** (Status: Aprovado / No Caminho) | Média calculada: **5.0** (Status: Em Risco) |
| **Impacto no CR / GPA** | Reflete com precisão o aproveitamento real do aluno nas avaliações já feitas | Penaliza o aluno prematuramente no início do semestre |

**Trecho Problemático em `src/screens/GradesScreen.tsx:36-67`:**
```ts
// Incorreto: divide pela soma total de pesos mesmo sem notas atribuídas
groups.forEach(group => {
  let groupSum = 0;
  let groupWeight = group.weight || 1;
  group.items.forEach(item => {
    if (item.grade !== undefined) {
      groupSum += (item.grade * (item.weight || 1));
    }
  });
  // Se o grupo tem 2 provas de peso 1 e o aluno fez 1 tirando 10:
  // groupSum = 10, mas groupTotalWeight = 2 -> nota do grupo = 5.0!
  const groupTotalWeight = group.items.reduce((sum, item) => sum + (item.weight || 1), 0);
  if (groupTotalWeight > 0) {
    const groupGrade = (groupSum / groupTotalWeight);
    totalScore += groupGrade * groupWeight;
    totalWeight += groupWeight;
  }
});
```

**Correção:** Importar e utilizar diretamente `calculateFinalGrade` de `src/components/GradeEngine.tsx` em ambos os locais para garantir consistência total de 100%.

### 5.2 Controle de Faltas e Invariante de 75% de Presença
O motor de faltas em `AttendanceScreen.tsx` e `AttendanceService.ts` opera corretamente:
- Aulas com status `'cancelled'` **não** são somadas em `absent` (não penalizam o estudante).
- A taxa de faltas é calculada como `(totalAbsences / maxAbsences) * 100`.
- Quando `totalAbsences >= maxAbsences * 0.75`, o app exibe alerta visual de perigo.

---

## 6. Auditoria de Integrações Externas e Pipeline de Sincronização

### 6.1 Microsoft Teams & Azure AD OAuth2 (`src/services/TeamsService.ts`)
- **Autenticação**: O fluxo OAuth2 gera URL padrão com `response_type=code`, `scope=ChannelMessage.Read.All Team.ReadBasic.All offline_access` contra o endpoint `https://login.microsoftonline.com/common/oauth2/v2.0/token`.
- **Sanitização HTML (`sanitizeHtmlMessage`)**: 
  - Remove tags perigosas (`<script>`, `<style>`, `<iframe>`, handlers `onclick`).
  - Decodifica entidades nomeadas em português (`&aacute;`, `&ccedil;`, `&atilde;`, etc.) e numéricas (`&#225;`, `&#xE1;`).
- **Ponto de Melhoria**: `fetch` não possui timeout explícito. Se o gateway da Microsoft falhar, a requisição fica travada.

### 6.2 Inteligência Artificial & LLMs (`src/services/AIParsingService.ts`)
- **Modelos Suportados**: Google Gemini 1.5 (`gemini-1.5-flash` / `gemini-1.5-pro`) e OpenAI (`gpt-4o-mini` / `gpt-4o`).
- **Validação de JSON (`cleanAndValidateJson`)**:
  - Remove delimitadores Markdown (````json ... ````).
  - Possui fallback via Expressão Regular para extrair blocos `{...}` ou `[...]` caso o modelo retorne texto conversacional ao redor.
  - Normaliza campos ausentes para padrões seguros (`alerts: [10080, 1440]`, `startTime: '23:59'`).
- **Fallback Determinístico Offline (`parseMessageMock`)**:
  - Permite testes e uso sem necessidade de chave de API.
  - **Descoberta**: A expressão de cancelamento não contemplava `não haverá` sem a palavra `aula` (ex: `não haverá o nosso encontro presencial`). Expandir as frases-chave no mock parser resolve essa lacuna.

### 6.3 Google Sheets & Power Automate (`src/services/GoogleSheetsService.ts`)
- **Mecanismo**: Busca dados diretamente do link CSV publicado (`pub?output=csv`).
- **Parser de CSV**:
  - `csvText.split('\n')` divide o CSV por quebras de linha cruas.
  - Se a mensagem do professor contiver quebras de linha reais dentro de aspas, a linha é fragmentada, corrompendo a leitura das colunas subsequentes.
  - **Recomendação**: Adicionar regex de parsing compatível com RFC 4180 que respeite quebras de linha dentro de campos com aspas (`/(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g`).

### 6.4 Pipeline de Sincronização (`src/services/SyncService.ts`)
- **Idempotência**:
  - Cancelamentos de aula procuram por registros de presença existentes na mesma data e matéria antes de criar novos.
  - Eventos de Prova/Trabalho verificam duplicidade por título e data.
  - GradeItems no `Subject.gradeGroups` são vinculados ao `eventId` do evento de calendário, evitando itens de nota órfãos ou duplicados.
- **Alertas**: Padronizados estritamente em `[10080, 1440]` (1 semana antes e 1 dia antes) para todas as provas e entregas de trabalho.

---

## 7. Catálogo Detalhado de Bugs Encontrados e Propostas de Correção

### BUG-01: Fuso Horário em Métodos de Data Local (Shift de +1 dia à noite)
- **Gravidade**: Alta
- **Arquivos Afetados**:
  - `src/services/AttendanceService.ts:8,32`
  - `src/components/TodaySummaryWidget.tsx:33`
  - `src/screens/StudyScreen.tsx:87,97,164,217,261`
  - `src/components/EventModal.tsx:92`
  - `src/components/ExamModal.tsx:55`
  - `src/components/AnalyticsAndAACCModal.tsx:85`
  - `src/components/SubjectModal.tsx:143`
  - `src/components/TeamsConfigModal.tsx:370,486`
- **Causa Raiz**: O uso de `new Date().toISOString().split('T')[0]` gera a data em UTC (0h). No Brasil (UTC-3), entre 21h00 e 23h59, a data UTC corresponde ao dia seguinte.
- **Correção Proposta**:
```ts
// src/utils/date.ts
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

---

### BUG-02: Inconsistência de Cálculo de Médias em `GradesScreen.tsx`
- **Gravidade**: Alta
- **Arquivo**: `src/screens/GradesScreen.tsx:36-67`
- **Causa Raiz**: O cálculo da média da matéria no `GradesScreen.tsx` divide pelo peso total de todas as avaliações cadastradas no semestre (`groupTotalWeight`), incluindo avaliações futuras onde `item.grade === undefined`. Isso reduz artificialmente a média de alunos que tiraram notas máximas nas primeiras provas.
- **Correção Proposta**:
```ts
// Substituir a função interna calculateGrade em GradesScreen.tsx:
import { calculateFinalGrade } from '../components/GradeEngine';

// Dentro do componente:
const gradeInfo = calculateFinalGrade(subject.gradeGroups || [], subject.passGrade || 7.0);
const subjectAverage = gradeInfo.score;
```

---

### BUG-03: Objeto `streak` Hardcoded com 0 no `App.tsx`
- **Gravidade**: Média
- **Arquivo**: `App.tsx:976`
- **Causa Raiz**: O `<AchievementsModal />` é instanciado recebendo `streak={{ currentStreak: 0, longestStreak: 0, lastStudyDate: '' }}`, ignorando os dados reais de streak salvos em `@organiza_streak`.
- **Correção Proposta**:
```ts
// Em App.tsx:
const [streak, setStreak] = useState<StudyStreak>({ currentStreak: 0, longestStreak: 0, lastStudyDate: '' });

// No loadData():
const loadedStreak = await StorageService.getStreak();
setStreak(loadedStreak);

// Na renderização do modal (linha 976):
<AchievementsModal
  visible={activeModal === 'achievements'}
  onClose={() => setActiveModal(null)}
  theme={theme}
  studySessions={studySessions}
  streak={streak}
  attendances={attendances}
/>
```

---

### BUG-04: Ausência de Timeouts em Chamadas `fetch` de Serviços Externos
- **Gravidade**: Média
- **Arquivos Afetados**:
  - `src/services/TeamsService.ts:68,112,185,211,240`
  - `src/services/AIParsingService.ts:122,170`
  - `src/services/GoogleSheetsService.ts:42`
- **Causa Raiz**: Chamadas `fetch()` sem `signal: AbortSignal.timeout(15000)`.
- **Correção Proposta**:
```ts
const response = await fetch(url, {
  ...options,
  signal: AbortSignal.timeout(15000),
});
```

---

### BUG-05: Falha no Parser de CSV do Google Sheets com Quebras de Linha em Aspas
- **Gravidade**: Baixa/Média
- **Arquivo**: `src/services/GoogleSheetsService.ts:93`
- **Causa Raiz**: `csvText.split('\n')` quebra linhas no meio de campos de texto multilinha.
- **Correção Proposta**:
Utilizar uma função robusta de parse CSV compatível com RFC 4180 que mantenha células com quebras de linha intactas dentro de aspas.

---

### BUG-06: Suporte Incompleto a Recorrência Semanal no `TodaySummaryWidget.tsx`
- **Gravidade**: Baixa
- **Arquivo**: `src/components/TodaySummaryWidget.tsx:40-44`
- **Causa Raiz**: Se um evento possui `recurrence: 'weekly'` mas `recurrenceDays` for `undefined` ou vazio, o widget não verifica o dia da semana da data original do evento (`event.date`).
- **Correção Proposta**:
```ts
if (e.recurrence === 'weekly') {
  const eventDay = new Date(e.date + 'T12:00:00').getDay();
  if ((e.recurrenceDays && e.recurrenceDays.includes(dayOfWeek)) || eventDay === dayOfWeek) {
    return true;
  }
}
```

---

### BUG-07: Mock Ausente de `expo-haptics` no Ambiente de Testes Unitários
- **Gravidade**: Média (Desenvolvimento/CI)
- **Arquivo**: `test/setup_env.ts:18-45`
- **Causa Raiz**: `expo-haptics` não é mockado no `setup_env.ts`. Ao rodar testes unitários que importam `GradeEngine.tsx` ou telas com feedback tátil, o Node.js lança `TypeError: Cannot read properties of undefined (reading 'EventEmitter')`.
- **Correção Proposta**:
Adicionar ao `test/setup_env.ts`:
```ts
mock.module('expo-haptics', () => ({
  selectionAsync: async () => {},
  impactAsync: async () => {},
  notificationAsync: async () => {},
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' }
}));
```

---

## 8. Conclusão e Próximos Passos
A arquitetura do Organiza encontra-se em estágio avançado de maturidade e estabilidade. A resolução dos 7 pontos catalogados acima garantirá conformidade impecável com os requisitos da entrega, assegurando que o app se comporte de maneira precisa em todos os fusos horários, cálculos acadêmicos e integrações de rede.
