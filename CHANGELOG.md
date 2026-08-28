# 📜 Histórico de Versões & Changelog — Lumen

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.
O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/).

---

## 🏷️ Regras de Versionamento Semântico
- **Patch (+0.0.1, ex: 3.1.1)**: Correções de bugs, ajustes de layout/CSS, pequenas melhorias de estabilidade.
- **Minor (+0.1.0, ex: 3.2.0)**: Novos recursos, novas telas, funcionalidades adicionais sem quebra de compatibilidade. (Zera o patch).
- **Major (+1.0.0, ex: 4.0.0)**: Grandes reformulações de arquitetura, redesign completo ou mudanças estruturais profundas. (Zera minor e patch).

---

## [3.3.0] - 2026-08-28
### 🎮 Novo Recurso de Gamificação (Features)
- **Motor de XP e Níveis:** Sistema inteligente de gamificação integrado! Estudar (Pomodoro) e marcar presença nas aulas agora rendem experiência (XP).
- **Sistema de Conquistas:** Desbloqueie badges alcançando marcos acadêmicos.
- **Painel de Conquistas:** Nova interface (`AchievementsModal`) para acompanhar o nível, o progresso até o próximo nível e todas as medalhas desbloqueadas.
- **Notificações em Tempo Real:** Animações e *Toasts* com feedback (Haptics) toda vez que você ganhar XP.

---

## [3.2.0] - 2026-08-27
### ✨ Novo Recurso (Features)
- **Extração de Dados via PDF e Imagens com IA:** Agora a tela de Desempenho & Curso permite carregar históricos escolares e fluxogramas diretamente em PDF ou Imagens (`expo-document-picker`). A IA do Gemini mapeia os documentos e cria a grade curricular e matérias cursadas magicamente.

---

## [3.1.3] - 2026-08-26
### 🛡️ Blindagem de Inicialização & Deserialização no AsyncStorage (Cold Start Firewall)
- **Firewall de Deserialização Segura (`safeParseArray` & `safeParseObject`):** Blindagem completa de todos os métodos do `StorageService` contra payloads corrompidos, strings literais `"null"`, `"undefined"`, números ou JSON malformado.
- **Eliminação Definitiva de Null-Pointers na Montagem:** Garantia de retorno de arrays e objetos tipados não-nulos em todos os 11 repositórios de dados (`getEvents`, `getSubjects`, `getAttendances`, `getTasks`, `getStudySessions`, `getSemesters`, `getSettings`, `getStreak`, `getAACCActivities`, `getGroupProjects`, `getGamificationData`), eliminando erros de `TypeError: Cannot read properties of null (reading 'filter')` no `App.tsx` e `AttendanceService`.

### 🔒 Blindagem de Ciclo de Vida & Tolerância a Falhas de Permissão do SO
- **Resiliência a Negação de Notificações no Android 13+:** Tratamento gracioso de recusas de permissão (`POST_NOTIFICATIONS`), alarmes exatos (`SCHEDULE_EXACT_ALARM`) e canais de notificação no `NotificationService.requestPermissions()` e `scheduleEventNotifications()`, garantindo que o app nunca dispare exceções não tratadas ao agendar alertas.
- **Cofre Seguro de Dois Níveis (SecureStore & In-Memory Vault):** Proteção de credenciais confidenciais com fallback automático para cofre seguro em memória (`inMemorySecureVault`) caso o hardware Keystore do dispositivo falhe ou esteja indisponível.
- **Migração Automática de Chaves Legadas:** Migração transparente de chaves de API do Google Gemini armazenadas em texto plano no `@organiza_ai_config` para o `expo-secure-store`, higienizando o armazenamento não criptografado.

### 🌟 Elegância em Primeira Instalação (Zero Data Bootstrap)
- **Inicialização Limpa Sem Exceções:** Telas de Agenda, Desempenho Acadêmico, Faltas, Notas e Estudos inicializam com estados visuais elegantes e cards informativos na ausência total de dados prévios.
- **Auto-Provisionamento de Semestre Ativo:** Criação automática do semestre corrente (ex: `2026.2`) e matriz curricular padrão de graduação no `CourseCRService` em boots de primeira instalação.

### 🧪 Bateria de Testes Automatizados & Cobertura Adversarial Expandida
- **Nova Suíte de Testes Dedicada (`test/lifecycle_and_permissions.test.ts`):** 64 novas asserções cobrindo cenários adversos de negação de permissões do SO, falha de hardware Keystore, simulação de boot limpo com dados zerados, migração de esquema legado e timeout com abort controller no `AppUpdateService`.
- **100% de Aprovação em 27 Suítes de Testes:** Mais de 900 asserções executadas com 0 falhas e verificação estrita de tipos com `npx tsc --noEmit` (0 erros).

---

## [3.1.2] - 2026-08-25
### 🛡️ Corrigido (Bug Fixes & Inicialização)
- **Correção de Crash na Inicialização:** Removida chamada de hook de Safe Area fora do escopo do provedor e encapsulado o componente raiz no `<SafeAreaProvider>`.
- **ErrorBoundary Global:** Implementado componente de captura de exceções em tempo de execução para garantir que qualquer erro pontual exiba uma tela de recuperação com botão de "Reiniciar Lumen", impedindo que o aplicativo feche abruptamente.

---

## [3.1.1] - 2026-08-25
### 🛡️ Corrigido (Bug Fixes)
- **Crash na Aba de Desempenho:** Corrigido erro de carregamento no CourseCRService e AcademicPerformanceScreen ao processar esquemas antigos ou incompletos do AsyncStorage sem a matriz de semestres.
- **Botão Flutuante (+):** Restrito para ser exibido exclusivamente na aba Agenda, permanecendo oculto nas demais abas (Estudos, Lumen AI, Faltas e Notas).

### 🎨 Melhorias de UI / UX
- **Adaptação para Câmeras Frontais & Notches:** Header superior redesenhado em formato Dual-Zone assimétrico com useSafeAreaInsets. O canal central superior foi desobstruído para evitar sobreposição de elementos em celulares com câmera punch-hole central/lateral ou ilhas dinâmicas.

### ✨ Inteligência Artificial
- **Simplificação da Configuração:** Removidos downloads pesados de modelos locais offline (340 MB, 1.18 GB e 2.45 GB) da tela de configurações, focando na integração direta e gratuita com a API do Google Gemini via Google AI Studio.

---

## [3.1.0] - 2026-08-25
### ✨ Novos Recursos (Features)
- **Atualizador Automático In-App (AppUpdateService):** Sistema que consulta automaticamente novas versões publicadas no GitHub Releases a cada inicialização do app.
- **Modal Nativo de Atualização (AppUpdateModal):** Interface nativa exibindo o número da versão mais recente, notas de atualização (changelog) e botão com link direto para download do APK.
- **Núcleo de Versionamento Semântico (version.ts):** Parser e comparador rigoroso de versões SemVer com suporte a incremento de Patch, Minor e Major.

---

## [3.0.0] - 2026-08-25
### 🚀 Grande Evolução (Major Release)
- **Novo Rebranding Lumen:** Transição completa para a identidade visual Lumen, novo ícone sutil e discreto em prisma de cetim sobre obsidiana fosca.
- **Rastreador de CR Ponderado & Simulador What-If:** Cálculo de Coeficiente de Rendimento ponderado por créditos e simulações dinâmicas de notas necessárias para atingir metas acadêmicas.
- **Fluxograma & Matriz Curricular:** Visualização semestre a semestre do progresso da graduação com barras de porcentagem de conclusão.
- **Motor Automático de Semestres:** Identificação inteligente do período letivo atual baseado na data do dispositivo.

---

## [2.5.0] - 2026-08-18
### ✨ Novos Recursos (Features)
- **Integração com Microsoft Teams:** Importação de mensagens e comunicados acadêmicos.
- **Parser de Mensagens com IA:** Reconhecimento automático de cancelamentos de aulas, prazos de trabalhos e datas de provas.
- **Notificações em Alta Prioridade:** Ícone transparente em silhueta para Android, eliminando o quadrado branco nas notificações.
