import './setup_env';
import { setMockFreeDiskStorageBytes, mockFileSystemStore } from './setup_env';
import { LocalAIModelService, AVAILABLE_MODEL_TIERS, DEFAULT_OFFLINE_MODEL } from '../src/services/LocalAIModelService';
import { LocalAIInferenceService } from '../src/services/LocalAIInferenceService';
import { LocalModelTier, AIConfig } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[TEST FAILED] ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

async function run3TierSuite() {
  console.log('\n======================================================');
  console.log('🧪 SUITE: 3-TIER LOCAL AI GGUF DOWNLOAD & LIFECYCLE');
  console.log('======================================================\n');

  // ─────────────────────────────────────────────────────────────
  // 1. Verify 3-Tier Configurations & Public GGUF URLs
  // ─────────────────────────────────────────────────────────────
  console.log('📦 1. Verifying 3 Tier Configurations & Public GGUF URLs...');

  const tiers: LocalModelTier[] = ['light', 'medium', 'deep'];
  for (const tier of tiers) {
    const config = AVAILABLE_MODEL_TIERS[tier];
    assert(!!config, `Tier ${tier} exists in AVAILABLE_MODEL_TIERS`);
    assert(config.filename.endsWith('.gguf'), `Tier ${tier} uses .gguf format (got ${config.filename})`);
    assert(config.downloadUrl.startsWith('https://huggingface.co/'), `Tier ${tier} has valid HuggingFace URL`);
    assert(config.downloadUrl.includes('/resolve/main/'), `Tier ${tier} URL points to resolve/main`);
    assert(config.sizeBytes > 0, `Tier ${tier} sizeBytes > 0 (${config.formattedSize})`);
  }

  assert(AVAILABLE_MODEL_TIERS.light.sizeBytes < 600000000, 'Light tier is lightweight (<600MB)');
  assert(AVAILABLE_MODEL_TIERS.medium.sizeBytes >= 1000000000, 'Medium tier is balanced (>=1.0GB)');
  assert(AVAILABLE_MODEL_TIERS.deep.sizeBytes >= 2000000000, 'Deep tier is advanced (>=2.0GB)');

  // ─────────────────────────────────────────────────────────────
  // 2. Initial State & Sandbox Model Directory
  // ─────────────────────────────────────────────────────────────
  console.log('\n📂 2. Testing Sandbox Directory & Initial Status...');

  const modelDir = LocalAIModelService.getModelDirectory();
  assert(modelDir.endsWith('models/'), `Model directory: ${modelDir}`);

  const allInitial = await LocalAIModelService.checkAllTiersStatus();
  assert(allInitial.light.downloadState === 'not_downloaded', 'Light tier initially not_downloaded');
  assert(allInitial.medium.downloadState === 'not_downloaded', 'Medium tier initially not_downloaded');
  assert(allInitial.deep.downloadState === 'not_downloaded', 'Deep tier initially not_downloaded');

  // ─────────────────────────────────────────────────────────────
  // 3. Download Execution with Progress Callback for Tier 'light'
  // ─────────────────────────────────────────────────────────────
  console.log('\n📥 3. Testing Download Execution & Progress Tracking (Light Tier)...');

  let progressEvents: number[] = [];
  let downloadedBytesReported = 0;

  const lightResult = await LocalAIModelService.startDownload('light', (progress, downloaded, total) => {
    progressEvents.push(progress);
    downloadedBytesReported = downloaded;
  });

  assert(lightResult.downloadState === 'downloaded', 'Light model successfully downloaded');
  assert(lightResult.downloadProgress === 1.0, 'Progress reached 100%');
  assert(progressEvents.length > 0, 'Progress callbacks were triggered during download');
  assert(downloadedBytesReported > 0, 'Downloaded bytes reported');
  assert(!!lightResult.localPath, 'Local path is populated with downloaded file');

  const lightStatus = await LocalAIModelService.checkModelStatus('light');
  assert(lightStatus.downloadState === 'downloaded', 'checkModelStatus confirms light is downloaded on disk');

  // ─────────────────────────────────────────────────────────────
  // 4. Download Execution for Tier 'medium' & 'deep'
  // ─────────────────────────────────────────────────────────────
  console.log('\n📥 4. Testing Download Execution for Medium & Deep Tiers...');

  const mediumResult = await LocalAIModelService.startDownload('medium');
  assert(mediumResult.downloadState === 'downloaded', 'Medium model successfully downloaded');

  const deepResult = await LocalAIModelService.startDownload('deep');
  assert(deepResult.downloadState === 'downloaded', 'Deep model successfully downloaded');

  const allDownloaded = await LocalAIModelService.checkAllTiersStatus();
  assert(allDownloaded.light.downloadState === 'downloaded', 'All tiers check: light is downloaded');
  assert(allDownloaded.medium.downloadState === 'downloaded', 'All tiers check: medium is downloaded');
  assert(allDownloaded.deep.downloadState === 'downloaded', 'All tiers check: deep is downloaded');

  // ─────────────────────────────────────────────────────────────
  // 5. Storage Stats Calculation
  // ─────────────────────────────────────────────────────────────
  console.log('\n📊 5. Testing Storage Statistics with 3 Downloaded Models...');

  const stats = await LocalAIModelService.getStorageStats();
  assert(stats.modelCount === 3, `Model count is 3 (got ${stats.modelCount})`);
  assert(stats.totalBytes > 0, `Total bytes > 0 (${stats.formattedSize})`);

  // ─────────────────────────────────────────────────────────────
  // 6. Active Tier Selection & Persistence
  // ─────────────────────────────────────────────────────────────
  console.log('\n⚙️ 6. Testing Active Tier Switching & Persistence...');

  await LocalAIModelService.setActiveTier('deep');
  let active = await LocalAIModelService.getActiveTier();
  assert(active === 'deep', 'Active tier switched to deep');

  await LocalAIModelService.setActiveTier('light');
  active = await LocalAIModelService.getActiveTier();
  assert(active === 'light', 'Active tier switched to light');

  // ─────────────────────────────────────────────────────────────
  // 7. Deletion & Disk Cleanup
  // ─────────────────────────────────────────────────────────────
  console.log('\n🗑️ 7. Testing Individual Model Deletion & Disk Cleanup...');

  await LocalAIModelService.deleteModelFile('light');
  const postDeleteLight = await LocalAIModelService.checkModelStatus('light');
  assert(postDeleteLight.downloadState === 'not_downloaded', 'Light model state reset to not_downloaded');
  assert(postDeleteLight.localPath === undefined, 'Light model localPath cleared');

  const statsAfterOneDelete = await LocalAIModelService.getStorageStats();
  assert(statsAfterOneDelete.modelCount === 2, `Model count updated to 2 after deletion (got ${statsAfterOneDelete.modelCount})`);

  // ─────────────────────────────────────────────────────────────
  // 8. Disk Space Verification (Pre-flight Check)
  // ─────────────────────────────────────────────────────────────
  console.log('\n💾 8. Testing Pre-download Disk Space Check...');

  // Set free disk space to only 10 MB (insufficient for any model)
  setMockFreeDiskStorageBytes(10 * 1024 * 1024);

  let caughtDiskError = false;
  try {
    await LocalAIModelService.startDownload('light');
  } catch (err: any) {
    caughtDiskError = true;
    assert(err.message.includes('Espaço insuficiente'), `Error message indicates insufficient space: ${err.message}`);
  }
  assert(caughtDiskError, 'startDownload threw error when disk space is insufficient');

  const statusAfterFailedSpace = await LocalAIModelService.checkModelStatus('light');
  assert(statusAfterFailedSpace.downloadState === 'error', 'Model state marked as error on failed disk check');
  assert(!!statusAfterFailedSpace.errorMessage, 'Error message stored in model status');

  // Restore ample disk space (10 GB)
  setMockFreeDiskStorageBytes(10 * 1024 * 1024 * 1024);

  // ─────────────────────────────────────────────────────────────
  // 9. Pedagogical Tutor Prompts & Local Inference Dispatching
  // ─────────────────────────────────────────────────────────────
  console.log('\n🧠 9. Testing Tutor Pedagogical Prompts & Local Edge Dispatcher...');

  const socraticPrompt = LocalAIModelService.getTutorSystemPrompt('socratic', 'Física Quântica');
  assert(socraticPrompt.includes('Física Quântica'), 'Prompt context includes subject name');
  assert(socraticPrompt.includes('Método Socrático'), 'Prompt specifies Socratic method');
  assert(socraticPrompt.includes('NUNCA dê a resposta final'), 'Prompt includes anti-spoiler rule');

  const directPrompt = LocalAIModelService.getTutorSystemPrompt('direct', 'Álgebra Linear');
  assert(directPrompt.includes('Resolução Direta'), 'Prompt specifies Direct resolution');
  assert(directPrompt.includes('passo a passo'), 'Prompt requires step-by-step resolution');

  // 9a. Test fallback when active tier ('light') is not downloaded
  const localAIConfig: AIConfig = {
    provider: 'gemini',
    mode: 'local_edge',
    apiKey: '',
  };

  const fallbackResult = await LocalAIInferenceService.parseUniversalInput(
    {
      rawText: 'Aviso: Amanhã dia 2026-09-10 não teremos aula de Cálculo 1 devido ao congresso.',
      sourceType: 'whatsapp',
    },
    localAIConfig,
    {
      currentDate: '2026-09-09',
      currentDayOfWeek: 'Quarta-feira',
      registeredSubjects: ['Cálculo 1', 'Física I']
    }
  );
  assert(fallbackResult.sourceMode === 'heuristic_offline', 'Falls back to heuristic_offline when active tier model is missing');

  // 9b. Switch active tier to 'medium' (which is downloaded on disk)
  await LocalAIModelService.setActiveTier('medium');
  const activeStatus = await LocalAIModelService.checkModelStatus();
  assert(activeStatus.downloadState === 'downloaded', 'Medium tier is verified as downloaded on disk');

  const parsingResult = await LocalAIInferenceService.parseUniversalInput(
    {
      rawText: 'Aviso: Amanhã dia 2026-09-10 não teremos aula de Cálculo 1 devido ao congresso.',
      sourceType: 'whatsapp',
    },
    localAIConfig,
    {
      currentDate: '2026-09-09',
      currentDayOfWeek: 'Quarta-feira',
      registeredSubjects: ['Cálculo 1', 'Física I']
    }
  );

  assert(parsingResult.items.length === 1, 'Local edge extracted 1 event');
  assert(parsingResult.items[0].intent === 'cancelled_class', 'Intent correctly identified as cancelled_class');
  assert(parsingResult.sourceMode === 'local_edge', 'Source mode correctly reported as local_edge with downloaded model');

  console.log('\n======================================================');
  console.log('🎉 ALL 3-TIER LOCAL AI GGUF TESTS PASSED (100%)');
  console.log('======================================================\n');
}

run3TierSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
