import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalAIModelInfo, LocalModelDownloadState, ModelTierInfo, LocalModelTier, TutorMode } from '../types';

const MODEL_INFO_STORAGE_PREFIX = '@lumen_local_ai_model_info_';
const ACTIVE_TIER_STORAGE_KEY = '@lumen_active_model_tier';

export const AVAILABLE_MODEL_TIERS: Record<LocalModelTier, ModelTierInfo> = {
  light: {
    tier: 'light',
    name: 'Qwen 2.5 0.5B (Ultraleve GGUF)',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeBytes: 491400032, // ~468 MB (491.4 MB)
    formattedSize: '468 MB',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    description: 'Ultraleve e ágil. Perfeito para dispositivos mais modestos ou com pouco armazenamento livre.',
    recommendedHardware: 'Smartphones de entrada (2GB+ RAM)',
    downloadState: 'not_downloaded',
    downloadProgress: 0,
    downloadedBytes: 0,
  },
  medium: {
    tier: 'medium',
    name: 'Qwen 2.5 1.5B (Equilibrado GGUF)',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1117320736, // ~1.04 GB (1.12 GB)
    formattedSize: '1.04 GB',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    description: 'Equilíbrio ideal entre velocidade, tamanho e capacidade de extração e resposta acadêmica.',
    recommendedHardware: 'Smartphones intermediários (3GB-4GB RAM)',
    downloadState: 'not_downloaded',
    downloadProgress: 0,
    downloadedBytes: 0,
  },
  deep: {
    tier: 'deep',
    name: 'LLaMA 3.2 3B (Raciocínio Avançado GGUF)',
    filename: 'llama-3.2-3b-instruct-q4_k_m.gguf',
    sizeBytes: 2019377696, // ~1.88 GB (2.02 GB)
    formattedSize: '1.88 GB',
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    description: 'Máxima capacidade de raciocínio lógico, resolução de cálculo, física e método socrático.',
    recommendedHardware: 'Smartphones topo de linha (6GB+ RAM)',
    downloadState: 'not_downloaded',
    downloadProgress: 0,
    downloadedBytes: 0,
  }
};

export const DEFAULT_OFFLINE_MODEL: LocalAIModelInfo = {
  id: AVAILABLE_MODEL_TIERS.medium.filename,
  name: AVAILABLE_MODEL_TIERS.medium.name,
  filename: AVAILABLE_MODEL_TIERS.medium.filename,
  description: AVAILABLE_MODEL_TIERS.medium.description,
  sizeBytes: AVAILABLE_MODEL_TIERS.medium.sizeBytes,
  formattedSize: AVAILABLE_MODEL_TIERS.medium.formattedSize,
  downloadUrl: AVAILABLE_MODEL_TIERS.medium.downloadUrl,
  downloadState: 'not_downloaded',
  downloadProgress: 0,
  downloadedBytes: 0,
};

export class LocalAIModelService {
  private static activeDownloads: Record<string, any> = {};

  /**
   * Returns the app's internal sandboxed models directory.
   */
  static getModelDirectory(): string {
    const docDir = FileSystem.documentDirectory || '';
    return `${docDir}models/`;
  }

  /**
   * Returns the absolute path of the model file inside the sandbox.
   */
  static getModelFilePath(filename: string = DEFAULT_OFFLINE_MODEL.filename): string {
    return `${this.getModelDirectory()}${filename}`;
  }

  /**
   * Ensures the models directory exists inside the app sandbox.
   */
  static async ensureDirectoryExists(): Promise<void> {
    try {
      const dir = this.getModelDirectory();
      if (!dir) return;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    } catch (err) {
      console.warn('Erro ao verificar/criar diretório de modelos:', err);
    }
  }

  /**
   * Gets the active model tier chosen by the user.
   */
  static async getActiveTier(): Promise<LocalModelTier> {
    try {
      const tier = await AsyncStorage.getItem(ACTIVE_TIER_STORAGE_KEY);
      if (tier && (tier === 'light' || tier === 'medium' || tier === 'deep')) {
        return tier as LocalModelTier;
      }
    } catch (e) {
      console.warn('Erro ao carregar nível de modelo ativo:', e);
    }
    return 'medium';
  }

  /**
   * Sets the active model tier.
   */
  static async setActiveTier(tier: LocalModelTier): Promise<void> {
    try {
      await AsyncStorage.setItem(ACTIVE_TIER_STORAGE_KEY, tier);
    } catch (e) {
      console.error('Erro ao salvar nível de modelo ativo:', e);
    }
  }

  /**
   * Checks the status and size of the on-device AI model file for a given tier.
   */
  static async checkModelStatus(tier?: LocalModelTier): Promise<LocalAIModelInfo> {
    const activeTier = tier || (await this.getActiveTier());
    const tierConfig = AVAILABLE_MODEL_TIERS[activeTier] || AVAILABLE_MODEL_TIERS.medium;
    let savedInfo = await this.getSavedModelInfo(activeTier);
    const filePath = this.getModelFilePath(tierConfig.filename);

    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (fileInfo.exists && !fileInfo.isDirectory) {
        const size = (fileInfo as any).size || tierConfig.sizeBytes;
        savedInfo = {
          id: tierConfig.filename,
          name: tierConfig.name,
          filename: tierConfig.filename,
          description: tierConfig.description,
          sizeBytes: tierConfig.sizeBytes,
          formattedSize: tierConfig.formattedSize,
          downloadUrl: tierConfig.downloadUrl,
          downloadState: 'downloaded',
          downloadProgress: 1.0,
          downloadedBytes: size,
          localPath: filePath,
          lastUpdated: savedInfo.lastUpdated || new Date().toISOString(),
          errorMessage: undefined
        };
      } else {
        if (savedInfo.downloadState === 'downloaded') {
          savedInfo.downloadState = 'not_downloaded';
          savedInfo.downloadProgress = 0;
          savedInfo.downloadedBytes = 0;
          savedInfo.localPath = undefined;
        }
      }
    } catch (err) {
      // In case of error checking file
    }

    await this.saveModelInfo(savedInfo, activeTier);
    return savedInfo;
  }

  /**
   * Checks the status and size of all 3 available model tiers in the app sandbox.
   */
  static async checkAllTiersStatus(): Promise<Record<LocalModelTier, LocalAIModelInfo>> {
    const results: Record<LocalModelTier, LocalAIModelInfo> = {} as any;
    const tiers: LocalModelTier[] = ['light', 'medium', 'deep'];

    for (const tier of tiers) {
      results[tier] = await this.checkModelStatus(tier);
    }

    return results;
  }

  /**
   * Starts downloading the on-device model file into the sandbox.
   * Supports both startDownload('medium', onProgress) and startDownload(onProgress).
   */
  static async startDownload(
    tierOrProgressCb?: LocalModelTier | ((progress: number, downloadedBytes: number, totalBytes: number) => void),
    onProgress?: (progress: number, downloadedBytes: number, totalBytes: number) => void
  ): Promise<LocalAIModelInfo> {
    let tier: LocalModelTier = 'medium';
    let progressCallback: ((progress: number, downloadedBytes: number, totalBytes: number) => void) | undefined = onProgress;

    if (typeof tierOrProgressCb === 'function') {
      progressCallback = tierOrProgressCb;
      tier = await this.getActiveTier();
    } else if (typeof tierOrProgressCb === 'string' && (tierOrProgressCb === 'light' || tierOrProgressCb === 'medium' || tierOrProgressCb === 'deep')) {
      tier = tierOrProgressCb;
    } else {
      tier = await this.getActiveTier();
    }

    await this.ensureDirectoryExists();
    await this.setActiveTier(tier);
    const tierConfig = AVAILABLE_MODEL_TIERS[tier];
    const targetPath = this.getModelFilePath(tierConfig.filename);

    let modelInfo: LocalAIModelInfo = {
      id: tierConfig.filename,
      name: tierConfig.name,
      filename: tierConfig.filename,
      description: tierConfig.description,
      sizeBytes: tierConfig.sizeBytes,
      formattedSize: tierConfig.formattedSize,
      downloadUrl: tierConfig.downloadUrl,
      downloadState: 'downloading',
      downloadProgress: 0,
      downloadedBytes: 0,
      lastUpdated: new Date().toISOString(),
      errorMessage: undefined
    };
    await this.saveModelInfo(modelInfo, tier);

    // 1. Verify available disk storage
    try {
      if (typeof (FileSystem as any).getFreeDiskStorageAsync === 'function') {
        const freeBytes = await (FileSystem as any).getFreeDiskStorageAsync();
        const requiredBytes = tierConfig.sizeBytes + (50 * 1024 * 1024); // 50MB buffer
        if (typeof freeBytes === 'number' && freeBytes > 0 && freeBytes < requiredBytes) {
          const errMessage = `Espaço insuficiente no dispositivo. Necessário ${this.formatBytes(requiredBytes)}, disponível ${this.formatBytes(freeBytes)}.`;
          modelInfo.downloadState = 'error';
          modelInfo.errorMessage = errMessage;
          await this.saveModelInfo(modelInfo, tier);
          throw new Error(errMessage);
        }
      }
    } catch (diskErr: any) {
      if (diskErr?.message?.includes('Espaço insuficiente')) {
        throw diskErr;
      }
    }

    // 2. Perform resumable download
    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        tierConfig.downloadUrl,
        targetPath,
        {},
        (downloadProgress) => {
          const expectedTotal = downloadProgress.totalBytesExpectedToWrite > 0
            ? downloadProgress.totalBytesExpectedToWrite
            : tierConfig.sizeBytes;
          const progress = expectedTotal > 0 ? downloadProgress.totalBytesWritten / expectedTotal : 0;
          modelInfo.downloadProgress = Math.min(Math.max(progress, 0), 1.0);
          modelInfo.downloadedBytes = downloadProgress.totalBytesWritten;
          if (progressCallback) {
            progressCallback(modelInfo.downloadProgress, modelInfo.downloadedBytes, expectedTotal);
          }
        }
      );

      this.activeDownloads[tier] = downloadResumable;
      const result = await downloadResumable.downloadAsync();

      if (result && result.uri) {
        // Confirm file actually exists on disk
        const fileInfo = await FileSystem.getInfoAsync(targetPath);
        if (fileInfo.exists && !fileInfo.isDirectory) {
          modelInfo.downloadState = 'downloaded';
          modelInfo.downloadProgress = 1.0;
          modelInfo.downloadedBytes = (fileInfo as any).size || tierConfig.sizeBytes;
          modelInfo.localPath = result.uri;
          modelInfo.errorMessage = undefined;
          modelInfo.lastUpdated = new Date().toISOString();
          await this.saveModelInfo(modelInfo, tier);
          delete this.activeDownloads[tier];
          return modelInfo;
        }
      }
      throw new Error('Arquivo de modelo não foi gravado corretamente no disco.');
    } catch (err: any) {
      console.warn(`Erro no download do modelo ${tier}:`, err?.message);
      modelInfo.downloadState = 'error';
      modelInfo.downloadProgress = 0;
      modelInfo.downloadedBytes = 0;
      modelInfo.localPath = undefined;
      modelInfo.errorMessage = err?.message || 'Falha na transferência do modelo de IA.';
      await this.saveModelInfo(modelInfo, tier);
      delete this.activeDownloads[tier];
      throw err;
    }
  }

  /**
   * Pauses an active download.
   */
  static async pauseDownload(tier?: LocalModelTier): Promise<void> {
    const activeTier = tier || (await this.getActiveTier());
    const download = this.activeDownloads[activeTier];
    if (download && typeof download.pauseAsync === 'function') {
      try {
        await download.pauseAsync();
      } catch (e) {
        console.warn('Erro ao pausar download:', e);
      }
    }
    const current = await this.getSavedModelInfo(activeTier);
    current.downloadState = 'paused';
    await this.saveModelInfo(current, activeTier);
  }

  /**
   * Cancels any active model download.
   */
  static async cancelDownload(tier?: LocalModelTier): Promise<void> {
    const activeTier = tier || (await this.getActiveTier());
    const download = this.activeDownloads[activeTier];
    if (download) {
      try {
        await download.cancelAsync();
      } catch (e) {
        console.warn('Erro ao cancelar download do modelo:', e);
      }
      delete this.activeDownloads[activeTier];
    }
    const current = await this.getSavedModelInfo(activeTier);
    current.downloadState = 'not_downloaded';
    current.downloadProgress = 0;
    current.downloadedBytes = 0;
    current.errorMessage = undefined;
    await this.saveModelInfo(current, activeTier);
  }

  /**
   * Deletes the downloaded model file from sandbox.
   */
  static async deleteModelFile(tier?: LocalModelTier): Promise<void> {
    const activeTier = tier || (await this.getActiveTier());
    const filename = AVAILABLE_MODEL_TIERS[activeTier]?.filename || DEFAULT_OFFLINE_MODEL.filename;
    const targetPath = this.getModelFilePath(filename);

    if (this.activeDownloads[activeTier]) {
      await this.cancelDownload(activeTier);
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(targetPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(targetPath, { idempotent: true });
      }
    } catch (err) {
      console.warn('Erro ao excluir arquivo de modelo local:', err);
    }

    const tierConfig = AVAILABLE_MODEL_TIERS[activeTier] || AVAILABLE_MODEL_TIERS.medium;
    const info: LocalAIModelInfo = {
      id: tierConfig.filename,
      name: tierConfig.name,
      filename: tierConfig.filename,
      description: tierConfig.description,
      sizeBytes: tierConfig.sizeBytes,
      formattedSize: tierConfig.formattedSize,
      downloadUrl: tierConfig.downloadUrl,
      downloadState: 'not_downloaded',
      downloadProgress: 0,
      downloadedBytes: 0,
      localPath: undefined,
      errorMessage: undefined,
    };
    await this.saveModelInfo(info, activeTier);
  }

  /**
   * Alias for deleteModelFile for backwards compatibility.
   */
  static async deleteModel(tier?: LocalModelTier): Promise<void> {
    return this.deleteModelFile(tier);
  }

  /**
   * Returns storage statistics for all models in the sandbox.
   */
  static async getStorageStats(): Promise<{ totalBytes: number; formattedSize: string; modelCount: number }> {
    const allStatuses = await this.checkAllTiersStatus();
    let totalBytes = 0;
    let modelCount = 0;

    for (const tier of Object.keys(allStatuses) as LocalModelTier[]) {
      const status = allStatuses[tier];
      if (status.downloadState === 'downloaded' && status.downloadedBytes > 0) {
        totalBytes += status.downloadedBytes;
        modelCount += 1;
      }
    }

    return {
      totalBytes,
      formattedSize: this.formatBytes(totalBytes),
      modelCount
    };
  }

  /**
   * Formats pedagogical system prompts for the Tutor AI based on the chosen mode.
   */
  static getTutorSystemPrompt(mode: TutorMode, subjectName?: string): string {
    const subjectContext = subjectName ? `Você é o professor tutor universitário da disciplina de "${subjectName}".` : 'Você é o professor tutor universitário oficial do estudante no aplicativo Lumen.';

    if (mode === 'socratic') {
      return `${subjectContext}
SUA METODOLOGIA: Método Socrático e Pedagógico.
REGRAS OBRIGATÓRIAS:
1. NUNCA dê a resposta final de um problema ou exercício diretamente na primeira mensagem.
2. Em vez disso, guie o estudante fazendo 1 ou 2 perguntas reflexivas e relembrando os conceitos teóricos essenciais (fórmulas, teoremas ou passos iniciais).
3. Seja encorajador, claro, paciente e didático.
4. Quando o estudante responder ou demonstrar o raciocínio correto, valide e incentive o próximo passo até a conclusão.`;
    }

    return `${subjectContext}
SUA METODOLOGIA: Modo Resolução Direta e Objetiva.
REGRAS OBRIGATÓRIAS:
1. Apresente a resolução completa, clara e detalhada passo a passo com formatação matemática elegante.
2. Destaque os teoremas, fórmulas e raciocínio lógico utilizado.
3. Conclua com o resultado final destacado e uma dica prática de fixação para provas.`;
  }

  /**
   * Helper to format raw bytes into MB / GB.
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 MB';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Persistence helpers
  private static async getSavedModelInfo(tier: LocalModelTier = 'medium'): Promise<LocalAIModelInfo> {
    const tierConfig = AVAILABLE_MODEL_TIERS[tier] || AVAILABLE_MODEL_TIERS.medium;
    const defaultInfo: LocalAIModelInfo = {
      id: tierConfig.filename,
      name: tierConfig.name,
      filename: tierConfig.filename,
      description: tierConfig.description,
      sizeBytes: tierConfig.sizeBytes,
      formattedSize: tierConfig.formattedSize,
      downloadUrl: tierConfig.downloadUrl,
      downloadState: 'not_downloaded',
      downloadProgress: 0,
      downloadedBytes: 0,
    };

    try {
      const data = await AsyncStorage.getItem(`${MODEL_INFO_STORAGE_PREFIX}${tier}`);
      if (data) {
        return { ...defaultInfo, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Erro ao carregar info do modelo salvo:', e);
    }
    return defaultInfo;
  }

  private static async saveModelInfo(info: LocalAIModelInfo, tier: LocalModelTier = 'medium'): Promise<void> {
    try {
      await AsyncStorage.setItem(`${MODEL_INFO_STORAGE_PREFIX}${tier}`, JSON.stringify(info));
    } catch (e) {
      console.warn('Erro ao salvar info do modelo:', e);
    }
  }
}
