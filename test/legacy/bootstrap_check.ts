import './setup_env';

console.log('Testing imports after setup_env...');
import { SyncService, SIMULATION_RAW_MESSAGES } from '../src/services/SyncService';
import { AIParsingService } from '../src/services/AIParsingService';
import { TeamsService } from '../src/services/TeamsService';
import { StorageService } from '../src/services/storage';

async function main() {
  console.log('SyncService loaded:', typeof SyncService.processParsedItems);
  console.log('AIParsingService loaded:', typeof AIParsingService.parseMessageMock);
  console.log('TeamsService loaded:', typeof TeamsService.sanitizeHtmlMessage);
  console.log('StorageService loaded:', typeof StorageService.getEvents);
  console.log('Simulation messages count:', SIMULATION_RAW_MESSAGES.length);

  // Test StorageService mock
  await StorageService.saveEvents([{
    id: 'test_1',
    title: 'Test Event',
    category: 'Faculdade/Aulas',
    date: '2026-08-17',
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'none',
    alerts: [15],
    isCompleted: false
  }]);

  const events = await StorageService.getEvents();
  console.log('Retrieved saved events count:', events.length, 'title:', events[0]?.title);
}

main().catch(console.error);
