import { TeamsConfig, TeamsMessage } from '../types';

export interface JoinedTeam {
  id: string;
  displayName: string;
  description?: string;
}

export interface TeamChannel {
  id: string;
  displayName: string;
  description?: string;
}

export class TeamsService {
  private static readonly GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
  private static readonly DEFAULT_REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
  private static readonly SCOPES = 'offline_access User.Read Team.ReadBasic.All Channel.ReadBasic.All ChannelMessage.Read.All';

  /**
   * Generates the Azure AD OAuth2 authorization URL.
   */
  static getAuthUrl(
    clientId: string,
    tenantId: string = 'common',
    redirectUri: string = TeamsService.DEFAULT_REDIRECT_URI
  ): string {
    const cleanTenant = tenantId.trim() || 'common';
    const params = new URLSearchParams({
      client_id: clientId.trim(),
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: TeamsService.SCOPES
    });
    return `https://login.microsoftonline.com/${encodeURIComponent(cleanTenant)}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   */
  static async exchangeCodeForToken(
    clientId: string,
    code: string,
    redirectUri: string = TeamsService.DEFAULT_REDIRECT_URI,
    tenantId: string = 'common',
    codeVerifier?: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    const cleanTenant = tenantId.trim() || 'common';
    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(cleanTenant)}/oauth2/v2.0/token`;

    const bodyParams: Record<string, string> = {
      client_id: clientId.trim(),
      scope: TeamsService.SCOPES,
      code: code.trim(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    };

    if (codeVerifier) {
      bodyParams.code_verifier = codeVerifier;
    }

    const formBody = Object.keys(bodyParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(bodyParams[key])}`)
      .join('&');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody,
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorDesc = errorData.error_description || errorData.error || response.statusText;
      throw new Error(`Falha na autenticação Microsoft (${response.status}): ${errorDesc}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600
    };
  }

  /**
   * Refreshes an expired access token using the stored refresh token.
   */
  static async refreshAccessToken(
    clientId: string,
    refreshToken: string,
    tenantId: string = 'common'
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    const cleanTenant = tenantId.trim() || 'common';
    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(cleanTenant)}/oauth2/v2.0/token`;

    const bodyParams: Record<string, string> = {
      client_id: clientId.trim(),
      scope: TeamsService.SCOPES,
      refresh_token: refreshToken.trim(),
      grant_type: 'refresh_token'
    };

    const formBody = Object.keys(bodyParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(bodyParams[key])}`)
      .join('&');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody,
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorDesc = errorData.error_description || errorData.error || response.statusText;
      throw new Error(`Falha ao renovar token Microsoft (${response.status}): ${errorDesc}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in || 3600
    };
  }

  /**
   * Checks if the access token is expired or will expire within 5 minutes.
   */
  static isTokenExpired(config: TeamsConfig): boolean {
    if (!config.accessToken || !config.expiresAt) {
      return true;
    }
    const safetyBufferMs = 5 * 60 * 1000; // 5 minutes
    return Date.now() >= (config.expiresAt - safetyBufferMs);
  }

  /**
   * Returns a valid access token, automatically refreshing it if necessary.
   */
  static async getValidAccessToken(
    config: TeamsConfig,
    onTokenRefreshed?: (updatedConfig: TeamsConfig) => Promise<void>
  ): Promise<string> {
    if (!TeamsService.isTokenExpired(config) && config.accessToken) {
      return config.accessToken;
    }

    if (!config.refreshToken) {
      throw new Error('Token Microsoft Teams expirado e nenhum refresh token disponível. Por favor, conecte-se novamente.');
    }

    const refreshed = await TeamsService.refreshAccessToken(
      config.clientId,
      config.refreshToken,
      config.tenantId
    );

    const updatedConfig: TeamsConfig = {
      ...config,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || config.refreshToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
      isConnected: true
    };

    if (onTokenRefreshed) {
      await onTokenRefreshed(updatedConfig);
    }

    return refreshed.accessToken;
  }

  /**
   * Fetches the list of joined teams for the user.
   */
  static async getJoinedTeams(accessToken: string): Promise<JoinedTeam[]> {
    const response = await fetch(`${TeamsService.GRAPH_BASE_URL}/me/joinedTeams`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado (401). Token Microsoft inválido ou expirado.');
      }
      throw new Error(`Erro ao buscar equipes do Teams (${response.status}): ${response.statusText}`);
    }

    const data = await response.json();
    return (data.value || []).map((t: any) => ({
      id: t.id,
      displayName: t.displayName || 'Equipe sem nome',
      description: t.description
    }));
  }

  /**
   * Fetches the channels of a specific team.
   */
  static async getChannels(accessToken: string, teamId: string): Promise<TeamChannel[]> {
    const response = await fetch(`${TeamsService.GRAPH_BASE_URL}/teams/${encodeURIComponent(teamId)}/channels`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar canais da equipe (${response.status}): ${response.statusText}`);
    }

    const data = await response.json();
    return (data.value || []).map((c: any) => ({
      id: c.id,
      displayName: c.displayName || 'Geral',
      description: c.description
    }));
  }

  /**
   * Fetches the most recent messages from a channel and sanitizes HTML content to plain text.
   */
  static async getChannelMessages(
    accessToken: string,
    teamId: string,
    channelId: string,
    top: number = 20
  ): Promise<TeamsMessage[]> {
    const url = `${TeamsService.GRAPH_BASE_URL}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages?$top=${top}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar mensagens do canal (${response.status}): ${response.statusText}`);
    }

    const data = await response.json();
    const rawMessages: any[] = data.value || [];

    return rawMessages
      .filter((m: any) => m && m.body && (m.body.content || '').trim().length > 0)
      .map((m: any) => {
        const rawContent = m.body?.content || '';
        const isHtml = m.body?.contentType === 'html';
        const sanitizedBody = isHtml ? TeamsService.sanitizeHtmlMessage(rawContent) : rawContent.trim();

        return {
          id: m.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          createdDateTime: m.createdDateTime || new Date().toISOString(),
          subject: m.subject || undefined,
          senderName: m.from?.user?.displayName || 'Professor / Colega',
          from: m.from,
          body: isHtml ? { content: sanitizedBody, contentType: 'html' } : { content: sanitizedBody, contentType: 'text' },
          cleanText: sanitizedBody,
          rawHtml: isHtml ? rawContent : undefined
        };
      });
  }

  /**
   * Strips HTML tags, decodes named & numeric HTML entities, and normalizes whitespace into clean plain text.
   */
  static sanitizeHtmlMessage(htmlOrText: string): string {
    if (!htmlOrText || typeof htmlOrText !== 'string') {
      return '';
    }

    let text = htmlOrText;

    // 1. Strip script and style blocks
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // 2. Convert block elements and linebreaks to newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote)>/gi, '\n');

    // 3. Remove all remaining tags
    text = text.replace(/<[^>]+>/g, '');

    // 4. Decode HTML entities
    const entities: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&#39;': "'",
      '&aacute;': 'á',
      '&eacute;': 'é',
      '&iacute;': 'í',
      '&oacute;': 'ó',
      '&uacute;': 'ú',
      '&atilde;': 'ã',
      '&otilde;': 'õ',
      '&ccedil;': 'ç',
      '&Aacute;': 'Á',
      '&Eacute;': 'É',
      '&Iacute;': 'Í',
      '&Oacute;': 'Ó',
      '&Uacute;': 'Ú',
      '&Atilde;': 'Ã',
      '&Otilde;': 'Õ',
      '&Ccedil;': 'Ç',
      '&agrave;': 'à',
      '&acirc;': 'â',
      '&ecirc;': 'ê',
      '&ocirc;': 'ô',
      '&Agrave;': 'À',
      '&Acirc;': 'Â',
      '&Ecirc;': 'Ê',
      '&Ocirc;': 'Ô'
    };

    for (const [entity, replacement] of Object.entries(entities)) {
      text = text.split(entity).join(replacement);
    }

    // Decode numeric decimal entities (e.g. &#225; -> á)
    text = text.replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    });

    // Decode numeric hex entities (e.g. &#xE1; -> á)
    text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });

    // 5. Normalize whitespace
    text = text.replace(/[\r\t\f\v]/g, ' ');
    text = text.replace(/[ ]+/g, ' ');
    
    // Trim per line and remove unnecessary blanks
    text = text
      .split('\n')
      .map(line => line.trim())
      .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
      .join('\n');

    // Collapse multiple consecutive newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  }
}
