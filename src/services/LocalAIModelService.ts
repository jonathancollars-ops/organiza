import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalAIModelInfo, LocalModelDownloadState } from '../types';

const MODEL_INFO_STORAGE_KEY = '@organiza_local_ai_model_info';

export const DEFAULT_OFFLINE_MODEL: LocalAIModelInfo = {
  id: 'gemma-2b-it-cpu-int4',
  name: 'Google Gemma 2B (AI Edge)',
  filename: 'gemma-2b-it-cpu-int4.bin',
  description: 'Modelo oficial do Google AI Edge otimizado para smartphones com 100% de privacidade e funcionamento offline.',
  sizeBytes: 1280000000, // ~1.28 GB
  formattedSize: '1.28 GB',
  downloadUrl: 'https://storage.googleapis.com/mediapipe-models/llm_inference/gemma-2b-it-cpu-int4.bin',
  downloadState: 'not_downloaded',
  downloadProgress: 0,
  downloadedBytes: 0,
};

export class LocalAIModelService {
  private static activeDownload: any = null;
  private static isSimulatingDownload = false;

  /**
   * Returns the app's internal sandboxed models directory.
   * Files stored here are automatically wiped by Android/iOS when the app is uninstalled.
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
   * Checks the status and size of the on-device AI model file.
   */
  static async checkModelStatus(): Promise<LocalAIModelInfo> {
    let savedInfo = await this.getSavedModelInfo();
    const filePath = this.getModelFilePath(savedInfo.filename);

    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (fileInfo.exists && !fileInfo.isDirectory) {
        const size = (fileInfo as any).size || savedInfo.sizeBytes;
        savedInfo = {
          ...savedInfo,
          downloadState: 'downloaded',
          downloadProgress: 1.0,
          downloadedBytes: size,
          localPath: filePath,
          lastUpdated: new Date().toISOString()
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
      // In test or non-native environment, fallback to saved info
      if (!savedInfo.localPath && savedInfo.downloadState === 'downloaded') {
        savedInfo.localPath = filePath;
      }
    }

    await this.saveModelInfo(savedInfo);
    return savedInfo;
  }

  /**
   * Starts or resumes downloading the on-device model file into the sandbox.
   */
  static async startDownload(
    onProgress?: (progress: number, downloadedBytes: number, totalBytes: number) => void
  ): Promise<LocalAIModelInfo> {
    await this.ensureDirectoryExists();
    const filePath = this.getModelFilePath();
    const modelInfo = await this.checkModelStatus();

    if (modelInfo.downloadState === 'downloaded') {
      return modelInfo;
    }

    modelInfo.downloadState = 'downloading';
    modelInfo.downloadProgress = 0;
    modelInfo.downloadedBytes = 0;
    await this.saveModelInfo(modelInfo);

    try {
      const callback = (progressData: FileSystem.DownloadProgressData) => {
        const total = progressData.totalBytesExpectedToWrite > 0 
          ? progressData.totalBytesExpectedToWrite 
          : modelInfo.sizeBytes;
        const downloaded = progressData.totalBytesWritten;
        const progress = Math.min(downloaded / total, 1.0);

        modelInfo.downloadProgress = progress;
        modelInfo.downloadedBytes = downloaded;
        if (onProgress) {
          onProgress(progress, downloaded, total);
        }
      };

      this.activeDownload = FileSystem.createDownloadResumable(
        modelInfo.downloadUrl,
        filePath,
        {},
        callback
      );

      const downloadResult = await this.activeDownload.downloadAsync();
      this.activeDownload = null;

      if (downloadResult && downloadResult.uri) {
        modelInfo.downloadState = 'downloaded';
        modelInfo.downloadProgress = 1.0;
        modelInfo.downloadedBytes = modelInfo.sizeBytes;
        modelInfo.localPath = downloadResult.uri;
        modelInfo.lastUpdated = new Date().toISOString();
        await this.saveModelInfo(modelInfo);
        return modelInfo;
      } else {
        throw new Error('Download não retornou URI válida.');
      }
    } catch (error: any) {
      this.activeDownload = null;
      console.warn('Download do modelo de IA offline:', error?.message || error);
      
      // If network fails (or during simulation/test), provide helpful status
      modelInfo.downloadState = 'error';
      await this.saveModelInfo(modelInfo);
      throw error;
    }
  }

  /**
   * Cancels any active download in progress.
   */
  static async cancelDownload(): Promise<void> {
    if (this.activeDownload) {
      try {
        await this.activeDownload.cancelAsync();
      } catch (err) {
        console.warn('Erro ao cancelar download:', err);
      }
      this.activeDownload = null;
    }

    const info = await this.getSavedModelInfo();
    info.downloadState = 'not_downloaded';
    info.downloadProgress = 0;
    info.downloadedBytes = 0;
    await this.saveModelInfo(info);
  }

  /**
   * Deletes the on-device AI model from the sandbox storage to immediately free up phone space.
   */
  static async deleteModel(): Promise<void> {
    const filePath = this.getModelFilePath();
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    } catch (err) {
      console.warn('Erro ao deletar arquivo do modelo:', err);
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
   * Injects or attaches an externally downloaded local model file (e.g. from AI Edge Gallery / Downloads).
   */
  static async attachCustomModelFile(sourceUri: string, filename?: string): Promise<LocalAIModelInfo> {
    await this.ensureDirectoryExists();
    const finalFilename = filename || 'custom_model.bin';
    const targetPath = this.getModelFilePath(finalFilename);

    try {
      await FileSystem.copyAsync({
        from: sourceUri,
        to: targetPath
      });

      const fileInfo = await FileSystem.getInfoAsync(targetPath);
      const size = (fileInfo as any).size || 1200000000;

      const updatedInfo: LocalAIModelInfo = {
        ...DEFAULT_OFFLINE_MODEL,
        id: 'custom-local-model',
        name: 'Modelo Local Personalizado (AI Edge)',
        filename: finalFilename,
        sizeBytes: size,
        formattedSize: this.formatBytes(size),
        downloadState: 'downloaded',
        downloadProgress: 1.0,
        downloadedBytes: size,
        localPath: targetPath,
        lastUpdated: new Date().toISOString()
      };

      await this.saveModelInfo(updatedInfo);
      return updatedInfo;
    } catch (err: any) {
      console.error('Erro ao anexar arquivo de modelo:', err);
      throw new Error(`Falha ao carregar arquivo de modelo: ${err?.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Returns human-readable storage statistics for the on-device AI.
   */
  static async getStorageStats(): Promise<{ isInstalled: boolean; formattedSize: string; path?: string }> {
    const info = await this.checkModelStatus();
    return {
      isInstalled: info.downloadState === 'downloaded',
      formattedSize: info.downloadState === 'downloaded' ? info.formattedSize : '0 MB',
      path: info.localPath
    };
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
