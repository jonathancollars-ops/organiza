import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeType, GamificationData, Achievement, StudyStreak, StudySession, AttendanceRecord, AACCActivity, GroupProject } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { StorageService } from '../services/storage';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: ThemeType;
  studySessions: StudySession[];
  streak: StudyStreak;
  attendances: AttendanceRecord[];
}

const LEVEL_TITLES: { [level: number]: string } = {
  1: 'Calouro Iniciante 🎓',
  2: 'Estudante Focado 📚',
  3: 'Pesquisador Dedicado 🔬',
  4: 'Estrategista Acadêmico 🧠',
  5: 'Veterano Exemplar ⚡',
  6: 'Mestre da Disciplina 🔥',
  7: 'Gabaritador Nato 🏆',
  8: 'Prodígio Universitário 🌟',
  9: 'Doutorando do Foco 👑',
  10: 'Lenda Acadêmica Suprema 🌌',
};

export const AchievementsModal: React.FC<Props> = ({
  visible,
  onClose,
  theme,
  studySessions,
  streak,
  attendances
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [gamification, setGamification] = useState<GamificationData>({
    xp: 0,
    level: 1,
    unlockedAchievements: [],
    totalFocusMinutes: 0
  });

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, studySessions, streak, attendances]);

  const loadData = async () => {
    const data = await StorageService.getGamificationData();
    setGamification(data);
  };

  const totalFocusMinutes = Math.round(studySessions.reduce((sum, s) => sum + (s.durationMs || 0), 0) / (1000 * 60));
  const currentStreak = streak.currentStreak || 0;
  const totalPresents = attendances.filter(a => a.status === 'present').length;

  // Compute Achievements List with real-time status
  const achievements: Achievement[] = [
    {
      id: 'first_focus',
      title: 'Primeiro Foco',
      description: 'Complete sua 1ª sessão de estudo ou Pomodoro.',
      icon: '🎯',
      xp: 50,
      unlocked: studySessions.length >= 1,
      progress: { current: Math.min(studySessions.length, 1), total: 1 }
    },
    {
      id: 'streak_3',
      title: 'Em Chamas',
      description: 'Mantenha um streak de 3 dias consecutivos de estudo.',
      icon: '🔥',
      xp: 100,
      unlocked: currentStreak >= 3,
      progress: { current: Math.min(currentStreak, 3), total: 3 }
    },
    {
      id: 'streak_7',
      title: 'Foco de Ferro',
      description: 'Mantenha um streak de 7 dias consecutivos de estudo.',
      icon: '⚡',
      xp: 200,
      unlocked: currentStreak >= 7,
      progress: { current: Math.min(currentStreak, 7), total: 7 }
    },
    {
      id: 'focus_5h',
      title: 'Dedicação Total',
      description: 'Acumule 5 horas (300 min) de estudo focado.',
      icon: '📚',
      xp: 150,
      unlocked: totalFocusMinutes >= 300,
      progress: { current: Math.min(totalFocusMinutes, 300), total: 300 }
    },
    {
      id: 'focus_20h',
      title: 'Mente Brilhante',
      description: 'Acumule 20 horas (1200 min) de estudo focado.',
      icon: '🧠',
      xp: 300,
      unlocked: totalFocusMinutes >= 1200,
      progress: { current: Math.min(totalFocusMinutes, 1200), total: 1200 }
    },
    {
      id: 'attendance_10',
      title: 'Presença VIP',
      description: 'Registre 10 presenças em aulas.',
      icon: '✅',
      xp: 100,
      unlocked: totalPresents >= 10,
      progress: { current: Math.min(totalPresents, 10), total: 10 }
    },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const levelTitle = LEVEL_TITLES[gamification.level] || 'Lenda Acadêmica 🌌';

  // XP calculations: 200 XP per level
  const xpCurrentLevel = gamification.xp % 200;
  const xpProgressPercent = Math.min(Math.round((xpCurrentLevel / 200) * 100), 100);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
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
                NÍVEL {gamification.level}
              </Text>
            </View>

            <Text style={[styles.levelTitleText, { color: colors.text }]}>{levelTitle}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
              {gamification.xp} XP acumulados
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
                  {xpCurrentLevel} / 200 XP
                </Text>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                  {200 - xpCurrentLevel} XP para o Nível {gamification.level + 1}
                </Text>
              </View>
            </View>
          </View>

          {/* Achievements Summary Banner */}
          <View style={[styles.summaryBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>🏆</Text>
              <View>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Medalhas Desbloqueadas</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                  {unlockedCount} de {achievements.length} conquistas alcançadas
                </Text>
              </View>
            </View>
            <View style={[styles.countBadge, { backgroundColor: colors.successLight }]}>
              <Text style={{ color: theme === 'light' ? colors.successDark : colors.success, fontWeight: '800', fontSize: 13 }}>
                {Math.round((unlockedCount / achievements.length) * 100)}%
              </Text>
            </View>
          </View>

          {/* Achievements List */}
          <Text style={styles.sectionTitle}>Todas as Conquistas</Text>

          {achievements.map(ach => (
            <View
              key={ach.id}
              style={[
                styles.achievementCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: ach.unlocked ? colors.primary : colors.borderSubtle,
                  borderWidth: ach.unlocked ? 1.5 : 1,
                  opacity: ach.unlocked ? 1 : 0.75
                }
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: ach.unlocked ? colors.primaryLight : colors.surfaceSubtle }]}>
                <Text style={{ fontSize: 26 }}>{ach.icon}</Text>
              </View>

              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.achTitle, { color: colors.text }]} numberOfLines={1}>
                    {ach.title}
                  </Text>
                  <View style={[styles.xpBadge, { backgroundColor: colors.surfaceSubtle }]}>
                    <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>+{ach.xp} XP</Text>
                  </View>
                </View>
                <Text style={[styles.achDesc, { color: colors.textSecondary }]}>
                  {ach.description}
                </Text>

                {/* Progress bar inside card */}
                {ach.progress && !ach.unlocked && (
                  <View style={{ marginTop: 8 }}>
                    <View style={[styles.miniBarTrack, { backgroundColor: colors.surfaceSubtle }]}>
                      <View
                        style={[
                          styles.miniBarFill,
                          {
                            width: `${(ach.progress.current / ach.progress.total) * 100}%`,
                            backgroundColor: colors.primary
                          }
                        ]}
                      />
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>
                      Progresso: {ach.progress.current} / {ach.progress.total}
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ justifyContent: 'center' }}>
                {ach.unlocked ? (
                  <View style={[styles.unlockedCheck, { backgroundColor: colors.successLight }]}>
                    <Text style={{ color: theme === 'light' ? colors.successDark : colors.success, fontWeight: '800', fontSize: 14 }}>✓</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 18 }}>🔒</Text>
                )}
              </View>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  content: {
    padding: 18,
  },
  heroCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  levelPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  levelTitleText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
  },
  xpBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  xpBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  achDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  miniBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  unlockedCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
