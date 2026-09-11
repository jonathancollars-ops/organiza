import './setup_env';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${msg}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('📱 ACADEMIC PERFORMANCE: HEADER & MODAL UX AUDIT (360dp / HIG)');
  console.log('================================================================\n');

  const screenPath = path.resolve(__dirname, '../src/screens/AcademicPerformanceScreen.tsx');
  assert(fs.existsSync(screenPath), 'AcademicPerformanceScreen.tsx exists');
  const screenContent = fs.readFileSync(screenPath, 'utf8');

  // ── 1. Header Layout & Title Respiration (360dp Android Protection) ──
  console.log('--- 1. Header Layout & Title Respiration ---');
  
  // Title & Subtitle presence and styling
  assert(
    screenContent.includes('🎯 Desempenho & Curso'),
    'Header contains full title "🎯 Desempenho & Curso"'
  );
  assert(
    screenContent.includes('CR Acumulado • Integralização • Prova Final'),
    'Header contains full subtitle "CR Acumulado • Integralização • Prova Final"'
  );

  // headerTitleContainer has 100% full width (does NOT compete in a flex-row with wide buttons)
  assert(
    /headerTitleContainer:\s*\{\s*width:\s*['"]100%['"]/.test(screenContent),
    'headerTitleContainer enforces width: "100%" to guarantee full breathing room on 360dp screens'
  );

  // Header actions toolbar
  assert(
    screenContent.includes('🔄 Sincronizar'),
    'Header action bar contains "🔄 Sincronizar"'
  );
  assert(
    screenContent.includes('📥 Importar'),
    'Header action bar contains "📥 Importar"'
  );

  // "🎯 Meta" is NOT in the header actions bar (removed clutter, lives inside hero card)
  const headerButtonsBlock = screenContent.match(/<View style={styles\.headerButtons}>([\s\S]*?)<\/View>/);
  assert(
    headerButtonsBlock !== null && !headerButtonsBlock[1].includes('🎯 Meta'),
    'Header action toolbar does NOT contain redundant "🎯 Meta" button (living in hero card)'
  );

  // Header buttons have flex: 1 and tactile minHeight >= 40dp
  assert(
    screenContent.includes('minHeight: 40'),
    'headerBtn enforces minimum 40dp touch target per Apple HIG'
  );

  // ── 2. Modal Importador Acadêmico: ScrollView & maxHeight ──
  console.log('\n--- 2. Modal Importador Acadêmico: ScrollView & Dimensions ---');

  // modalCard has maxHeight: '90%' and continuous corners (borderRadius: 20)
  assert(
    screenContent.includes("maxHeight: '90%'"),
    'modalCard defines maxHeight: "90%" to prevent viewport overflow'
  );
  assert(
    screenContent.includes('borderRadius: 20'),
    'modalCard uses Apple HIG continuous 20px corners'
  );

  // ScrollView wrapping modal body
  assert(
    screenContent.includes('showsVerticalScrollIndicator={false}') &&
    screenContent.includes('keyboardShouldPersistTaps="handled"') &&
    screenContent.includes('modalScrollContent'),
    'modalCard body is wrapped in ScrollView with keyboard handling'
  );

  // ── 3. Bottom Action Hierarchy ──
  console.log('\n--- 3. Modal Bottom Action Hierarchy ---');

  // 1. Full-Width AI Button
  assert(
    screenContent.includes('modalActionAIFullWidth') &&
    screenContent.includes('📄 Analisar PDF / Imagem com Lumen AI'),
    'Modal features full-width prominent "📄 Analisar PDF / Imagem com Lumen AI" button'
  );

  // 2. Action row: Cancelar (left) and Processar Texto (right)
  assert(
    screenContent.includes('modalPrimaryActionsRow') &&
    screenContent.includes('modalActionSubmitPrimary'),
    'Modal features dedicated primary action row (Cancelar & Processar Texto)'
  );

  // 3. Discrete secondary action: Restaurar Grade Padrão
  assert(
    screenContent.includes('modalActionSecondaryDiscrete') &&
    screenContent.includes('Restaurar Grade Padrão'),
    'Modal positions "Restaurar Grade Padrão" discretely below primary actions'
  );

  // ── 4. Zero Hardcoded Forbidden Dark Tokens ──
  console.log('\n--- 4. Theme & Token Integrity ---');

  const FORBIDDEN_DARK_TOKENS = [
    '#0F1115', '#181B20', '#1F232B', '#292E38', '#2A303C', '#1E232D', '#3E4756',
    '#0A0C0E', '#121519', '#1A1E24', '#1E2229', '#14171C', '#2C323D'
  ];

  let darkViolations = 0;
  for (const token of FORBIDDEN_DARK_TOKENS) {
    if (screenContent.toLowerCase().includes(token.toLowerCase())) {
      darkViolations++;
      console.error(`  Violation: Found ${token} in AcademicPerformanceScreen.tsx`);
    }
  }
  assert(darkViolations === 0, 'AcademicPerformanceScreen has 0 forbidden dark tokens');

  console.log('\n================================================================');
  console.log(`AUDIT SUMMARY: ${passed}/${passed + failed} Tests Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTestSuite();
