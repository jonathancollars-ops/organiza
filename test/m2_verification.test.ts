import './setup_env';
import React from 'react';
import { TeamsConfigModal } from '../src/components/TeamsConfigModal';
import { StorageService } from '../src/services/storage';
import { SyncService } from '../src/services/SyncService';

async function testM2() {
  console.log('Testing M2 Integration...');
  console.log('1. TeamsConfigModal exported:', typeof TeamsConfigModal === 'function');
  
  // Test storage methods
  await StorageService.saveTeamsConfig({
    clientId: 'test-client-id-123',
    tenantId: 'common',
    isConnected: true
  });
  const teamsConf = await StorageService.getTeamsConfig();
  console.log('2. Teams config saved & retrieved:', teamsConf?.clientId === 'test-client-id-123', teamsConf?.isConnected);

  await StorageService.saveAIConfig({
    provider: 'gemini',
    apiKey: 'AIzaSyTestKey123',
    model: 'gemini-1.5-flash'
  });
  const aiConf = await StorageService.getAIConfig();
  console.log('3. AI config saved & retrieved:', aiConf?.provider, aiConf?.apiKey === 'AIzaSyTestKey123');

  // Test simulation directly
  const simResult = await SyncService.runSimulation(aiConf, [], [], []);
  console.log('4. Simulation updatedEvents count:', simResult.updatedEvents.length);
  console.log('5. Simulation updatedAttendances count:', simResult.updatedAttendances.length);
  console.log('6. Simulation updatedSubjects count:', simResult.updatedSubjects.length);
  console.log('7. Simulation logs count:', simResult.syncResult.logs.length);

  const cancelled = simResult.syncResult.cancelledAttendances;
  const homework = simResult.syncResult.createdEvents.find(e => e.category === 'Provas/Trabalhos' && e.title.includes('Exercícios'));
  const exam = simResult.syncResult.createdEvents.find(e => e.title.includes('Prova P2'));

  console.log('8. Cancelled attendance status:', cancelled[0]?.status);
  console.log('9. Homework alerts:', homework?.alerts);
  console.log('10. Exam date & alerts:', exam?.date, exam?.alerts);

  if (
    cancelled[0]?.status === 'cancelled' &&
    JSON.stringify(homework?.alerts) === JSON.stringify([10080, 1440]) &&
    exam?.date === '2026-08-28' &&
    JSON.stringify(exam?.alerts) === JSON.stringify([10080, 1440])
  ) {
    console.log('>>> ALL M2 CRITERIA VERIFIED EMPIRICALLY! <<<');
  } else {
    throw new Error('Verification failed');
  }
}

testM2().catch(e => { console.error(e); process.exit(1); });
