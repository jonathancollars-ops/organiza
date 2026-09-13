import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { GeminiIntegrationService, GeminiActionResult } from '../services/GeminiIntegrationService';
import { SecuritySanitizer } from '../services/SecuritySanitizer';

export interface DeepLinkHandlerOptions {
  onActionExecuted?: () => void | Promise<void>;
  showAlert?: boolean;
}

export interface DeepLinkExecutionResult {
  handled: boolean;
  action?: string;
  result?: GeminiActionResult<unknown>;
}

/**
 * Normaliza os parâmetros de URL para evitar discrepâncias entre nomes em português e inglês
 */
export function extractStringParam(params: Record<string, any> | undefined, keys: string[]): string {
  if (!params) return '';
  for (const key of keys) {
    const val = params[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

/**
 * Processador principal de Deep Links no padrão:
 * lumen://gemini/<acao>?<parametros>
 */
export async function handleGeminiDeepLink(
  url: string,
  options?: DeepLinkHandlerOptions
): Promise<DeepLinkExecutionResult> {
  if (!url || typeof url !== 'string') {
    return { handled: false };
  }

  const showAlert = options?.showAlert !== false;

  try {
    const parsed = Linking.parse(url);

    // Valida o esquema 'lumen'
    const scheme = (parsed.scheme || '').toLowerCase();
    if (scheme !== 'lumen') {
      return { handled: false };
    }

    // Identifica o hostname e a ação desejada
    const hostname = (parsed.hostname || '').toLowerCase();
    const rawPath = (parsed.path || '').replace(/^\/+/, '').toLowerCase();

    let action = '';
    if (hostname === 'gemini') {
      action = rawPath.split('/')[0] || '';
      if (!action && parsed.queryParams?.action) {
        action = String(parsed.queryParams.action).toLowerCase();
      }
    } else if (rawPath.startsWith('gemini/')) {
      action = rawPath.replace(/^gemini\//, '').split('/')[0] || '';
    } else if (hostname && hostname !== 'gemini' && rawPath) {
      action = rawPath.split('/')[0] || '';
    } else if (hostname && !rawPath) {
      action = hostname;
    }

    const queryParams = parsed.queryParams || {};

    // Verificação preventiva de segurança: SQL injection
    for (const [, val] of Object.entries(queryParams)) {
      if (typeof val === 'string' && SecuritySanitizer.containsSqlInjection(val)) {
        if (showAlert) {
          Alert.alert('Segurança', 'Comando bloqueado: entrada maliciosa detectada.');
        }
        return {
          handled: true,
          action,
          result: {
            success: false,
            message: 'Comando bloqueado: entrada maliciosa detectada (SQL injection).',
          },
        };
      }
    }

    // Verificação preventiva de segurança: Datas bizarras
    const rawDateParam = extractStringParam(queryParams, ['data', 'date', 'dataIso', 'startDate', 'dt']);
    if (rawDateParam && SecuritySanitizer.isBizarreDate(rawDateParam)) {
      if (showAlert) {
        Alert.alert('Segurança', 'Comando bloqueado: data maliciosa ou inválida.');
      }
      return {
        handled: true,
        action,
        result: {
          success: false,
          message: 'Comando bloqueado: data maliciosa ou inválida detectada.',
        },
      };
    }

    // 1. Rota: Adicionar Evento / Prova / Trabalho / Lembrete
    if (
      action === 'adicionar_evento' ||
      action === 'criar_evento' ||
      action === 'create_event' ||
      action === 'add_event' ||
      action === 'evento'
    ) {
      const titulo = extractStringParam(queryParams, ['titulo', 'title', 'nome', 'name', 'descricao', 'tit']);
      const rawTipo = extractStringParam(queryParams, ['tipo', 'type', 'tipoEvento', 'category']).toLowerCase();
      const dataIso = extractStringParam(queryParams, ['data', 'date', 'dataIso', 'startDate', 'dt']) || undefined;

      let tipoEvento: 'prova' | 'trabalho' | 'lembrete' = 'lembrete';
      if (rawTipo.includes('prov') || rawTipo.includes('exam')) {
        tipoEvento = 'prova';
      } else if (rawTipo.includes('trab') || rawTipo.includes('assignment') || rawTipo.includes('entrega')) {
        tipoEvento = 'trabalho';
      }

      const result = await GeminiIntegrationService.adicionarEvento(titulo, tipoEvento, dataIso);

      if (result.success) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // fallback silencioso
        }
        if (showAlert) {
          Alert.alert('Gemini App Action', result.message);
        }
        if (options?.onActionExecuted) {
          await options.onActionExecuted();
        }
      } else {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {
          // fallback silencioso
        }
        if (showAlert) {
          Alert.alert('Gemini App Action', result.message || 'Não foi possível adicionar o evento via Gemini.');
        }
      }

      return { handled: true, action: 'adicionar_evento', result };
    }

    // 2. Rota: Marcar Falta ou Presença
    if (
      action === 'marcar_falta' ||
      action === 'registrar_falta' ||
      action === 'registrar_presenca' ||
      action === 'marcar_presenca' ||
      action === 'record_attendance' ||
      action === 'falta' ||
      action === 'presenca'
    ) {
      const materia = extractStringParam(queryParams, ['materia', 'subject', 'materiaNome', 'disciplina', 'course', 'mat', 'sub', 'disciplinaNome', 'nome']);
      const rawTipo = extractStringParam(queryParams, ['tipo', 'type', 'status']).toLowerCase();
      const dataIso = extractStringParam(queryParams, ['data', 'date', 'dataIso', 'dt']) || undefined;

      let tipoPresenca: 'presenca' | 'falta' = 'falta';
      if (
        rawTipo.includes('presen') ||
        rawTipo.includes('present') ||
        action.includes('presenca')
      ) {
        tipoPresenca = 'presenca';
      }

      const result = await GeminiIntegrationService.registrarPresencaFalta(materia, tipoPresenca, dataIso);

      if (result.success) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // fallback silencioso
        }
        if (showAlert) {
          Alert.alert('Gemini App Action', result.message);
        }
        if (options?.onActionExecuted) {
          await options.onActionExecuted();
        }
      } else {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {
          // fallback silencioso
        }
        if (showAlert) {
          Alert.alert('Gemini App Action', result.message || 'Não foi possível registrar a falta/presença via Gemini.');
        }
      }

      return { handled: true, action: 'marcar_falta', result };
    }

    // 3. Rota: Consultar Agenda do Dia
    if (
      action === 'consultar_agenda' ||
      action === 'agenda' ||
      action === 'get_agenda' ||
      action === 'compromissos'
    ) {
      const dataIso = extractStringParam(queryParams, ['data', 'date', 'dataIso', 'dt']) || undefined;
      const result = await GeminiIntegrationService.consultarAgendaDoDia(dataIso);

      if (showAlert) {
        Alert.alert('Agenda do Dia (Gemini)', result.message);
      }

      return { handled: true, action: 'consultar_agenda', result };
    }

    // 4. Rota: Consultar Status Geral Acadêmico / Resumo Acadêmico
    if (
      action === 'status_geral' ||
      action === 'status' ||
      action === 'consultar_status' ||
      action === 'desempenho' ||
      action === 'resumo_academico' ||
      action === 'resumo' ||
      action === 'academic_summary' ||
      action === 'summary'
    ) {
      const result = await GeminiIntegrationService.consultarStatusGeral();

      if (showAlert) {
        Alert.alert('Status Acadêmico (Gemini)', result.message);
      }

      return { handled: true, action: 'status_geral', result };
    }

    // Ação desconhecida com esquema lumen://gemini
    if (showAlert && action) {
      Alert.alert('Gemini App Action', `Ação não reconhecida: "${action}".`);
    }

    return { handled: false, action };
  } catch (error: any) {
    console.warn('[useDeepLinkHandler] Erro ao processar deep link:', error);
    if (showAlert) {
      Alert.alert('Erro ao Processar Deep Link', error?.message || 'Falha na comunicação com o Gemini.');
    }
    return { handled: false };
  }
}

/**
 * Hook React para escutar eventos de Deep Link em tempo real e tratar cold starts
 */
export function useDeepLinkHandler(options?: DeepLinkHandlerOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const lastProcessedUrlRef = useRef<{ url: string; timestamp: number } | null>(null);

  const processUrl = useCallback(async (url: string | null) => {
    if (!url) return;

    // Deduplicação contra chamadas repetidas disparadas em menos de 1500ms
    const now = Date.now();
    if (
      lastProcessedUrlRef.current &&
      lastProcessedUrlRef.current.url === url &&
      now - lastProcessedUrlRef.current.timestamp < 1500
    ) {
      return;
    }

    lastProcessedUrlRef.current = { url, timestamp: now };
    await handleGeminiDeepLink(url, optionsRef.current);
  }, []);

  useEffect(() => {
    // 1. Trata Cold Start (quando o aplicativo é aberto a partir do Deep Link)
    Linking.getInitialURL()
      .then(initialUrl => {
        if (initialUrl) {
          processUrl(initialUrl);
        }
      })
      .catch(err => {
        console.warn('[useDeepLinkHandler] Falha ao obter initialURL:', err);
      });

    // 2. Escuta eventos em tempo real (quando o app já está em segundo plano ou ativo)
    const subscription = Linking.addEventListener('url', (event: { url: string }) => {
      processUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [processUrl]);
}
