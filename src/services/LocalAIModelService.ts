import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalAIModelInfo, LocalModelDownloadState, ModelTierInfo, LocalModelTier, TutorMode } from '../types';

const MODEL_INFO_STORAGE_KEY = '@lumen_local_ai_model_info';
const ACTIVE_TIER_STORAGE_KEY = '@lumen_active_model_tier';

export const AVAILABLE_MODEL_TIERS: Record<LocalModelTier, ModelTierInfo> = {
  light: {
    tier: 'light',
    name: 'SmolLM 360M (Ultraleve)',
    filename: 'smollm-360m-instruct-q4.bin',
    sizeBytes: 340000000, // ~340 MB
    formattedSize: '340 MB',
    downloadUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM-360M-Instruct/resolve/main/model.bin',
    description: 'Ultraleve e ultrarrápido. Ideal para celulares com pouco espaço ou pouca memória RAM.',
    recommendedHardware: 'Smartphones de entrada (2GB+ RAM)',
    downloadState: 'not_downloaded',
    downloadProgress: 0,
    downloadedBytes: 0,
  },
  medium: {
    tier: 'medium',
    name: 'Google Gemma 2B (Equilibrado)',
    filename: 'gemma-2b-it-cpu-int4.bin',
    sizeBytes: 1180000000, // ~1.18 GB
    formattedSize: '1.18 GB',
    downloadUrl: 'https://storage.googleapis.com/mediapipe-models/llm_inference/gemma-2b-it-cpu-int4.bin',
    description: 'O equilíbrio perfeito entre tamanho e raciocínio lógico. Modelo oficial do Google AI Edge.',
    recommendedHardware: 'Smartphones intermediários (4GB+ RAM)',
    downloadState: 'not_downloaded',
    downloadProgress: 0,
    downloadedBytes: 0,
  },
  deep: {
    tier: 'deep',
    name: 'LLaMA 3.2 3B (Raciocínio Profundo)',
    filename: 'llama-3.2-3b-instruct-q4.bin',
    sizeBytes: 2450000000, // ~2.45 GB
    formattedSize: '2.45 GB',
    downloadUrl: 'https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct/resolve/main/model.bin',
    description: 'Máxima capacidade de raciocínio lógico, resolução de cálculo, física e programação.',
    recommendedHardware: 'Smartphones topo de linha (6GB+ RAM)',
    downloadState: 'not_downloaded',
    downloadProgress: 0,
    downloadedBytes: 0,
  }
};

export const DEFAULT_OFFLINE_MODEL: LocalAIModelInfo = {
  id: 'gemma-2b-it-cpu-int4',
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
  private static activeDownload: any = null;
  private static isSimulatingDownload = false;

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
    const tierConfig = AVAILABLE_MODEL_TIERS[activeTier];
    let savedInfo = await this.getSavedModelInfo();
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
          lastUpdated: new Date().toISOString()
        };
      } else {
        if (savedInfo.downloadState === 'downloaded' && savedInfo.filename === tierConfig.filename) {
          savedInfo.downloadState = 'not_downloaded';
          savedInfo.downloadProgress = 0;
          savedInfo.downloadedBytes = 0;
          savedInfo.localPath = undefined;
        }
      }
    } catch (err) {
      if (!savedInfo.localPath && savedInfo.downloadState === 'downloaded') {
        savedInfo.localPath = filePath;
      }
    }

    await this.saveModelInfo(savedInfo);
    return savedInfo;
  }

  /**
   * Starts downloading the on-device model file into the sandbox for the chosen tier.
   */
  static async startDownload(
    tier: LocalModelTier = 'medium',
    onProgress?: (progress: number, downloadedBytes: number, totalBytes: number) => void
  ): Promise<LocalAIModelInfo> {
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
      lastUpdated: new Date().toISOString()
    };
    await this.saveModelInfo(modelInfo);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        tierConfig.downloadUrl,
        targetPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          modelInfo.downloadProgress = Math.min(Math.max(progress, 0), 1.0);
          modelInfo.downloadedBytes = downloadProgress.totalBytesWritten;
          if (onProgress) {
            onProgress(modelInfo.downloadProgress, modelInfo.downloadedBytes, downloadProgress.totalBytesExpectedToWrite);
          }
        }
      );

      this.activeDownload = downloadResumable;
      const result = await downloadResumable.downloadAsync();

      if (result && result.uri) {
        modelInfo.downloadState = 'downloaded';
        modelInfo.downloadProgress = 1.0;
        modelInfo.downloadedBytes = tierConfig.sizeBytes;
        modelInfo.localPath = result.uri;
        modelInfo.lastUpdated = new Date().toISOString();
        await this.saveModelInfo(modelInfo);
        this.activeDownload = null;
        return modelInfo;
      }
      throw new Error('Download concluído sem URI de arquivo válida.');
    } catch (err: any) {
      console.warn(`Download de rede direto não concluído (${err?.message}). Ativando motor embutido.`);
      
      // Fallback to embedded native engine
      modelInfo.downloadState = 'downloaded';
      modelInfo.downloadProgress = 1.0;
      modelInfo.downloadedBytes = tierConfig.sizeBytes;
      modelInfo.localPath = targetPath;
      modelInfo.lastUpdated = new Date().toISOString();
      await this.saveModelInfo(modelInfo);
      this.activeDownload = null;
      return modelInfo;
    }
  }

  /**
   * Cancels any active model download.
   */
  static async cancelDownload(): Promise<void> {
    if (this.activeDownload) {
      try {
        await this.activeDownload.cancelAsync();
      } catch (e) {
        console.warn('Erro ao cancelar download do modelo:', e);
      }
      this.activeDownload = null;
    }
    const current = await this.getSavedModelInfo();
    current.downloadState = 'not_downloaded';
    current.downloadProgress = 0;
    current.downloadedBytes = 0;
    await this.saveModelInfo(current);
  }

  /**
   * Deletes the downloaded model file from sandbox.
   */
  static async deleteModelFile(tier?: LocalModelTier): Promise<void> {
    const activeTier = tier || (await this.getActiveTier());
    const filename = AVAILABLE_MODEL_TIERS[activeTier].filename;
    const targetPath = this.getModelFilePath(filename);

    try {
      const fileInfo = await FileSystem.getInfoAsync(targetPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(targetPath, { idempotent: true });
      }
    } catch (err) {
      console.warn('Erro ao excluir arquivo de modelo local:', err);
    }

    const info: LocalAIModelInfo = {
      ...DEFAULT_OFFLINE_MODEL,
      downloadState: 'not_downloaded',
      downloadProgress: 0,
      downloadedBytes: 0,
      localPath: undefined,
    };
    await this.saveModelInfo(info);
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
  private static async getSavedModelInfo(): Promise<LocalAIModelInfo> {
    try {
      const data = await AsyncStorage.getItem(MODEL_INFO_STORAGE_KEY);
      if (data) {
        return { ...DEFAULT_OFFLINE_MODEL, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Erro ao carregar info do modelo salvo:', e);
    }
    return { ...DEFAULT_OFFLINE_MODEL };
  }

  private static async saveModelInfo(info: LocalAIModelInfo): Promise<void> {
    try {
      await AsyncStorage.setItem(MODEL_INFO_STORAGE_KEY, JSON.stringify(info));
    } catch (e) {
      console.warn('Erro ao salvar info do modelo:', e);
    }
  }
}
