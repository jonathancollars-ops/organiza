import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeType, GamificationData, Achievement, StudyStreak, StudySession, AttendanceRecord } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { StorageService } from '../services/storage';
import { GamificationService } from '../services/GamificationService';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: ThemeType;
  studySessions?: StudySession[];
  streak?: StudyStreak;
  attendances?: AttendanceRecord[];
  onGamificationUpdate?: (data: GamificationData) => void;
}

/**
 * Limites de XP para cada nível de 0 até 51+ calculados pela curva balanceada do GamificationService
 */
export const LEVEL_THRESHOLDS: number[] = Array.from({ length: 52 }, (_, lvl) =>
  GamificationService.calculateXPForLevel(lvl)
);

/**
 * Mapa expandido de patentes e títulos acadêmicos do Nível 1 ao 50
 */
export const LEVEL_TITLES: { [level: number]: string } = {
  1: 'Calouro Iniciante 🎓',
  2: 'Sobrevivente da Matrícula 🎒',
  3: 'Explorador da Biblioteca 📖',
  4: 'Sobrevivente do Cálculo 📐',
  5: 'Monitor de Disciplina ⚡',
  6: 'Frequentador de Plantão ☕',
  7: 'Rato de Laboratório 🔬',
  8: 'Estrategista de Seminários 💡',
  9: 'Mestre das Listas de Exercício 📝',
  10: 'Veterano Exemplar 🏆',
  11: 'Articulador de Grupos 👥',
  12: 'Mago do Resumo 📄',
  13: 'Devorador de Ementas 📑',
  14: 'Guardião do Coeficiente 🛡️',
  15: 'Pesquisador de Iniciação Científica 🔍',
  16: 'Apresentador de Banner 🖼️',
  17: 'Publicador de Artigos 📜',
  18: 'Bolsista Notável 🏅',
  19: 'Analista de Dados Acadêmicos 📊',
  20: 'Pesquisador PIBIC de Destaque 🧪',
  21: 'Orador de Turma 🎙️',
  22: 'Mentor de Calouros 🤝',
  23: 'Especialista em TCC 📑',
  24: 'Defensor de Prévia 🛡️',
  25: 'Formando de Honra 🎓',
  26: 'Graduado Magna Cum Laude 🌟',
  27: 'Aspirante à Pós-Graduação 🏛️',
  28: 'Especialista Pós-Graduado 🎯',
  29: 'Bolsista CAPES/CNPq 💼',
  30: 'Mestre Acadêmico 🎖️',
  31: 'Palestrante de Simpósio 🎤',
  32: 'Revisor de Periódicos 🔎',
  33: 'Docente Assistente 👨‍🏫',
  34: 'Cientista Publicado 📚',
  35: 'Doutorando Incansável 🧬',
  36: 'Autor de Capítulo 📖',
  37: 'Líder de Grupo de Pesquisa 👥',
  38: 'Defensor de Tese ⚔️',
  39: 'Doutor com Louvor 📜',
  40: 'Pós-Doutor Honorável 👑',
  41: 'Pesquisador Produtividade 🚀',
  42: 'Coordenador de Laboratório 🔭',
  43: 'Professor Adjunto 🏛️',
  44: 'Membro de Banca Avaliadora ⚖️',
  45: 'Professor Titular Catedrático 💎',
  46: 'Embaixador da Ciência 🌐',
  47: 'Emérito do Conhecimento 🏛️',
  48: 'Grão-Mestre da Academia 🌌',
  49: 'Titã da Sabedoria ⚡',
  50: 'Lenda Acadêmica Suprema 👑🌌',
};

export function getLevelTitle(level: number): string {
  if (LEVEL_TITLES[level]) return LEVEL_TITLES[level];
  if (level > 50) return `Lenda Acadêmica Suprema (Nv. ${level}) 🌌`;
  return LEVEL_TITLES[1];
}

export const AchievementsModal: React.FC<Props> = ({
  visible,
  onClose,
  theme,
  studySessions = [],
  streak,
  attendances = [],
  onGamificationUpdate,
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [gamification, setGamification] = useState<GamificationData>({
    xp: 0,
    level: 1,
    unlockedAchievements: [],
    claimedAchievements: [],
    totalFocusMinutes: 0
  });

  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, studySessions, streak, attendances]);

  const loadData = async () => {
    const data = await StorageService.getGamificationData();
    if (data && typeof data === 'object') {
      setGamification(data);
    }
  };

  const safeStudySessions = Array.isArray(studySessions) ? studySessions.filter(Boolean) : [];
  const safeAttendances = Array.isArray(attendances) ? attendances.filter(Boolean) : [];
  const safeStreak = streak && typeof streak === 'object' ? streak : { currentStreak: 0, longestStreak: 0, lastStudyDate: '' };

  const totalFocusMinutes = Math.round(safeStudySessions.reduce((sum, s) => sum + (s?.durationMs || 0), 0) / (1000 * 60));
  const currentStreak = safeStreak.currentStreak || 0;
  const totalPresents = safeAttendances.filter(a => a?.status === 'present').length;

  const unlockedAchievementsSet = new Set(gamification?.unlockedAchievements || []);
  const claimedAchievementsSet = new Set(gamification?.claimedAchievements || []);

  const isAchUnlocked = (id: string, condition: boolean) =>
    condition || unlockedAchievementsSet.has(id) || claimedAchievementsSet.has(id);

  const achievements: Achievement[] = [
    {
      id: 'first_focus',
      title: 'Primeiro Foco',
      description: 'Complete sua 1ª sessão de estudo.',
      icon: '🎯',
      xp: 50,
      unlocked: isAchUnlocked('first_focus', safeStudySessions.length >= 1),
      progress: { current: Math.min(safeStudySessions.length, 1), total: 1 }
    },
    {
      id: 'streak_3',
      title: 'Em Chamas',
      description: '3 dias consecutivos.',
      icon: '🔥',
      xp: 100,
      unlocked: isAchUnlocked('streak_3', currentStreak >= 3),
      progress: { current: Math.min(currentStreak, 3), total: 3 }
    },
    {
      id: 'streak_7',
      title: 'Foco de Ferro',
      description: '7 dias consecutivos.',
      icon: '⚡',
      xp: 200,
      unlocked: isAchUnlocked('streak_7', currentStreak >= 7),
      progress: { current: Math.min(currentStreak, 7), total: 7 }
    },
    {
      id: 'focus_5h',
      title: 'Dedicação',
      description: '5h de estudo focado.',
      icon: '📚',
      xp: 150,
      unlocked: isAchUnlocked('focus_5h', totalFocusMinutes >= 300),
      progress: { current: Math.min(totalFocusMinutes, 300), total: 300 }
    },
    {
      id: 'focus_20h',
      title: 'Mente Brilhante',
      description: '20h de estudo focado.',
      icon: '🧠',
      xp: 300,
      unlocked: isAchUnlocked('focus_20h', totalFocusMinutes >= 1200),
      progress: { current: Math.min(totalFocusMinutes, 1200), total: 1200 }
    },
    {
      id: 'attendance_10',
      title: 'Presença VIP',
      description: '10 presenças em aulas.',
      icon: '✅',
      xp: 100,
      unlocked: isAchUnlocked('attendance_10', totalPresents >= 10),
      progress: { current: Math.min(totalPresents, 10), total: 10 }
    },
    {
      id: 'study_night',
      title: 'Coruja Noturna',
      description: 'Estude na madrugada (00h-04h).',
      icon: '🦉',
      xp: 100,
      unlocked: isAchUnlocked('study_night', safeStudySessions.some(s => {
        if (!s?.startTime) return false;
        const d = new Date(s.startTime);
        const h = d.getHours();
        return h >= 0 && h < 4;
      })),
      progress: { current: unlockedAchievementsSet.has('study_night') ? 1 : 0, total: 1 }
    },
    {
      id: 'level_5',
      title: 'Veterano dos Livros',
      description: 'Alcance o Nível 5.',
      icon: '⭐',
      xp: 150,
      unlocked: isAchUnlocked('level_5', (gamification?.level ?? 1) >= 5),
      progress: { current: Math.min(gamification?.level ?? 1, 5), total: 5 }
    },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const pendingAchievements = achievements.filter(a => a.unlocked && !claimedAchievementsSet.has(a.id));
  const totalPendingXP = pendingAchievements.reduce((sum, a) => sum + a.xp, 0);

  const currentLevel = Math.max(1, gamification?.level ?? 1);
  const currentXp = Math.max(0, gamification?.xp ?? 0);
  const levelTitle = getLevelTitle(currentLevel);

  const currentLevelXP = LEVEL_THRESHOLDS[currentLevel] ?? GamificationService.calculateXPForLevel(currentLevel);
  const nextLevelXP = LEVEL_THRESHOLDS[currentLevel + 1] ?? GamificationService.calculateXPForLevel(currentLevel + 1);
  const xpSpan = Math.max(1, nextLevelXP - currentLevelXP);
  const xpCurrentLevel = Math.max(0, currentXp - currentLevelXP);
  const xpNeeded = Math.max(0, nextLevelXP - currentXp);
  const xpProgressPercent = Math.min(100, Math.max(0, Math.round((xpCurrentLevel / xpSpan) * 100)));

  const handleClaimSingle = async (ach: Achievement) => {
    if (isClaiming) return;
    try {
      setIsClaiming(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updated = await StorageService.claimAchievementXP(ach.id, ach.xp);
      setGamification(updated);
      onGamificationUpdate?.(updated);
    } catch (e) {
      console.warn('[AchievementsModal] Failed to claim XP:', e);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClaimAll = async () => {
    if (isClaiming || pendingAchievements.length === 0) return;
    try {
      setIsClaiming(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updated = await StorageService.claimAllAchievementsXP(
        pendingAchievements.map(a => ({ id: a.id, xp: a.xp }))
      );
      setGamification(updated);
      onGamificationUpdate?.(updated);
    } catch (e) {
      console.warn('[AchievementsModal] Failed to claim all XP:', e);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onClose(); }} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700' }}>✕ Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conquistas & Nível</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Level Hero Card */}
          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
              <Text style={{ fontSize: 36 }}>🎓</Text>
            </View>

            <View style={[styles.levelPill, { backgroundColor: colors.primary }]}>
              <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800', fontSize: 13 }}>
                NÍVEL {currentLevel}
              </Text>
            </View>

            <Text style={[styles.levelTitleText, { color: colors.text }]}>{levelTitle}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
              {currentXp} XP acumulados
            </Text>

            {/* Level XP Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.xpBarTrack, { backgroundColor: colors.surfaceSubtle }]}>
                <View
                  style={[
                    styles.xpBarFill,
                    {
                      width: `${xpProgressPercent}%`,
                      backgroundColor: colors.primary
                    }
                  ]}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                  {xpCurrentLevel} / {xpSpan} XP
                </Text>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                  {xpNeeded} XP para Nível {currentLevel + 1}
                </Text>
              </View>
            </View>
          </View>

          {/* Claim All Banner when multiple achievements are pending */}
          {pendingAchievements.length > 1 && (
            <View style={[styles.claimAllBanner, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.claimAllTitle, { color: colors.text }]}>
                  Recompensas Pendentes! 🎁
                </Text>
                <Text style={[styles.claimAllSubtitle, { color: colors.textSecondary }]}>
                  Você tem {pendingAchievements.length} conquistas prontas ({totalPendingXP} XP disponíveis).
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.claimAllBtn, { backgroundColor: colors.primary }]}
                onPress={handleClaimAll}
                activeOpacity={0.8}
                disabled={isClaiming}
                accessibilityRole="button"
                accessibilityLabel={`Resgatar Tudo, mais ${totalPendingXP} XP`}
              >
                <Text style={[styles.claimAllBtnText, { color: getContrastTextColor(colors.primary) }]}>
                  🎁 Resgatar Tudo (+{totalPendingXP} XP)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Achievements Summary Banner */}
          <View style={[styles.summaryBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>🏆</Text>
              <View>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Medalhas de Conquistas</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                  {unlockedCount} de {achievements.length} desbloqueadas
                </Text>
              </View>
            </View>
            <View style={[styles.countBadge, { backgroundColor: colors.successLight }]}>
              <Text style={{ color: theme === 'light' ? colors.successDark : colors.success, fontWeight: '800', fontSize: 13 }}>
                {Math.round((unlockedCount / achievements.length) * 100)}%
              </Text>
            </View>
          </View>

          {/* Achievements Grid */}
          <Text style={styles.sectionTitle}>Mural de Medalhas</Text>

          <View style={styles.gridContainer}>
            {achievements.map((ach) => {
              const isClaimed = claimedAchievementsSet.has(ach.id);

              return (
                <View
                  key={ach.id}
                  style={[
                    styles.medalCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: ach.unlocked ? colors.primary : colors.borderSubtle,
                      opacity: ach.unlocked ? 1 : 0.6
                    }
                  ]}
                >
                  <View style={[styles.medalIconWrap, { backgroundColor: ach.unlocked ? colors.primaryLight : colors.surfaceSubtle }]}>
                    <Text style={{ fontSize: 32 }}>{ach.unlocked ? ach.icon : '🔒'}</Text>
                  </View>
                  <Text style={[styles.medalTitle, { color: colors.text }]} numberOfLines={1}>
                    {ach.title}
                  </Text>
                  <Text style={[styles.medalDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {ach.description}
                  </Text>
                  
                  {/* Action button: Claim / Claimed / Locked Progress */}
                  {ach.unlocked && !isClaimed ? (
                    <TouchableOpacity
                      style={[styles.claimBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleClaimSingle(ach)}
                      activeOpacity={0.8}
                      disabled={isClaiming}
                      accessibilityRole="button"
                      accessibilityLabel={`Coletar ${ach.xp} XP para conquista ${ach.title}`}
                    >
                      <Text style={[styles.claimBtnText, { color: getContrastTextColor(colors.primary) }]}>
                        ✨ Coletar +{ach.xp} XP
                      </Text>
                    </TouchableOpacity>
                  ) : isClaimed ? (
                    <View style={[styles.claimedBadge, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                      <Text style={[styles.claimedBadgeText, { color: colors.textSecondary }]}>
                        ✓ Coletado
                      </Text>
                    </View>
                  ) : ach.progress ? (
                    <View style={styles.medalProgressWrap}>
                      <View style={[styles.miniBarTrack, { backgroundColor: colors.surfaceSubtle }]}>
                        <View
                          style={[
                            styles.miniBarFill,
                            {
                              width: `${Math.min(100, Math.round((ach.progress.current / ach.progress.total) * 100))}%`,
                              backgroundColor: colors.primary
                            }
                          ]}
                        />
                      </View>
                      <Text style={[styles.miniProgressText, { color: colors.textMuted }]}>
                        {ach.progress.current} / {ach.progress.total}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.lockedBadge, { backgroundColor: colors.surfaceSubtle }]}>
                      <Text style={[styles.lockedBadgeText, { color: colors.textMuted }]}>
                        🔒 Bloqueado
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  content: { padding: 18 },
  heroCard: {
    alignItems: 'center', padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  levelPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 6 },
  levelTitleText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  progressContainer: { width: '100%', marginTop: 16 },
  xpBarTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  xpBarFill: { height: '100%', borderRadius: 5 },
  claimAllBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  claimAllTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  claimAllSubtitle: { fontSize: 11, lineHeight: 15 },
  claimAllBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  claimAllBtnText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  summaryBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 20,
  },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  
  /* Grid Styles */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  medalCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  medalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  medalTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  medalDesc: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 8,
  },
  medalProgressWrap: {
    width: '100%',
    marginTop: 'auto',
    alignItems: 'center',
  },
  miniBarTrack: { height: 4, borderRadius: 2, overflow: 'hidden', width: '100%' },
  miniBarFill: { height: '100%', borderRadius: 2 },
  miniProgressText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
  },
  claimBtn: {
    marginTop: 'auto',
    width: '100%',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBtnText: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  claimedBadge: {
    marginTop: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  claimedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  lockedBadge: {
    marginTop: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
  },
  lockedBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  }
});
