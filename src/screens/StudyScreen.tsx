import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Subject, ThemeType, StudyTask, StudySession, StudyStreak, GamificationData } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { generateId, getLocalDateString } from '../utils';
import { StorageService } from '../services/storage';
import * as Haptics from 'expo-haptics';

interface Props {
  subjects: Subject[];
  tasks: StudyTask[];
  onUpdateTasks: (tasks: StudyTask[]) => void;
  sessions: StudySession[];
  onAddSession: (session: StudySession) => void;
  theme: ThemeType;
  focusMinutesDefault?: number;
  breakMinutesDefault?: number;
  onOpenAchievements?: () => void;
  onOpenAnalytics?: () => void;
}

export const StudyScreen: React.FC<Props> = ({
  subjects,
  tasks,
  onUpdateTasks,
  sessions,
  onAddSession,
  theme,
  focusMinutesDefault = 25,
  breakMinutesDefault = 5,
  onOpenAchievements,
  onOpenAnalytics,
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [activeTab, setActiveTab] = useState<'pomodoro' | 'cronometro' | 'tarefas'>('pomodoro');
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  
  // Pomodoro State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(Array.isArray(subjects) && subjects.length > 0 ? subjects[0].id : null);
  const [activeFocusMinutes, setActiveFocusMinutes] = useState<number>(focusMinutesDefault);
  const [timeLeft, setTimeLeft] = useState(focusMinutesDefault * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  // Stopwatch (Cronômetro Livre) State
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchSubjectId, setStopwatchSubjectId] = useState<string | null>(Array.isArray(subjects) && subjects.length > 0 ? subjects[0].id : null);

  // Banner/Toast message instead of browser alert
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Streak State
  const [streak, setStreak] = useState<StudyStreak>({ currentStreak: 0, longestStreak: 0, lastStudyDate: '' });

  // Tarefas State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState<string | null>(null);
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [selectedFilterSubject, setSelectedFilterSubject] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stopwatchRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadStreak();
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    };
  }, []);

  // Sync selected subjects when subjects array changes
  useEffect(() => {
    if (subjects.length > 0) {
      if (!selectedSubjectId || !subjects.some(s => s.id === selectedSubjectId)) {
        setSelectedSubjectId(subjects[0].id);
      }
      if (!stopwatchSubjectId || !subjects.some(s => s.id === stopwatchSubjectId)) {
        setStopwatchSubjectId(subjects[0].id);
      }
    }
  }, [subjects]);

  // Dynamic sync: when focusMinutesDefault or breakMinutesDefault change from Settings props,
  // update timeLeft immediately if the timer is idle (!isActive).
  useEffect(() => {
    if (!isActive) {
      if (!isBreak) {
        setActiveFocusMinutes(focusMinutesDefault);
        setTimeLeft(focusMinutesDefault * 60);
      } else {
        setTimeLeft(breakMinutesDefault * 60);
      }
    }
  }, [focusMinutesDefault, breakMinutesDefault, isBreak, isActive]);

  const loadStreak = async () => {
    const s = await StorageService.getStreak();
    const g = await StorageService.getGamificationData();
    setStreak(s);
    setGamification(g);
  };

  const updateStreakOnSessionSaved = async () => {
    const todayStr = getLocalDateString();
    let newStreak = { ...streak };

    if (streak.lastStudyDate === todayStr) {
      // already studied today
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    if (streak.lastStudyDate === yesterdayStr) {
      newStreak.currentStreak += 1;
    } else {
      newStreak.currentStreak = 1;
    }

    if (newStreak.currentStreak > newStreak.longestStreak) {
      newStreak.longestStreak = newStreak.currentStreak;
    }
    newStreak.lastStudyDate = todayStr;

    setStreak(newStreak);
    await StorageService.saveStreak(newStreak);
  };

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage({ text, type });
    Haptics.notificationAsync(
      type === 'success' 
        ? Haptics.NotificationFeedbackType.Success 
        : Haptics.NotificationFeedbackType.Warning
    );
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Pomodoro timer tick without clock drift
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  // Handle pomodoro completion when timeLeft reaches 0
  useEffect(() => {
    if (timeLeft === 0 && isActive) {
      handlePomodoroComplete();
    }
  }, [timeLeft, isActive]);

  // Stopwatch timer tick
  useEffect(() => {
    if (isStopwatchRunning) {
      stopwatchRef.current = setInterval(() => {
        setStopwatchSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    }
    return () => {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    };
  }, [isStopwatchRunning]);

  const handlePomodoroComplete = async () => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    const subId = selectedSubjectId || (subjects.length > 0 ? subjects[0].id : null);
    if (!isBreak && subId) {
      const sessionDurationMin = activeFocusMinutes || focusMinutesDefault;
      const newSession: StudySession = {
        id: generateId('sess'),
        subjectId: subId,
        durationMs: sessionDurationMin * 60 * 1000,
        date: getLocalDateString(),
      };
      onAddSession(newSession);
      await updateStreakOnSessionSaved();
      const updatedGamification = await StorageService.addXP(50, sessionDurationMin);
      setGamification(updatedGamification);
      showToast(`🎉 Sessão de ${sessionDurationMin}min concluída! (+50 XP) Hora do descanso.`, 'success');
      setIsBreak(true);
      setTimeLeft(breakMinutesDefault * 60);
    } else {
      showToast('⚡ Descanso finalizado! Hora de retomar o foco.', 'info');
      setIsBreak(false);
      setTimeLeft((activeFocusMinutes || focusMinutesDefault) * 60);
    }
  };

  const toggleTimer = () => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
    if (!selectedSubjectId && subjects.length === 0) {
      showToast('Cadastre uma matéria antes de iniciar o timer.', 'warning');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsActive(false);
    setIsBreak(false);
    setTimeLeft((activeFocusMinutes || focusMinutesDefault) * 60);
  };

  const handleSelectPreset = (minutes: number) => {
    if (isActive) {
      showToast('Pause o timer para alterar a duração.', 'warning');
      return;
    }
    Haptics.selectionAsync();
    setActiveFocusMinutes(minutes);
    if (!isBreak) {
      setTimeLeft(minutes * 60);
    }
  };

  const toggleStopwatch = () => {
    if (!stopwatchSubjectId && subjects.length > 0) {
      setStopwatchSubjectId(subjects[0].id);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsStopwatchRunning(!isStopwatchRunning);
  };

  const resetStopwatch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsStopwatchRunning(false);
    setStopwatchSeconds(0);
    showToast('Cronômetro zerado.', 'info');
  };

  const saveAndResetStopwatch = async () => {
    if (stopwatchSeconds < 30) {
      showToast('Estude por pelo menos 30 segundos para salvar a sessão.', 'warning');
      return;
    }

    const subId = stopwatchSubjectId || (subjects.length > 0 ? subjects[0].id : null);
    if (!subId) {
      showToast('Selecione uma matéria para salvar a sessão.', 'warning');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newSession: StudySession = {
      id: generateId('sess'),
      subjectId: subId,
      durationMs: stopwatchSeconds * 1000,
      date: getLocalDateString(),
    };
    onAddSession(newSession);
    await updateStreakOnSessionSaved();

    const minutes = Math.max(1, Math.floor(stopwatchSeconds / 60));
    // Proportional XP: ~2 XP per minute, minimum 10 XP
    const xpGained = Math.max(10, Math.round(minutes * 2));
    const updatedGamification = await StorageService.addXP(xpGained, minutes);
    setGamification(updatedGamification);
    showToast(`🎉 Sessão de ${minutes} min salva! (+${xpGained} XP)`, 'success');

    setIsStopwatchRunning(false);
    setStopwatchSeconds(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatStopwatch = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (ms: number) => {
    const hrs = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const getSubjectTotalTime = (subId: string) => {
    const subSessions = sessions.filter(s => s.subjectId === subId);
    return subSessions.reduce((acc, curr) => acc + curr.durationMs, 0);
  };

  // Total time studied today
  const todayTotalStudyMs = useMemo(() => {
    const todayStr = getLocalDateString();
    return sessions
      .filter(s => s.date === todayStr)
      .reduce((acc, curr) => acc + curr.durationMs, 0);
  }, [sessions]);

  // Tarefas Handlers
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newTask: StudyTask = {
      id: generateId('task'),
      title: newTaskTitle.trim(),
      isCompleted: false,
      subjectId: taskSubjectId || undefined,
      priority: taskPriority,
    };
    onUpdateTasks([...tasks, newTask]);
    setNewTaskTitle('');
  };

  const toggleTask = async (taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = tasks.find(t => t.id === taskId);
    const willComplete = target ? !target.isCompleted : false;
    const updated = tasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
    onUpdateTasks(updated);

    if (willComplete) {
      const g = await StorageService.addXP(30);
      setGamification(g);
      showToast('Tarefa concluída! (+30 XP) 🎯', 'success');
    }
  };

  const deleteTask = (taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = tasks.filter(t => t.id !== taskId);
    onUpdateTasks(updated);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedFilterSubject && t.subjectId !== selectedFilterSubject) return false;
      return true;
    });
  }, [tasks, selectedFilterSubject]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.headerTitle}>Estudos</Text>
          {gamification && (
            <TouchableOpacity
              style={[styles.levelBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
              onPress={() => {
                Haptics.selectionAsync();
                if (onOpenAchievements) onOpenAchievements();
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>
                Nv. {gamification.level} 🎓
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onOpenAnalytics && (
            <TouchableOpacity
              style={[styles.headerActionBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
              onPress={() => {
                Haptics.selectionAsync();
                onOpenAnalytics();
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>📈 Stats</Text>
            </TouchableOpacity>
          )}

          {streak.currentStreak > 0 && (
            <View style={[styles.streakBadge, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.warning }}>
                🔥 {streak.currentStreak} {streak.currentStreak === 1 ? 'dia' : 'dias'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Toast banner */}
      {toastMessage && (
        <View style={[
          styles.toastBanner,
          {
            backgroundColor: toastMessage.type === 'success' 
              ? colors.success 
              : toastMessage.type === 'warning' 
                ? colors.warning 
                : colors.primary
          }
        ]}>
          <Text style={{
            color: getContrastTextColor(
              toastMessage.type === 'success' ? colors.success : toastMessage.type === 'warning' ? colors.warning : colors.primary
            ),
            fontWeight: '700',
            fontSize: 13,
            textAlign: 'center'
          }}>
            {toastMessage.text}
          </Text>
        </View>
      )}

      {/* Navigation tabs */}
      <View style={styles.tabsRow}>
        {[
          { id: 'pomodoro', label: '🍅 Pomodoro' },
          { id: 'cronometro', label: '⏱️ Cronômetro' },
          { id: 'tarefas', label: '📝 Tarefas' }
        ].map(t => {
          const isSelected = activeTab === t.id;
          return (
            <TouchableOpacity 
              key={t.id}
              style={[
                styles.tab,
                isSelected && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
              ]} 
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(t.id as any);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.tabText,
                { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: isSelected ? '800' : '600' }
              ]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'pomodoro' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Matéria em Foco</Text>
            
            {subjects.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {subjects.map(sub => {
                  const isSelected = selectedSubjectId === sub.id;
                  const chipBg = isSelected ? (sub.color || colors.primary) : colors.surfaceSubtle;
                  const textColor = isSelected ? getContrastTextColor(sub.color || colors.primary) : colors.text;

                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.subjectChip,
                        {
                          backgroundColor: chipBg,
                          borderWidth: 1,
                          borderColor: isSelected ? (sub.color || colors.primary) : colors.border
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedSubjectId(sub.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: textColor, fontWeight: '700', fontSize: 13 }}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 14 }}>
                Nenhuma matéria cadastrada. Adicione matérias para vincular seus estudos.
              </Text>
            )}

            {/* Quick Presets */}
            <View style={styles.presetsContainer}>
              <Text style={[styles.presetsLabel, { color: colors.textSecondary }]}>⏱️ Duração rápida:</Text>
              <View style={styles.presetsRow}>
                {[15, 25, 45, 50, 60].map((presetMin) => {
                  const isPresetSelected = !isBreak && activeFocusMinutes === presetMin;
                  return (
                    <TouchableOpacity
                      key={presetMin}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: isPresetSelected ? colors.primary : colors.surfaceSubtle,
                          borderColor: isPresetSelected ? colors.primary : colors.border,
                        }
                      ]}
                      onPress={() => handleSelectPreset(presetMin)}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        color: isPresetSelected ? getContrastTextColor(colors.primary) : colors.text,
                        fontWeight: '700',
                        fontSize: 12
                      }}>
                        {presetMin}m
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.timerContainer}>
              <View style={[
                styles.statePill,
                {
                  backgroundColor: isBreak ? colors.successLight : colors.primaryLight,
                  borderColor: isBreak ? colors.success : colors.primary
                }
              ]}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: isBreak ? colors.success : colors.primary }}>
                  {isBreak ? `☕ Descanso (${breakMinutesDefault}m)` : `🎯 Foco Total (${activeFocusMinutes}m)`}
                </Text>
              </View>

              <Text style={[styles.timerText, { color: colors.text }]}>{formatTime(timeLeft)}</Text>
              
              <View style={styles.timerControls}>
                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: colors.primary }]}
                  onPress={toggleTimer}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timerButtonText, { color: getContrastTextColor(colors.primary) }]}>
                    {isActive ? '⏸️ Pausar' : '▶️ Iniciar Foco'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border }]}
                  onPress={resetTimer}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timerButtonText, { color: colors.text }]}>🔄 Resetar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Daily study overview card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Tempo Hoje</Text>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
                {formatTotalTime(todayTotalStudyMs)}
              </Text>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10 }}>Distribuição por matéria:</Text>

            {subjects.map(sub => {
              const total = getSubjectTotalTime(sub.id);
              if (total === 0) return null;
              return (
                <View key={sub.id} style={[styles.statRow, { borderBottomColor: colors.borderSubtle }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sub.color || colors.primary, marginRight: 8 }} />
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{sub.name}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{formatTotalTime(total)}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : activeTab === 'cronometro' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Cronômetro Livre</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 15 }}>
              Contagem progressiva: estude no seu próprio ritmo e salve a sessão ao terminar.
            </Text>

            {subjects.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {subjects.map(sub => {
                  const isSelected = stopwatchSubjectId === sub.id;
                  const chipBg = isSelected ? (sub.color || colors.primary) : colors.surfaceSubtle;
                  const textColor = isSelected ? getContrastTextColor(sub.color || colors.primary) : colors.text;

                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.subjectChip,
                        {
                          backgroundColor: chipBg,
                          borderWidth: 1,
                          borderColor: isSelected ? (sub.color || colors.primary) : colors.border
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setStopwatchSubjectId(sub.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: textColor, fontWeight: '700', fontSize: 13 }}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 15 }}>
                Nenhuma matéria cadastrada.
              </Text>
            )}

            <View style={styles.timerContainer}>
              <Text style={[styles.timerText, { color: colors.text }]}>{formatStopwatch(stopwatchSeconds)}</Text>
              
              <View style={styles.timerControls}>
                <TouchableOpacity
                  style={[
                    styles.timerButton,
                    { backgroundColor: isStopwatchRunning ? colors.danger : colors.primary }
                  ]}
                  onPress={toggleStopwatch}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.timerButtonText,
                    { color: isStopwatchRunning ? getContrastTextColor(colors.danger) : getContrastTextColor(colors.primary) }
                  ]}>
                    {isStopwatchRunning ? '⏸️ Pausar' : '▶️ Iniciar'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: colors.success }]}
                  onPress={saveAndResetStopwatch}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timerButtonText, { color: getContrastTextColor(colors.success) }]}>💾 Salvar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border }]}
                  onPress={resetStopwatch}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timerButtonText, { color: colors.text }]}>🔄 Zerar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Daily study overview card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Tempo Hoje</Text>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
                {formatTotalTime(todayTotalStudyMs)}
              </Text>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10 }}>Distribuição por matéria:</Text>

            {subjects.map(sub => {
              const total = getSubjectTotalTime(sub.id);
              if (total === 0) return null;
              return (
                <View key={sub.id} style={[styles.statRow, { borderBottomColor: colors.borderSubtle }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sub.color || colors.primary, marginRight: 8 }} />
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{sub.name}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{formatTotalTime(total)}</Text>
                </View>
              );
            })}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>
          {/* Add Task Box */}
          <View style={[styles.addTaskContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.taskInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Adicionar nova tarefa..."
              placeholderTextColor={colors.textSecondary}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              onSubmitEditing={handleAddTask}
            />

            {/* Subject selector for task */}
            {subjects.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginBottom: 10 }}>
                <TouchableOpacity
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: !taskSubjectId ? colors.primary : colors.surfaceSubtle,
                      borderWidth: 1,
                      borderColor: !taskSubjectId ? colors.primary : colors.border,
                      paddingVertical: 5
                    }
                  ]}
                  onPress={() => setTaskSubjectId(null)}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: !taskSubjectId ? getContrastTextColor(colors.primary) : colors.text,
                    fontSize: 12,
                    fontWeight: '700'
                  }}>
                    Geral
                  </Text>
                </TouchableOpacity>
                {subjects.map(sub => {
                  const isSelected = taskSubjectId === sub.id;
                  const chipBg = isSelected ? (sub.color || colors.primary) : colors.surfaceSubtle;
                  const textColor = isSelected ? getContrastTextColor(sub.color || colors.primary) : colors.text;

                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.subjectChip,
                        {
                          backgroundColor: chipBg,
                          borderWidth: 1,
                          borderColor: isSelected ? (sub.color || colors.primary) : colors.border,
                          paddingVertical: 5
                        }
                      ]}
                      onPress={() => setTaskSubjectId(sub.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Priority selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>Prioridade:</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[
                  { id: 'low', label: '🟢 Baixa' },
                  { id: 'medium', label: '🟡 Média' },
                  { id: 'high', label: '🔴 Alta' }
                ].map(p => {
                  const isSelected = taskPriority === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.priorityBtn,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : colors.border
                        }
                      ]}
                      onPress={() => setTaskPriority(p.id as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        fontSize: 11,
                        color: isSelected ? getContrastTextColor(colors.primary) : colors.text,
                        fontWeight: '700'
                      }}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddTask}
              activeOpacity={0.8}
            >
              <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '700', fontSize: 14 }}>
                + Adicionar Tarefa
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter tasks by subject */}
          {subjects.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: !selectedFilterSubject ? colors.primary : colors.surface,
                    borderColor: !selectedFilterSubject ? colors.primary : colors.border
                  }
                ]}
                onPress={() => setSelectedFilterSubject(null)}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: !selectedFilterSubject ? getContrastTextColor(colors.primary) : colors.text,
                  fontSize: 12,
                  fontWeight: '700'
                }}>
                  Todas ({tasks.length})
                </Text>
              </TouchableOpacity>
              {subjects.map(s => {
                const count = tasks.filter(t => t.subjectId === s.id).length;
                const isSelected = selectedFilterSubject === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border
                      }
                    ]}
                    onPress={() => setSelectedFilterSubject(s.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      color: isSelected ? getContrastTextColor(colors.primary) : colors.text,
                      fontSize: 12,
                      fontWeight: '700'
                    }}>
                      {s.name} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Task list */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {filteredTasks.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 30 }}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📝</Text>
                <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '600' }}>
                  Nenhuma tarefa pendente! 🎉
                </Text>
              </View>
            ) : (
              filteredTasks.sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted)).map(task => {
                const sub = subjects.find(s => s.id === task.subjectId);
                return (
                  <View key={task.id} style={[styles.taskRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TouchableOpacity
                      onPress={() => toggleTask(task.id)}
                      style={[
                        styles.checkbox,
                        {
                          borderColor: task.isCompleted ? colors.primary : colors.border,
                          backgroundColor: task.isCompleted ? colors.primary : 'transparent'
                        }
                      ]}
                      activeOpacity={0.7}
                    >
                      {task.isCompleted && (
                        <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800', fontSize: 13 }}>✓</Text>
                      )}
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{
                        color: task.isCompleted ? colors.textSecondary : colors.text,
                        textDecorationLine: task.isCompleted ? 'line-through' : 'none',
                        fontSize: 15,
                        fontWeight: '600'
                      }}>
                        {task.title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        {sub && (
                          <Text style={{ color: sub.color || colors.primary, fontSize: 11, fontWeight: '700' }}>
                            {sub.name}
                          </Text>
                        )}
                        {task.priority === 'high' && (
                          <Text style={{ fontSize: 10, color: colors.danger, fontWeight: '700' }}>• Urgente</Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => deleteTask(task.id)} style={{ padding: 6 }} activeOpacity={0.7}>
                      <Text style={{ color: colors.danger, fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1 },
  headerActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  streakBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  toastBanner: { marginHorizontal: 18, padding: 12, borderRadius: 12, marginBottom: 10 },
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabText: { fontSize: 13 },
  content: { flex: 1, padding: 16 },
  card: {
    padding: 18,
    borderRadius: 18,
    marginBottom: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 14 },
  subjectChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8 },
  presetsContainer: { marginBottom: 12 },
  presetsLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  presetsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statePill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 10, borderWidth: 1 },
  timerContainer: { alignItems: 'center', paddingVertical: 15 },
  timerText: { fontSize: 58, fontWeight: '800', marginBottom: 18, fontVariant: ['tabular-nums'], letterSpacing: 2 },
  timerControls: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  timerButton: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22 },
  timerButtonText: { fontSize: 14, fontWeight: '700' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  addTaskContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  taskInput: { padding: 12, borderRadius: 12, borderWidth: 1, fontSize: 14 },
  priorityBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addButton: { padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
});

