import './setup_env';
import fs from 'fs';
import path from 'path';
import React from 'react';
import {
  calculateDaySchedule,
  formatDuration,
  timeToMinutes,
  minutesToTime,
  STUDY_DAY_START_HOUR,
  STUDY_DAY_END_HOUR,
  MIN_FREE_WINDOW_MINUTES
} from '../src/utils/schedulePlanner';
import { AppEvent, Subject, AttendanceRecord } from '../src/types';
import { AgendaScreen, AgendaScreenProps } from '../src/screens/AgendaScreen';

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
  console.log('⏱️  LUMEN: DAY SCHEDULE & FREE TIME ENGINE AUDIT');
  console.log('================================================================\n');

  // --- SUITE 1: Formatação de Tempo & Utilitários Puros ---
  console.log('--- 1. Pure Time Conversion & Duration Formatting ---');
  assert(timeToMinutes('07:00') === 420, 'timeToMinutes("07:00") is 420');
  assert(timeToMinutes('22:00') === 1320, 'timeToMinutes("22:00") is 1320');
  assert(timeToMinutes('00:00') === 0, 'timeToMinutes("00:00") is 0');
  assert(timeToMinutes('23:59') === 1439, 'timeToMinutes("23:59") is 1439');
  assert(timeToMinutes(null) === 0, 'timeToMinutes(null) defensively returns 0');
  assert(timeToMinutes('invalid') === 0, 'timeToMinutes("invalid") defensively returns 0');

  assert(minutesToTime(420) === '07:00', 'minutesToTime(420) is "07:00"');
  assert(minutesToTime(1320) === '22:00', 'minutesToTime(1320) is "22:00"');
  assert(minutesToTime(615) === '10:15', 'minutesToTime(615) is "10:15"');

  assert(formatDuration(0) === '0h 00m', 'formatDuration(0) is "0h 00m"');
  assert(formatDuration(210) === '3h 30m', 'formatDuration(210) is "3h 30m"');
  assert(formatDuration(300) === '5h 00m', 'formatDuration(300) is "5h 00m"');
  assert(formatDuration(45) === '45m', 'formatDuration(45) is "45m"');
  assert(formatDuration(15) === '15m', 'formatDuration(15) is "15m"');
  assert(formatDuration(900) === '15h 00m', 'formatDuration(900) is "15h 00m"');

  // --- SUITE 2: Cálculo com Múltiplos Eventos & Intervalos Livres ---
  console.log('\n--- 2. Multi-Event Day Schedule Calculation ---');
  const multiEvents: AppEvent[] = [
    {
      id: 'evt_calc_1',
      title: 'Cálculo I',
      category: 'Faculdade/Aulas',
      date: '2026-09-11',
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'none',
      alerts: [],
      isCompleted: false,
      subjectId: 'sub_math',
      location: 'Sala 101'
    },
    {
      id: 'evt_physics_2',
      title: 'Física Geral',
      category: 'Faculdade/Aulas',
      date: '2026-09-11',
      startTime: '13:30',
      endTime: '15:30',
      recurrence: 'none',
      alerts: [],
      isCompleted: false,
      subjectId: 'sub_phys',
      location: 'Lab de Física'
    }
  ];

  const summary = calculateDaySchedule(multiEvents);

  // Período 07:00 às 22:00 = 15 horas = 900 minutos
  // Ocupado: 08:00-10:00 (120m) + 13:30-15:30 (120m) = 240 minutos (4h 00m)
  // Livre: 07:00-08:00 (60m) + 10:00-13:30 (210m = 3h 30m) + 15:30-22:00 (390m = 6h 30m) = 660m (11h 00m)
  assert(summary.totalOccupiedMinutes === 240, 'Total occupied minutes is 240 (4 hours)');
  assert(summary.totalOccupiedFormatted === '4h 00m', 'Formatted occupied time is "4h 00m"');
  assert(summary.totalFreeMinutes === 660, 'Total free minutes is 660 (11 hours)');
  assert(summary.totalFreeFormatted === '11h 00m', 'Formatted free time is "11h 00m"');

  assert(summary.freeBlocks.length === 3, 'Found exactly 3 free time blocks');
  assert(summary.freeBlocks[0].startTime === '07:00' && summary.freeBlocks[0].endTime === '08:00', 'Free block 1: 07:00 - 08:00');
  assert(summary.freeBlocks[0].durationFormatted === '1h 00m', 'Free block 1 duration is "1h 00m"');
  assert(summary.freeBlocks[1].startTime === '10:00' && summary.freeBlocks[1].endTime === '13:30', 'Free block 2: 10:00 - 13:30');
  assert(summary.freeBlocks[1].durationFormatted === '3h 30m', 'Free block 2 duration is "3h 30m"');
  assert(summary.freeBlocks[2].startTime === '15:30' && summary.freeBlocks[2].endTime === '22:00', 'Free block 3: 15:30 - 22:00');
  assert(summary.freeBlocks[2].durationFormatted === '6h 30m', 'Free block 3 duration is "6h 30m"');

  // Verifica se o bloco de tempo livre anterior a Física sugere a matéria
  assert(summary.freeBlocks[1].suggestedSubjectId === 'sub_phys', 'Free block 2 suggests upcoming subject sub_phys');

  // Timeline combinada
  assert(summary.blocks.length === 5, 'Combined timeline has 5 interleaved blocks (free, busy, free, busy, free)');
  assert(summary.blocks[0].type === 'free', 'Block 0 is free');
  assert(summary.blocks[1].type === 'busy', 'Block 1 is busy (Cálculo I)');
  assert(summary.blocks[2].type === 'free', 'Block 2 is free');
  assert(summary.blocks[3].type === 'busy', 'Block 3 is busy (Física Geral)');
  assert(summary.blocks[4].type === 'free', 'Block 4 is free');

  // --- SUITE 3: Regra de Intervalos < 15 Minutos ---
  console.log('\n--- 3. Ignore Free Intervals Less Than 15 Minutes ---');
  const shortGapEvents: AppEvent[] = [
    {
      id: 'evt_1',
      title: 'Aula 1',
      category: 'Faculdade/Aulas',
      date: '2026-09-11',
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'none',
      alerts: [],
      isCompleted: false
    },
    {
      id: 'evt_2',
      title: 'Aula 2 (10 min depois)',
      category: 'Faculdade/Aulas',
      date: '2026-09-11',
      startTime: '10:10',
      endTime: '12:00',
      recurrence: 'none',
      alerts: [],
      isCompleted: false
    }
  ];

  const shortGapSummary = calculateDaySchedule(shortGapEvents);
  // Intervalo entre 10:00 e 10:10 tem 10 minutos (< 15 minutos) -> NÃO deve virar bloco livre
  const intermediateGaps = shortGapSummary.freeBlocks.filter(b => b.startTime === '10:00' && b.endTime === '10:10');
  assert(intermediateGaps.length === 0, '10-minute interval between 10:00 and 10:10 is omitted from free blocks');
  // Os blocos livres devem ser apenas: 07:00-08:00 (60m) e 12:00-22:00 (600m)
  assert(shortGapSummary.freeBlocks.length === 2, 'Exactly 2 qualifying free blocks (07:00-08:00 and 12:00-22:00)');
  assert(shortGapSummary.freeBlocks[0].startTime === '07:00' && shortGapSummary.freeBlocks[0].endTime === '08:00', 'First block: 07:00-08:00');
  assert(shortGapSummary.freeBlocks[1].startTime === '12:00' && shortGapSummary.freeBlocks[1].endTime === '22:00', 'Second block: 12:00-22:00');

  // Testar exatamente 15 minutos (deve ser incluído)
  const exact15GapEvents: AppEvent[] = [
    {
      id: 'evt_a',
      title: 'Aula A',
      category: 'Faculdade/Aulas',
      date: '2026-09-11',
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'none',
      alerts: [],
      isCompleted: false
    },
    {
      id: 'evt_b',
      title: 'Aula B (15 min depois)',
      category: 'Faculdade/Aulas',
      date: '2026-09-11',
      startTime: '10:15',
      endTime: '12:00',
      recurrence: 'none',
      alerts: [],
      isCompleted: false
    }
  ];
  const exact15Summary = calculateDaySchedule(exact15GapEvents);
  const gap15 = exact15Summary.freeBlocks.find(b => b.startTime === '10:00' && b.endTime === '10:15');
  assert(gap15 !== undefined, 'Exact 15-minute gap (10:00-10:15) qualifies as a Free Time block');
  assert(gap15?.durationFormatted === '15m', 'Exact 15-minute gap duration is "15m"');

  // --- SUITE 4: Dia Totalmente Vazio (100% Livre) ---
  console.log('\n--- 4. Completely Empty Day (100% Free Time) ---');
  const emptySummary = calculateDaySchedule([]);
  assert(emptySummary.totalOccupiedMinutes === 0, 'Empty day has 0 occupied minutes');
  assert(emptySummary.totalOccupiedFormatted === '0h 00m', 'Empty day occupied format is "0h 00m"');
  assert(emptySummary.totalFreeMinutes === 900, 'Empty day has 900 free minutes (15 hours, 07:00-22:00)');
  assert(emptySummary.totalFreeFormatted === '15h 00m', 'Empty day free format is "15h 00m"');
  assert(emptySummary.freeBlocks.length === 1, 'Empty day has exactly 1 large free block');
  assert(emptySummary.freeBlocks[0].startTime === '07:00' && emptySummary.freeBlocks[0].endTime === '22:00', 'Free block covers 07:00 to 22:00');
  assert(emptySummary.busyBlocks.length === 0, 'Empty day has 0 busy blocks');

  // --- SUITE 5: Dia Totalmente Ocupado (100% Ocupado) ---
  console.log('\n--- 5. Completely Busy Day (100% Occupied) ---');
  const fullBusyEvents: AppEvent[] = [
    {
      id: 'evt_full',
      title: 'Maratona Acadêmica',
      category: 'Faculdade/Aulas',
      date: '2026-09-11',
      startTime: '07:00',
      endTime: '22:00',
      recurrence: 'none',
      alerts: [],
      isCompleted: false
    }
  ];
  const fullBusySummary = calculateDaySchedule(fullBusyEvents);
  assert(fullBusySummary.totalOccupiedMinutes === 900, 'Full day has 900 occupied minutes');
  assert(fullBusySummary.totalOccupiedFormatted === '15h 00m', 'Full day occupied format is "15h 00m"');
  assert(fullBusySummary.totalFreeMinutes === 0, 'Full day has 0 free minutes');
  assert(fullBusySummary.totalFreeFormatted === '0h 00m', 'Full day free format is "0h 00m"');
  assert(fullBusySummary.freeBlocks.length === 0, 'Full day has 0 free blocks');
  assert(fullBusySummary.busyBlocks.length === 1, 'Full day has 1 busy block');

  // --- SUITE 6: Eventos Sobrepostos e Borda Externa ---
  console.log('\n--- 6. Overlapping Events & Boundary Clamping ---');
  const overlappingEvents: AppEvent[] = [
    {
      id: 'evt_ov_1',
      title: 'Aula Teórica',
      category: 'Faculdade/Aulas',
      date: '2026-09-11',
      startTime: '08:00',
      endTime: '10:00',
      recurrence: 'none',
      alerts: [],
      isCompleted: false
    },
    {
      id: 'evt_ov_2',
      title: 'Monitoria Sobreposta',
      category: 'Faculdade/Aulas',
      date: '2026-09-11',
      startTime: '09:30',
      endTime: '11:30',
      recurrence: 'none',
      alerts: [],
      isCompleted: false
    }
  ];
  const overlapSummary = calculateDaySchedule(overlappingEvents);
  // Intervalo ocupado mesclado: 08:00 até 11:30 = 3h 30m = 210 min
  assert(overlapSummary.totalOccupiedMinutes === 210, 'Overlapping events merged correctly into 210 occupied minutes (3h 30m)');
  assert(overlapSummary.totalOccupiedFormatted === '3h 30m', 'Occupied format is "3h 30m"');
  // Free time: 07:00-08:00 (60m) + 11:30-22:00 (630m) = 690m (11h 30m)
  assert(overlapSummary.totalFreeMinutes === 690, 'Free minutes after merge is 690');
  assert(overlapSummary.totalFreeFormatted === '11h 30m', 'Free format is "11h 30m"');

  // --- SUITE 7: Auditoria Estática & Integração em AgendaScreen.tsx ---
  console.log('\n--- 7. Static Audit & AgendaScreen.tsx Component Integration ---');
  const agendaScreenPath = path.resolve(__dirname, '../src/screens/AgendaScreen.tsx');
  assert(fs.existsSync(agendaScreenPath), 'AgendaScreen.tsx exists');

  const agendaContent = fs.readFileSync(agendaScreenPath, 'utf8');

  assert(
    agendaContent.includes('Cronograma do Dia'),
    'AgendaScreen renders "Cronograma do Dia" card'
  );
  assert(
    agendaContent.includes('calculateDaySchedule'),
    'AgendaScreen integrates calculateDaySchedule calculation engine'
  );
  assert(
    agendaContent.includes('ocupadas') && agendaContent.includes('livres hoje'),
    'AgendaScreen renders tactile summary capsules for occupied and free time'
  );
  assert(
    agendaContent.includes('Focar') && agendaContent.includes('onOpenStudy'),
    'AgendaScreen free time block features "Focar" quick action calling onOpenStudy'
  );

  console.log('\n================================================================');
  console.log(`DAY SCHEDULE TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
