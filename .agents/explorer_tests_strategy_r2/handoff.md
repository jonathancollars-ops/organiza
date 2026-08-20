# Relatório de Auditoria de Testes, Segurança de Tipos & Estratégia de Inovação (Explorer 3)

**Projeto**: Organiza — Assistente Acadêmico Mobile (React Native / Expo)  
**Data**: 2026-08-20  
**Autor**: Explorer 3 (Testing, Type Safety & Innovation Strategy Specialist)  
**Status**: Concluído e Validado (100% Type-Safe, Suítes de Testes Auditadas, 10 Propostas Estruturadas)

---

## 1. Observation (Observações Diretas)

### 1.1. Auditoria da Compilação TypeScript (`tsconfig.json` e Type Definitions)
- **Comando executado**: `npx tsc --noEmit`
- **Resultado verbatim**: Código de saída `0` com 0 erros de compilação.
- **Configuração TypeScript (`tsconfig.json`)**:
  ```json
  {
    "extends": "expo/tsconfig.base",
    "compilerOptions": {
      "strict": true
    },
    "exclude": ["node_modules", "test"]
  }
  ```
- **Definições de Tipos (`src/types/index.ts`)**:
  - Total de 308 linhas cobrindo com fidelidade estrita 26 interfaces e tipos de união: `AppEvent`, `Subject`, `GradeGroup`, `GradeItem`, `Semester`, `AttendanceRecord`, `AttendanceStatus`, `ThemeType`, `StudyTask`, `StudySession`, `StudyStreak`, `AppSettings`, `AACCActivity`, `GroupTask`, `GroupProject`, `GamificationData`, `Achievement`, `BackupData`, `TeamsConfig`, `AIProvider`, `AIConfig`, `AIParsedItem`, `AIParsingResult`, `UniversalAIInput`, `GradeFormulaExtraction`, `SyncResult`, `TeamsMessage`, `GoogleSheetsConfig`.
  - Ausência de tipos `any` inseguros em contratos críticos de dados acadêmicos e persistência.

### 1.2. Execução das Suítes de Testes Automatizados (`test/`)
Foram executadas e auditadas individualmente e em lote as principais suítes de teste:

| Arquivo de Teste | Quantidade de Testes | Status | Escopo Avaliado |
|---|---|---|---|
| `test/e2e_teams_ai.test.ts` | 134 testes | **PASS (134/134, 100%)** | Cobertura E2E completa Tiers 1-4: Auth Teams, Sanitizer HTML, Mock AI Parser, Cancelamento de aulas, Tarefas, Provas, Grade Engine, Casos de borda e cargas reais. |
| `test/local_ai_and_universal_hub.test.ts` | 4 estágios (16 asserções) | **PASS (100%)** | Lifecycle de modelo on-device sandbox, cálculo de storage, extração de fórmula de notas em linguagem natural, parsing universal WhatsApp/Classroom e sync de calendário. |
| `test/google_sheets_and_date.test.ts` | 23 testes | **PASS (23/23, 100%)** | Resiliência de timezone UTC-3 Brasília, formatação DD/MM/YYYY, anos bissextos, parsing RFC 4180 CSV com novas linhas embutidas, cálculo de notas omitindo futuras provas, auto-sync out-of-the-box. |
| `test/features_and_fixes.test.ts` | 10 testes (10k iterações) | **PASS (100%)** | Unicidade de IDs com 0 colisões em 10.000 gerações, step loop semanal otimizado de presença, simulador de exame final e exportação/restauração de backup. |
| `test/theme_and_id.test.ts` | 139 testes | **PASS (139/139, 100%)** | Função `getContrastTextColor` para cores claras/escuras/HSL/bordas, integridade de tokens WCAG AA nos 3 temas (`dark`, `amoled`, `light`), unicidade de `generateId`. |
| `test/sync_service.test.ts` | 26 testes | **PASS (26/26, 100%)** | Algoritmo de fuzzy match de matérias, busca de eventos de aula, sync de faltas e notas, invariantes de alertas `[10080, 1440]` e runner de simulação. |
| `test/ai_parser.test.ts` | 35 testes | **PASS (35/35, 100%)** | Construção de prompts contextuais, tratamento de mensagens vazias, classificação determinística de intents e limpeza de JSON com code fences markdown. |
| `test/challenger_stress_test.ts` | 24 testes | **PASS (24/24, 100%)** | Sanitizer anti-XSS com remoção de script/style/iframe, resistência a ReDoS, payloads com 120 níveis de aninhamento e normalização de entidades numéricas/hexadecimais. |
| `test/challenger_m1_adversarial.test.ts` | 68 testes | **PASS (68/68, 100%)** | Verificação empírica de UI, teclado `keyboardShouldPersistTaps`, contraste de botões em light theme, e budget de viewport em telas de 360px. |
| `test/sync_challenge.test.ts` | 59 testes | **PASS (59/59, 100%)** | Recuperação de falhas em JSON truncado, invariantes de ausência não-penalizada por aula cancelada, integridade do banco de dados SQLite/AsyncStorage. |

### 1.3. Análise dos Utilitários de Data/Hora e Fuso Horário Brasileiro (`src/utils/date.ts`)
- **`getLocalDateString(d: Date = new Date()): string`**:
  - Implementação utiliza getters locais (`d.getFullYear()`, `d.getMonth() + 1`, `d.getDate()`).
  - Resolve integralmente a anomalia do fuso horário UTC-3 (Horário de Brasília) onde chamadas a `toISOString().split('T')[0]` entre 21h00 e 23h59 avançavam indevidamente para o dia seguinte.
- **`formatDisplayDate(dateStr: string): string`**:
  - Converte `YYYY-MM-DD` com segurança para o padrão brasileiro `DD/MM/YYYY`. Trata strings vazias ou nulas sem quebrar a aplicação.
- **`parseLocalDate(dateStr: string): Date`**:
  - Fixa o horário em `12:00:00` (meio-dia local `T12:00:00`), eliminando qualquer risco de deslocamento de data em transições de horário de verão ou limites da meia-noite.
- **Anos bissextos**: Validado com `2028-02-29` gerando corretamente strings e cálculos de calendário.

### 1.4. Análise da Infraestrutura de Mocking (`test/setup_env.ts`)
- O arquivo `test/setup_env.ts` intercepta o `Module.prototype.require` para criar sandboxes em memória de:
  - `@react-native-async-storage/async-storage` (simulado via `memoryStore` em memória);
  - `react-native` (fornecendo `Platform.OS` e seletores);
  - `expo-notifications`, `expo-haptics` e `expo-file-system/legacy`.
- **Descoberta Crítica de Infraestrutura**: Arquivos de teste executados via `npx tsx` que importem componentes `.tsx` (como `GradeEngine.tsx`) requerem impreterivelmente `import './setup_env';` no topo. Do contrário, o Node tenta carregar os arquivos nativos de `react-native` contendo anotações de tipo Flow (`typeof React.forwardRef`), resultando em `TransformError`.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio & Diagnóstico)

```
[Observação 1: Compilação TypeScript limpa com 0 erros]
                      ↓
[Observação 2: Mais de 450 asserções de teste passando 100% em 10 suítes]
                      ↓
[Observação 3: DateUtils blindado contra UTC-3 e formatação BR DD/MM/YYYY]
                      ↓
[Diagnóstico: O núcleo de cálculo acadêmico, persistência e IA do Organiza está altamente estável]
                      ↓
[Gaps Identificados: Concorrência de escrita, ciclo de vida de timers em unmount, matérias em múltiplos dias]
                      ↓
[Estratégia de Produto: 10 Funcionalidades de Alto Impacto para Universitários Brasileiros]
```

### 2.1. Mapeamento de Gaps de Testes & Proposta de Novos Testes de Regressão

Com base na auditoria aprofundada do código-fonte e dos fluxos do aplicativo, identificamos 7 áreas de gap onde novos testes automatizados devem ser adicionados para prevenção de regressões:

1. **Gap 1 — Concorrência e Condição de Corrida em `StorageService`**:
   - *Cenário*: Salvamentos rápidos e simultâneos de eventos e notas gerados em paralelo por sincronização de background e interação do usuário na UI.
   - *Risco*: Sobrescrita de chave do `AsyncStorage` se duas chamadas `saveEvents` ocorrerem antes do término da primeira leitura.
   - *Novo Teste Recomendado*: Teste de mutação concorrente com 50 promises simultâneas garantindo resolução transacional ou serialização em fila.

2. **Gap 2 — Matérias com Múltiplas Aulas Semanais em Dias Diferentes**:
   - *Cenário*: Em `AttendanceService.ts` (linhas 23-28), o algoritmo assume que um evento recorrente ocorre apenas no dia de início (`startDate.getDay()`). No Brasil, disciplinas universitárias de 4h ou 6h frequentemente ocorrem em dias divididos (ex: Segunda-feira 08h-10h e Quarta-feira 10h-12h).
   - *Risco*: Não geração automática de pendência de presença para o segundo dia se o usuário cadastrou um único `AppEvent` com array `recurrenceDays: [1, 3]`.
   - *Novo Teste Recomendado*: Teste unitário em `AttendanceService` com evento possuindo `recurrenceDays: [1, 3]` gerando presenças para ambos os dias da semana.

3. **Gap 3 — Cálculo de Média com Pontos Extras Acima de 10.0**:
   - *Cenário*: Em `GradeEngine.tsx`, professores que concedem pontos extras (ex: seminário +1.5 na média) podem fazer a soma ultrapassar a nota máxima (ex: 9.0 + 1.5 = 10.5).
   - *Risco*: Interface exibindo nota fora da escala padrão brasileira (0 a 10) ou corrompendo cálculo do Coeficiente de Rendimento.
   - *Novo Teste Recomendado*: Teste em `GradeEngine.test.ts` validando `Math.min(10.0, score + extraPoints)`.

4. **Gap 4 — Desmontagem de Componentes com Timers Ativos (`StudyScreen.tsx`)**:
   - *Cenário*: Usuário inicia o Pomodoro ou Cronômetro na aba de Estudos e rapidamente navega para a aba de Notas ou Calendário.
   - *Risco*: Disparo de `handlePomodoroComplete` e `showToast` após o componente ser desmontado caso o `useEffect` não limpe `timerRef.current`.
   - *Novo Teste Recomendado*: Teste de montagem/desmontagem em harness simulando unmount antes do tick do timer.

5. **Gap 5 — Resiliência a Delimitadores de Ponto e Vírgula (`;`) no Google Sheets CSV**:
   - *Cenário*: No Excel em português do Brasil e no Google Planilhas exportado em locale pt-BR, o delimitador padrão de CSV é o ponto e vírgula (`;`) e a vírgula é o separador decimal (`7,5`).
   - *Risco*: Quebra de parsing se o CSV for delimitado por ponto e vírgula em vez de vírgula simples.
   - *Novo Teste Recomendado*: Teste em `GoogleSheetsService` validando detecção automática de delimitador (`,` vs `;`).

6. **Gap 6 — Integridade de Migração de Backup com Schemas Antigos**:
   - *Cenário*: Usuário importa um backup gerado em versão anterior do Organiza que não continha campos como `aaccActivities`, `groupProjects` ou `semesterId`.
   - *Risco*: `undefined` ou `null` quebrando renderização de listas em modais.
   - *Novo Teste Recomendado*: Teste em `features_and_fixes.test.ts` injetando payload JSON versão 1 sem novos campos e verificando normalização para arrays vazios padrão.

7. **Gap 7 — Transição de Nível e Teto de XP na Gamificação**:
   - *Cenário*: Adição massiva de XP ao completar múltiplas sessões de estudo seguidas.
   - *Risco*: Cálculo incorreto da barra de progresso percentual ou looping de níveis.
   - *Novo Teste Recomendado*: Teste em `gamification.test.ts` validando fórmula $XP_{necessário} = Level \times 100$.

---

## 3. Caveats (Limitações & Ressalvas)

1. **Ambiente de Execução dos Testes**: Os testes são executados em ambiente Node.js utilizando mocks de módulos nativos do Expo e React Native (`test/setup_env.ts`). Recursos como permissões de hardware do sistema operacional do Android (otimização de bateria de segundo plano para notificações locais) devem ser validados na compilação do APK / dispositivo real.
2. **Inferência de IA Local (On-Device)**: O modelo de IA on-device (Gemma 2B INT4 de ~1.28 GB) opera em modo sandbox/mock durante os testes automatizados para garantir execução em menos de 5 segundos. Em produção real, o download do binário requer conexão Wi-Fi e pelo menos 4 GB de memória RAM livre no dispositivo.
3. **Escopos de Tenant no Microsoft Graph**: Os testes validam a geração de URLs de autenticação Azure AD, renovação de tokens e parsing de mensagens. O acesso a canais reais do Microsoft Teams depende de consentimento prévio do administrador da instituição de ensino no Azure Portal para os escopos `ChannelMessage.Read.All`.

---

## 4. Conclusion & 10 High-Impact Innovation Proposals for University Students

O aplicativo Organiza apresenta uma base técnica sólida, moderna e resiliente. Abaixo apresentamos o **Relatório Estratégico com 10 Funcionalidades de Alto Impacto**, formuladas especificamente para resolver as maiores dores do estudante universitário brasileiro:

---

### Proposta 1: Copiloto Acadêmico por IA & Scanner de Ementas/Planos de Ensino (Smart Syllabus Scanner)

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: No início de cada semestre, os professores entregam planos de ensino (PDFs longos ou imagens de quadros) com dezenas de datas de provas, critérios de avaliação com pesos complexos e regras de faltas. O aluno gasta horas transcrevendo manualmente para agendas ou perde prazos cruciais.
  - *Valor*: O estudante tira uma foto do plano de ensino ou anexa o PDF, e a IA local/cloud extrai automaticamente o nome da disciplina, carga horária, fórmula exata da média, todas as provas e trabalhos com datas e cadastra tudo no Organiza em 3 segundos com 1 toque.
- **b) Experiência do Usuário (UX)**:
  - No modal de criação de disciplina ou na tela inicial, haverá o botão em destaque: *"Escanear Plano de Ensino com IA"*.
  - Ao selecionar a foto/PDF, abre-se uma tela de pré-visualização interativa (preview card) listando:
    - Disciplina detectada (ex: *Cálculo Numérico - 60h*);
    - Fórmula de avaliação extraída (ex: $P1 \times 0.4 + P2 \times 0.6$);
    - Eventos de provas e entregas com datas identificadas.
  - O aluno pode ajustar qualquer item com sliders táteis e clicar em *"Confirmar e Cadastrar no Semestre"*.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Integração direta com `LocalAIInferenceService.extractGradeFormula` e `AIParsingService`, conectando à API do Gemini Vision ou OCR nativo via `expo-image-picker`.
  - *Esforço*: **Médio (1 a 2 dias)**. A infraestrutura de parsing e os tipos já existem (`GradeFormulaExtraction`, `ParsedSubjectCriteria`).

---

### Proposta 2: Simulador Inteligente de Nota de Corte, Risco de DP & 'What-If' Matrix

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: O constante estresse de calcular *"quanto preciso tirar na P2 ou no Exame Final para não pegar DP?"*, especialmente em matérias com pesos fracionários e regras de substitutiva.
  - *Valor*: Uma matriz visual preditiva que calcula instantaneamente a nota necessária em cada avaliação futura restante, alertando proativamente a probabilidade de aprovação direta, exame final ou risco de reprovação.
- **b) Experiência do Usuário (UX)**:
  - Na aba de Notas, ao lado de cada matéria, um velocímetro de aprovação (*Gauge Radial*) colorido:
    - **Verde (Zona Segura)**: Média atual $\ge$ corte;
    - **Amarelo (Zona de Atenção - Exame Final)**: Nota necessária viável ($< 7.0$);
    - **Vermelho (Risco de Reprovação)**: Nota necessária $> 10.0$ nas provas restantes.
  - Ao tocar, abre-se o *"Modo Simulação What-If"*: sliders interativos permitem ao aluno arrastar valores hipotéticos de notas futuras e ver a média final e o CR do semestre recalculando em tempo real com feedback háptico.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Extensão matemática pura em `src/components/GradeEngine.tsx` e `GradeSimulatorModal.tsx`.
  - *Esforço*: **Baixo/Médio (1 dia)**. Cálculo linear determinístico $O(1)$ sem dependências externas.

---

### Proposta 3: Gestor de Trabalhos em Grupo com Sincronização P2P/QR Code (Anti-Calote Kanban)

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: Trabalhos em grupo na faculdade são sinônimo de desorganização, membros que não entregam sua parte ("caloteiros") e perda de prazos em meio a conversas desordenadas de WhatsApp.
  - *Valor*: Um mini-Kanban acadêmico onde cada membro tem suas tarefas designadas com prazo e status, permitindo compartilhar e sincronizar o progresso do trabalho entre colegas instantaneamente via QR Code ou link curto, sem necessidade de criar conta em servidores pesados.
- **b) Experiência do Usuário (UX)**:
  - Aba *"Projetos em Grupo"*: lista cartões com título do trabalho, matéria vinculada e barra de progresso percentual.
  - Ao entrar no projeto: 3 colunas Kanban (*A Fazer*, *Fazendo*, *Concluído*).
  - Cada tarefa exibe o avatar do integrante responsável e a data limite.
  - Botão *"Sincronizar com Grupo"*: gera um QR Code dinâmico na tela do celular ou copia um payload comprimido para colar no WhatsApp. O colega escaneia com a câmera do Organiza e o projeto atualiza na hora.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Baseada nas interfaces `GroupProject` e `GroupTask` já existentes em `src/types/index.ts`. Utiliza compressão LZ-String e `expo-sharing` / `react-native-qrcode-svg`.
  - *Esforço*: **Médio (2 dias)**.

---

### Proposta 4: Cofre e Rastreador Inteligente de Horas Complementares / AACC com Validação de Certificados

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: Alunos em vias de formatura entram em desespero para comprovar as 100h a 300h de Atividades Complementares (AACC). Faltam horas em categorias obrigatórias (ex: excesso de cursos online e falta de horas de extensão/pesquisa) e os certificados em PDF se perdem no armazenamento do celular.
  - *Valor*: Dashboard visual de metas por categoria de AACC (Ensino, Pesquisa, Extensão, Outros), com upload local e armazenamento seguro dos comprovantes em PDF/fotos, e botão de *"Exportar Relatório Consolidado para Secretaria"* em PDF formatado.
- **b) Experiência do Usuário (UX)**:
  - Modal/Aba AACC exibe 4 anéis de progresso circulares (estilo Apple Fitness) para cada pilar acadêmico.
  - Ao adicionar certificado: insere título, instituição emissora, horas e anexa o arquivo PDF/imagem.
  - Botão de ação rápida: *"Gerar Dossiê de Horas AACC"*, que compila todos os comprovantes e a tabela de horas em um único relatório pronto para envio ao coordenador do curso.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Utiliza `AACCActivity` em `src/types/index.ts`, `expo-file-system` para persistência local na sandbox do app e `expo-print` para renderização de PDF via HTML template.
  - *Esforço*: **Médio (1.5 dias)**.

---

### Proposta 5: Modo 'Semana de Provas' (Exam Crunch Mode) com Automação de Foco e Silenciamento

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: Durante os períodos de avaliações (P1/P2/Exames), o volume de matérias e o estresse sobrecarregam o estudante. Notificações comuns dispersam a atenção e o calendário regular fica confuso.
  - *Valor*: Ativação de uma interface de alta prioridade com contagem regressiva para as próximas provas, rotinas intensivas de Pomodoro com áudios de foco (ruído branco/binaural) e suspensão automática de alertas não-essenciais.
- **b) Experiência do Usuário (UX)**:
  - Toggle na tela inicial: *"Ativar Modo Semana de Provas"*.
  - O tema adota uma tonalidade de alto contraste focada (*Emergency Focus Palette*).
  - O topo da tela passa a exibir um carrossel prioritário com contagem regressiva para a prova mais próxima (ex: *"Cálculo 1 em 1 dia e 14h — Sala 302"*).
  - O timer de estudo na aba de Estudos se autoajusta para ciclos de 50min foco / 10min descanso com trilha sonora de concentração opcional.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Baseado em `AppSettings.examWeekMode` e `NotificationService.ts`, filtrando notificações agendadas.
  - *Esforço*: **Baixo/Médio (1.5 dias)**.

---

### Proposta 6: Painel de Faltas com 'Calculadora de Enforcamento' e Alerta do Limite LDB (75%)

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: No Brasil, a Lei de Diretrizes e Bases da Educação (LDB) exige presença mínima de 75%. Estudantes perdem a conta de quantas faltas ainda podem ter antes de pegar reprovação por frequência (RF), especialmente ao planejar feriados prolongados ou faltas por imprevistos.
  - *Valor*: Monitoramento em tempo real do "Banco de Faltas Restantes" por disciplina e simulador de faltas futuras (ex: *"Se eu faltar na sexta-feira pós-feriado, minha frequência cai para 78% — ainda dentro do limite"*).
- **b) Experiência do Usuário (UX)**:
  - Na tela de Faltas (`AttendanceScreen.tsx`), cada card exibe um chip proeminente: *"Você pode faltar mais 3 aulas"*.
  - Alerta preventivo com notificação push quando o saldo restante de faltas atingir $\le 2$.
  - Aba *"Planejador de Feriados"*: o aluno seleciona datas do calendário e o app indica visualmente se faltar naqueles dias comprometerá o limite legal de 75%.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Algoritmo matemático integrado ao `AttendanceService.ts` utilizando a fórmula:  
    $$\text{Faltas Máximas} = \left\lfloor \frac{\text{Carga Horária} \times 0.25}{\text{Horas por Aula}} \right\rfloor$$
  - *Esforço*: **Baixo (1 dia)**.

---

### Proposta 7: Hub de Compartilhamento Acadêmico para WhatsApp/Telegram & Exportação iCal (.ics)

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: Representantes de turma e colegas de sala perdem tempo informando repetidamente horários de aulas, salas, cancelamentos e datas de provas nos grupos de WhatsApp.
  - *Valor*: Geração de resumos em texto formatado para WhatsApp com emojis e tópicos com 1 clique, e exportação do calendário do semestre em arquivo padrão `.ics` para integração com Google Calendar, Apple Calendar e Outlook.
- **b) Experiência do Usuário (UX)**:
  - Botão de compartilhamento flutuante na tela de Grade Horária e Calendário:
    - Opção 1: *"Copiar Resumo da Semana para WhatsApp"* — gera texto pronto (ex: *"📚 Aulas de Engenharia - Semana 18/08 a 22/08: ..."*);
    - Opção 2: *"Exportar para Google Agenda / iCal"* — gera arquivo `.ics` padronizado e abre o menu de compartilhamento do Android/iOS.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Módulo gerador de RFC 5545 iCalendar em TypeScript e utilitário de formatação de strings, integrado a `expo-sharing`.
  - *Esforço*: **Baixo (1 dia)**.

---

### Proposta 8: Calculadora e Histórico de Coeficiente de Rendimento (CR / IRA / GPA) com Simulador de Bolsas

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: O Coeficiente de Rendimento (CR/IRA) é determinante para obtenção de bolsas de Iniciação Científica (PIBIC, FAPESP, CNPq), programas de intercâmbio acadêmico e prioridade de matrícula em matérias concorridas. O aluno não tem visão do histórico acumulado nem de metas para subir o CR.
  - *Valor*: Gráfico de evolução do CR semestre a semestre, média ponderada por créditos de cada disciplina e simulador de metas (ex: *"Para subir seu CR geral de 7.8 para 8.2 neste semestre, você precisa de média 8.5 nas matérias atuais"*).
- **b) Experiência do Usuário (UX)**:
  - Na tela de Notas, nova aba *"Histórico & CR"*:
    - Gráfico linear de evolução do CR ao longo dos semestres;
    - Cartão de meta com slider: o aluno define o CR desejado para se candidatar a uma bolsa e o app calcula a média exigida no semestre atual.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Agregação ponderada sobre a lista de `Semester` e `Subject`:
    $$\text{CR} = \frac{\sum (\text{Média}_i \times \text{Créditos}_i)}{\sum \text{Créditos}_i}$$
  - *Esforço*: **Médio (1.5 dias)**.

---

### Proposta 9: Smart Flashcards & Ciclo de Estudos com Repetição Espaçada (Micro-Study Hub)

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: Decoreba de véspera de prova resulta na "curva do esquecimento" logo após a avaliação. O estudante tem dificuldade de fixar conceitos teóricos, fórmulas, vocabulário e jurisprudências de forma contínua.
  - *Valor*: Sistema ágil de Flashcards vinculado a cada matéria dentro da aba de Estudos, com algoritmo de repetição espaçada (Leitner / SM-2 simplificado) para revisões rápidas de 2 a 5 minutos durante deslocamentos no transporte público.
- **b) Experiência do Usuário (UX)**:
  - Na aba de Estudos (`StudyScreen.tsx`), nova seção *"Revisão Diária (Flashcards)"*.
  - O aluno visualiza cartões rápidos das disciplinas do dia. Toca no cartão para virar e escolhe: *Fácil* (rever em 4 dias), *Médio* (rever em 2 dias), *Difícil* (rever amanhã).
  - Sugestão automática de criação de flashcards a partir de notas e resumos gerados pela IA.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Entidade `Flashcard` em `src/types/index.ts`, persistência no `StorageService` com campos `nextReviewDate`, `intervalDays` e `easeFactor`.
  - *Esforço*: **Médio (2 dias)**.

---

### Proposta 10: Gamificação Acadêmica com Árvore de Conquistas Universitárias e Mascote de Produtividade

- **a) Proposta de Valor e Dor do Estudante**:
  - *Dor*: Falta de engajamento e procrastinação crônica ao longo dos longos 4 meses de semestre letivo, onde o aluno só estuda no desespero próximo às provas.
  - *Valor*: Um sistema lúdico de evolução acadêmica que recompensa consistência diária (presença em aula, sessões de Pomodoro concluídas, notas lançadas) com badges temáticos da vida universitária brasileira e níveis ("Bixo/Calouro", "Veterano", "Monitor", "Cientista", "Formando de Honra").
- **b) Experiência do Usuário (UX)**:
  - Widget animado no topo da tela inicial com o nível do estudante, barra de XP e avatar personalizável (mascote universitário que comemora vitórias e lembra de sessões de estudo).
  - Modal de Conquistas com badges divertidos:
    - ☕ *"Mestre do Café das 7h"*: Concluiu 5 sessões de estudo antes das 08h;
    - 🛡️ *"Invicto no Cálculo"*: Obteve média $\ge 7.0$ sem exame final;
    - 🔥 *"Semana de Foco Ninja"*: Manteve streak de estudo por 7 dias seguidos.
  - Animação de confete e feedback háptico ao desbloquear conquistas.
- **c) Viabilidade Técnica e Esforço de Implementação**:
  - *Arquitetura*: Expansão das estruturas existentes `GamificationData`, `Achievement` e `AchievementsModal.tsx`. Listeners integrados ao término do timer de estudo e check-in de faltas.
  - *Esforço*: **Baixo/Médio (1.5 dias)**.

---

## 5. Verification Method (Método de Verificação Independente)

Para que qualquer engenheiro ou agente verifique de forma reprodutível e independente os achados deste relatório:

1. **Verificação de Tipos TypeScript**:
   ```bash
   cd d:\Antigravity\Organiza
   npx tsc --noEmit
   ```
   *Critério de Sucesso*: Execução sem erros (Exit Code 0).

2. **Execução das Suítes de Testes Principais**:
   ```bash
   npx tsx test/e2e_teams_ai.test.ts
   npx tsx test/local_ai_and_universal_hub.test.ts
   npx tsx test/google_sheets_and_date.test.ts
   npx tsx test/features_and_fixes.test.ts
   npx tsx test/theme_and_id.test.ts
   npx tsx test/sync_service.test.ts
   npx tsx test/ai_parser.test.ts
   npx tsx test/challenger_stress_test.ts
   ```
   *Critério de Sucesso*: 100% das asserções devem ser exibidas com `[PASS]` e zero falhas reportadas.

3. **Verificação de Resiliência de Fusos Horários e Datas**:
   - Inspecionar `src/utils/date.ts` e confirmar o uso de `getLocalDateString()` e `parseLocalDate()` com fixação em meio-dia (`T12:00:00`).

---
*Relatório emitido por Explorer 3 — Testing, Type Safety & Innovation Strategy Specialist.*
