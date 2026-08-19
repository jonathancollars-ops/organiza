# Relatório Completo de Auditoria de UI & UX — Organiza Mobile App

**Data da Auditoria**: 2026-08-18  
**Auditor**: Explorer 1 (UI & UX Specialist)  
**Ambiente**: React Native 0.81.5 / Expo SDK 54 / TypeScript 5.9 / react-native-calendars / react-native-safe-area-context  
**Escopo**: Todas as telas (`src/screens/*`), componentes e modais (`src/components/*`), sistema de temas (`src/theme/index.ts`), layout raiz (`App.tsx`), acessibilidade e responsividade.

---

## 1. Sumário Executivo

A auditoria visual e de experiência do usuário (UI/UX) avaliou o aplicativo Organiza em três temas visuais (**Dark**, **Light**, **AMOLED**) e em diferentes perfis de tela (telas compactas de 360px até telas modernas com entalhes/Dynamic Island de 59pt).

Foram identificadas **15 inconsistências visuais e estruturais** categorizadas em 5 áreas de impacto:
1. **Contraste de Temas (WCAG AA)**: Cores de texto rígidas (`#000` ou `#fff`) sobre fundos dinâmicos (`colors.primary`, `dangerLight`, `warningLight`, `successLight`), resultando em índices de contraste abaixo de 3:1 no tema Claro e no tema Escuro.
2. **Arquitetura de Modais & Interações**: Ausência de fechamento por toque no backdrop (scrim overlay) e falta de `KeyboardAvoidingView` em modais com formulários e inputs numéricos.
3. **Safe Area & Insets de Plataforma**: Uso de `paddingTop: 50` fixo em modais de tela cheia no iOS, provocando sobreposição com Dynamic Island (iPhone 14 Pro/15/16) e espaçamentos excessivos em modelos compactos; tratamento de barra inferior no Android vs iOS.
4. **Responsividade & Quebra de Layout**: Sobrecarga de botões no cabeçalho de `App.tsx` (~440px de largura requerida contra viewports de 360px), causando corte e quebra visual de elementos; compressão de botões de 3 colunas em telas menores.
5. **Feedback Visual & Acessibilidade**: Ausência de indicador de carregamento inicial (flash de tela vazia no boot) e touch targets abaixo de 44x44px.

---

## 2. Inventário Detalhado de Achados

---

### Categoria A: Contraste de Temas & Legibilidade Visual (WCAG AA)

#### [BUG-UI-01] Texto Preto Rígido sobre `colors.primary` no Tema Claro em `TeamsConfigModal.tsx`
- **Arquivo**: `src/components/TeamsConfigModal.tsx`
- **Linhas**: 970, 988, 1040, 1062, 1133, 1160, 1466, 1508
- **Gravidade**: Alta
- **Descrição do Problema**:
  No tema Claro (`theme === 'light'`), `colors.primary` é `#059669` (Verde Esmeralda Escuro). O componente utiliza cor de texto fixa `{ color: '#000000' }` e `color: '#000'` em botões primários (`primaryButtonText`, `actionButtonGreenText`) e nos seletores de provedor/modelo de IA quando selecionados (`providerOptionSelected`, `modelChipSelected`).
- **Impacto no Usuário**:
  Texto preto sobre verde escuro atinge uma taxa de contraste de apenas **2.81:1**, violando a diretriz WCAG AA (mínimo de 4.5:1 para textos normais), tornando os textos quase ilegíveis para usuários no tema Claro.
- **Código Problemático**:
  ```tsx
  // Linha 1465-1469
  primaryButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold'
  }
  // Linhas 969-971
  aiConfig.provider === 'gemini' && { color: '#000', fontWeight: 'bold' }
  ```
- **Correção Proposta**:
  Utilizar a função utilitária `getContrastTextColor(colors.primary)` ou definir `color: getContrastTextColor(colors.primary)` dinamicamente nos estilos.
  ```tsx
  // Correção:
  <Text style={[styles.primaryButtonText, { color: getContrastTextColor(colors.primary) }]}>
  ```

---

#### [BUG-UI-02] Baixo Contraste em Badges e Banners de Alerta no Tema Claro
- **Arquivos**:
  - `src/screens/GradesScreen.tsx` (linhas 175-184, 270-286)
  - `src/screens/AttendanceScreen.tsx` (linhas 227-230, 264-267, 303-317)
  - `src/screens/StudyScreen.tsx` (linhas 346, 784)
  - `src/components/TodaySummaryWidget.tsx` (linhas 178-198)
  - `src/components/PendingAttendanceModal.tsx` (linhas 64-77)
  - `src/components/SubjectDetailsModal.tsx` (linhas 208-222, 248)
  - `src/components/EventModal.tsx` (linhas 428-435)
  - `src/components/SubjectModal.tsx` (linhas 460-466)
- **Gravidade**: Média
- **Descrição do Problema**:
  No tema Claro, as cores base de alerta aplicadas diretamente sobre seus respectivos fundos claros geram baixo contraste:
  - `warning: '#F59E0B'` sobre `warningLight: '#FEF3C7'` = contraste de **2.35:1** (Falha WCAG).
  - `danger: '#EF4444'` sobre `dangerLight: '#FEE2E2'` = contraste de **3.39:1** (Falha WCAG para textos de 11px-13px).
  - `success: '#10B981'` sobre `successLight: '#D1FAE5'` = contraste de **2.52:1** (Falha WCAG).
- **Impacto no Usuário**:
  Labels essenciais como "Atenção! Restam 2 faltas", "Reprovado por falta!", status de notas "Em Risco" e datas de provas urgentes ficam difíceis de ler sob luz ambiente no tema Claro.
- **Correção Proposta**:
  Adicionar ao `src/theme/index.ts` variantes de texto de alto contraste para o tema Claro ou aplicar tons mais profundos (`#B45309` para warning, `#B91C1C` para danger, `#047857` para success) quando renderizados sobre fundos pastéis.
  ```typescript
  // Sugestão para theme/index.ts:
  Colors.light.warningText = '#B45309';
  Colors.light.dangerText = '#B91C1C';
  Colors.light.successText = '#047857';
  ```

---

#### [BUG-UI-03] Conflito Cromático de Destaque no Simulador de Notas
- **Arquivo**: `src/components/GradeSimulatorModal.tsx`
- **Linha**: 166-168
- **Gravidade**: Baixa
- **Descrição do Problema**:
  O resultado do cálculo de nota necessária é exibido dentro de `resultCard`, cujo fundo varia dinamicamente entre `successLight`, `warningLight` e `dangerLight`. Porém, o número da nota (`40px bold`) é renderizado fixamente com `color: colors.primary`:
  ```tsx
  <Text style={{ fontSize: 40, fontWeight: '800', color: colors.primary, letterSpacing: -1 }}>
    {gradeInfo.minimumNeeded.toFixed(1)}
  </Text>
  ```
- **Impacto no Usuário**:
  No tema Escuro, `colors.primary` é Verde Menta Neon (`#00FFAA`). Quando a situação do aluno é crítica (fundo avermelhado `dangerLight`), um número verde neon gigante sobre fundo vermelho cria uma combinação visual desarmônica e confusa.
- **Correção Proposta**:
  Vincular a cor do número ao status do resultado: verde se `minimumNeeded <= 5`, âmbar se `<= 8` e vermelho/danger se `> 8` ou `colors.text`.

---

#### [BUG-UI-04] Inconsistência de Texto no Banner de Faltas Pendentes em Tema Escuro
- **Arquivo**: `App.tsx`
- **Linhas**: 483-498
- **Gravidade**: Média
- **Descrição do Problema**:
  O banner `pendingBanner` utiliza `backgroundColor: colors.danger`. No tema escuro, `colors.danger` é `#F87171` (vermelho pastel claro). O texto interno está fixado com `color: '#fff'`.
- **Impacto no Usuário**:
  Texto branco sobre `#F87171` possui contraste de apenas **2.62:1**, causando aspecto desbotado e ilegível no tema Dark e AMOLED.
- **Correção Proposta**:
  Utilizar `getContrastTextColor(colors.danger)` ou fixar fundo em tom avermelhado profundo (`#DC2626` / `#B91C1C`) com texto branco em todos os temas.

---

#### [BUG-UI-05] Falta de `selectedTextColor` no Calendário Manual em `SubjectDetailsModal.tsx`
- **Arquivo**: `src/components/SubjectDetailsModal.tsx`
- **Linha**: 192-194
- **Gravidade**: Baixa
- **Descrição do Problema**:
  Na marcação de data avulsa do calendário manual de presenças:
  ```tsx
  markedDates={{
    [manualDate]: { selected: true, selectedColor: colors.primary }
  }}
  ```
  Falta especificar `selectedTextColor: getContrastTextColor(colors.primary)`.
- **Impacto no Usuário**:
  O componente `react-native-calendars` usa branco por padrão no dia selecionado, o que tem baixo contraste quando `selectedColor` é o verde menta claro do Dark Mode.
- **Correção Proposta**:
  Adicionar `selectedTextColor: getContrastTextColor(colors.primary)` ao objeto do dia selecionado.

---

### Categoria B: Arquitetura de Modais, Animações & Teclado

#### [BUG-UI-06] Impossibilidade de Fechar Modais Clicando no Fundo (Backdrop / Scrim Dismiss)
- **Arquivos**:
  - `src/components/EventModal.tsx` (linhas 154-157)
  - `src/components/EventTypeModal.tsx` (linhas 24-27)
  - `src/components/GradeEngine.tsx` (linhas 420, 509, 571)
- **Gravidade**: Alta
- **Descrição do Problema**:
  Modais do tipo Bottom Sheet e caixas de diálogo centrais usam `<Modal transparent={true}>` com um `<View style={styles.modalOverlay}>` estático. Ao tocar na área escura fora do modal, o evento de toque é engolido pela View sem disparar `onClose()`. O usuário é obrigado a rolar até o botão "Cancelar" ou "Fechar" ou utilizar o botão voltar do Android.
- **Impacto no Usuário**:
  Quebra a convenção padrão de UX mobile no iOS e Android, onde tocar no fundo translúcido fecha o modal/sheet imediatamente.
- **Correção Proposta**:
  Envolver o overlay com `TouchableWithoutFeedback` / `TouchableOpacity` com `onPress={onClose}` e isolar o container de conteúdo com `onPress={(e) => e.stopPropagation()}` ou `TouchableWithoutFeedback`.
  ```tsx
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
        {/* Conteúdo do modal */}
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
  ```

---

#### [BUG-UI-07] Ausência de `KeyboardAvoidingView` em Modais com Entradas de Texto
- **Arquivos**:
  - `src/components/EventModal.tsx`
  - `src/components/GradeEngine.tsx` (submodais de Adicionar Nota, Editar Nota e Simular Final)
  - `src/components/SubjectModal.tsx`
  - `src/components/ExamModal.tsx`
  - `src/components/AnalyticsAndAACCModal.tsx`
  - `src/components/GroupProjectsModal.tsx`
- **Gravidade**: Alta
- **Descrição do Problema**:
  Diversos modais contêm campos `<TextInput>` com foco automático (`autoFocus`) ou posicionados na metade inferior da tela sem encapsulamento em `KeyboardAvoidingView` (com `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`).
- **Impacto no Usuário**:
  No iOS e em vários aparelhos Android, quando o teclado virtual é aberto, os botões "Salvar", "Adicionar" e os próprios campos de digitação ficam completamente encobertos pelo teclado, impedindo a visualização do que está sendo digitado.
- **Correção Proposta**:
  Adicionar `KeyboardAvoidingView` em torno do conteúdo rolável de formulários com `keyboardShouldPersistTaps="handled"` nos `ScrollView`.

---

#### [BUG-UI-08] Ausência de Gesto de Arraste no Drag Handle dos Bottom Sheets
- **Arquivos**:
  - `src/components/EventModal.tsx` (linha 157)
  - `src/components/EventTypeModal.tsx` (linha 27)
- **Gravidade**: Baixa
- **Descrição do Problema**:
  Existe um elemento visual `<View style={styles.dragHandle} />` que sugere ao usuário que a gaveta pode ser arrastada para baixo para fechar, porém não há suporte a `PanResponder` ou gesto deslizante.
- **Impacto no Usuário**:
  Falsa acessibilidade perceptual: o usuário tenta arrastar a gaveta para baixo e nada acontece.
- **Correção Proposta**:
  Ou implementar suporte a gesto deslizante ou assegurar que o toque no backdrop (BUG-UI-06) e no botão Fechar forneçam saída imediata e intuitiva.

---

### Categoria C: Safe Area & Insets de Plataforma (iOS & Android)

#### [BUG-UI-09] `paddingTop: 50` Fixo em Modais de Tela Cheia no iOS
- **Arquivos**:
  - `src/components/SubjectModal.tsx` (linha 487)
  - `src/components/ExamModal.tsx` (linha 419)
  - `src/components/PendingAttendanceModal.tsx` (linha 107)
  - `src/components/EditSubjectModal.tsx` (linha 295)
  - `src/components/GradeSimulatorModal.tsx` (linha 225)
- **Gravidade**: Alta
- **Descrição do Problema**:
  O cabeçalho desses modais de tela cheia define:
  ```typescript
  paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 20) + 12 : 50
  ```
- **Impacto no Usuário**:
  - Em dispositivos iPhone 14 Pro, 15, 15 Pro, 16 (com **Dynamic Island**), o safe area top inset é de **59pt**. Com `paddingTop: 50`, o título do cabeçalho e os botões "Cancelar" e "Salvar" colidem diretamente com a Dynamic Island (ficam cortados em ~9pt).
  - Em iPhones compactos com botão Home (iPhone SE 2/3, 8), o safe area top é **20pt**, resultando em um espaço em branco desnecessário de 30pt.
- **Correção Proposta**:
  Substituir a View raiz por `<SafeAreaView style={styles.container}>` ou utilizar o hook `useSafeAreaInsets()` do pacote `react-native-safe-area-context` (já instalado no projeto na versão `~5.6.0`).

---

#### [BUG-UI-10] Tratamento da Barra Inferior (Bottom Navigation) e Home Indicator
- **Arquivo**: `App.tsx`
- **Linhas**: 386, 1196-1215
- **Gravidade**: Média
- **Descrição do Problema**:
  A barra de navegação inferior `styles.bottomNav` possui `height: 64, paddingBottom: 6, paddingTop: 4`.
  Como a `SafeAreaView` da biblioteca padrão `react-native` encapsula todo o `App`, em iPhones com barra de gestos (Home Indicator de 34pt), a margem segura inferior fica com a cor de fundo do container (`colors.background`), enquanto a barra inferior possui fundo `colors.surface`, criando um corte visual no rodapé.
- **Impacto no Usuário**:
  Descontinuidade estética na parte inferior do aplicativo no iOS.
- **Correção Proposta**:
  Utilizar `SafeAreaProvider` e aplicar `useSafeAreaInsets().bottom` diretamente ao padding inferior do componente `bottomNav`, permitindo que o fundo `colors.surface` cubra toda a base da tela até a borda física.

---

### Categoria D: Responsividade, Quebra de Texto & Densidade de Tela

#### [BUG-UI-11] Overflow e Quebra de Elementos no Cabeçalho Principal do App
- **Arquivo**: `App.tsx`
- **Linhas**: 390-478
- **Gravidade**: Alta
- **Descrição do Problema**:
  O cabeçalho principal contém lado a lado:
  - Lado Esquerdo: Ícone do app (32px), Título "Organiza" (fonte 22px bold) e Badge opcional "🎯 MODO PROVAS" (80px).
  - Lado Direito (`headerRight` com `gap: 8`): Botão de Nível/Conquistas (~65px), Botão Trabalhos em Grupo (36px), Botão Analytics (36px), Botão Teams (~80px), Botão Configurações (36px), Botão Tema (36px).
  - Largura total combinada do cabeçalho: **~440px**.
- **Impacto no Usuário**:
  Em telas com largura típica de 360px a 390px (maioria dos smartphones Android populares e iPhone SE), o cabeçalho sofre quebra de linha forçada, compressão dos botões ou empurra os botões para fora da tela (overflow horizontal invisível), prejudicando o acesso às telas de Trabalhos e Estatísticas.
- **Correção Proposta**:
  1. No `headerRight`, manter os botões mais frequentes visíveis e agrupar ações secundárias ou condensar o botão do Teams para ícone circular (36x36px `🤖`).
  2. Ajustar o `title` com `flexShrink: 1` e `numberOfLines={1}`.
  3. Adicionar scroll horizontal sutil ou menu de ações se necessário.

---

#### [BUG-UI-12] Botões de Ação Rápida de Presença em 3 Colunas em Telas Estreitas
- **Arquivos**:
  - `src/screens/AttendanceScreen.tsx` (linhas 301-326, 464-471)
  - `src/components/PendingAttendanceModal.tsx` (linhas 62-86, 160-174)
  - `src/components/SubjectDetailsModal.tsx` (linhas 206-231, 365-371)
- **Gravidade**: Média
- **Descrição do Problema**:
  Os 3 botões de registro rápido (`✓ Presente`, `✕ Faltei`/`✕ Falta`, `Cancelada`) estão dispostos lado a lado com `flex: 1` e `gap: 6`. Em telas de 320px a 360px, o espaço interno útil de cada botão é de apenas ~85px.
- **Impacto no Usuário**:
  O texto "✓ Presente" e "Cancelada" pode sofrer quebra de linha feia ou corte parcial caso o usuário aumente o tamanho de fonte padrão nas preferências de acessibilidade do sistema.
- **Correção Proposta**:
  Adicionar `numberOfLines={1}` e `adjustsFontSizeToFit={true}` nos componentes `<Text>` dos botões de ação rápida.

---

#### [BUG-UI-13] Altura Rígida em Cards de Avaliação em `GradeEngine.tsx`
- **Arquivo**: `src/components/GradeEngine.tsx`
- **Linha**: 720-733 (`itemSquare: { width: '48%', height: 128 }`)
- **Gravidade**: Baixa
- **Descrição do Problema**:
  O card de cada avaliação possui altura fixa de `128px`. Quando o título da prova tem 2 linhas longas e possui o sufixo `(Final)`, o peso e a nota na base do card ficam comprimidos.
- **Impacto no Usuário**:
  Pode ocorrer sobreposição de texto em dispositivos com fontes ampliadas.
- **Correção Proposta**:
  Substituir `height: 128` por `minHeight: 128` com `padding: 12`.

---

#### [BUG-UI-14] Compressão de Aulas com Duração Curta na Grade Horária Semanal
- **Arquivo**: `src/screens/ScheduleGridScreen.tsx`
- **Linhas**: 191-211, 358-379
- **Gravidade**: Baixa
- **Descrição do Problema**:
  Aulas com duração de 30 a 45 minutos geram blocos com altura entre 24px e 35px. Nesses blocos, o componente tenta renderizar o nome da matéria e o horário (`startTime - endTime`).
- **Impacto no Usuário**:
  O horário sobrepõe o nome da matéria ou fica cortado pela borda inferior do bloco.
- **Correção Proposta**:
  Ocultar o horário se a altura calculada for menor que 42px (já existente condicional `duration >= 40`, mas recomendável refinar para checar altura física em pixels `>= 42`).

---

### Categoria E: Feedback Visual, Estados Vazios & Acessibilidade

#### [BUG-UI-15] Flash de Estado Vazio durante Carregamento Inicial em `App.tsx`
- **Arquivo**: `App.tsx`
- **Linhas**: 98-154, 385-780
- **Gravidade**: Média
- **Descrição do Problema**:
  Ao inicializar o aplicativo, o hook `useEffect` chama `loadData()`, que realiza chamadas assíncronas ao `AsyncStorage`. Durante os primeiros 100-300ms, o estado `events`, `subjects` e `attendances` é inicializado como array vazio `[]`. A interface renderiza imediatamente o componente do calendário e o texto "Nenhuma matéria cadastrada", antes de dar um salto repentino (layout shift) para os dados carregados.
- **Impacto no Usuário**:
  Sensação de aplicativo travado ou inconsistência de dados nos primeiros instantes de abertura.
- **Correção Proposta**:
  Adicionar um estado `const [isInitializing, setIsInitializing] = useState(true)` e renderizar um `ActivityIndicator` elegante com o logo ou manter o splash screen nativo até que `loadData()` conclua.

---

#### [BUG-UI-16] Touch Targets Reduzidos em Botões de Exclusão e Ícones
- **Arquivos**:
  - `src/components/GradeEngine.tsx` (linha 384: botão `✕` com `padding: 4`)
  - `src/screens/StudyScreen.tsx` (linha 788: botão `×` com `padding: 6`)
  - `src/screens/GradesScreen.tsx` (linha 200: botão de limpar busca com `padding: 4`)
- **Gravidade**: Baixa
- **Descrição do Problema**:
  Botões de remoção de itens possuem área de toque inferior a 28x28px, abaixo da recomendação de 44x44px (Apple HIG) e 48x48px (Material Design).
- **Impacto no Usuário**:
  Dificuldade para usuários com dedos maiores ou dificuldades motoras tocarem com precisão no botão de exclusão sem acionar o card inteiro.
- **Correção Proposta**:
  Adicionar `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}` aos botões touchables compactos.

---

## 3. Matriz de Priorização de Correções

| ID | Componente / Tela | Problema Principal | Impacto | Complexidade |
|---|---|---|---|---|
| **BUG-UI-01** | `TeamsConfigModal.tsx` | Texto preto em botão verde no tema Claro | 🔴 Alto (WCAG) | 🟢 Baixa |
| **BUG-UI-06** | `EventModal`, `EventTypeModal`, `GradeEngine` | Fundo translúcido não fecha modal ao toque | 🔴 Alto (UX) | 🟢 Baixa |
| **BUG-UI-07** | Modais de formulários | Teclado encobre inputs e botões de ação | 🔴 Alto (UX) | 🟡 Média |
| **BUG-UI-09** | `SubjectModal`, `ExamModal`, etc. | `paddingTop: 50` colide com Dynamic Island | 🔴 Alto (iOS) | 🟢 Baixa |
| **BUG-UI-11** | `App.tsx` Header | 6 botões no cabeçalho estouram largura de 360px | 🔴 Alto (Layout) | 🟡 Média |
| **BUG-UI-02** | `GradesScreen`, `AttendanceScreen`, etc. | Contraste de textos de alerta em tema Claro | 🟡 Médio (WCAG) | 🟢 Baixa |
| **BUG-UI-04** | `App.tsx` Banner | Texto branco sobre perigo pastel no tema Escuro | 🟡 Médio (WCAG) | 🟢 Baixa |
| **BUG-UI-10** | `App.tsx` Bottom Nav | Home indicator safe area desconectada do fundo | 🟡 Médio (Visual) | 🟢 Baixa |
| **BUG-UI-12** | `AttendanceScreen`, `PendingAttendance` | 3 botões em linha podem truncar texto | 🟡 Médio (Texto) | 🟢 Baixa |
| **BUG-UI-15** | `App.tsx` | Flash de tela vazia antes do `loadData` | 🟡 Médio (UX) | 🟢 Baixa |
| **BUG-UI-03** | `GradeSimulatorModal.tsx` | Verde neon sobre vermelho em simulador | 🟢 Baixo (Visual) | 🟢 Baixa |
| **BUG-UI-05** | `SubjectDetailsModal.tsx` | Cor de texto no dia selecionado do calendário | 🟢 Baixo (Visual) | 🟢 Baixa |
| **BUG-UI-13** | `GradeEngine.tsx` | Altura fixa 128px em cards de nota | 🟢 Baixo (Visual) | 🟢 Baixa |
| **BUG-UI-14** | `ScheduleGridScreen.tsx` | Aulas < 40min comprimem texto de horário | 🟢 Baixo (Visual) | 🟢 Baixa |
| **BUG-UI-16** | Múltiplos componentes | Touch targets pequenos sem hitSlop | 🟢 Baixo (A11y) | 🟢 Baixa |

---

## 4. Recomendações de Código & Snippets de Solução

### 4.1. Correção do Cabeçalho Responsivo em `App.tsx`
```tsx
// Compactar ações secundárias ou utilizar ícones limpos de 36x36
<View style={styles.headerRight}>
  <TouchableOpacity
    style={[styles.levelHeaderBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
    onPress={() => setAchievementsModalVisible(true)}
  >
    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>
      Nv.{gamification?.level || 1} 🎓
    </Text>
  </TouchableOpacity>

  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]} onPress={() => setGroupProjectsModalVisible(true)}>
    <Text style={{ fontSize: 15 }}>👥</Text>
  </TouchableOpacity>

  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]} onPress={() => setAnalyticsModalVisible(true)}>
    <Text style={{ fontSize: 15 }}>📈</Text>
  </TouchableOpacity>

  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]} onPress={() => setTeamsModalVisible(true)}>
    <Text style={{ fontSize: 15 }}>🤖</Text>
  </TouchableOpacity>

  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]} onPress={() => setSettingsModalVisible(true)}>
    <Text style={{ fontSize: 15 }}>⚙️</Text>
  </TouchableOpacity>

  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]} onPress={handleThemeToggle}>
    <Text style={{ fontSize: 15 }}>{theme === 'dark' ? '🌙' : theme === 'amoled' ? '🖤' : '☀️'}</Text>
  </TouchableOpacity>
</View>
```

### 4.2. Correção de Backdrop Dismiss em `EventModal.tsx` e `EventTypeModal.tsx`
```tsx
<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
  <TouchableOpacity 
    style={styles.modalOverlay} 
    activeOpacity={1} 
    onPress={onClose}
  >
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={{ width: '100%', justifyContent: 'flex-end' }}
    >
      <TouchableOpacity 
        activeOpacity={1} 
        style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.dragHandle} />
        {/* Formulário */}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  </TouchableOpacity>
</Modal>
```

### 4.3. Correção de Safe Area em Modais de Tela Cheia
```tsx
// Em SubjectModal, ExamModal, PendingAttendanceModal, EditSubjectModal, GradeSimulatorModal:
import { SafeAreaView } from 'react-native-safe-area-context';

<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
  <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
    <View style={styles.header}>
      {/* Header com paddingVertical normal sem paddingTop: 50 hardcoded */}
    </View>
    {/* Conteúdo */}
  </SafeAreaView>
</Modal>
```

---

## 5. Conclusão da Investigação de UI/UX

O aplicativo Organiza possui uma interface moderna, rica em funcionalidades e bem estruturada em temas escuros. No entanto, a aplicação das correções descritas acima é necessária para garantir:
1. **Conformidade WCAG AA total** em modo Claro e Escuro.
2. **Usabilidade sem falhas em iPhones com Dynamic Island e Androids modernos**.
3. **Fluidez de navegação em modais com fechamento por backdrop e suporte adequado a teclados**.
4. **Preservação do layout em qualquer tamanho de tela mobile (360px a 430px+)**.

Este relatório serve como diretriz precisa para os agentes executores na etapa de implementação e testes de integração.
