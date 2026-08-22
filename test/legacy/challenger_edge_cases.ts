import './setup_env';
// Define global.__DEV__ before any imports
(globalThis as any).__DEV__ = false;

async function run() {
  const { TeamsService } = await import('../src/services/TeamsService');
  const { AIParsingService } = await import('../src/services/AIParsingService');
  const { SyncService } = await import('../src/services/SyncService');

  const baseContext = {
    currentDate: '2026-08-17',
    currentDayOfWeek: 'Segunda-feira',
    registeredSubjects: ['Cálculo 1', 'Algoritmos', 'Física I']
  };

  console.log('=== DEEP ADVERSARIAL EDGE CASE ANALYSIS ===\n');

  // 1. Unclosed script tag
  console.log('1. Testing unclosed script tag:');
  const unclosedScript = '<script>maliciousCode();';
  const sanitized1 = TeamsService.sanitizeHtmlMessage(unclosedScript);
  console.log('Input:', unclosedScript);
  console.log('Sanitized:', JSON.stringify(sanitized1));

  // 2. Multiple dates in one message
  console.log('\n2. Testing multiple dates in message:');
  const multiDateMsg = "Aviso aos alunos de Cálculo 1: a aula do dia 2026-08-17 foi cancelada e a reposição será em 2026-08-24.";
  const parsedMultiDate = AIParsingService.parseMessageMock(multiDateMsg, baseContext);
  console.log('Input:', multiDateMsg);
  console.log('Parsed targetDate:', parsedMultiDate.items[0]?.targetDate, 'Intent:', parsedMultiDate.items[0]?.intent);

  // 3. Day of week names without explicit date
  console.log('\n3. Testing day of week names without explicit date:');
  const dayOfWeekMsg = "Pessoal de Algoritmos, não teremos aula na próxima quarta-feira.";
  const parsedDayOfWeek = AIParsingService.parseMessageMock(dayOfWeekMsg, baseContext);
  console.log('Input:', dayOfWeekMsg);
  console.log('Parsed targetDate:', parsedDayOfWeek.items[0]?.targetDate, '(Context currentDate is:', baseContext.currentDate, ')');

  // 4. Multiple conflicting keywords ("prova cancelada")
  console.log('\n4. Testing conflicting keywords ("prova cancelada"):');
  const conflictMsg = "Atenção: a Prova P1 de Física I de 2026-08-28 foi cancelada pelo coordenador.";
  const parsedConflict = AIParsingService.parseMessageMock(conflictMsg, baseContext);
  console.log('Input:', conflictMsg);
  console.log('Parsed intent:', parsedConflict.items[0]?.intent, 'Title:', parsedConflict.items[0]?.title);

  // 5. Invalid calendar dates like "2026-08-35" in cleanAndValidateJson & SyncService
  console.log('\n5. Testing invalid calendar date "2026-08-35" through SyncService:');
  const invalidDateItem = {
    intent: 'cancelled_class' as const,
    subjectName: 'Cálculo 1',
    title: 'Aula Cancelada',
    targetDate: '2026-08-35',
    startTime: '08:00',
    endTime: '10:00',
    alerts: [10080, 1440],
    rawSummary: 'Aula cancelada'
  };

  const testSubjects = [{
    id: 'subj_calc',
    name: 'Cálculo 1',
    color: '#000',
    passGrade: 7,
    maxAbsences: 10,
    workloadHours: 60,
    gradeGroups: []
  }];

  const testEvents = [{
    id: 'ev_calc',
    title: 'Aula de Cálculo 1',
    category: 'Faculdade/Aulas' as const,
    date: '2026-08-17',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'weekly' as const,
    alerts: [15],
    isCompleted: false,
    subjectId: 'subj_calc'
  }];

  const testAttendances: any[] = [];

  const res = await SyncService.processParsedItems([invalidDateItem], testEvents, testAttendances, testSubjects);
  console.log('Sync result cancelledAttendances count:', res.syncResult.cancelledAttendances.length);
  console.log('Sync logs:', res.syncResult.logs);

  // 6. Accent-insensitive subject matching in cleanAndValidateJson vs SyncService
  console.log('\n6. Testing accent-insensitive subject matching:');
  const unaccentedJson = JSON.stringify({
    items: [{
      intent: 'cancelled_class',
      subjectName: 'calculo 1',
      title: 'Aula Cancelada',
      targetDate: '2026-08-17'
    }]
  });
  const validated = AIParsingService.cleanAndValidateJson(unaccentedJson, baseContext);
  console.log('cleanAndValidateJson output subjectName:', validated.items[0]?.subjectName);
  const matchedBySync = SyncService.matchSubject(validated.items[0]?.subjectName, testSubjects);
  console.log('SyncService.matchSubject matched to:', matchedBySync?.name);
}

run().catch(console.error);
