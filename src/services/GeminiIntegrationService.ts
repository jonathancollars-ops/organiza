import {
  AppEvent,
  Subject,
  AttendanceRecord,
  EventCategory
} from '../types';
import { StorageService } from './storage';
import { NotificationService } from './notifications';
import { CourseCRService } from './CourseCRService';
import { calculateFinalGrade } from '../components/GradeEngine';
import {
  generateId,
  getLocalDateString,
  formatDisplayDate,
  calculateDaySchedule,
  DayScheduleSummary
} from '../utils';
import { parseISO, getDay, isValid, addDays } from 'date-fns';
import { SecuritySanitizer } from './SecuritySanitizer';

/**
 * Constantes de proteção e limites estritos de segurança para comandos do Gemini
 */
export const GEMINI_INPUT_LIMITS = {
  MAX_TITLE_LENGTH: 200,
  MAX_SUBJECT_NAME_LENGTH: 150,
  MAX_DATE_STRING_LENGTH: 50,
  ABSOLUTE_MAX_STRING_LENGTH: 1000,
} as const;

export const VALID_PRESENCE_TYPES = ['presenca', 'falta'] as const;
export type ValidPresenceType = typeof VALID_PRESENCE_TYPES[number];

export const VALID_EVENT_TYPES = ['prova', 'trabalho', 'lembrete'] as const;
export type ValidEventType = typeof VALID_EVENT_TYPES[number];

/**
 * Validação rigorosa de datas ISO 8601 (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss).
 * Garante que ano, mês, dia e horário sejam valores reais no calendário gregoriano.
 * Se a data for omitida, inválida, corrompida ou inexistente no calendário (ex: 31/02),
 * realiza fallback defensivo seguro para a data e horário atual (now).
 */
export function validateAndSanitizeISODate(
  rawDate?: unknown,
  defaultTime: string = '08:00'
): {
  date: string;
  time: string;
  isFallback: boolean;
} {
  const now = new Date();
  const nowDateStr = getLocalDateString(now);
  const nowHour = String(now.getHours()).padStart(2, '0');
  const nowMinute = String(now.getMinutes()).padStart(2, '0');
  const dynamicFallbackTime = defaultTime || `${nowHour}:${nowMinute}`;

  const fallbackResult = {
    date: nowDateStr,
    time: dynamicFallbackTime,
    isFallback: true,
  };

  if (!rawDate || typeof rawDate !== 'string') {
    return fallbackResult;
  }

  const trimmed = rawDate.trim();
  if (trimmed.length === 0 || trimmed.length > GEMINI_INPUT_LIMITS.MAX_DATE_STRING_LENGTH) {
    return fallbackResult;
  }

  const parts = trimmed.split('T');
  const dateStr = parts[0].trim();

  // Validação estrita de formato YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return fallbackResult;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return fallbackResult;
  }

  // Verificação de calendário real (ex: anos bissextos, meses com 30 vs 31 dias)
  const calendarCheck = new Date(year, month - 1, day);
  if (
    calendarCheck.getFullYear() !== year ||
    calendarCheck.getMonth() + 1 !== month ||
    calendarCheck.getDate() !== day
  ) {
    return fallbackResult;
  }

  // Processamento de horário caso fornecido na string ISO
  let timeStr = defaultTime;
  if (parts.length > 1 && parts[1]) {
    const timeClean = parts[1].trim();
    const timeMatch = timeClean.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }

  return {
    date: dateStr,
    time: timeStr,
    isFallback: false,
  };
}

/**
 * Validação rigorosa de strings de entrada prevenindo XSS, script injection e buffer/memory denial-of-service.
 */
export function validateAndSanitizeInputText(
  rawInput: unknown,
  maxLength: number
): {
  valid: boolean;
  sanitized: string;
} {
  if (typeof rawInput !== 'string') {
    return { valid: false, sanitized: '' };
  }

  // Se exceder limites de segurança (ex: 1000 caracteres), rejeita
  if (rawInput.length > GEMINI_INPUT_LIMITS.ABSOLUTE_MAX_STRING_LENGTH || rawInput.length > maxLength) {
    return { valid: false, sanitized: '' };
  }

  // Barramento de SQL injection
  if (SecuritySanitizer.containsSqlInjection(rawInput)) {
    return { valid: false, sanitized: '' };
  }

  const sanitized = SecuritySanitizer.sanitizeTitle(rawInput, maxLength);
  if (sanitized.trim().length === 0) {
    return { valid: false, sanitized: '' };
  }

  return { valid: true, sanitized: sanitized.trim() };
}

export interface GeminiActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface DayAgendaResult {
  date: string;
  formattedDate: string;
  totalEvents: number;
  totalOccupiedFormatted: string;
  totalFreeFormatted: string;
  events: Array<{
    id: string;
    title: string;
    category: string;
    startTime: string;
    endTime: string;
    subjectName?: string;
    isImportant?: boolean;
    isCompleted?: boolean;
  }>;
  daySchedule: DayScheduleSummary;
  summaryText: string;
}

export interface SubjectAbsenceSummary {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  currentAbsences: number;
  maxAbsences: number;
  remainingAbsences: number;
  presenceRate: number;
  riskLevel: 'safe' | 'warning' | 'danger';
}

export interface UpcomingExamSummary {
  id: string;
  title: string;
  date: string;
  formattedDate: string;
  daysRemaining: number;
  subjectName?: string;
}

export interface GeneralStatusResult {
  overallCR: number;
  activeSemesterGPA: number;
  totalActiveSubjects: number;
  criticalAbsences: SubjectAbsenceSummary[];
  allAbsences: SubjectAbsenceSummary[];
  upcomingExams: UpcomingExamSummary[];
  summaryText: string;
}

/**
 * Normaliza uma string removendo acentos, caracteres especiais e convertendo numerais romanos.
 * Exemplo: "Cálculo I" -> "calculo 1", "Física II" -> "fisica 2"
 */
export function normalizeStringForMatching(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const safeText = text.length > 500 ? text.slice(0, 500) : text;
  let normalized = safeText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // Converte numerais romanos comuns em limites de palavra para numerais arábicos
  normalized = normalized
    .replace(/\bviii\b/g, '8')
    .replace(/\bvii\b/g, '7')
    .replace(/\bvi\b/g, '6')
    .replace(/\bv\b/g, '5')
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1');

  return normalized.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Calcula a similaridade entre duas strings (0 a 1) usando substring, tokens e bigramas.
 */
export function calculateStringSimilarity(strA: string, strB: string): number {
  if (!strA || !strB || typeof strA !== 'string' || typeof strB !== 'string') return 0;
  const safeA = strA.length > 500 ? strA.slice(0, 500) : strA;
  const safeB = strB.length > 500 ? strB.slice(0, 500) : strB;
  const a = normalizeStringForMatching(safeA);
  const b = normalizeStringForMatching(safeB);

  if (!a || !b) return 0;
  if (a === b) return 1.0;

  // Substring direta
  if (a.includes(b) || b.includes(a)) {
    const minLen = Math.min(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);
    return Math.max(0.85, minLen / maxLen);
  }

  // Sobreposição de tokens (palavras)
  const tokensA = a.split(' ').filter(t => t.length > 1);
  const tokensB = b.split(' ').filter(t => t.length > 1);
  if (tokensA.length > 0 && tokensB.length > 0) {
    const common = tokensA.filter(t => tokensB.includes(t));
    if (common.length > 0) {
      const tokenScore = (2 * common.length) / (tokensA.length + tokensB.length);
      if (tokenScore >= 0.5) {
        return Math.max(0.75, tokenScore * 0.9);
      }
    }
  }

  // Coeficiente de Dice sobre bigramas
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    if (bigramsA.has(b.slice(i, i + 2))) intersection++;
  }

  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/**
 * Busca aproximada (fuzzy search) para identificar a matéria pelo nome ou código.
 */
export function findSubjectByFuzzyName(
  query: string,
  subjects: Subject[],
  minConfidence: number = 0.4
): { subject: Subject | null; confidence: number } {
  if (!query || typeof query !== 'string' || !Array.isArray(subjects) || subjects.length === 0) {
    return { subject: null, confidence: 0 };
  }

  if (query.length > GEMINI_INPUT_LIMITS.ABSOLUTE_MAX_STRING_LENGTH) {
    return { subject: null, confidence: 0 };
  }

  const cleanQuery = SecuritySanitizer.sanitizeTitle(query, GEMINI_INPUT_LIMITS.MAX_SUBJECT_NAME_LENGTH);
  if (!cleanQuery) {
    return { subject: null, confidence: 0 };
  }

  let bestMatch: Subject | null = null;
  let bestScore = 0;

  for (const sub of subjects) {
    if (!sub || typeof sub !== 'object' || !sub.name) continue;

    const scoreName = calculateStringSimilarity(cleanQuery, sub.name);
    let scoreCode = 0;
    if (sub.code) {
      scoreCode = calculateStringSimilarity(cleanQuery, sub.code);
    }

    const currentMax = Math.max(scoreName, scoreCode);
    if (currentMax > bestScore) {
      bestScore = currentMax;
      bestMatch = sub;
    }
  }

  if (bestScore >= minConfidence && bestMatch) {
    return { subject: bestMatch, confidence: bestScore };
  }

  return { subject: null, confidence: bestScore };
}

/**
 * Serviço desacoplado de UI para orquestração de App Actions e Deep Links acionados pelo Google Gemini.
 */
export class GeminiIntegrationService {
  /**
   * 1. Registrar Presença ou Falta em uma disciplina por data.
   */
  static async registrarPresencaFalta(
    materiaNome: string,
    tipo: 'presenca' | 'falta',
    dataIso?: string
  ): Promise<GeminiActionResult<{ attendance: AttendanceRecord; subject: Subject }>> {
    try {
      // 1. Validação estrita do enum (Rule 3)
      if (typeof tipo !== 'string' || (tipo !== 'presenca' && tipo !== 'falta')) {
        return {
          success: false,
          message: 'Parâmetros inválidos',
        };
      }

      // 2. Validação estrita e sanitização do nome da matéria (Rule 1 & Rule 4)
      const subjectValidation = validateAndSanitizeInputText(
        materiaNome,
        GEMINI_INPUT_LIMITS.MAX_SUBJECT_NAME_LENGTH
      );
      if (!subjectValidation.valid) {
        return {
          success: false,
          message: 'Parâmetros inválidos',
        };
      }
      const cleanMateriaNome = subjectValidation.sanitized;

      // 3. Validação ISO 8601 estrita com fallback seguro para a data atual (Rule 2)
      if (dataIso && SecuritySanitizer.isBizarreDate(dataIso)) {
        return {
          success: false,
          message: 'Data inválida ou maliciosa detectada pela camada de segurança.',
        };
      }
      const { date: targetDate } = validateAndSanitizeISODate(dataIso);

      // Busca matérias no banco
      const subjects = await StorageService.getSubjects();
      const activeSubjects = subjects.filter(s => !s.isArchived);

      const { subject } = findSubjectByFuzzyName(cleanMateriaNome, activeSubjects);
      if (!subject) {
        return {
          success: false,
          message: `Disciplina "${cleanMateriaNome}" não foi encontrada no seu cadastro acadêmico.`,
        };
      }

      const attendances = await StorageService.getAttendances();
      const events = await StorageService.getEvents();

      // Busca evento de aula correspondente para linkar o eventId
      const matchingEvent = events.find(e => {
        if (e.subjectId !== subject.id) return false;
        if (e.category !== 'Faculdade/Aulas') return false;

        const eventDateClean = e.date ? e.date.split('T')[0] : '';
        if (e.recurrence === 'weekly') {
          try {
            const currentDayOfWeek = getDay(parseISO(targetDate));
            if (e.recurrenceDays && e.recurrenceDays.length > 0) {
              return e.recurrenceDays.includes(currentDayOfWeek);
            }
            const eventDayOfWeek = getDay(parseISO(eventDateClean));
            return currentDayOfWeek === eventDayOfWeek;
          } catch {
            return false;
          }
        }
        return eventDateClean === targetDate;
      });

      const newStatus = tipo === 'presenca' ? 'present' : 'absent';

      // Atualiza ou insere o registro de presença
      const existingIndex = attendances.findIndex(
        a => a.subjectId === subject.id && a.date === targetDate
      );

      let savedRecord: AttendanceRecord;
      let updatedAttendances: AttendanceRecord[];

      if (existingIndex >= 0) {
        savedRecord = {
          ...attendances[existingIndex],
          status: newStatus,
          eventId: matchingEvent?.id || attendances[existingIndex].eventId,
        };
        updatedAttendances = [...attendances];
        updatedAttendances[existingIndex] = savedRecord;
      } else {
        savedRecord = {
          id: generateId('att'),
          subjectId: subject.id,
          date: targetDate,
          eventId: matchingEvent?.id || '',
          status: newStatus,
        };
        updatedAttendances = [...attendances, savedRecord];
      }

      await StorageService.saveAttendances(updatedAttendances);

      const actionLabel = tipo === 'presenca' ? 'Presença' : 'Falta';
      const formattedDate = formatDisplayDate(targetDate);
      const message = `${actionLabel} registrada com sucesso em ${subject.name} para o dia ${formattedDate}.`;

      return {
        success: true,
        message,
        data: {
          attendance: savedRecord,
          subject,
        },
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Falha ao registrar ${tipo}: ${errMessage}`,
      };
    }
  }

  /**
   * 2. Adicionar Evento, Prova ou Lembrete no calendário.
   */
  static async adicionarEvento(
    titulo: string,
    tipoEvento: 'prova' | 'trabalho' | 'lembrete',
    dataIso?: string
  ): Promise<GeminiActionResult<{ event: AppEvent; subject?: Subject }>> {
    try {
      // 1. Validação estrita do enum de tipo de evento (Rule 3)
      if (typeof tipoEvento !== 'string' || (tipoEvento !== 'prova' && tipoEvento !== 'trabalho' && tipoEvento !== 'lembrete')) {
        return {
          success: false,
          message: 'Parâmetros inválidos',
        };
      }

      // 2. Validação estrita e sanitização do título (Rule 1 & Rule 4)
      const titleValidation = validateAndSanitizeInputText(
        titulo,
        GEMINI_INPUT_LIMITS.MAX_TITLE_LENGTH
      );
      if (!titleValidation.valid) {
        return {
          success: false,
          message: 'Parâmetros inválidos',
        };
      }
      const cleanTitle = titleValidation.sanitized;

      // 3. Validação estrita ISO 8601 com fallback seguro para data e horário atual (Rule 2)
      if (dataIso && SecuritySanitizer.isBizarreDate(dataIso)) {
        return {
          success: false,
          message: 'Data inválida ou maliciosa detectada pela camada de segurança.',
        };
      }
      const { date: dateClean, time: startTime } = validateAndSanitizeISODate(dataIso, '08:00');
      const [h, m] = startTime.split(':').map(Number);
      const endH = (h + (tipoEvento === 'prova' ? 2 : 1)) % 24;
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      // Categoria e Alertas
      let category: EventCategory;
      let alerts: number[];
      let isImportant = false;

      if (tipoEvento === 'prova') {
        category = 'Provas/Trabalhos';
        alerts = [60, 1440, 10080]; // 1h, 1 dia, 1 semana
        isImportant = true;
      } else if (tipoEvento === 'trabalho') {
        category = 'Provas/Trabalhos';
        alerts = [60, 1440]; // 1h, 1 dia
        isImportant = true;
      } else {
        category = 'Outros';
        alerts = [30]; // 30min
      }

      // Detecção inteligente da matéria no título sanitizado
      const subjects = await StorageService.getSubjects();
      const activeSubjects = subjects.filter(s => !s.isArchived);

      let matchedSubject: Subject | undefined = undefined;

      // 1. Limpa prefixos comuns de eventos (ex: "P2 de Cálculo", "Prova de Física", "Entrega de Algoritmos")
      const cleanSubjectHint = cleanTitle
        .replace(/^(prova|p\d+|trabalho|entrega|exame|teste|lembrete|revisar|estudar|aula)\s*(de|da|do)?\s+/i, '')
        .trim();

      if (cleanSubjectHint.length > 0 && activeSubjects.length > 0) {
        const fuzzyClean = findSubjectByFuzzyName(cleanSubjectHint, activeSubjects, 0.4);
        if (fuzzyClean.subject) {
          matchedSubject = fuzzyClean.subject;
        }
      }

      // 2. Se não encontrou pelo título limpo, tenta correspondência direta com nome ou código
      if (!matchedSubject) {
        for (const sub of activeSubjects) {
          const normSub = normalizeStringForMatching(sub.name);
          const normTitle = normalizeStringForMatching(cleanTitle);
          if (normTitle.includes(normSub) || (sub.code && normTitle.includes(normalizeStringForMatching(sub.code)))) {
            matchedSubject = sub;
            break;
          }
        }
      }

      // 3. Fallback: fuzzy search sobre o título sanitizado completo com tolerância
      if (!matchedSubject && activeSubjects.length > 0) {
        const { subject } = findSubjectByFuzzyName(cleanTitle, activeSubjects, 0.35);
        if (subject) {
          matchedSubject = subject;
        }
      }

      const newEvent: AppEvent = {
        id: generateId('evt'),
        title: cleanTitle,
        category,
        date: dateClean,
        startTime,
        endTime,
        recurrence: 'none',
        alerts,
        isCompleted: false,
        isImportant,
        subjectId: matchedSubject?.id,
        description: `Criado via comando do Gemini (${tipoEvento})`,
      };

      const existingEvents = await StorageService.getEvents();
      const updatedEvents = [...existingEvents, newEvent];
      await StorageService.saveEvents(updatedEvents);

      // Agenda notificações no sistema operacional
      try {
        await NotificationService.scheduleEventNotifications(newEvent);
      } catch (notifErr) {
        console.warn('[GeminiIntegrationService] Notificações não puderam ser agendadas:', notifErr);
      }

      const typeLabel = tipoEvento === 'prova' ? 'Prova' : tipoEvento === 'trabalho' ? 'Trabalho' : 'Lembrete';
      const formattedDate = formatDisplayDate(dateClean);
      const subjectNote = matchedSubject ? ` vinculada a ${matchedSubject.name}` : '';
      const message = `${typeLabel} "${newEvent.title}" agendado(a) com sucesso para ${formattedDate} às ${startTime}${subjectNote}.`;

      return {
        success: true,
        message,
        data: {
          event: newEvent,
          subject: matchedSubject,
        },
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Falha ao adicionar ${tipoEvento}: ${errMessage}`,
      };
    }
  }

  /**
   * 3. Consultar a Agenda Completa do Dia (compromissos, aulas e janelas livres).
   */
  static async consultarAgendaDoDia(
    dataIso?: string
  ): Promise<GeminiActionResult<DayAgendaResult>> {
    try {
      // Validação ISO 8601 estrita com fallback seguro para a data atual (Rule 2)
      if (dataIso && SecuritySanitizer.isBizarreDate(dataIso)) {
        return {
          success: false,
          message: 'Data inválida ou maliciosa detectada pela camada de segurança.',
        };
      }
      const { date: targetDate } = validateAndSanitizeISODate(dataIso);

      const events = await StorageService.getEvents();
      const subjects = await StorageService.getSubjects();
      const attendances = await StorageService.getAttendances();

      // Filtra eventos do dia com suporte a recorrência e cancelamentos
      const todaysEvents = events.filter(e => {
        if (!e) return false;

        // Oculta matérias arquivadas
        if (e.subjectId) {
          const subject = subjects.find(s => s.id === e.subjectId);
          if (subject?.isArchived) return false;
        }

        // Oculta aulas canceladas
        if (e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly') {
          const isCancelled = attendances.some(
            a => a.eventId === e.id && a.date === targetDate && a.status === 'cancelled'
          );
          if (isCancelled) return false;
        }

        const startDateClean = e.date ? e.date.split('T')[0] : '';
        if (!startDateClean || targetDate < startDateClean) return false;

        if (e.recurrence === 'daily') return true;

        if (e.recurrence === 'weekly') {
          try {
            const currentDay = getDay(parseISO(targetDate));
            if (e.recurrenceDays && e.recurrenceDays.length > 0) {
              return e.recurrenceDays.includes(currentDay);
            }
            const startDay = getDay(parseISO(startDateClean));
            return startDay === currentDay;
          } catch {
            return false;
          }
        }

        if (e.recurrence === 'monthly' || e.recurrence === 'custom_interval') {
          try {
            const [startYear, startMonth, startDay] = startDateClean.split('-').map(Number);
            const [targetYear, targetMonth, targetDay] = targetDate.split('-').map(Number);
            const expectedDay = e.recurrenceMonthDay || startDay;
            const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
            const effectiveDay = Math.min(expectedDay, daysInTargetMonth);
            if (targetDay !== effectiveDay && targetDay !== expectedDay) return false;

            const interval = e.recurrenceInterval && e.recurrenceInterval > 0 ? e.recurrenceInterval : 1;
            if (interval > 1) {
              const monthDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
              if (monthDiff < 0 || monthDiff % interval !== 0) return false;
            }
            return true;
          } catch {
            return false;
          }
        }

        return startDateClean === targetDate;
      }).sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

      // Executa o motor de cálculo de cronograma diário e tempos livres
      const daySchedule = calculateDaySchedule(todaysEvents);

      const formattedDate = formatDisplayDate(targetDate);
      const isToday = targetDate === getLocalDateString();
      const dateContext = isToday ? 'hoje' : `no dia ${formattedDate}`;

      let summaryText = '';

      if (todaysEvents.length === 0) {
        summaryText = `Você não tem compromissos agendados para ${dateContext}. Seu dia está 100% livre com ${daySchedule.totalFreeFormatted} disponíveis para descanso ou estudo focado.`;
      } else {
        const eventItems = todaysEvents.map(evt => {
          const sub = evt.subjectId ? subjects.find(s => s.id === evt.subjectId) : null;
          const subLabel = sub ? ` (${sub.name})` : '';
          return `• ${evt.startTime || '08:00'} às ${evt.endTime || '09:00'}: ${evt.title}${subLabel}`;
        });

        const freeGaps = daySchedule.freeBlocks.map(
          fb => `${fb.startTime} às ${fb.endTime} (${fb.durationFormatted})`
        );

        let freeGapsText = '';
        if (freeGaps.length > 0) {
          freeGapsText = `\nJanelas livres para estudo: ${freeGaps.join(', ')}.`;
        }

        summaryText = `Sua agenda para ${dateContext} tem ${todaysEvents.length} compromisso(s) (${daySchedule.totalOccupiedFormatted} ocupadas e ${daySchedule.totalFreeFormatted} livres):\n${eventItems.join('\n')}${freeGapsText}`;
      }

      return {
        success: true,
        message: summaryText,
        data: {
          date: targetDate,
          formattedDate,
          totalEvents: todaysEvents.length,
          totalOccupiedFormatted: daySchedule.totalOccupiedFormatted,
          totalFreeFormatted: daySchedule.totalFreeFormatted,
          events: todaysEvents.map(e => ({
            id: e.id,
            title: e.title,
            category: e.category,
            startTime: e.startTime,
            endTime: e.endTime,
            subjectName: subjects.find(s => s.id === e.subjectId)?.name,
            isImportant: e.isImportant,
            isCompleted: e.isCompleted,
          })),
          daySchedule,
          summaryText,
        },
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Falha ao consultar agenda: ${errMessage}`,
      };
    }
  }

  /**
   * 4. Consultar Status Geral Acadêmico (CR Geral, Média do Semestre, Faltas Críticas e Próximas Provas).
   */
  static async consultarStatusGeral(): Promise<GeminiActionResult<GeneralStatusResult>> {
    try {
      const subjects = await StorageService.getSubjects();
      const attendances = await StorageService.getAttendances();
      const events = await StorageService.getEvents();
      const courseData = await CourseCRService.loadCourseProgress();

      const activeSubjects = subjects.filter(s => !s.isArchived);

      // 1. Cálculo do CR Histórico Acumulado
      let overallCR = 0;
      if (courseData) {
        overallCR = CourseCRService.calculateHistoricalCR(courseData);
      }

      // 2. Cálculo da Média Ponderada do Semestre Ativo
      let semesterTotalWeighted = 0;
      let semesterTotalCredits = 0;

      for (const sub of activeSubjects) {
        if (sub.gradeGroups && sub.gradeGroups.length > 0) {
          const gradeResult = calculateFinalGrade(sub.gradeGroups, sub.passGrade || 7.0);
          const credits = typeof sub.workloadHours === 'number' && sub.workloadHours > 0
            ? sub.workloadHours
            : 4;

          if (gradeResult.score > 0 || !gradeResult.hasMissingItems) {
            semesterTotalWeighted += gradeResult.score * credits;
            semesterTotalCredits += credits;
          }
        }
      }

      const activeSemesterGPA = semesterTotalCredits > 0
        ? Number((semesterTotalWeighted / semesterTotalCredits).toFixed(2))
        : overallCR;

      // 3. Faltas e Nível de Risco por Disciplina
      const allAbsences: SubjectAbsenceSummary[] = [];
      const criticalAbsences: SubjectAbsenceSummary[] = [];

      for (const sub of activeSubjects) {
        const subAttendances = attendances.filter(a => a.subjectId === sub.id);
        const currentAbsences = subAttendances.filter(a => a.status === 'absent').length;
        const currentPresences = subAttendances.filter(a => a.status === 'present').length;

        // Limite de faltas (25% da carga horária ou padrão 15)
        let maxAbsences = 15;
        if (typeof sub.maxAbsences === 'number' && sub.maxAbsences > 0) {
          maxAbsences = sub.maxAbsences;
        } else if (typeof sub.workloadHours === 'number' && sub.workloadHours > 0) {
          maxAbsences = Math.max(1, Math.floor(sub.workloadHours * 0.25));
        }

        const remainingAbsences = Math.max(0, maxAbsences - currentAbsences);
        const totalClasses = currentAbsences + currentPresences;
        const presenceRate = totalClasses > 0
          ? Number(((currentPresences / totalClasses) * 100).toFixed(1))
          : 100.0;

        let riskLevel: 'safe' | 'warning' | 'danger' = 'safe';
        if (remainingAbsences <= 2 || presenceRate < 75) {
          riskLevel = 'danger';
        } else if (remainingAbsences <= 4 || presenceRate < 80) {
          riskLevel = 'warning';
        }

        const summary: SubjectAbsenceSummary = {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          currentAbsences,
          maxAbsences,
          remainingAbsences,
          presenceRate,
          riskLevel,
        };

        allAbsences.push(summary);
        if (riskLevel === 'danger' || riskLevel === 'warning') {
          criticalAbsences.push(summary);
        }
      }

      // 4. Próximas Provas nos Próximos 7 Dias
      const todayStr = getLocalDateString();
      const todayDate = new Date(`${todayStr}T12:00:00`);

      const upcomingExams: UpcomingExamSummary[] = [];
      const examEvents = events.filter(e => {
        if (!e || !e.date) return false;
        const isExamCategory = e.category === 'Provas/Trabalhos';
        const titleLower = (e.title || '').toLowerCase();
        return isExamCategory || titleLower.includes('prova');
      });

      for (const exam of examEvents) {
        const examDateClean = exam.date.split('T')[0];
        const examDate = new Date(`${examDateClean}T12:00:00`);
        if (!isValid(examDate)) continue;

        const diffDays = Math.round((examDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
          const sub = exam.subjectId ? subjects.find(s => s.id === exam.subjectId) : null;
          upcomingExams.push({
            id: exam.id,
            title: exam.title,
            date: examDateClean,
            formattedDate: formatDisplayDate(examDateClean),
            daysRemaining: diffDays,
            subjectName: sub?.name,
          });
        }
      }

      upcomingExams.sort((a, b) => a.daysRemaining - b.daysRemaining);

      // 5. Geração de texto natural descritivo
      let summaryText = `Status Acadêmico: CR Geral ${overallCR.toFixed(2)}`;
      if (activeSemesterGPA > 0 && activeSemesterGPA !== overallCR) {
        summaryText += ` (Média do Período: ${activeSemesterGPA.toFixed(2)})`;
      }
      summaryText += `. Você possui ${activeSubjects.length} disciplina(s) em andamento.`;

      if (criticalAbsences.length > 0) {
        const critList = criticalAbsences
          .map(c => `${c.subjectName} (${c.remainingAbsences} falta(s) restante(s))`)
          .join(', ');
        summaryText += `\n⚠️ Atenção com faltas: ${critList}.`;
      } else {
        summaryText += '\n✅ Frequência regular em todas as disciplinas.';
      }

      if (upcomingExams.length > 0) {
        const nextExam = upcomingExams[0];
        const whenText = nextExam.daysRemaining === 0
          ? 'hoje'
          : nextExam.daysRemaining === 1
          ? 'amanhã'
          : `em ${nextExam.daysRemaining} dias (${nextExam.formattedDate})`;
        summaryText += `\n📝 Próxima prova: "${nextExam.title}" ${whenText}.`;
      } else {
        summaryText += '\nNenhuma prova agendada para os próximos 7 dias.';
      }

      return {
        success: true,
        message: summaryText,
        data: {
          overallCR,
          activeSemesterGPA,
          totalActiveSubjects: activeSubjects.length,
          criticalAbsences,
          allAbsences,
          upcomingExams,
          summaryText,
        },
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Falha ao consultar status geral: ${errMessage}`,
      };
    }
  }
}
