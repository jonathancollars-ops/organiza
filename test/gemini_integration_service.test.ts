import './setup_env';
import {
  GeminiIntegrationService,
  normalizeStringForMatching,
  calculateStringSimilarity,
  findSubjectByFuzzyName
} from '../src/services/GeminiIntegrationService';
import { StorageService } from '../src/services/storage';
import { CourseCRService, DEFAULT_CURRICULUM_TEMPLATE } from '../src/services/CourseCRService';
import { Subject, AppEvent, AttendanceRecord } from '../src/types';
import { getLocalDateString } from '../src/utils';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🤖 LUMEN: GEMINI INTEGRATION & DEEP LINK SERVICE TESTS');
  console.log('================================================================\n');

  // Limpa o storage antes de iniciar os testes
  await StorageService.clearAllData();

  // Matérias simuladas no banco de dados local
  const mockSubjects: Subject[] = [
    {
      id: 'sub_calc_1',
      name: 'Cálculo Diferencial e Integral I',
      code: 'MAT101',
      color: '#3B82F6',
      maxAbsences: 15,
      workloadHours: 60,
      passGrade: 7.0,
      gradeGroups: [
        {
          id: 'gg_1',
          name: 'Provas',
          weight: 1,
          items: [
            { id: 'gi_1', name: 'P1', weight: 1, maxGrade: 10, grade: 8.5 },
            { id: 'gi_2', name: 'P2', weight: 1, maxGrade: 10, grade: 7.5 }
          ]
        }
      ]
    },
    {
      id: 'sub_fis_2',
      name: 'Física Geral II',
      code: 'FIS201',
      color: '#EF4444',
      maxAbsences: 15,
      workloadHours: 60,
      passGrade: 7.0,
      gradeGroups: [
        {
          id: 'gg_2',
          name: 'Provas',
          weight: 1,
          items: [
            { id: 'gi_3', name: 'P1', weight: 1, maxGrade: 10, grade: 5.0 }
          ]
        }
      ]
    },
    {
      id: 'sub_aed',
      name: 'Algoritmos e Estruturas de Dados',
      code: 'CC201',
      color: '#10B981',
      maxAbsences: 12,
      workloadHours: 48,
      passGrade: 7.0
    }
  ];

  await StorageService.saveSubjects(mockSubjects);

  // --- SUITE 1: Normalização e Similaridade de Strings ---
  console.log('--- 1. String Normalization & Similarity ---');
  assert(
    normalizeStringForMatching('Cálculo I') === 'calculo 1',
    'normalizeStringForMatching converts accents and Roman numeral I to 1'
  );
  assert(
    normalizeStringForMatching('Física II!') === 'fisica 2',
    'normalizeStringForMatching converts accents and Roman numeral II to 2'
  );
  assert(
    normalizeStringForMatching('Álgebra Linear III') === 'algebra linear 3',
    'normalizeStringForMatching converts Roman numeral III to 3'
  );
  assert(
    normalizeStringForMatching('') === '',
    'normalizeStringForMatching handles empty string'
  );

  const exactScore = calculateStringSimilarity('Cálculo I', 'calculo 1');
  assert(exactScore === 1.0, 'calculateStringSimilarity returns 1.0 for normalized identical strings');

  const substringScore = calculateStringSimilarity('Cálculo', 'Cálculo Diferencial e Integral I');
  assert(substringScore >= 0.85, `calculateStringSimilarity detects strong substring match (${substringScore})`);

  const tokenScore = calculateStringSimilarity('Estruturas de Dados', 'Algoritmos e Estruturas de Dados');
  assert(tokenScore >= 0.7, `calculateStringSimilarity detects multi-token overlap (${tokenScore})`);

  const unrelatedScore = calculateStringSimilarity('Cálculo', 'História da Arte Moderna');
  assert(unrelatedScore < 0.3, `calculateStringSimilarity scores low on unrelated strings (${unrelatedScore})`);

  // --- SUITE 2: Busca Aproximada de Matérias (Fuzzy Match) ---
  console.log('\n--- 2. Fuzzy Subject Matching ---');
  const match1 = findSubjectByFuzzyName('Calculo', mockSubjects);
  assert(match1.subject?.id === 'sub_calc_1', 'Fuzzy match "Calculo" finds "Cálculo Diferencial e Integral I"');

  const match2 = findSubjectByFuzzyName('calculo 1', mockSubjects);
  assert(match2.subject?.id === 'sub_calc_1', 'Fuzzy match "calculo 1" finds "Cálculo Diferencial e Integral I"');

  const match3 = findSubjectByFuzzyName('fisica 2', mockSubjects);
  assert(match3.subject?.id === 'sub_fis_2', 'Fuzzy match "fisica 2" finds "Física Geral II"');

  const match4 = findSubjectByFuzzyName('estrutura de dados', mockSubjects);
  assert(match4.subject?.id === 'sub_aed', 'Fuzzy match "estrutura de dados" finds "Algoritmos e Estruturas de Dados"');

  const match5 = findSubjectByFuzzyName('CC201', mockSubjects);
  assert(match5.subject?.id === 'sub_aed', 'Fuzzy match by subject code "CC201" finds matching subject');

  const matchNone = findSubjectByFuzzyName('Biologia Celular', mockSubjects);
  assert(matchNone.subject === null, 'Fuzzy match returns null for non-existent subject');

  // --- SUITE 3: Registrar Presença e Falta ---
  console.log('\n--- 3. GeminiIntegrationService.registrarPresencaFalta ---');

  // Validações de entrada
  const errNoSubject = await GeminiIntegrationService.registrarPresencaFalta('', 'presenca', '2026-09-15');
  assert(errNoSubject.success === false, 'Fails when materiaNome is empty');
  assert(errNoSubject.message === 'Parâmetros inválidos', 'Returns "Parâmetros inválidos" when materiaNome is empty');

  const errInvalidType = await GeminiIntegrationService.registrarPresencaFalta('Calculo', 'outro' as any, '2026-09-15');
  assert(errInvalidType.success === false, 'Fails when tipo is invalid');
  assert(errInvalidType.message === 'Parâmetros inválidos', 'Returns "Parâmetros inválidos" when tipo is invalid');

  const resFallbackDate = await GeminiIntegrationService.registrarPresencaFalta('Calculo', 'presenca', 'data-invalida');
  assert(resFallbackDate.success === true, 'Safely falls back to current date (now) when date format is invalid');
  assert(resFallbackDate.data?.attendance.date === getLocalDateString(), 'Attendance date matches today (now)');

  const errNotFound = await GeminiIntegrationService.registrarPresencaFalta('Sociologia Jurídica', 'presenca', '2026-09-15');
  assert(errNotFound.success === false, 'Fails with clear message when subject is not found');

  // Registrar Presença com sucesso
  const resPresenca = await GeminiIntegrationService.registrarPresencaFalta('Calculo', 'presenca', '2026-09-15');
  assert(resPresenca.success === true, 'Successfully registers presence for fuzzy subject "Calculo"');
  assert(resPresenca.data?.attendance.status === 'present', 'Attendance status is "present"');
  assert(resPresenca.data?.subject.id === 'sub_calc_1', 'Linked to correct subject sub_calc_1');
  assert(resPresenca.message.includes('Presença registrada com sucesso'), 'Success message is informative');

  // Verificar persistência no StorageService
  const attendancesAfterPresenca = await StorageService.getAttendances();
  const savedAtt = attendancesAfterPresenca.find(a => a.subjectId === 'sub_calc_1' && a.date === '2026-09-15');
  assert(savedAtt !== undefined && savedAtt.status === 'present', 'Presence record is persisted in StorageService');

  // Registrar Falta com sucesso (atualizando o mesmo registro do dia)
  const resFalta = await GeminiIntegrationService.registrarPresencaFalta('Calculo 1', 'falta', '2026-09-15');
  assert(resFalta.success === true, 'Successfully registers absence updating same day record');
  assert(resFalta.data?.attendance.status === 'absent', 'Updated status is "absent"');

  const attendancesAfterFalta = await StorageService.getAttendances();
  const updatedAtt = attendancesAfterFalta.find(a => a.subjectId === 'sub_calc_1' && a.date === '2026-09-15');
  assert(updatedAtt?.status === 'absent', 'Absence record updated correctly in StorageService without duplicates');

  // Registrar Falta em outra disciplina
  const resFaltaFis = await GeminiIntegrationService.registrarPresencaFalta('Física 2', 'falta', '2026-09-15');
  assert(resFaltaFis.success === true, 'Successfully registers absence for "Física 2"');
  assert(resFaltaFis.data?.subject.id === 'sub_fis_2', 'Correctly linked to sub_fis_2');

  // --- SUITE 4: Adicionar Evento / Prova / Trabalho / Lembrete ---
  console.log('\n--- 4. GeminiIntegrationService.adicionarEvento ---');

  // Validação de título vazio
  const errEmptyTitle = await GeminiIntegrationService.adicionarEvento('', 'prova', '2026-09-22');
  assert(errEmptyTitle.success === false, 'Fails when title is empty');

  // Adicionar Prova com data e horário ISO
  const resProva = await GeminiIntegrationService.adicionarEvento(
    'P2 de Cálculo I',
    'prova',
    '2026-09-22T14:00:00'
  );
  assert(resProva.success === true, 'Successfully adds exam event');
  assert(resProva.data?.event.category === 'Provas/Trabalhos', 'Category is Provas/Trabalhos');
  assert(resProva.data?.event.isImportant === true, 'Exam is marked as important');
  assert(resProva.data?.event.startTime === '14:00', 'Start time extracted as 14:00');
  assert(resProva.data?.event.endTime === '16:00', 'End time default 2h for exam is 16:00');
  assert(resProva.data?.event.subjectId === 'sub_calc_1', 'Auto-detected subjectId from title');
  assert(resProva.message.includes('Prova'), 'Message mentions Prova');

  // Adicionar Trabalho com data apenas
  const resTrabalho = await GeminiIntegrationService.adicionarEvento(
    'Entrega de Algoritmos',
    'trabalho',
    '2026-09-25'
  );
  assert(resTrabalho.success === true, 'Successfully adds work/assignment event');
  assert(resTrabalho.data?.event.category === 'Provas/Trabalhos', 'Category is Provas/Trabalhos');
  assert(resTrabalho.data?.event.subjectId === 'sub_aed', 'Auto-detected subjectId sub_aed');
  assert(resTrabalho.data?.event.startTime === '08:00', 'Default start time is 08:00');

  // Adicionar Lembrete
  const resLembrete = await GeminiIntegrationService.adicionarEvento(
    'Comprar caderno novo',
    'lembrete',
    '2026-09-18T10:30:00'
  );
  assert(resLembrete.success === true, 'Successfully adds reminder event');
  assert(resLembrete.data?.event.category === 'Outros', 'Category is Outros for lembrete');
  assert(resLembrete.data?.event.subjectId === undefined, 'No subject linked for non-academic reminder');

  // Verificar persistência dos eventos
  const eventsInStorage = await StorageService.getEvents();
  assert(eventsInStorage.length === 3, 'All 3 events persisted in StorageService');

  // --- SUITE 5: Consultar Agenda do Dia ---
  console.log('\n--- 5. GeminiIntegrationService.consultarAgendaDoDia ---');

  // Dia sem compromissos
  const resEmptyAgenda = await GeminiIntegrationService.consultarAgendaDoDia('2026-09-11');
  assert(resEmptyAgenda.success === true, 'Successfully queries agenda for empty day');
  assert(resEmptyAgenda.data?.totalEvents === 0, 'Total events is 0 on empty day');
  assert(resEmptyAgenda.message.includes('100% livre'), 'Summary mentions 100% free day');

  // Dia com evento (2026-09-22: Prova de Cálculo)
  const resAgendaWithEvent = await GeminiIntegrationService.consultarAgendaDoDia('2026-09-22');
  assert(resAgendaWithEvent.success === true, 'Successfully queries agenda on day with events');
  assert(resAgendaWithEvent.data?.totalEvents === 1, 'Found 1 event');
  assert(resAgendaWithEvent.data?.events[0].title === 'P2 de Cálculo I', 'Event title matches');
  assert(resAgendaWithEvent.message.includes('P2 de Cálculo I'), 'Message includes event title');
  assert(resAgendaWithEvent.message.includes('14:00'), 'Message includes time');

  // Adicionar aula recorrente para testar agenda do dia
  const aulaRecorrente: AppEvent = {
    id: 'evt_aula_weekly',
    title: 'Aula de Física II',
    category: 'Faculdade/Aulas',
    date: '2026-09-01',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'weekly',
    recurrenceDays: [2], // Terça-feira (Tuesday)
    alerts: [],
    isCompleted: false,
    subjectId: 'sub_fis_2'
  };
  await StorageService.saveEvents([...eventsInStorage, aulaRecorrente]);

  // 2026-09-22 é uma Terça-feira (Tuesday) -> Deve incluir tanto a aula recorrente quanto a prova!
  const resAgendaTuesday = await GeminiIntegrationService.consultarAgendaDoDia('2026-09-22');
  assert(resAgendaTuesday.data?.totalEvents === 2, 'Agenda includes both recurring class and exam on Tuesday');

  // --- SUITE 6: Consultar Status Geral ---
  console.log('\n--- 6. GeminiIntegrationService.consultarStatusGeral ---');

  // Configura histórico de curso para CR
  await CourseCRService.saveCourseProgress(DEFAULT_CURRICULUM_TEMPLATE);

  // Adiciona mais faltas para criar um cenário de risco em Física II
  const extraFaltas: AttendanceRecord[] = [
    { id: 'att_f1', subjectId: 'sub_fis_2', date: '2026-09-01', eventId: 'e1', status: 'absent' },
    { id: 'att_f2', subjectId: 'sub_fis_2', date: '2026-09-02', eventId: 'e2', status: 'absent' },
    { id: 'att_f3', subjectId: 'sub_fis_2', date: '2026-09-03', eventId: 'e3', status: 'absent' },
    { id: 'att_f4', subjectId: 'sub_fis_2', date: '2026-09-04', eventId: 'e4', status: 'absent' },
    { id: 'att_f5', subjectId: 'sub_fis_2', date: '2026-09-05', eventId: 'e5', status: 'absent' },
    { id: 'att_f6', subjectId: 'sub_fis_2', date: '2026-09-06', eventId: 'e6', status: 'absent' },
    { id: 'att_f7', subjectId: 'sub_fis_2', date: '2026-09-07', eventId: 'e7', status: 'absent' },
    { id: 'att_f8', subjectId: 'sub_fis_2', date: '2026-09-08', eventId: 'e8', status: 'absent' },
    { id: 'att_f9', subjectId: 'sub_fis_2', date: '2026-09-09', eventId: 'e9', status: 'absent' },
    { id: 'att_f10', subjectId: 'sub_fis_2', date: '2026-09-10', eventId: 'e10', status: 'absent' },
    { id: 'att_f11', subjectId: 'sub_fis_2', date: '2026-09-11', eventId: 'e11', status: 'absent' },
    { id: 'att_f12', subjectId: 'sub_fis_2', date: '2026-09-12', eventId: 'e12', status: 'absent' },
    { id: 'att_f13', subjectId: 'sub_fis_2', date: '2026-09-13', eventId: 'e13', status: 'absent' },
    { id: 'att_f14', subjectId: 'sub_fis_2', date: '2026-09-14', eventId: 'e14', status: 'absent' },
  ];
  await StorageService.saveAttendances([...(await StorageService.getAttendances()), ...extraFaltas]);

  const resStatus = await GeminiIntegrationService.consultarStatusGeral();
  assert(resStatus.success === true, 'consultarStatusGeral executed successfully');
  assert(typeof resStatus.data?.overallCR === 'number', 'overallCR is a valid number');
  assert(resStatus.data?.totalActiveSubjects === 3, 'totalActiveSubjects is 3');
  assert(resStatus.data?.criticalAbsences.length! >= 1, 'Detected at least 1 critical absence subject (Física II)');

  const criticalFis = resStatus.data?.criticalAbsences.find(c => c.subjectId === 'sub_fis_2');
  assert(criticalFis?.riskLevel === 'danger', 'Física II is at risk level "danger"');
  assert(criticalFis?.remainingAbsences! <= 2, 'Física II has <= 2 absences remaining');
  assert(resStatus.message.includes('CR Geral'), 'Message includes CR Geral');
  assert(resStatus.message.includes('Física Geral II'), 'Message alerts user about critical absences in Física II');

  // --- SUITE 7: Blindagem de Segurança (Regras 1, 2, 3 e 4) ---
  console.log('\n--- 7. Security Hardening: Memory Limits, Enum Protection, ISO Validation & XSS Sanitization ---');

  // Regra 1: Prevenção de Injeção de Dados e Limites Máximos de String (ex: 1000 caracteres)
  const hugeString1000 = 'A'.repeat(1000);
  const resHugeTitle = await GeminiIntegrationService.adicionarEvento(hugeString1000, 'prova', '2026-09-22');
  assert(resHugeTitle.success === false, 'Rejects event title exceeding 1000 characters to prevent memory crash (Rule 1)');
  assert(resHugeTitle.message === 'Parâmetros inválidos', 'Returns exact message "Parâmetros inválidos" for oversized title');

  const resHugeSubject = await GeminiIntegrationService.registrarPresencaFalta(hugeString1000, 'presenca', '2026-09-22');
  assert(resHugeSubject.success === false, 'Rejects subject name exceeding limits to prevent DoS (Rule 1)');
  assert(resHugeSubject.message === 'Parâmetros inválidos', 'Returns exact message "Parâmetros inválidos" for oversized subject');

  // Regra 3: Enum Restrito (Parâmetros inválidos)
  const resGarbageTipoPresenca = await GeminiIntegrationService.registrarPresencaFalta('Calculo', 'futebol' as any, '2026-09-22');
  assert(resGarbageTipoPresenca.success === false, 'Rejects non-enum value in registrarPresencaFalta (Rule 3)');
  assert(resGarbageTipoPresenca.message === 'Parâmetros inválidos', 'Returns exact message "Parâmetros inválidos" when tipo is garbage');

  const resGarbageTipoEvento = await GeminiIntegrationService.adicionarEvento('Prova de Cálculo', 'balada_noturna' as any, '2026-09-22');
  assert(resGarbageTipoEvento.success === false, 'Rejects non-enum value in adicionarEvento (Rule 3)');
  assert(resGarbageTipoEvento.message === 'Parâmetros inválidos', 'Returns exact message "Parâmetros inválidos" when tipoEvento is garbage');

  // Regra 4: Sanitização de Texto & Prevenção de XSS
  const resXssTitle = await GeminiIntegrationService.adicionarEvento(
    '<script>alert("XSS_EXAM")</script><b>P3 de Cálculo I</b>',
    'prova',
    '2026-09-30T10:00:00'
  );
  assert(resXssTitle.success === true, 'Accepts event with sanitized title (Rule 4)');
  assert(!resXssTitle.data?.event.title.includes('<script>'), 'Title has <script> stripped');
  assert(!resXssTitle.data?.event.title.includes('<b>'), 'Title has <b> tag stripped');
  assert(resXssTitle.data?.event.title === 'P3 de Cálculo I', 'Sanitized title is clean "P3 de Cálculo I"');

  const resPureScriptTitle = await GeminiIntegrationService.adicionarEvento('<script>alert("hack")</script>', 'lembrete');
  assert(resPureScriptTitle.success === false, 'Rejects event when title becomes empty after stripping malicious script tags (Rule 4)');
  assert(resPureScriptTitle.message === 'Parâmetros inválidos', 'Returns "Parâmetros inválidos" when title sanitized is empty');

  const resXssSubject = await GeminiIntegrationService.registrarPresencaFalta('<script>alert(1)</script>Calculo 1', 'presenca');
  assert(resXssSubject.success === true, 'Sanitizes subject query with script tags before fuzzy search (Rule 4)');
  assert(resXssSubject.data?.subject.id === 'sub_calc_1', 'Correctly matches subject sub_calc_1');

  // Regra 2: Validação ISO 8601 Estrita & Fallback Seguro para NOW
  // Data impossível no calendário (31 de Fevereiro)
  const resImpossibleDate = await GeminiIntegrationService.adicionarEvento('Estudar', 'lembrete', '2026-02-31T09:00:00');
  assert(resImpossibleDate.success === true, 'Succeeds with safe fallback for impossible calendar date 2026-02-31 (Rule 2)');
  assert(resImpossibleDate.data?.event.date === getLocalDateString(), 'Impossible date safely fell back to today (now)');

  // Data omitida (undefined) em adicionarEvento
  const resOmittedDate = await GeminiIntegrationService.adicionarEvento('Revisão Geral', 'lembrete');
  assert(resOmittedDate.success === true, 'Succeeds with safe fallback when date is omitted (Rule 2)');
  assert(resOmittedDate.data?.event.date === getLocalDateString(), 'Omitted date safely fell back to today (now)');

  // Data malformada em consultarAgendaDoDia
  const resAgendaMalformed = await GeminiIntegrationService.consultarAgendaDoDia('data-invalida-lixo');
  assert(resAgendaMalformed.success === true, 'consultarAgendaDoDia safely falls back to today for malformed date (Rule 2)');
  assert(resAgendaMalformed.data?.date === getLocalDateString(), 'Agenda target date fell back to today (now)');

  // Data impossível em consultarAgendaDoDia
  const resAgendaImpossible = await GeminiIntegrationService.consultarAgendaDoDia('2026-04-31'); // Abril tem 30 dias
  assert(resAgendaImpossible.success === true, 'consultarAgendaDoDia safely falls back to today for impossible date 2026-04-31 (Rule 2)');
  assert(resAgendaImpossible.data?.date === getLocalDateString(), 'Agenda target date fell back to today (now)');

  console.log('\n================================================================');
  console.log(`GEMINI INTEGRATION SERVICE TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
