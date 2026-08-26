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
