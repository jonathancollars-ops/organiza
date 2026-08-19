import { TeamsMessage } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = '@organiza_sheets_last_sync';
const SHEET_URL_KEY = '@organiza_sheets_url';

export interface GoogleSheetsConfig {
  spreadsheetUrl: string; // The published CSV URL
  isConnected: boolean;
  lastSync?: string;
}

export class GoogleSheetsService {
  /**
   * Extracts the spreadsheet ID from various Google Sheets URL formats.
   */
  static extractSpreadsheetId(url: string): string | null {
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

    const newMessages = allMessages.filter(msg => {
      try {
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
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRecord.push(currentField);
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') {
          i++;
        }
        currentRecord.push(currentField);
        currentField = '';
        if (currentRecord.length > 1 || (currentRecord.length === 1 && currentRecord[0].trim().length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentRecord.length > 0) {
      currentRecord.push(currentField);
      if (currentRecord.length > 1 || (currentRecord.length === 1 && currentRecord[0].trim().length > 0)) {
        records.push(currentRecord);
      }
    }

    return records;
  }

  /**
   * Parses CSV text into TeamsMessage objects.
   */
  private static parseCsv(csvText: string): TeamsMessage[] {
    const rows = this.parseCsvRecords(csvText);
    if (rows.length <= 1) return []; // Only header or empty

    const messages: TeamsMessage[] = [];

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      try {
        const fields = rows[i];
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
   * Parses a single CSV line handling quoted fields with commas.
   */
  private static parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current); // Last field
    return fields;
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

  static async getSheetsConfig(): Promise<GoogleSheetsConfig | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(SHEET_URL_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch {
      return null;
    }
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
