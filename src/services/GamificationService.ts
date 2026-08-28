import { GamificationData, Achievement } from '../types';

export const BASE_ACHIEVEMENTS: Achievement[] = [
  { 
    id: 'first_study', 
    title: 'Primeiro Passo', 
    description: 'Complete sua primeira sessão de estudos no Lumen.', 
    icon: '🎯', 
    xp: 50, 
    unlocked: false 
  },
  { 
    id: 'study_10h', 
    title: 'Foco de Ferro', 
    description: 'Acumule 10 horas totais de estudo (600 minutos).', 
    icon: '🔥', 
    xp: 200, 
    unlocked: false 
  },
  { 
    id: 'perfect_attendance', 
    title: 'Assiduidade', 
    description: 'Marque presença na sua primeira aula (Faltas).', 
    icon: '✅', 
    xp: 100, 
    unlocked: false 
  },
  { 
    id: 'level_5', 
    title: 'Mente Brilhante', 
    description: 'Alcance o Nível 5.', 
    icon: '🧠', 
    xp: 150, 
    unlocked: false 
  },
  { 
    id: 'study_night', 
    title: 'Coruja', 
    description: 'Estude durante a madrugada (00h - 04h).', 
    icon: '🦉', 
    xp: 100, 
    unlocked: false 
  }
];

export class GamificationService {
  // Constantes para o cálculo da Curva de XP
  // Curva: XP(n) = BASE_XP * (n - 1) ^ EXPONENT
  private static readonly BASE_XP = 100;
  private static readonly EXPONENT = 1.5;

  /**
   * Calcula o total de XP necessário para alcançar um determinado nível.
   * Ex: Nível 1 = 0 XP, Nível 2 = 100 XP, Nível 3 = 282 XP, Nível 5 = 800 XP.
   */
  static calculateXPForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.floor(this.BASE_XP * Math.pow(level - 1, this.EXPONENT));
  }

  /**
   * Dado o XP total acumulado, retorna em qual nível o usuário está.
   */
  static calculateLevelFromXP(xp: number): number {
    if (xp <= 0) return 1;
    return Math.floor(Math.pow(xp / this.BASE_XP, 1 / this.EXPONENT)) + 1;
  }

  /**
   * Retorna os dados normalizados, prevenindo valores nulos.
   */
  static initializeData(data: GamificationData | null): GamificationData {
    if (data) {
      // Retorna uma cópia para preservar a pureza na manipulação de estado
      return { 
        ...data,
        unlockedAchievements: [...(data.unlockedAchievements || [])]
      };
    }
    return {
      xp: 0,
      level: 1,
      unlockedAchievements: [],
      totalFocusMinutes: 0,
      processedEventIds: [],
    };
  }

  /**
   * Recompensa o usuário por tempo de estudo.
   */
  static awardStudyXP(currentData: GamificationData | null, minutes: number, hourOfDay?: number): GamificationData {
    const data = this.initializeData(currentData);
    
    // XP base: 2 XP por minuto de estudo focado
    const earnedXP = minutes * 2;
    data.xp += earnedXP;
    data.totalFocusMinutes += minutes;

    // Condição customizada para a conquista 'study_night'
    if (hourOfDay !== undefined && hourOfDay >= 0 && hourOfDay < 4) {
      if (!data.unlockedAchievements.includes('study_night')) {
        data.unlockedAchievements.push('study_night');
        data.xp += 100;
      }
    }

    return this.processLevelAndAchievements(data);
  }

  /**
   * Recompensa o usuário por registrar presença.
   */
  static awardAttendanceXP(currentData: GamificationData | null): GamificationData {
    const data = this.initializeData(currentData);
    
    // XP fixo: 15 XP por presença registrada
    data.xp += 15;

    // Desbloqueia 'perfect_attendance' na primeira vez
    if (!data.unlockedAchievements.includes('perfect_attendance')) {
      data.unlockedAchievements.push('perfect_attendance');
      data.xp += 100;
    }
    
    return this.processLevelAndAchievements(data);
  }

  /**
   * Recompensa o usuário com uma quantidade genérica de XP (ex: completar tarefa).
   */
  static awardGenericXP(currentData: GamificationData | null, amount: number): GamificationData {
    const data = this.initializeData(currentData);
    
    data.xp += Math.max(0, amount);
    
    return this.processLevelAndAchievements(data);
  }

  /**
   * Centraliza a verificação de subida de nível e desbloqueio de achievements
   * dependentes de progresso geral (horas, nível).
   */
  private static processLevelAndAchievements(data: GamificationData): GamificationData {
    let newlyUnlocked = false;

    // Verifica conquistas baseadas em tempo/nível
    BASE_ACHIEVEMENTS.forEach(achievement => {
      if (!data.unlockedAchievements.includes(achievement.id)) {
        let met = false;

        if (achievement.id === 'first_study' && data.totalFocusMinutes > 0) met = true;
        if (achievement.id === 'study_10h' && data.totalFocusMinutes >= 600) met = true;
        if (achievement.id === 'level_5' && data.level >= 5) met = true;

        if (met) {
          data.unlockedAchievements.push(achievement.id);
          data.xp += achievement.xp;
          newlyUnlocked = true;
        }
      }
    });

    // Calcula o novo nível baseado no XP atual
    const expectedLevel = this.calculateLevelFromXP(data.xp);
    if (expectedLevel > data.level) {
      data.level = expectedLevel;
    }

    // Se novas conquistas foram destravadas, isso pode ter alterado o XP e potencialmente o nível novamente.
    // Recursão segura apenas se destravou algo.
    if (newlyUnlocked) {
      return this.processLevelAndAchievements(data);
    }

    return data;
  }
}

/**
 * Wrapper de Proteção (Anti-Farming)
 * Interage diretamente com o StorageService para garantir que eventos
 * (como presença em aulas ou sessões de estudo já contabilizadas) não
 * deem XP infinito ao usuário que fica marcando e desmarcando repetidamente.
 */
import { StorageService } from './storage';

export class GamificationManager {
  /**
   * Processa com segurança o ganho de XP por estudo, impedindo duplicação por ID de sessão.
   */
  static async safeAwardStudyXP(sessionId: string, minutes: number, hourOfDay?: number): Promise<boolean> {
    if (!sessionId) return false;
    
    const currentData = await StorageService.getGamificationData();
    const processedIds = currentData.processedEventIds || [];
    
    // Verifica se a sessão já foi processada (Debounce / Anti-Farming)
    if (processedIds.includes(sessionId)) {
      console.log(`[GamificationManager] Sessão ${sessionId} já rendeu XP. Ação ignorada.`);
      return false; 
    }
    
    // Atualiza os dados usando o Service puro
    const updatedData = GamificationService.awardStudyXP(currentData, minutes, hourOfDay);
    
    // Marca a sessão como processada (mantendo o histórico limitado aos últimos 5000)
    updatedData.processedEventIds = [...processedIds, sessionId].slice(-5000);
    
    // Salva de forma atômica/segura no AsyncStorage
    await StorageService.saveGamificationData(updatedData);
    return true;
  }

  /**
   * Processa com segurança o ganho de XP por presença, impedindo duplicação por ID de evento/aula.
   */
  static async safeAwardAttendanceXP(attendanceRecordId: string): Promise<boolean> {
    if (!attendanceRecordId) return false;

    const currentData = await StorageService.getGamificationData();
    const processedIds = currentData.processedEventIds || [];
    
    // Verifica se a presença para este evento/aula já rendeu XP
    if (processedIds.includes(attendanceRecordId)) {
      console.log(`[GamificationManager] Presença ${attendanceRecordId} já rendeu XP. Ação ignorada.`);
      return false;
    }
    
    // Atualiza os dados usando o Service puro
    const updatedData = GamificationService.awardAttendanceXP(currentData);
    
    // Marca o registro como processado (mantendo o histórico limitado aos últimos 5000)
    updatedData.processedEventIds = [...processedIds, attendanceRecordId].slice(-5000);
    
    // Salva
    await StorageService.saveGamificationData(updatedData);
    return true;
  }

  /**
   * Processa com segurança o ganho de XP genérico (ex: concluir tarefas), impedindo farming se houver ID.
   */
  static async safeAwardGenericXP(amount: number, eventId?: string): Promise<GamificationData> {
    const currentData = await StorageService.getGamificationData();
    const processedIds = currentData.processedEventIds || [];
    
    if (eventId && processedIds.includes(eventId)) {
      console.log(`[GamificationManager] Evento ${eventId} já rendeu XP. Ação ignorada.`);
      return currentData;
    }
    
    const updatedData = GamificationService.awardGenericXP(currentData, amount);
    
    if (eventId) {
      updatedData.processedEventIds = [...processedIds, eventId].slice(-5000);
    }
    
    await StorageService.saveGamificationData(updatedData);
    return updatedData;
  }
}

