import './setup_env';
import React from 'react';
import { TeamsConfigModal } from '../src/components/TeamsConfigModal';
import { SyncService } from '../src/services/SyncService';
import { AIParsingService } from '../src/services/AIParsingService';
import { TeamsService } from '../src/services/TeamsService';
import { StorageService } from '../src/services/storage';
import { AppEvent, AttendanceRecord, Subject, AIConfig, TeamsConfig } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`  [PASS] ${msg}`);
}

async function runAdversarialTests() {
  console.log('================================================================');
  console.log('STARTING ADVERSARIAL STRESS TESTS — MILESTONE 2');
  console.log('================================================================');

  // Test 1: Empty and malformed config resilience
  console.log('\n--- SUITE 1: Config Handling & Resilience ---');
  await StorageService.saveTeamsConfig({
    clientId: '   ',
    tenantId: '',
    isConnected: false
  });
  const emptyTeams = await StorageService.getTeamsConfig();
  assert(emptyTeams?.isConnected === false, 'Empty teams config retains isConnected=false');

  await StorageService.saveAIConfig({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-1.5-flash'
  });
  const emptyAI = await StorageService.getAIConfig();
  assert(emptyAI?.provider === 'gemini', 'Empty AI key preserves provider');

  // Test 2: Simulation with empty initial state
  console.log('\n--- SUITE 2: Simulation with Zero Pre-existing State ---');
  const emptyEvents: AppEvent[] = [];
  const emptyAttendances: AttendanceRecord[] = [];
  const emptySubjects: Subject[] = [];

  const simResult = await SyncService.runSimulation(
    { provider: 'gemini', apiKey: '', model: 'gemini-1.5-flash' },
    emptyEvents,
    emptyAttendances,
    emptySubjects
  );

  assert(simResult.updatedSubjects.length >= 3, 'Simulation auto-seeds missing subjects');
  assert(simResult.updatedEvents.length >= 3, 'Simulation creates events (1 class, 1 hw, 1 exam)');
  assert(simResult.updatedAttendances.length === 1, 'Simulation cancels exactly 1 attendance');
  assert(simResult.syncResult.logs.length > 0, 'Simulation produces informative logs');

  // Test 3: Idempotent re-runs of simulation
  console.log('\n--- SUITE 3: Idempotent Simulation & Non-Duplication ---');
  const simResult2 = await SyncService.runSimulation(
    { provider: 'gemini', apiKey: '', model: 'gemini-1.5-flash' },
    simResult.updatedEvents,
    simResult.updatedAttendances,
    simResult.updatedSubjects
  );

  // Homework and Exam should not be duplicated infinitely
  const hwCount = simResult2.updatedEvents.filter(e => e.category === 'Provas/Trabalhos' && e.title.includes('Exercícios')).length;
  assert(hwCount === 1, 'Idempotent simulation prevents duplicate homework event creation');

  const examCount = simResult2.updatedEvents.filter(e => e.title.includes('Prova P2')).length;
  assert(examCount === 1, 'Idempotent simulation updates existing exam event instead of duplicating');

  // Test 4: TeamsService Auth URL generation with special chars / spaces
  console.log('\n--- SUITE 4: TeamsService Edge Cases ---');
  const authUrl = TeamsService.getAuthUrl('test-client-id-123', 'common');
  assert(authUrl.includes('client_id=test-client-id-123'), 'Auth URL contains client_id');
  assert(authUrl.includes('response_type=code'), 'Auth URL contains response_type=code');
  assert(authUrl.includes('scope='), 'Auth URL contains scopes');

  // Test 5: AI fallback when Gemini/OpenAI endpoints are given bad keys
  console.log('\n--- SUITE 5: AI Error Fallback ---');
  const invalidConfig: AIConfig = {
    provider: 'openai',
    apiKey: 'invalid-key-testing',
    model: 'gpt-4o-mini'
  };
  const parseRes = await AIParsingService.parseMessage(
    'Aviso importante: A aula de Cálculo 1 de hoje está cancelada.',
    invalidConfig,
    { currentDate: '2026-08-17', currentDayOfWeek: 'Monday', registeredSubjects: ['Cálculo 1'] }
  );
  assert(parseRes.items.length > 0, 'Fallback parser activates on invalid API key');
  assert(parseRes.items[0].intent === 'cancelled_class', 'Fallback parser extracts correct intent');

  console.log('\n================================================================');
  console.log('ALL ADVERSARIAL TESTS COMPLETED WITH 100% PASS RATE');
  console.log('================================================================');
}

runAdversarialTests().catch(err => {
  console.error('Adversarial test error:', err);
  process.exit(1);
});
