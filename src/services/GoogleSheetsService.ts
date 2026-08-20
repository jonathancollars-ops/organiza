import {
  TeamsMessage,
  AppEvent,
  AttendanceRecord,
  Subject,
  AIConfig,
  AIParsedItem,
  GoogleSheetsConfig
} from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from './storage';
import { SyncService } from './SyncService';
import { NotificationService } from './notifications';
import { LocalAIInferenceService } from './LocalAIInferenceService';
import { getLocalDateString } from '../utils';

export { GoogleSheetsConfig };

const LAST_SYNC_KEY = '@organiza_sheets_last_sync';
const SHEET_URL_KEY = '@organiza_sheets_url';

export const DEFAULT_SHEETS_CONFIG: GoogleSheetsConfig = {
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing',
  isConnected: true,
  autoSyncEnabled: true,
  syncIntervalMinutes: 15
};

export class GoogleSheetsService {
  /**
   * Extracts the spreadsheet ID from various Google Sheets URL formats.
   */
  static extractSpreadsheetId(url: string): string | null {
    if (!url) return null;
    // Format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  /**
   * Builds the published CSV URL from a spreadsheet ID.
   */
  static buildCsvUrl(spreadsheetId: string, gid: string = '0'): string {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&cachebust=${Date.now()}`;
  }

  /**
   * Fetches and parses messages from a published Google Sheet.
   * Expected columns: timestamp | team_name | channel_name | sender | message
   */
  static async fetchMessages(spreadsheetUrl: string): Promise<TeamsMessage[]> {
    const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      throw new Error('URL da planilha inválida. Use o link de compartilhamento do Google Sheets.');
    }

    const csvUrl = this.buildCsvUrl(spreadsheetId);

    const response = await fetch(csvUrl, {
      headers: {
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Planilha não encontrada. Verifique se ela está publicada na web (Arquivo > Compartilhar > Publicar na Web).');
      }
      throw new Error(`Erro ao acessar a planilha (${response.status}): ${response.statusText}`);
    }

    const csvText = await response.text();
    return this.parseCsv(csvText);
  }

  /**
   * Robust timestamp parser supporting ISO formats and Brazilian date formats (DD/MM/YYYY HH:mm:ss).
   */
  public static parseTimestamp(ts: string): number {
    if (!ts) return 0;
    const trimmed = ts.trim();
    // Try ISO / standard JS date format first
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.getTime();

    // Try Brazilian date format: DD/MM/YYYY or DD/MM/YYYY HH:mm or DD/MM/YYYY HH:mm:ss
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (brMatch) {
      const [_, day, month, year, h = '0', m = '0', s = '0'] = brMatch;
      const parsedBrDate = new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m), Number(s));
      if (!isNaN(parsedBrDate.getTime())) return parsedBrDate.getTime();
    }
    return 0;
  }

  /**
   * Fetches only messages newer than the last sync timestamp.
   */
  static async fetchNewMessages(spreadsheetUrl: string): Promise<TeamsMessage[]> {
    const allMessages = await this.fetchMessages(spreadsheetUrl);
    const lastSync = await this.getLastSyncTimestamp();

    if (!lastSync) {
      // First sync: return all messages
      if (allMessages.length > 0) {
        await this.saveLastSyncTimestamp(allMessages[allMessages.length - 1].createdDateTime);
      }
      return allMessages;
    }

    const lastSyncTime = this.parseTimestamp(lastSync);

    const newMessages = allMessages.filter(msg => {
      try {
        const msgTime = this.parseTimestamp(msg.createdDateTime);
        if (msgTime > 0 && lastSyncTime > 0) {
          return msgTime > lastSyncTime;
        }
        return new Date(msg.createdDateTime) > new Date(lastSync);
      } catch {
        return true;
      }
    });

    if (newMessages.length > 0) {
      await this.saveLastSyncTimestamp(newMessages[newMessages.length - 1].createdDateTime);
    }

    return newMessages;
  }

  /**
   * Robust RFC 4180 compliant CSV parser.
   * Correctly handles quoted strings containing embedded commas, escaped quotes (""), and multiline newlines.
   */
  public static parseCsvRecords(csvText: string): string[][] {
    const records: string[][] = [];
    let currentRecord: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];

      if (char === '"') {
        if (inQuotes && i + 1 < csvText.length && csvText[i + 1] === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++; // Skip the next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field delimiter outside quotes
        currentRecord.push(currentField);
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        // Record delimiter outside quotes
        // Handle \r\n as a single delimiter
        if (char === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') {
          i++;
        }
        currentRecord.push(currentField);
        currentField = '';
        if (currentRecord.some(f => f.trim().length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
      } else {
        currentField += char;
      }
    }

    // Push trailing field/record if present
    if (currentField.length > 0 || currentRecord.length > 0) {
      currentRecord.push(currentField);
      if (currentRecord.some(f => f.trim().length > 0)) {
        records.push(currentRecord);
      }
    }

    return records;
  }

  /**
   * Parses CSV text into TeamsMessage objects using RFC 4180 parser.
   */
  private static parseCsv(csvText: string): TeamsMessage[] {
    const records = this.parseCsvRecords(csvText);
    if (records.length <= 1) return []; // Only header or empty

    const messages: TeamsMessage[] = [];

    // Skip header row (index 0)
    for (let i = 1; i < records.length; i++) {
      try {
        const fields = records[i];
        if (fields.length < 5) continue;

        const [timestamp, teamName, channelName, sender, ...messageParts] = fields;
        const messageContent = messageParts.join(',').trim();

        if (!messageContent) continue;

        messages.push({
          id: `sheet_${i}_${Date.now()}`,
          createdDateTime: timestamp?.trim() || new Date().toISOString(),
          subject: `${teamName?.trim()} - ${channelName?.trim()}`,
          body: { content: messageContent, contentType: 'text' },
          from: {
            user: {
              displayName: sender?.trim() || 'Professor',
            },
          },
          senderName: sender?.trim() || 'Professor',
          cleanText: messageContent,
        });
      } catch (err) {
        console.warn(`Erro ao processar linha ${i} da planilha:`, err);
        continue;
      }
    }

    return messages;
  }

  /**
   * Validates if a Google Sheets URL is accessible and has the expected format.
   */
  static async validateConnection(spreadsheetUrl: string): Promise<{ success: boolean; messageCount: number; error?: string }> {
    try {
      const messages = await this.fetchMessages(spreadsheetUrl);
      return { success: true, messageCount: messages.length };
    } catch (err: any) {
      return { success: false, messageCount: 0, error: err?.message || 'Erro desconhecido' };
    }
  }

  /**
   * Fully automated background sync with Google Sheets on app startup or timer.
   * Seamlessly downloads new class notices, triggers AI inference, updates attendances & calendar.
   */
  static async performAutoSync(
    currentEvents: AppEvent[],
    currentAttendances: AttendanceRecord[],
    currentSubjects: Subject[],
    aiConfig: AIConfig
  ): Promise<{
    hasUpdates: boolean;
    updatedEvents: AppEvent[];
    updatedAttendances: AttendanceRecord[];
    updatedSubjects: Subject[];
    newMessagesCount: number;
  }> {
    try {
      const config = await this.getSheetsConfig();
      if (!config.isConnected || !config.autoSyncEnabled || !config.spreadsheetUrl) {
        return {
          hasUpdates: false,
          updatedEvents: currentEvents,
          updatedAttendances: currentAttendances,
          updatedSubjects: currentSubjects,
          newMessagesCount: 0
        };
      }

      const newMessages = await this.fetchNewMessages(config.spreadsheetUrl);
      if (newMessages.length === 0) {
        return {
          hasUpdates: false,
          updatedEvents: currentEvents,
          updatedAttendances: currentAttendances,
          updatedSubjects: currentSubjects,
          newMessagesCount: 0
        };
      }

      const context = {
        currentDate: getLocalDateString(),
        currentDayOfWeek: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][new Date().getDay()],
        registeredSubjects: currentSubjects.map(s => s.name)
      };

      const parsedItems: AIParsedItem[] = [];
      for (const msg of newMessages) {
        const text = msg.cleanText || (typeof msg.body === 'object' ? msg.body.content : msg.body);
        if (text) {
          const res = await LocalAIInferenceService.parseUniversalInput(
            { rawText: text, sourceType: 'sheets', sender: msg.senderName },
            aiConfig,
            context
          );
          parsedItems.push(...res.items);
        }
      }

      if (parsedItems.length === 0) {
        return {
          hasUpdates: false,
          updatedEvents: currentEvents,
          updatedAttendances: currentAttendances,
          updatedSubjects: currentSubjects,
          newMessagesCount: newMessages.length
        };
      }

      const syncRes = await SyncService.processParsedItems(
        parsedItems,
        currentEvents,
        currentAttendances,
        currentSubjects
      );

      // Save updated records
      await StorageService.saveEvents(syncRes.updatedEvents);
      await StorageService.saveAttendances(syncRes.updatedAttendances);
      await StorageService.saveSubjects(syncRes.updatedSubjects);

      // Schedule alerts
      for (const ev of syncRes.syncResult.createdEvents) {
        await NotificationService.scheduleEventNotifications(ev);
      }

      return {
        hasUpdates: true,
        updatedEvents: syncRes.updatedEvents,
        updatedAttendances: syncRes.updatedAttendances,
        updatedSubjects: syncRes.updatedSubjects,
        newMessagesCount: newMessages.length
      };
    } catch (err) {
      console.warn('[GoogleSheets] Sincronização em segundo plano pulada:', err);
      return {
        hasUpdates: false,
        updatedEvents: currentEvents,
        updatedAttendances: currentAttendances,
        updatedSubjects: currentSubjects,
        newMessagesCount: 0
      };
    }
  }

  // Persistence helpers
  static async getLastSyncTimestamp(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(LAST_SYNC_KEY);
    } catch {
      return null;
    }
  }

  static async saveLastSyncTimestamp(timestamp: string): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_SYNC_KEY, timestamp);
    } catch (err) {
      console.error('Erro ao salvar timestamp de sincronização', err);
    }
  }

  static async getSheetsConfig(): Promise<GoogleSheetsConfig> {
    try {
      const jsonValue = await AsyncStorage.getItem(SHEET_URL_KEY);
      if (jsonValue != null) {
        const parsed = JSON.parse(jsonValue);
        return {
          spreadsheetUrl: parsed.spreadsheetUrl || DEFAULT_SHEETS_CONFIG.spreadsheetUrl,
          isConnected: parsed.isConnected !== false,
          autoSyncEnabled: parsed.autoSyncEnabled !== false,
          lastSync: parsed.lastSync,
          syncIntervalMinutes: parsed.syncIntervalMinutes || DEFAULT_SHEETS_CONFIG.syncIntervalMinutes
        };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SHEETS_CONFIG;
  }

  static async saveSheetsConfig(config: GoogleSheetsConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(SHEET_URL_KEY, JSON.stringify(config));
    } catch (err) {
      console.error('Erro ao salvar configuração da planilha', err);
    }
  }

  /**
   * Resets the sync state (useful for re-processing all messages).
   */
  static async resetSync(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_SYNC_KEY);
    } catch (err) {
      console.error('Erro ao resetar sincronização', err);
    }
  }
}
