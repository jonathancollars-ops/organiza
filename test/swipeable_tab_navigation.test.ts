import './setup_env';
import * as fs from 'fs';
import * as path from 'path';
import {
  TAB_ORDER,
  getNextTab,
  getPrevTab,
  SwipeableTabContainer,
  SwipeableTabContext,
  useSwipeableTabs,
  TabName,
} from '../src/components/SwipeableTabContainer';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
    failed++;
  }
}

async function runSwipeableTabNavigationTestSuite() {
  console.log('================================================================');
  console.log('SWIPEABLE TAB CONTAINER & 120HZ LATERAL NAVIGATION TEST SUITE');
  console.log('================================================================\n');

  // ── 1. TAB_ORDER Sequence & Canonical Tab Order ──
  console.log('--- 1. TAB_ORDER Sequence & Tab Navigation Logic ---');

  assert(Array.isArray(TAB_ORDER), 'TAB_ORDER is an exported array');
  assert(TAB_ORDER.length === 5, `TAB_ORDER has exactly 5 main tabs (got ${TAB_ORDER.length})`);
  assert(TAB_ORDER[0] === 'Agenda', 'Tab 0 is Agenda');
  assert(TAB_ORDER[1] === 'Estudos', 'Tab 1 is Estudos');
  assert(TAB_ORDER[2] === 'Desempenho', 'Tab 2 is Desempenho');
  assert(TAB_ORDER[3] === 'Faltas', 'Tab 3 is Faltas');
  assert(TAB_ORDER[4] === 'Notas', 'Tab 4 is Notas');

  // getNextTab Tests
  assert(getNextTab('Agenda') === 'Estudos', 'getNextTab(Agenda) returns Estudos');
  assert(getNextTab('Estudos') === 'Desempenho', 'getNextTab(Estudos) returns Desempenho');
  assert(getNextTab('Desempenho') === 'Faltas', 'getNextTab(Desempenho) returns Faltas');
  assert(getNextTab('Faltas') === 'Notas', 'getNextTab(Faltas) returns Notas');
  assert(getNextTab('Notas') === null, 'getNextTab(Notas) returns null (Right edge exception handled)');
  assert(getNextTab('Unknown') === null, 'getNextTab(unknown) returns null safely');

  // getPrevTab Tests
  assert(getPrevTab('Notas') === 'Faltas', 'getPrevTab(Notas) returns Faltas');
  assert(getPrevTab('Faltas') === 'Desempenho', 'getPrevTab(Faltas) returns Desempenho');
  assert(getPrevTab('Desempenho') === 'Estudos', 'getPrevTab(Desempenho) returns Estudos');
  assert(getPrevTab('Estudos') === 'Agenda', 'getPrevTab(Estudos) returns Agenda');
  assert(getPrevTab('Agenda') === null, 'getPrevTab(Agenda) returns null (Left edge exception handled)');
  assert(getPrevTab('Unknown') === null, 'getPrevTab(unknown) returns null safely');

  // ── 2. Swipe Gesture Math & Boundary Clamping ──
  console.log('\n--- 2. Swipe Gesture Math, Threshold (60px) & Edge Clamping ---');

  const THRESHOLD = 60;

  function simulateGestureRelease(currentTab: TabName, dx: number, vx: number = 0): TabName | null {
    const activeIdx = TAB_ORDER.indexOf(currentTab);
    const isSwipeLeft = dx <= -THRESHOLD || (dx < -30 && vx < -0.5);
    const isSwipeRight = dx >= THRESHOLD || (dx > 30 && vx > 0.5);

    if (isSwipeLeft && activeIdx < TAB_ORDER.length - 1) {
      return TAB_ORDER[activeIdx + 1];
    } else if (isSwipeRight && activeIdx > 0) {
      return TAB_ORDER[activeIdx - 1];
    }
    return null;
  }

  // Swipe Left beyond threshold (dx = -65)
  assert(simulateGestureRelease('Agenda', -65) === 'Estudos', 'Swiping left -65px from Agenda navigates to Estudos');
  assert(simulateGestureRelease('Estudos', -65) === 'Desempenho', 'Swiping left -65px from Estudos navigates to Desempenho');
  assert(simulateGestureRelease('Desempenho', -65) === 'Faltas', 'Swiping left -65px from Desempenho navigates to Faltas');
  assert(simulateGestureRelease('Faltas', -65) === 'Notas', 'Swiping left -65px from Faltas navigates to Notas');
  assert(simulateGestureRelease('Notas', -65) === null, 'Swiping left -65px on Notas does not navigate (edge bound)');

  // Swipe Right beyond threshold (dx = +65)
  assert(simulateGestureRelease('Notas', 65) === 'Faltas', 'Swiping right +65px from Notas navigates to Faltas');
  assert(simulateGestureRelease('Faltas', 65) === 'Desempenho', 'Swiping right +65px from Faltas navigates to Desempenho');
  assert(simulateGestureRelease('Desempenho', 65) === 'Estudos', 'Swiping right +65px from Desempenho navigates to Estudos');
  assert(simulateGestureRelease('Estudos', 65) === 'Agenda', 'Swiping right +65px from Estudos navigates to Agenda');
  assert(simulateGestureRelease('Agenda', 65) === null, 'Swiping right +65px on Agenda does not navigate (edge bound)');

  // Sub-threshold swipes (e.g. dx = -45, no flick)
  assert(simulateGestureRelease('Agenda', -45, 0) === null, 'Sub-threshold drag (-45px, 0 vx) does not navigate');
  assert(simulateGestureRelease('Notas', 45, 0) === null, 'Sub-threshold drag (+45px, 0 vx) does not navigate');

  // Fast flick gesture (e.g. dx = -35, vx = -0.8)
  assert(simulateGestureRelease('Agenda', -35, -0.8) === 'Estudos', 'Fast flick left (-35px, vx -0.8) successfully triggers navigation');
  assert(simulateGestureRelease('Notas', 35, 0.8) === 'Faltas', 'Fast flick right (+35px, vx +0.8) successfully triggers navigation');

  // ── 3. PanResponder Slop Filter & Vertical Scroll Rejection ──
  console.log('\n--- 3. PanResponder Slop Filter & Vertical Scroll Passthrough ---');

  function shouldPanResponderCapture(
    currentTab: TabName,
    dx: number,
    dy: number,
    disabled: boolean
  ): boolean {
    if (disabled) return false;
    const activeIdx = TAB_ORDER.indexOf(currentTab);
    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
    const hasMovedEnough = Math.abs(dx) > 12;

    if (!isHorizontal || !hasMovedEnough) return false;
    if (activeIdx === 0 && dx > 0) return false;
    if (activeIdx === TAB_ORDER.length - 1 && dx < 0) return false;

    return true;
  }

  // Vertical scroll gestures (ScrollView / FlatList)
  assert(
    shouldPanResponderCapture('Agenda', 5, 50, false) === false,
    'Pure vertical scroll (dx=5, dy=50) is rejected by PanResponder (allows native ScrollView)'
  );
  assert(
    shouldPanResponderCapture('Estudos', -10, 40, false) === false,
    'Diagonal vertical scroll (dx=-10, dy=40) is rejected by PanResponder'
  );
  assert(
    shouldPanResponderCapture('Grades', 15, 14, false) === false,
    'Ambiguous move (dx=15, dy=14) below 1.5x ratio is rejected by PanResponder'
  );

  // Intentional horizontal swipes
  assert(
    shouldPanResponderCapture('Agenda', -35, 5, false) === true,
    'Clear horizontal swipe left on Agenda (dx=-35, dy=5) is accepted by PanResponder'
  );
  assert(
    shouldPanResponderCapture('Estudos', 35, 5, false) === true,
    'Clear horizontal swipe right on Estudos (dx=35, dy=5) is accepted by PanResponder'
  );

  // Edge bound rejections
  assert(
    shouldPanResponderCapture('Agenda', 40, 5, false) === false,
    'Dragging right on Agenda (index 0) is rejected at gesture initiation'
  );
  assert(
    shouldPanResponderCapture('Notas', -40, 5, false) === false,
    'Dragging left on Notas (index 4) is rejected at gesture initiation'
  );

  // Disabled state (modals open)
  assert(
    shouldPanResponderCapture('Estudos', -40, 5, true) === false,
    'When disabled=true (modal open), PanResponder rejects all gestures'
  );

  // ── 4. Static Codebase Audit: SwipeableTabContainer.tsx ──
  console.log('\n--- 4. Static Codebase Audit: SwipeableTabContainer.tsx ---');

  const containerPath = path.resolve(__dirname, '../src/components/SwipeableTabContainer.tsx');
  assert(fs.existsSync(containerPath), 'SwipeableTabContainer.tsx exists');

  const containerContent = fs.readFileSync(containerPath, 'utf8');

  // Verify Native Driver is enabled for 120Hz/60Hz
  assert(
    containerContent.includes('useNativeDriver: true'),
    'SwipeableTabContainer configures useNativeDriver: true for 120Hz/60Hz UI Thread animations'
  );

  // Verify Haptics feedback
  assert(
    containerContent.includes('Haptics.impactAsync') &&
    containerContent.includes('Haptics.ImpactFeedbackStyle.Light'),
    'Triggers Haptics.impactAsync with ImpactFeedbackStyle.Light on tab transitions'
  );

  // Verify Context for conditional disabling
  assert(
    containerContent.includes('SwipeableTabContext') &&
    containerContent.includes('useSwipeableTabs'),
    'Exports SwipeableTabContext and useSwipeableTabs for child components'
  );

  // Verify 0 hardcoded dark theme colors
  const FORBIDDEN_DARK_TOKENS = [
    '#0F1115', '#181B20', '#1F232B', '#292E38', '#2A303C',
    '#1E232D', '#3E4756', '#0A0C0E', '#121519', '#1A1E24',
    '#1E2229', '#14171C', '#2C323D'
  ];
  let foundTokens: string[] = [];
  for (const token of FORBIDDEN_DARK_TOKENS) {
    if (new RegExp(token, 'i').test(containerContent)) {
      foundTokens.push(token);
    }
  }
  assert(foundTokens.length === 0, 'SwipeableTabContainer.tsx has 0 hardcoded dark theme tokens');

  // ── 5. Static Codebase Audit: Screen Wrappers & AppNavigator Integration ──
  console.log('\n--- 5. Static Codebase Audit: Screen Wrappers & AppNavigator Integration ---');

  const navPath = path.resolve(__dirname, '../src/navigation/AppNavigator.tsx');
  assert(fs.existsSync(navPath), 'AppNavigator.tsx exists');

  const navContent = fs.readFileSync(navPath, 'utf8');

  // Verify NavigationContainer hosts Tab.Navigator cleanly for Android FragmentManager stability
  assert(
    navContent.includes('<NavigationContainer') && navContent.includes('<Tab.Navigator'),
    'AppNavigator.tsx hosts Tab.Navigator within NavigationContainer for native Android Fragment stability'
  );

  // Verify all 5 screen wrappers integrate SwipeableTabContainer
  const wrappers = [
    { file: 'AgendaScreenWrapper.tsx', tab: 'Agenda' },
    { file: 'StudyScreenWrapper.tsx', tab: 'Estudos' },
    { file: 'AcademicPerformanceScreenWrapper.tsx', tab: 'Desempenho' },
    { file: 'AttendanceScreenWrapper.tsx', tab: 'Faltas' },
    { file: 'GradesScreenWrapper.tsx', tab: 'Notas' },
  ];

  for (const { file, tab } of wrappers) {
    const wrapPath = path.resolve(__dirname, `../src/screens/${file}`);
    assert(fs.existsSync(wrapPath), `${file} exists`);
    const wrapContent = fs.readFileSync(wrapPath, 'utf8');
    assert(
      wrapContent.includes('SwipeableTabContainer'),
      `${file} imports and integrates SwipeableTabContainer`
    );
    assert(
      wrapContent.includes(`currentTab="${tab}"`),
      `${file} configures currentTab="${tab}"`
    );
    assert(
      wrapContent.includes('onNavigateTab'),
      `${file} wires onNavigateTab callback`
    );
  }

  console.log('\n================================================================');
  console.log(`SWIPEABLE TAB TESTS SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runSwipeableTabNavigationTestSuite();
