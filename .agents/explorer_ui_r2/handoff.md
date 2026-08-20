# Relatório de Auditoria Visual, Temas e Contraste UI (Organiza)

## 1. Observações (Defeitos Identificados por Arquivo e Linha)

### 1.1 `src/theme/index.ts` — Contraste Crítico de Cores de Categoria
- **Localização**: `src/theme/index.ts:74`
- **Código Atual**:
  ```ts
  export const CategoryColors: { [key: string]: string } = {
    'Faculdade/Aulas': '#3B82F6',
    'Provas/Trabalhos': '#EF4444',
    'Estudos': '#10B981',
    'Trabalho': '#F59E0B',
    'Pessoal': '#8B5CF6',
    'Saúde/Academia': '#00FFAA',
    'Outros': '#6B7280',
  };
  ```
- **Problema**: A cor `'Saúde/Academia': '#00FFAA'` é estática e possui luminância altíssima (YIQ = 208). No tema **`light`** (`#FFFFFF` / `#F8FAFC`), texto ou borda usando `#00FFAA` possui razão de contraste de apenas **1.3:1** (falha total nos critérios WCAG AA e AAA de 4.5:1). Em `App.tsx` e `EventModal.tsx`, chips de eventos dessa categoria tornam-se ilegíveis no modo claro.

---

### 1.2 `App.tsx` — Insets de Safe Area, Banner de Faltas e Contraste
- **Localização 1**: `App.tsx:103, 412, 426`
  - **Código Atual**:
    ```tsx
    103: <StatusBar hidden />
    ...
    412: <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
    ```
    E nos estilos:
    ```tsx
    container: {
      flex: 1,
      paddingTop: Platform.OS === 'android' ? 6 : 0,
    }
    ```
  - **Problema**: Uso do `SafeAreaView` legado do `react-native` com padding estático (`Platform.OS === 'android' ? 6 : 0`) em vez de `react-native-safe-area-context` com `edges={['top', 'bottom']}` ou `useSafeAreaInsets()`. Em aparelhos Android com notch ou punch-hole de câmera e navegação por gestos, a barra superior sofre sobreposição e clipping.
- **Localização 2**: `App.tsx:534-536`
  - **Código Atual**:
    ```tsx
    <TouchableOpacity
      style={[styles.pendingBanner, { backgroundColor: colors.danger }]}
      onPress={() => setPendingModalVisible(true)}
    >
      <Text style={[styles.pendingBannerText, { color: '#fff' }]}>
        ⚠️ Você tem {pendingAttendances.length} aula(s) sem registro de presença!
      </Text>
    ```
  - **Problema**: No tema `dark` e `amoled`, `colors.danger` é `#F87171` (vermelho salmão claro). Texto `#fff` sobre `#F87171` gera contraste de apenas **2.4:1** (inapropriado).
- **Localização 3**: `App.tsx:611-613`
  - **Código Atual**:
    ```tsx
    <Text style={{
      color: isSelected ? '#fff' : (CategoryColors[cat] || colors.primary),
      fontWeight: '700',
      fontSize: 12
    }}>
      {cat}
    </Text>
    ```
  - **Problema**: No modo `light`, quando `cat === 'Saúde/Academia'`, o texto usa `CategoryColors['Saúde/Academia']` (`#00FFAA`) sobre fundo claro não selecionado, ficando invisível.
- **Localização 4**: `App.tsx:1198`
  - **Código Atual**:
    ```tsx
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: 'rgba(150,150,150,0.15)',
      ...
    }
    ```
  - **Problema**: Cor de borda hardcoded em vez de usar `colors.border`.

---

### 1.3 `src/components/AIImportModal.tsx` — Texto Branco Hardcoded sobre Fundo Primário Neon Mint
- **Localização**: `src/components/AIImportModal.tsx:632-634, 743-745, 817`
  - **Código Atual**:
    ```tsx
    632: <TouchableOpacity
    633:   style={[styles.actionBtn, { backgroundColor: colors.primary }]}
    634:   onPress={handleProcess}
    635: >
    636:   <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
    637:     ✨ Processar Mensagem com IA
    638:   </Text>
    639: </TouchableOpacity>
    ```
    E em `src/components/AIImportModal.tsx:530-532`:
    ```tsx
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]}>
      <Text style={{ color: '#fff', fontWeight: '800' }}>Aplicar Tudo Automaticamente</Text>
    </TouchableOpacity>
    ```
  - **Problema**: Nos temas `dark` e `amoled`, `colors.primary` é `#00FFAA` (verde neon). Texto branco `#fff` sobre `#00FFAA` possui contraste de **1.2:1**, tornando o texto completamente ilegível. Do mesmo modo, sobre `colors.success` (`#34D399` no tema escuro), texto branco possui contraste de apenas **1.6:1**.

---

### 1.4 `src/components/AIGradeCriteriaModal.tsx` — Texto Âmbar Escuro Hardcoded e Botão Salvar
- **Localização 1**: `src/components/AIGradeCriteriaModal.tsx:238`
  - **Código Atual**:
    ```tsx
    <View style={[styles.extraBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
      <Text style={{ color: '#b45309', fontSize: 11, fontWeight: '700' }}>
        ⚙️ Nota Máxima: {item.maxGrade}
      </Text>
    </View>
    ```
  - **Problema**: `#b45309` (marrom âmbar escuro) sobre superfícies escuras nos temas `dark` (`#181B20`) e `amoled` (`#0A0A0A`) fica escuro demais e ilegível (contraste ~2.5:1).
- **Localização 2**: `src/components/AIGradeCriteriaModal.tsx:249`
  - **Código Atual**:
    ```tsx
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: colors.success }]}
      onPress={handleApply}
    >
      <Text style={{ color: '#fff', fontWeight: '800' }}>Salvar Critérios</Text>
    </TouchableOpacity>
    ```
  - **Problema**: No tema escuro (`colors.success = '#34D399'`), texto `#fff` tem contraste deficiente (~1.6:1).
- **Localização 3**: `src/components/AIGradeCriteriaModal.tsx:334`
  - **Código Atual**:
    ```tsx
    templateChip: {
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      ...
    }
    ```
    Com texto em `colors.primary`. No tema escuro, cria combinação de azul transparente com texto verde menta.

---

### 1.5 `src/components/AchievementsModal.tsx` & `src/components/AnalyticsAndAACCModal.tsx` — Contraste de Badges de Sucesso no Tema Claro
- **Localização 1**: `src/components/AchievementsModal.tsx:204, 267`
  - **Código Atual**:
    ```tsx
    <View style={[styles.countBadge, { backgroundColor: colors.successLight }]}>
      <Text style={{ color: colors.success, fontWeight: '800', fontSize: 11 }}>
        {unlockedCount}/{ACHIEVEMENTS_LIST.length}
      </Text>
    </View>
    ...
    <View style={[styles.unlockedCheck, { backgroundColor: colors.successLight }]}>
      <Text style={{ color: colors.success, fontWeight: '800', fontSize: 12 }}>✓</Text>
    </View>
    ```
  - **Problema**: No tema `light`, `colors.success` é `#10B981` e `colors.successLight` é `#D1FAE5`. A razão de contraste entre `#10B981` e `#D1FAE5` é de apenas **2.2:1** (falha WCAG AA).
- **Localização 2**: `src/components/AnalyticsAndAACCModal.tsx:284-286`
  - **Código Atual**:
    ```tsx
    <View style={[styles.percentBadge, { backgroundColor: percent >= 100 ? colors.successLight : colors.surfaceSubtle }]}>
      <Text style={{ color: percent >= 100 ? colors.success : colors.primary, fontWeight: '800', fontSize: 13 }}>
        {percent}%
      </Text>
    </View>
    ```
  - **Problema**: Mesma falha de contraste de `#10B981` sobre `#D1FAE5` no modo claro.

---

### 1.6 `src/screens/StudyScreen.tsx` — Botão Parar no Cronômetro Livre
- **Localização**: `src/screens/StudyScreen.tsx:549-556`
  - **Código Atual**:
    ```tsx
    <TouchableOpacity
      style={[styles.mainBtn, { backgroundColor: colors.danger }]}
      onPress={handleStopStopwatch}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Parar</Text>
    </TouchableOpacity>
    ```
  - **Problema**: Nos temas `dark` e `amoled`, `colors.danger` é `#F87171`. O texto `#fff` tem contraste de apenas **2.4:1**.

---

### 1.7 `src/components/GroupProjectsModal.tsx` — Cabeçalho Kanban e Badges 100% no Tema Claro
- **Localização 1**: `src/components/GroupProjectsModal.tsx:284-288`
  - **Código Atual**:
    ```tsx
    <View style={[styles.percentBadge, { backgroundColor: percent === 100 ? colors.successLight : colors.surfaceSubtle }]}>
      <Text style={{ color: percent === 100 ? colors.success : colors.primary, fontWeight: '800', fontSize: 13 }}>
        {percent}%
      </Text>
    </View>
    ```
- **Localização 2**: `src/components/GroupProjectsModal.tsx:492`
  - **Código Atual**:
    ```tsx
    const columnColor =
      columnStatus === 'todo' ? colors.textSecondary : columnStatus === 'doing' ? colors.warning : colors.success;
    ```
  - **Problema**: No tema `light`, `colors.warning` (`#F59E0B`) e `colors.success` (`#10B981`) sobre fundo claro (`#FFFFFF`) possuem contraste baixo (~2.1:1).

---

### 1.8 `src/components/TeamsConfigModal.tsx` — Spinners de ActivityIndicator e Log de Terminal
- **Localização 1**: `src/components/TeamsConfigModal.tsx:733, 921, 1084, 1222`
  - **Código Atual**:
    ```tsx
    733: <ActivityIndicator color="#fff" /> // dentro de botão com backgroundColor: colors.primary
    ...
    921: <ActivityIndicator color="#000" /> // dentro de botão com backgroundColor: colors.primary
    1084: <ActivityIndicator color="#000" /> // dentro de botão com backgroundColor: colors.primary
    1222: <ActivityIndicator color="#000" /> // dentro de botão com backgroundColor: colors.primary
    ```
  - **Problema**: Na linha 733, spinner branco sobre `#00FFAA` (tema escuro) é invisível. Nas linhas 921, 1084 e 1222, spinner preto sobre `#059669` (tema claro) tem péssima visibilidade.
- **Localização 2**: `src/components/TeamsConfigModal.tsx:1277`
  - **Código Atual**:
    ```tsx
    else if (log.includes('[Tarefa]')) logColor = colors.primary;
    ```
    Em console com `backgroundColor: '#0a0a0c'`.
  - **Problema**: No tema claro, `colors.primary` é `#059669` (verde escuro). No console preto `#0a0a0c`, `#059669` fica ilegível (contraste ~2.4:1).

---

### 1.9 Padronização de `SafeAreaView` em Modais
- **Localização**: `src/components/SettingsModal.tsx:9, 193`, `src/components/SubjectDetailsModal.tsx:2, 79`, `src/components/OnboardingModal.tsx:2, 62`
  - **Código Atual**: Importam `SafeAreaView` de `'react-native'` em vez de `'react-native-safe-area-context'`.
  - **Problema**: Inconsistência com os demais modais (`GradeSimulatorModal`, `GroupProjectsModal`, `PendingAttendanceModal`, `SubjectModal`) que já utilizam `SafeAreaView` de `react-native-safe-area-context` com `edges={['top', 'bottom']}`, prevenindo cortes de cabeçalho em telas Android edge-to-edge.

---

## 2. Cadeia Lógica (Logic Chain)

1. **Mecânica de Luminância e Temas**:
   - `Colors.light.primary = '#059669'` (luminância YIQ = 117 → texto contrastante deve ser `#FFFFFF`).
   - `Colors.dark.primary = '#00FFAA'` (luminância YIQ = 208 → texto contrastante **DEVE** ser `#0A0A0A`).
   - `Colors.dark.danger = '#F87171'` (luminância YIQ = 143 → texto `#fff` falha WCAG com 2.4:1; texto `#0A0A0A` atinge 7.2:1).
   - `Colors.dark.success = '#34D399'` (luminância YIQ = 175 → texto `#fff` falha com 1.6:1; texto `#0A0A0A` atinge 9.5:1).
   - `Colors.light.success = '#10B981'` (luminância YIQ = 146) sobre `colors.successLight = '#D1FAE5'` (YIQ = 240) tem contraste de apenas 2.2:1. O uso de `colors.successDark = '#047857'` atinge 4.8:1 (aprovado WCAG AA).
2. **Impacto nos Componentes**:
   - Sempre que um botão aplica `backgroundColor: colors.primary`, o estilo do texto **NUNCA** pode ser estático (`#fff` ou `#000`), devendo obrigatoriamente chamar `getContrastTextColor(colors.primary)` ou usar `theme === 'light' ? '#fff' : '#0A0A0A'`.
   - Sempre que um badge usa `backgroundColor: colors.successLight`, o texto no tema claro **DEVE** usar `colors.successDark`.
   - Sempre que um badge usa `backgroundColor: colors.dangerLight`, o texto no tema claro **DEVE** usar `colors.dangerDark`.
   - Sempre que um badge usa `backgroundColor: colors.warningLight`, o texto no tema claro **DEVE** usar `colors.warningDark`.
3. **Mecânica de Safe Area Insets**:
   - No React Native moderno, `SafeAreaView` do pacote principal `react-native` é obsoleto e não respeita os insets de barras de navegação transparentes e telas com recorte no Android 13/14+.
   - A biblioteca oficial do ecossistema Expo/React Native é `react-native-safe-area-context`. Todos os modais e telas devem importar `SafeAreaView` desta biblioteca passando `edges={['top', 'bottom']}`.

---

## 3. Ressalvas (Caveats)

- Nenhuma alteração direta foi aplicada no código-fonte dos componentes da aplicação (princípio de exploração read-only estrita).
- As fórmulas de contraste seguem a norma internacional WCAG 2.1 (mínimo de 4.5:1 para texto normal e 3.0:1 para texto em escala grande ou elementos de interface).
- No componente `TeamsConfigModal.tsx`, a visualização do console de auditoria possui fundo escuro fixo `#0a0a0c` por design de terminal; portanto, as cores das linhas de log devem ser fixas em tons claros e não herdar `colors.primary` do tema claro.

---

## 4. Conclusão & Tabela Consolidada de Correções

| # | Arquivo | Linhas | Defeito | Correção Recomendada |
|---|---|---|---|---|
| 1 | `src/theme/index.ts` | 74 | `CategoryColors['Saúde/Academia'] = '#00FFAA'` ilegível no tema claro | Criar helper `getCategoryColor(category, theme)` que retorna `#059669` no tema `light` e `#00FFAA` nos temas `dark`/`amoled`. |
| 2 | `App.tsx` | 103, 412 | `SafeAreaView` legado com padding estático no Android | Importar `SafeAreaView` de `react-native-safe-area-context` com `edges={['top', 'bottom']}`. |
| 3 | `App.tsx` | 534-536 | Texto `#fff` sobre `colors.danger` (`#F87171`) no banner de faltas pendentes | Usar `color: getContrastTextColor(colors.danger)`. |
| 4 | `App.tsx` | 611-613 | Categoria Saúde/Academia invisível no filtro de categorias do tema claro | Aplicar cor adaptada ao tema claro para a categoria. |
| 5 | `App.tsx` | 1198 | Borda da barra de abas hardcoded `'rgba(150,150,150,0.15)'` | Usar `borderTopColor: colors.border`. |
| 6 | `src/components/AIImportModal.tsx` | 636, 745, 817 | Texto `#fff` sobre `colors.primary` (`#00FFAA`) no botão de processamento | Usar `color: getContrastTextColor(colors.primary)`. |
| 7 | `src/components/AIImportModal.tsx` | 532 | Texto `#fff` sobre `colors.success` (`#34D399`) no tema escuro | Usar `color: getContrastTextColor(colors.success)`. |
| 8 | `src/components/AIGradeCriteriaModal.tsx` | 238 | Texto `#b45309` escuro sobre superfície escura | Usar `color: theme === 'light' ? '#b45309' : '#FBBF24'`. |
| 9 | `src/components/AIGradeCriteriaModal.tsx` | 249 | Texto `#fff` sobre `colors.success` (`#34D399`) | Usar `color: getContrastTextColor(colors.success)`. |
| 10 | `src/components/AchievementsModal.tsx` | 204, 267 | `colors.success` sobre `colors.successLight` no tema claro | Usar `color: theme === 'light' ? colors.successDark : colors.success`. |
| 11 | `src/components/AnalyticsAndAACCModal.tsx` | 285 | `colors.success` sobre `colors.successLight` no tema claro | Usar `color: theme === 'light' ? colors.successDark : colors.success`. |
| 12 | `src/screens/StudyScreen.tsx` | 551 | Texto `#fff` sobre `colors.danger` (`#F87171`) no botão Parar do cronômetro | Usar `color: getContrastTextColor(colors.danger)`. |
| 13 | `src/components/GroupProjectsModal.tsx` | 285 | `colors.success` sobre `colors.successLight` no tema claro | Usar `color: percent === 100 ? (theme === 'light' ? colors.successDark : colors.success) : colors.primary`. |
| 14 | `src/components/GroupProjectsModal.tsx` | 492 | `columnColor` usando `colors.success` e `colors.warning` claros sobre fundo branco | Usar `theme === 'light' ? colors.successDark : colors.success` e `theme === 'light' ? colors.warningDark : colors.warning`. |
| 15 | `src/components/TeamsConfigModal.tsx` | 733, 921, 1084, 1222 | ActivityIndicator com cores hardcoded `#fff` ou `#000` sobre `colors.primary` | Usar `color={getContrastTextColor(colors.primary)}`. |
| 16 | `src/components/TeamsConfigModal.tsx` | 1277 | Linha de log do console usando `colors.primary` escuro (`#059669`) no terminal preto | Usar cor verde neon fixa para terminal: `logColor = '#34D399'`. |
| 17 | `SettingsModal.tsx`, `SubjectDetailsModal.tsx`, `OnboardingModal.tsx` | - | Importam `SafeAreaView` de `react-native` em vez de `react-native-safe-area-context` | Substituir import por `import { SafeAreaView } from 'react-native-safe-area-context';` e passar `edges={['top', 'bottom']}`. |

---

## 5. Método de Verificação Independente

### 5.1 Verificação de Sintaxe e Compilação TypeScript
Execute no terminal da raiz do projeto:
```powershell
npx tsc --noEmit
```
*Critério de Sucesso*: 0 erros de tipagem encontrados.

### 5.2 Matriz de Inspeção Visual Manual nos 3 Temas
1. **Tema Claro (`light`)**:
   - Abrir a tela de **Conquistas** (`AchievementsModal`) e verificar se os números de conquistas (`unlockedCount`) e ícones de check `✓` estão nítidos em verde escuro (`#047857`) sobre fundo verde suave (`#D1FAE5`).
   - Abrir o **Hub / Importação IA** (`AIImportModal`) e verificar legibilidade dos botões primários.
   - Adicionar ou filtrar eventos na categoria **Saúde/Academia** no calendário principal e verificar se o texto está legível.
   - Abrir a aba **Trabalhos em Grupo** (`GroupProjectsModal`) e verificar se as colunas Kanban "Em Andamento" e "Concluído" têm texto contrastante.
2. **Tema Escuro (`dark`) e AMOLED (`amoled`)**:
   - Abrir `AIImportModal` e verificar se o botão "✨ Processar Mensagem com IA" possui fundo verde neon (`#00FFAA`) com texto em preto profundo (`#0A0A0A`).
   - Iniciar o cronômetro livre na aba **Estudos** e verificar se o botão "Parar" possui texto nítido.
   - Simular aulas pendentes e verificar a legibilidade do banner vermelho de faltas em `App.tsx`.
   - Abrir `AIGradeCriteriaModal` e verificar se o badge de "Nota Máxima" exibe amarelo claro legível sobre fundo escuro.
   - Abrir `TeamsConfigModal`, alternar para a aba "Simulação & Auditoria" e verificar a legibilidade do log no console escuro.
3. **Verificação de Safe Area no Android**:
   - Abrir `SettingsModal`, `SubjectDetailsModal` e `OnboardingModal` em um dispositivo Android e verificar se o cabeçalho superior não corta sob a barra de status ou câmera frontal.
