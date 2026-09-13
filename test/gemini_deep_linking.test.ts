import './setup_env';
import {
  handleGeminiDeepLink,
  extractStringParam
} from '../src/hooks/useDeepLinkHandler';
import { GeminiIntegrationService } from '../src/services/GeminiIntegrationService';
import { SecuritySanitizer } from '../src/services/SecuritySanitizer';
import { StorageService } from '../src/services/storage';
import { Subject, AppEvent, AttendanceRecord } from '../src/types';
import { lastAlertCalls } from './setup_env';

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

async function runGeminiDeepLinkingTests() {
  console.log('================================================================');
  console.log('🔗 LUMEN: GEMINI DEEP LINKING & APP ACTIONS E2E INTEGRATION SUITE');
  console.log('================================================================\n');

  // Limpa o banco local antes dos testes
  await StorageService.clearAllData();
  lastAlertCalls.length = 0;

  // Matérias simuladas no banco de dados local
  const mockSubjects: Subject[] = [
    {
      id: 'sub_fis_1',
      name: 'Física Teórica e Experimental I',
      code: 'FIS101',
      color: '#EF4444',
      maxAbsences: 12,
      workloadHours: 60,
      passGrade: 7.0,
      gradeGroups: []
    },
    {
      id: 'sub_calc_1',
      name: 'Cálculo Diferencial e Integral I',
      code: 'MAT101',
      color: '#3B82F6',
      maxAbsences: 16,
      workloadHours: 80,
      passGrade: 7.0,
      gradeGroups: []
    },
    {
      id: 'sub_aed_1',
      name: 'Algoritmos e Estruturas de Dados',
      code: 'CC201',
      color: '#10B981',
      maxAbsences: 10,
      workloadHours: 60,
      passGrade: 7.0,
      gradeGroups: []
    }
  ];

  await StorageService.saveSubjects(mockSubjects);

  // =========================================================================
  // CENÁRIO 1: Chegada de URL Válida e Mutação Correta do StorageService
  // =========================================================================
  console.log('--- CENÁRIO 1: Chegada de URL Válida & Mutação no StorageService ---');

  // 1.1 Marcar Falta via URL completa
  const urlFalta = 'lumen://gemini/marcar_falta?materia=Fisica&tipo=falta&data=2026-10-10';
  const resFalta = await handleGeminiDeepLink(urlFalta);

  assert(resFalta.handled === true, '1.1 Deep link válido de falta foi manipulado (handled = true)');
  assert(resFalta.action === 'marcar_falta', '1.1 Ação identificada como marcar_falta');
  assert(resFalta.result?.success === true, '1.1 Ação executada com sucesso');

  const attendancesAfterFalta = await StorageService.getAttendances();
  const faltaRecord = attendancesAfterFalta.find(
    a => a.subjectId === 'sub_fis_1' && a.date === '2026-10-10'
  );
  assert(faltaRecord !== undefined, '1.1 Registro de presença/falta existe no StorageService');
  assert(faltaRecord?.status === 'absent', '1.1 Status persistido é "absent" (falta)');

  // 1.2 Atualizar para Presença na mesma data (sem duplicação de registro)
  const urlPresenca = 'lumen://gemini/marcar_falta?materia=Fisica&tipo=presenca&data=2026-10-10';
  const resPresenca = await handleGeminiDeepLink(urlPresenca);

  assert(resPresenca.handled === true, '1.2 Deep link de presença manipulado');
  assert(resPresenca.result?.success === true, '1.2 Presença registrada com sucesso');

  const attendancesAfterPres = await StorageService.getAttendances();
  const presRecords = attendancesAfterPres.filter(
    a => a.subjectId === 'sub_fis_1' && a.date === '2026-10-10'
  );
  assert(presRecords.length === 1, '1.2 Apenas 1 registro persistido para o mesmo dia (sem duplicatas)');
  assert(presRecords[0].status === 'present', '1.2 Status foi atualizado para "present" (presença)');

  // 1.3 Adicionar Evento Válido via URL
  const urlEvento = 'lumen://gemini/adicionar_evento?titulo=P1%20de%20Fisica&tipo=prova&data=2026-10-20';
  const resEvento = await handleGeminiDeepLink(urlEvento);

  assert(resEvento.handled === true, '1.3 Deep link de criação de evento manipulado');
  assert(resEvento.result?.success === true, '1.3 Evento criado com sucesso');

  const eventsAfterCreate = await StorageService.getEvents();
  const createdEvent = eventsAfterCreate.find(e => e.title.includes('P1 de Fisica'));
  assert(createdEvent !== undefined, '1.3 Evento persistido com sucesso no StorageService');
  assert(createdEvent?.category === 'Provas/Trabalhos', '1.3 Categoria definida como Provas/Trabalhos');
  assert(createdEvent?.subjectId === 'sub_fis_1', '1.3 Evento vinculado à matéria correta sub_fis_1');
  assert(createdEvent?.date === '2026-10-20', '1.3 Data do evento definida como 2026-10-20');

  // =========================================================================
  // CENÁRIO 2: Parâmetros Maliciosos (SQL Injection e Datas Bizarras)
  // =========================================================================
  console.log('\n--- CENÁRIO 2: Parâmetros Maliciosos & Barramento de Segurança ---');

  // 2.1 SQL Injection no título do evento via URL
  const urlSqlTitulo = 'lumen://gemini/adicionar_evento?titulo=%27%3B%20DROP%20TABLE%20events%3B%20--&tipo=prova&data=2026-10-15';
  const resSqlTitulo = await handleGeminiDeepLink(urlSqlTitulo);

  assert(resSqlTitulo.handled === true, '2.1 Deep link com SQL injection no título foi interceptado');
  assert(resSqlTitulo.result?.success === false, '2.1 Execução barrada pela camada de Segurança (success = false)');
  assert(
    resSqlTitulo.result?.message.includes('maliciosa') || resSqlTitulo.result?.message.includes('SQL'),
    '2.1 Mensagem de segurança alerta sobre comando malicioso'
  );

  const eventsAfterSqlAttempt = await StorageService.getEvents();
  const maliciousEvent = eventsAfterSqlAttempt.find(e => e.title.includes('DROP TABLE'));
  assert(maliciousEvent === undefined, '2.1 Nenhum registro com SQL injection foi persistido no StorageService');

  // 2.2 SQL Injection no nome da matéria
  const urlSqlMateria = 'lumen://gemini/marcar_falta?materia=Fisica%27%20OR%20%271%27%3D%271&tipo=falta&data=2026-10-15';
  const resSqlMateria = await handleGeminiDeepLink(urlSqlMateria);

  assert(resSqlMateria.result?.success === false, '2.2 Execução com SQL injection na matéria barrada pela Segurança');

  // 2.3 Data bizarra 2099-99-99 ao marcar falta via URL
  const urlDataBizarraFalta = 'lumen://gemini/marcar_falta?materia=Fisica&tipo=falta&data=2099-99-99';
  const resDataBizarraFalta = await handleGeminiDeepLink(urlDataBizarraFalta);

  assert(resDataBizarraFalta.handled === true, '2.3 Deep link com data bizarra interceptado');
  assert(resDataBizarraFalta.result?.success === false, '2.3 Execução com data 2099-99-99 barrada (success = false)');
  assert(
    resDataBizarraFalta.result?.message.includes('data maliciosa ou inválida') ||
    resDataBizarraFalta.result?.message.includes('Data inválida'),
    '2.3 Mensagem de erro relata data bizarra/inválida'
  );

  const attendancesAfterBizarre = await StorageService.getAttendances();
  const bizarreAtt = attendancesAfterBizarre.find(a => a.date === '2099-99-99');
  assert(bizarreAtt === undefined, '2.3 Nenhuma falta persistida para a data bizarra 2099-99-99');

  // 2.4 Data bizarra 2099-99-99 ao adicionar evento via URL
  const urlDataBizarraEvento = 'lumen://gemini/adicionar_evento?titulo=Prova%20Final&tipo=prova&data=2099-99-99';
  const resDataBizarraEvento = await handleGeminiDeepLink(urlDataBizarraEvento);

  assert(resDataBizarraEvento.result?.success === false, '2.4 Adição de evento com data 2099-99-99 rejeitada');

  const eventsAfterBizarre = await StorageService.getEvents();
  const bizarreEvt = eventsAfterBizarre.find(e => e.date === '2099-99-99');
  assert(bizarreEvt === undefined, '2.4 Nenhum evento persistido para a data bizarra 2099-99-99');

  // 2.5 Data com ano fora do intervalo suportado (> 2100)
  const urlDataFutura = 'lumen://gemini/marcar_falta?materia=Fisica&tipo=falta&data=2999-01-01';
  const resDataFutura = await handleGeminiDeepLink(urlDataFutura);
  assert(resDataFutura.result?.success === false, '2.5 Data no ano 2999 rejeitada pela camada de segurança');

  // 2.6 Defesa em profundidade no próprio GeminiIntegrationService
  const directSqlResult = await GeminiIntegrationService.adicionarEvento(
    "'; DROP TABLE events; --",
    'prova',
    '2026-10-10'
  );
  assert(directSqlResult.success === false, '2.6 GeminiIntegrationService.adicionarEvento rejeita SQL injection diretamente');

  const directBizarreResult = await GeminiIntegrationService.registrarPresencaFalta(
    'Fisica',
    'falta',
    '2099-99-99'
  );
  assert(directBizarreResult.success === false, '2.6 GeminiIntegrationService.registrarPresencaFalta rejeita data bizarra diretamente');

  // =========================================================================
  // CENÁRIO 3: Solicitação de Resumo Acadêmico via Deep Link
  // =========================================================================
  console.log('\n--- CENÁRIO 3: Solicitação de Resumo Acadêmico ---');

  // 3.1 URL padrão de resumo acadêmico
  const urlResumo = 'lumen://gemini/resumo_academico';
  const resResumo = await handleGeminiDeepLink(urlResumo);

  assert(resResumo.handled === true, '3.1 Deep link resumo_academico manipulado com sucesso');
  assert(resResumo.result?.success === true, '3.1 Consulta de resumo acadêmico executada com sucesso');
  assert(typeof resResumo.result?.message === 'string', '3.1 Retorna string de mensagem formatada');
  assert(
    resResumo.result?.message.includes('Status Acadêmico: CR Geral'),
    '3.1 Mensagem contém cabeçalho descritivo "Status Acadêmico: CR Geral"'
  );
  assert(
    resResumo.result?.message.includes('disciplina(s) em andamento'),
    '3.1 Mensagem inclui quantidade de disciplinas em andamento'
  );
  assert(
    resResumo.result?.message.includes('Frequência regular') || resResumo.result?.message.includes('Atenção com faltas'),
    '3.1 Mensagem inclui balanço de frequência e faltas'
  );

  // 3.2 URL com alias status_geral
  const urlStatus = 'lumen://gemini/status_geral';
  const resStatus = await handleGeminiDeepLink(urlStatus);
  assert(resStatus.handled === true, '3.2 Alias status_geral manipulado com sucesso');
  assert(resStatus.result?.success === true, '3.2 Consulta via status_geral bem sucedida');
  assert(
    resStatus.result?.message.includes('Status Acadêmico: CR Geral'),
    '3.2 Mensagem do alias status_geral possui mesma formatação'
  );

  // 3.3 URL com alias curto resumo
  const urlResumoCurto = 'lumen://gemini/resumo';
  const resResumoCurto = await handleGeminiDeepLink(urlResumoCurto);
  assert(resResumoCurto.handled === true, '3.3 Alias curto lumen://gemini/resumo manipulado');
  assert(resResumoCurto.result?.success === true, '3.3 Resumo retornado com sucesso');

  // =========================================================================
  // CENÁRIO 4: Tolerância a Falhas na Busca de Matérias (ex: mat=calc)
  // =========================================================================
  console.log('\n--- CENÁRIO 4: Tolerância a Falhas na Busca de Matérias (Fuzzy Search) ---');

  // 4.1 Envio de nome incompleto "calc" com alias "mat"
  const urlFuzzyCalc = 'lumen://gemini/marcar_falta?mat=calc&tipo=falta&data=2026-10-25';
  const resFuzzyCalc = await handleGeminiDeepLink(urlFuzzyCalc);

  assert(resFuzzyCalc.handled === true, '4.1 Deep link com alias mat=calc manipulado');
  assert(resFuzzyCalc.result?.success === true, '4.1 Mapeamento fuzzy bem-sucedido para mat=calc');

  const attendancesAfterCalc = await StorageService.getAttendances();
  const attCalc = attendancesAfterCalc.find(
    a => a.subjectId === 'sub_calc_1' && a.date === '2026-10-25'
  );
  assert(attCalc !== undefined, '4.1 Falta persistida associada a sub_calc_1 ("Cálculo Diferencial e Integral I")');
  assert(attCalc?.status === 'absent', '4.1 Status é "absent"');

  // 4.2 Envio de nome incompleto "algoritmos" com alias "sub"
  const urlFuzzyAed = 'lumen://gemini/marcar_presenca?sub=algoritmos&data=2026-10-26';
  const resFuzzyAed = await handleGeminiDeepLink(urlFuzzyAed);

  assert(resFuzzyAed.handled === true, '4.2 Deep link com alias sub=algoritmos manipulado');
  assert(resFuzzyAed.result?.success === true, '4.2 Mapeamento fuzzy bem-sucedido para "algoritmos"');

  const attendancesAfterAed = await StorageService.getAttendances();
  const attAed = attendancesAfterAed.find(
    a => a.subjectId === 'sub_aed_1' && a.date === '2026-10-26'
  );
  assert(attAed !== undefined, '4.2 Presença persistida associada a sub_aed_1 ("Algoritmos e Estruturas de Dados")');
  assert(attAed?.status === 'present', '4.2 Status é "present"');

  // 4.3 Detecção automática em criação de evento com título abreviado "P1 de Calc"
  const urlEvtCalc = 'lumen://gemini/adicionar_evento?titulo=P1%20de%20Calc&tipo=prova&data=2026-10-28';
  const resEvtCalc = await handleGeminiDeepLink(urlEvtCalc);

  assert(resEvtCalc.handled === true, '4.3 Deep link adicionar_evento com "P1 de Calc" manipulado');
  assert(resEvtCalc.result?.success === true, '4.3 Evento criado com sucesso');

  const eventsAfterEvtCalc = await StorageService.getEvents();
  const evtCalc = eventsAfterEvtCalc.find(e => e.title.includes('P1 de Calc'));
  assert(evtCalc !== undefined, '4.3 Evento "P1 de Calc" persistido no StorageService');
  assert(evtCalc?.subjectId === 'sub_calc_1', '4.3 Auto-detectou subjectId sub_calc_1 a partir de "Calc"');

  // 4.4 Busca por código da disciplina (MAT101)
  const urlCodeMatch = 'lumen://gemini/marcar_falta?materia=MAT101&tipo=falta&data=2026-10-29';
  const resCodeMatch = await handleGeminiDeepLink(urlCodeMatch);

  assert(resCodeMatch.handled === true, '4.4 Busca por código de disciplina manipulada');
  assert(resCodeMatch.result?.success === true, '4.4 Mapeou corretamente matéria pelo código MAT101');

  const attendancesAfterCode = await StorageService.getAttendances();
  const attCode = attendancesAfterCode.find(
    a => a.subjectId === 'sub_calc_1' && a.date === '2026-10-29'
  );
  assert(attCode !== undefined, '4.4 Falta vinculada a sub_calc_1 via código MAT101');

  // =========================================================================
  // SUMÁRIO FINAL
  // =========================================================================
  console.log('\n================================================================');
  console.log(`🎉 GEMINI DEEP LINKING TESTS: ${passed} PASSADOS | ${failed} FALHAS`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runGeminiDeepLinkingTests().catch(err => {
  console.error('💥 Erro fatal nos testes de Gemini Deep Linking:', err);
  process.exit(1);
});
