import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addDays, getDay, parseISO, startOfWeek, endOfWeek, isSameDay, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';

import { Subject, AppEvent, AttendanceRecord, ThemeType } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';

// Defensive wrapper for Haptics to protect against platforms/devices without vibration hardware
const safeHaptic = {
  impact: async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      await Haptics.impactAsync(style);
    } catch {
      // Safe fallback for devices/platforms without haptic support
    }
  },
  selection: async () => {
    try {
      await Haptics.selectionAsync();
    } catch {
      // Safe fallback
    }
  },
  notification: async (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Warning) => {
    try {
      await Haptics.notificationAsync(type);
    } catch {
      // Safe fallback
    }
  }
};

const formatDisplayDate = (dateStr: string): string => {
  try {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const clean = dateStr.split('T')[0];
    const parsed = parseISO(clean);
    if (!isValid(parsed)) return dateStr;
    return format(parsed, 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
};

export interface AbsencePlannerModalProps {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  events: AppEvent[];
  attendances: AttendanceRecord[];
  theme: ThemeType;
}

type SimulationMode = 'by_date' | 'by_subject';

interface AffectedSubjectResult {
  subject: Subject;
  missedClassesCount: number;
  currentAbsences: number;
  simulatedTotalAbsences: number;
  maxAbsences: number;
  safeMargin: number;
  estimatedPresenceRate: number;
  isAtRisk: boolean;
  isCritical: boolean;
  weeklyExams: AppEvent[];
}

export const AbsencePlannerModal: React.FC<AbsencePlannerModalProps> = ({
  visible,
  onClose,
  subjects,
  events,
  attendances,
  theme
}) => {
  const colors = getThemeColors(theme);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [mode, setMode] = useState<SimulationMode>('by_date');

  // Mode 1: By Date state
  const tomorrowStr = useMemo(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'), []);
  const [selectedDate, setSelectedDate] = useState<string>(tomorrowStr);

  // Mode 2: By Subject state (defensive against null/empty subjects array)
  const activeSubjects = useMemo(
    () => (Array.isArray(subjects) ? subjects.filter(s => Boolean(s && !s.isArchived)) : []),
    [subjects]
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(activeSubjects[0]?.id || '');
  const [subjectAbsenceCount, setSubjectAbsenceCount] = useState<number>(1);

  // Sync selectedSubjectId if activeSubjects change
  useEffect(() => {
    if (!activeSubjects.some(s => s.id === selectedSubjectId) && activeSubjects.length > 0) {
      setSelectedSubjectId(activeSubjects[0].id);
    }
  }, [activeSubjects, selectedSubjectId]);

  // Quick Date Chips: Amanhã, Próxima Sexta, Próxima Segunda
  const quickDateChips = useMemo(() => {
    const today = new Date();

    // Amanhã
    const tomorrow = addDays(today, 1);

    // Próxima Sexta
    const day = today.getDay(); // 0 is Sunday, 5 is Friday
    const diffFriday = (5 - day + 7) % 7 || 7;
    const nextFriday = addDays(today, diffFriday);

    // Próxima Segunda
    const diffMonday = (1 - day + 7) % 7 || 7;
    const nextMonday = addDays(today, diffMonday);

    return [
      { id: 'tomorrow', label: 'Amanhã', dateStr: format(tomorrow, 'yyyy-MM-dd'), dateObj: tomorrow },
      { id: 'friday', label: 'Próx. Sexta', dateStr: format(nextFriday, 'yyyy-MM-dd'), dateObj: nextFriday },
      { id: 'monday', label: 'Próx. Segunda', dateStr: format(nextMonday, 'yyyy-MM-dd'), dateObj: nextMonday },
    ];
  }, []);

  // Next 14 days scrollable list
  const nextDays = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 1; i <= 14; i++) {
      const d = addDays(today, i);
      days.push({
        dateStr: format(d, 'yyyy-MM-dd'),
        dateObj: d,
        dayName: format(d, 'EEE', { locale: ptBR }),
        dayMonth: format(d, 'dd/MM')
      });
    }
    return days;
  }, []);

  // Helper to count current absences
  const getCurrentAbsences = (subjectId: string): number => {
    if (!Array.isArray(attendances) || !subjectId) return 0;
    return attendances.filter(a => a && a.subjectId === subjectId && a.status === 'absent').length;
  };

  // Helper to find exams in the same week as a given date for a subject
  const getWeeklyExams = (subjectId: string, targetDateStr: string): AppEvent[] => {
    try {
      if (!subjectId || !targetDateStr || typeof targetDateStr !== 'string' || !Array.isArray(events)) {
        return [];
      }
      const cleanTarget = targetDateStr.split('T')[0];
      const targetObj = parseISO(cleanTarget);
      if (!isValid(targetObj)) return [];

      const weekStart = format(startOfWeek(targetObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(targetObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');

      return events.filter(e => {
        if (!e || e.subjectId !== subjectId) return false;
        const isExamCategory = e.category === 'Provas/Trabalhos';
        const titleLower = (e.title || '').toLowerCase();
        const isExamTitle = titleLower.includes('prova') || titleLower.includes('trabalho') || titleLower.includes('exame');
        if (!isExamCategory && !isExamTitle) return false;
        
        const eDateStr = (e.date || '').split('T')[0];
        if (!eDateStr) return false;
        const parsedEDate = parseISO(eDateStr);
        if (!isValid(parsedEDate)) return false;

        return eDateStr >= weekStart && eDateStr <= weekEnd;
      });
    } catch {
      return [];
    }
  };

  // Calculations for Mode 1: By Date
  const dateSimulationResults: AffectedSubjectResult[] = useMemo(() => {
    if (mode !== 'by_date' || !selectedDate || typeof selectedDate !== 'string') return [];
    try {
      const cleanDate = selectedDate.split('T')[0];
      const targetObj = parseISO(cleanDate);
      if (!isValid(targetObj)) return [];
      const targetDayOfWeek = getDay(targetObj); // 0 = Sunday, 1 = Monday, etc.

      // Find all class events on that date
      const matchedEvents = (events || []).filter(e => {
        if (!e || e.category !== 'Faculdade/Aulas') return false;
        if (!e.subjectId) return false;

        // If weekly recurring
        if (e.recurrence === 'weekly') {
          if (Array.isArray(e.recurrenceDays) && e.recurrenceDays.length > 0) {
            return e.recurrenceDays.includes(targetDayOfWeek);
          }
          if (!e.date) return false;
          const parsedEDate = parseISO(e.date);
          if (!isValid(parsedEDate)) return false;
          const eventDayOfWeek = getDay(parsedEDate);
          return eventDayOfWeek === targetDayOfWeek;
        }

        // Single event matching date
        const eDateStr = (e.date || '').split('T')[0];
        return eDateStr === cleanDate;
      });

      // Group by active subject
      const subjectCountMap = new Map<string, number>();
      matchedEvents.forEach(e => {
        if (e.subjectId) {
          const current = subjectCountMap.get(e.subjectId) || 0;
          subjectCountMap.set(e.subjectId, current + 1);
        }
      });

      const results: AffectedSubjectResult[] = [];
      subjectCountMap.forEach((missedCount, subjectId) => {
        const subject = activeSubjects.find(s => s.id === subjectId);
        if (!subject) return;

        const currentAbsences = getCurrentAbsences(subjectId);
        const simulatedTotalAbsences = currentAbsences + missedCount;

        // Safe max absences fallback (never <= 0)
        let calculatedMax = typeof subject.maxAbsences === 'number' && !isNaN(subject.maxAbsences) && subject.maxAbsences > 0
          ? subject.maxAbsences
          : (subject.workloadHours && subject.workloadHours > 0 ? Math.floor(subject.workloadHours * 0.25) : 15);

        if (!calculatedMax || calculatedMax <= 0) {
          calculatedMax = subject.workloadHours && subject.workloadHours > 0
            ? Math.max(1, Math.floor(subject.workloadHours * 0.25))
            : 15;
        }
        const maxAbsences = Math.max(1, calculatedMax);
        const safeMargin = maxAbsences - simulatedTotalAbsences;

        // Estimated presence rate (guaranteed totalExpectedClasses >= 1 to prevent division by zero)
        const rawExpected = subject.workloadHours && subject.workloadHours > 0
          ? Math.round(subject.workloadHours / 2)
          : (maxAbsences * 4);
        const totalExpectedClasses = Math.max(1, rawExpected || (maxAbsences * 4) || 60);
        const estimatedPresenceRate = Math.max(
          0,
          Math.min(100, Math.round(((totalExpectedClasses - simulatedTotalAbsences) / totalExpectedClasses) * 1000) / 10)
        );

        const isCritical = simulatedTotalAbsences >= maxAbsences;
        const isAtRisk = !isCritical && ((simulatedTotalAbsences / maxAbsences) >= 0.70 || safeMargin <= 2);
        const weeklyExams = getWeeklyExams(subjectId, cleanDate);

        results.push({
          subject,
          missedClassesCount: missedCount,
          currentAbsences,
          simulatedTotalAbsences,
          maxAbsences,
          safeMargin,
          estimatedPresenceRate,
          isAtRisk,
          isCritical,
          weeklyExams
        });
      });

      return results;
    } catch {
      return [];
    }
  }, [mode, selectedDate, events, activeSubjects, attendances]);

  // Calculations for Mode 2: By Subject
  const subjectSimulationResults: AffectedSubjectResult[] = useMemo(() => {
    if (mode !== 'by_subject') return [];
    const subject = activeSubjects.find(s => s.id === selectedSubjectId);
    if (!subject) return [];

    const currentAbsences = getCurrentAbsences(subject.id);
    const simulatedTotalAbsences = currentAbsences + Math.max(1, subjectAbsenceCount || 1);

    // Safe max absences fallback (never <= 0)
    let calculatedMax = typeof subject.maxAbsences === 'number' && !isNaN(subject.maxAbsences) && subject.maxAbsences > 0
      ? subject.maxAbsences
      : (subject.workloadHours && subject.workloadHours > 0 ? Math.floor(subject.workloadHours * 0.25) : 15);

    if (!calculatedMax || calculatedMax <= 0) {
      calculatedMax = subject.workloadHours && subject.workloadHours > 0
        ? Math.max(1, Math.floor(subject.workloadHours * 0.25))
        : 15;
    }
    const maxAbsences = Math.max(1, calculatedMax);
    const safeMargin = maxAbsences - simulatedTotalAbsences;

    const rawExpected = subject.workloadHours && subject.workloadHours > 0
      ? Math.round(subject.workloadHours / 2)
      : (maxAbsences * 4);
    const totalExpectedClasses = Math.max(1, rawExpected || (maxAbsences * 4) || 60);
    const estimatedPresenceRate = Math.max(
      0,
      Math.min(100, Math.round(((totalExpectedClasses - simulatedTotalAbsences) / totalExpectedClasses) * 1000) / 10)
    );

    const isCritical = simulatedTotalAbsences >= maxAbsences;
    const isAtRisk = !isCritical && ((simulatedTotalAbsences / maxAbsences) >= 0.70 || safeMargin <= 2);

    // Check upcoming exams for this subject in the next 7 days
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const inSevenDaysStr = format(addDays(today, 7), 'yyyy-MM-dd');
    const weeklyExams = (events || []).filter(e => {
      if (!e || e.subjectId !== subject.id) return false;
      const isExamCategory = e.category === 'Provas/Trabalhos';
      const titleLower = (e.title || '').toLowerCase();
      const isExamTitle = titleLower.includes('prova') || titleLower.includes('trabalho') || titleLower.includes('exame');
      if (!isExamCategory && !isExamTitle) return false;
      const eDateStr = (e.date || '').split('T')[0];
      if (!eDateStr) return false;
      const parsedEDate = parseISO(eDateStr);
      if (!isValid(parsedEDate)) return false;
      return eDateStr >= todayStr && eDateStr <= inSevenDaysStr;
    });

    return [{
      subject,
      missedClassesCount: Math.max(1, subjectAbsenceCount || 1),
      currentAbsences,
      simulatedTotalAbsences,
      maxAbsences,
      safeMargin,
      estimatedPresenceRate,
      isAtRisk,
      isCritical,
      weeklyExams
    }];
  }, [mode, selectedSubjectId, subjectAbsenceCount, activeSubjects, events, attendances]);

  const activeResults = mode === 'by_date' ? dateSimulationResults : subjectSimulationResults;

  // Overall Verdict evaluation
  const verdict = useMemo(() => {
    if (activeSubjects.length === 0) {
      return {
        level: 'empty' as const,
        badgeText: '📚 Nenhuma disciplina ativa encontrada',
        description: 'Cadastre suas matérias para simular o limite de faltas e planejar ausências.',
        color: colors.info,
        bgColor: colors.surfaceSubtle,
        borderColor: colors.border
      };
    }

    if (mode === 'by_date' && activeResults.length === 0) {
      return {
        level: 'empty' as const,
        badgeText: '🏖️ Nenhuma aula programada para este dia!',
        description: 'Você não possui aulas registradas neste dia. Pode aproveitar sem qualquer impacto em presenças.',
        color: colors.info,
        bgColor: colors.surfaceSubtle,
        borderColor: colors.border
      };
    }

    const hasCritical = activeResults.some(r => r.isCritical);
    const hasRisk = activeResults.some(r => r.isAtRisk);

    if (hasCritical) {
      return {
        level: 'danger' as const,
        badgeText: '🔴 Cuidado! Risco iminente de reprovação por falta.',
        description: 'A simulação atinge ou ultrapassa o limite máximo permitido de faltas. Reprovação iminente!',
        color: colors.danger,
        bgColor: colors.dangerLight,
        borderColor: colors.danger
      };
    }

    if (hasRisk) {
      return {
        level: 'warning' as const,
        badgeText: '🟡 Atenção! Faltar te deixará perto do limite.',
        description: 'Você entrará na zona de alerta (acima de 70% do teto de faltas). Considere guardar suas faltas para emergências.',
        color: colors.warning,
        bgColor: colors.warningLight,
        borderColor: colors.warning
      };
    }

    return {
      level: 'success' as const,
      badgeText: '🟢 Pode relaxar! Suas faltas estão sob controle.',
      description: 'Você possui margem segura de faltas restantes em todas as disciplinas afetadas.',
      color: colors.success,
      bgColor: colors.successLight,
      borderColor: colors.success
    };
  }, [mode, activeResults, activeSubjects, colors]);

  // Haptic feedback upon critical verdicts (safely wrapped)
  useEffect(() => {
    if (visible && verdict.level === 'danger') {
      safeHaptic.notification(Haptics.NotificationFeedbackType.Warning);
    }
  }, [visible, verdict.level]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>🏖️ Posso Faltar?</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Simule faltas com segurança e descubra o impacto no seu teto de faltas.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
            onPress={() => {
              safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Fechar planejador de faltas"
            activeOpacity={0.7}
          >
            <Text style={[styles.closeBtnText, { color: colors.text }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Mode Switcher Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              mode === 'by_date' && [styles.tabBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
            ]}
            onPress={() => {
              safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
              setMode('by_date');
            }}
            accessibilityRole="button"
            accessibilityLabel="Simulação por data"
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: mode === 'by_date' ? getContrastTextColor(colors.primary) : colors.textSecondary }
              ]}
            >
              📅 Por Data
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              mode === 'by_subject' && [styles.tabBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
            ]}
            onPress={() => {
              safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
              setMode('by_subject');
            }}
            accessibilityRole="button"
            accessibilityLabel="Simulação por disciplina"
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: mode === 'by_subject' ? getContrastTextColor(colors.primary) : colors.textSecondary }
              ]}
            >
              🎯 Por Disciplina
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeSubjects.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, marginVertical: 24 }]}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>📚</Text>
              <Text style={[styles.emptyCardTitle, { color: colors.text }]}>Nenhuma disciplina ativa encontrada</Text>
              <Text style={[styles.emptyCardSubtitle, { color: colors.textSecondary }]}>
                Cadastre suas matérias para simular o limite de faltas e acompanhar o impacto na sua presença acadêmica.
              </Text>
            </View>
          ) : (
            <>
              {/* =========================================================================
                  ABA 1: POR DATA
                 ========================================================================= */}
              {mode === 'by_date' && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Selecione o Dia da Ausência</Text>
                  
                  {/* Quick Date Chips */}
                  <View style={styles.quickChipsRow}>
                    {quickDateChips.map(chip => {
                      const isSelected = selectedDate === chip.dateStr;
                      return (
                        <TouchableOpacity
                          key={chip.id}
                          style={[
                            styles.quickChip,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.surface,
                              borderColor: isSelected ? colors.primary : colors.border
                            }
                          ]}
                          onPress={() => {
                            safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedDate(chip.dateStr);
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar ${chip.label}`}
                        >
                          <Text
                            style={[
                              styles.quickChipText,
                              { color: isSelected ? getContrastTextColor(colors.primary) : colors.text }
                            ]}
                          >
                            {chip.label}
                          </Text>
                          <Text
                            style={[
                              styles.quickChipSub,
                              { color: isSelected ? getContrastTextColor(colors.primary) : colors.textSecondary }
                            ]}
                          >
                            {format(chip.dateObj, 'dd/MM')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 14-day horizontal strip */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.daysScroll}
                  >
                    {nextDays.map(item => {
                      const isSelected = selectedDate === item.dateStr;
                      return (
                        <TouchableOpacity
                          key={item.dateStr}
                          style={[
                            styles.dayCard,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.surface,
                              borderColor: isSelected ? colors.primary : colors.border
                            }
                          ]}
                          onPress={() => {
                            safeHaptic.selection();
                            setSelectedDate(item.dateStr);
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Data ${item.dayMonth}`}
                        >
                          <Text
                            style={[
                              styles.dayCardName,
                              { color: isSelected ? getContrastTextColor(colors.primary) : colors.textSecondary }
                            ]}
                          >
                            {item.dayName.toUpperCase()}
                          </Text>
                          <Text
                            style={[
                              styles.dayCardDate,
                              { color: isSelected ? getContrastTextColor(colors.primary) : colors.text }
                            ]}
                          >
                            {item.dayMonth}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

          {/* =========================================================================
              ABA 2: POR DISCIPLINA
             ========================================================================= */}
          {mode === 'by_subject' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Selecione a Disciplina</Text>

              {/* Subject Selector Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subjectScroll}
              >
                {activeSubjects.map(sub => {
                  const isSelected = selectedSubjectId === sub.id;
                  const subColor = sub.color || colors.primary;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.subjectPill,
                        {
                          backgroundColor: isSelected ? subColor : colors.surface,
                          borderColor: isSelected ? subColor : colors.border
                        }
                      ]}
                      onPress={() => {
                        safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedSubjectId(sub.id);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Disciplina ${sub.name}`}
                    >
                      <View style={[styles.colorDot, { backgroundColor: isSelected ? getContrastTextColor(subColor) : subColor }]} />
                      <Text
                        style={[
                          styles.subjectPillText,
                          { color: isSelected ? getContrastTextColor(subColor) : colors.text }
                        ]}
                        numberOfLines={1}
                      >
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Counter Increments */}
              <View style={[styles.counterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.counterTitle, { color: colors.textSecondary }]}>
                  Quantas faltas deseja simular?
                </Text>

                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                    onPress={() => {
                      safeHaptic.selection();
                      setSubjectAbsenceCount(prev => Math.max(1, prev - 1));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Diminuir faltas"
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>

                  <View style={[styles.counterDisplay, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.counterNumber, { color: colors.primary }]}>
                      +{subjectAbsenceCount}
                    </Text>
                    <Text style={[styles.counterUnit, { color: colors.textSecondary }]}>
                      {subjectAbsenceCount === 1 ? 'falta' : 'faltas'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                    onPress={() => {
                      safeHaptic.selection();
                      setSubjectAbsenceCount(prev => prev + 1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar faltas"
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Addition Buttons */}
                <View style={styles.quickAddRow}>
                  {[1, 2, 3].map(amt => (
                    <TouchableOpacity
                      key={amt}
                      style={[
                        styles.quickAddBtn,
                        {
                          backgroundColor: subjectAbsenceCount === amt ? colors.primary : colors.surfaceSubtle,
                          borderColor: subjectAbsenceCount === amt ? colors.primary : colors.border
                        }
                      ]}
                      onPress={() => {
                        safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
                        setSubjectAbsenceCount(amt);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.quickAddBtnText,
                          { color: subjectAbsenceCount === amt ? getContrastTextColor(colors.primary) : colors.text }
                        ]}
                      >
                        +{amt} {amt === 1 ? 'falta' : 'faltas'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* =========================================================================
              VEREDITO VISUAL INTELIGENTE
             ========================================================================= */}
          <View style={[styles.verdictCard, { backgroundColor: verdict.bgColor, borderColor: verdict.borderColor }]}>
            <View style={styles.verdictBadge}>
              <Text style={[styles.verdictBadgeText, { color: verdict.color }]}>
                {verdict.badgeText}
              </Text>
            </View>
            <Text style={[styles.verdictDescription, { color: colors.text }]}>
              {verdict.description}
            </Text>
          </View>

          {/* =========================================================================
              CARDS DAS MATÉRIAS AFETADAS
             ========================================================================= */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {mode === 'by_date'
                ? `Matérias Afetadas no Dia (${activeResults.length})`
                : 'Impacto Detalhado da Disciplina'}
            </Text>

            {activeResults.length === 0 && mode === 'by_date' ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🏖️</Text>
                <Text style={[styles.emptyCardTitle, { color: colors.text }]}>Nenhuma aula programada para este dia!</Text>
                <Text style={[styles.emptyCardSubtitle, { color: colors.textSecondary }]}>
                  Nenhuma disciplina cadastrada possui horário nesta data ({formatDisplayDate(selectedDate)}).
                </Text>
              </View>
            ) : activeResults.length === 0 && mode === 'by_subject' ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📚</Text>
                <Text style={[styles.emptyCardTitle, { color: colors.text }]}>Nenhuma disciplina ativa encontrada</Text>
                <Text style={[styles.emptyCardSubtitle, { color: colors.textSecondary }]}>
                  Selecione ou cadastre uma disciplina para simular ausências.
                </Text>
              </View>
            ) : (
              activeResults.map(item => {
                const subColor = item.subject.color || colors.primary;
                const progressPct = Math.min(100, Math.round((item.currentAbsences / item.maxAbsences) * 100));
                const simulatedAddPct = Math.min(
                  100 - progressPct,
                  Math.round((item.missedClassesCount / item.maxAbsences) * 100)
                );

                return (
                  <View
                    key={item.subject.id}
                    style={[styles.subjectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    {/* Header with subject color badge */}
                    <View style={styles.cardHeader}>
                      <View style={[styles.subjectIndicator, { backgroundColor: subColor }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardSubjectName, { color: colors.text }]}>
                          {item.subject.name}
                        </Text>
                        <Text style={[styles.cardSubjectMeta, { color: colors.textSecondary }]}>
                          +{item.missedClassesCount} {item.missedClassesCount === 1 ? 'aula simulada' : 'aulas simuladas'}
                          {item.subject.workloadHours ? ` • Carga: ${item.subject.workloadHours}h` : ''}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: item.isCritical
                              ? colors.dangerLight
                              : item.isAtRisk
                              ? colors.warningLight
                              : colors.successLight,
                            borderColor: item.isCritical
                              ? colors.danger
                              : item.isAtRisk
                              ? colors.warning
                              : colors.success
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            {
                              color: item.isCritical
                                ? (theme === 'light' ? colors.dangerDark : colors.danger)
                                : item.isAtRisk
                                ? (theme === 'light' ? colors.warningDark : colors.warning)
                                : (theme === 'light' ? colors.successDark : colors.success)
                            }
                          ]}
                        >
                          {item.isCritical ? 'Crítico' : item.isAtRisk ? 'Alerta' : 'Seguro'}
                        </Text>
                      </View>
                    </View>

                    {/* Numerical stats grid */}
                    <View style={[styles.statsGrid, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                      <View style={styles.statCol}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Atuais</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>{item.currentAbsences}</Text>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

                      <View style={styles.statCol}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Simulado</Text>
                        <Text
                          style={[
                            styles.statValue,
                            { color: item.isCritical ? colors.danger : item.isAtRisk ? colors.warning : colors.primary }
                          ]}
                        >
                          {item.simulatedTotalAbsences} / {item.maxAbsences}
                        </Text>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

                      <View style={styles.statCol}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Margem Restante</Text>
                        <Text
                          style={[
                            styles.statValue,
                            { color: item.safeMargin <= 0 ? colors.danger : colors.text }
                          ]}
                        >
                          {item.safeMargin <= 0 ? '0 faltas' : `${item.safeMargin} faltas`}
                        </Text>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

                      <View style={styles.statCol}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Presença Est.</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>{item.estimatedPresenceRate}%</Text>
                      </View>
                    </View>

                    {/* Visual Progress Bar */}
                    <View style={styles.progressSection}>
                      <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceHighlight }]}>
                        {/* Current absences */}
                        <View
                          style={[
                            styles.progressBarSegment,
                            {
                              width: `${progressPct}%`,
                              backgroundColor: colors.primary
                            }
                          ]}
                        />
                        {/* Simulated addition */}
                        <View
                          style={[
                            styles.progressBarSegment,
                            {
                              width: `${simulatedAddPct}%`,
                              backgroundColor: item.isCritical
                                ? colors.danger
                                : item.isAtRisk
                                ? colors.warning
                                : colors.info
                            }
                          ]}
                        />
                      </View>

                      <View style={styles.progressBarLabels}>
                        <Text style={[styles.barLabel, { color: colors.textSecondary }]}>0</Text>
                        <Text style={[styles.barLabel, { color: colors.textSecondary }]}>
                          Teto: {item.maxAbsences} faltas
                        </Text>
                      </View>
                    </View>

                    {/* Warning if there's an exam in the week */}
                    {item.weeklyExams.length > 0 && (
                      <View style={[styles.examAlertBanner, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
                        <Text style={{ fontSize: 16, marginRight: 8 }}>🚨</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.examAlertTitle, { color: theme === 'light' ? colors.dangerDark : colors.danger }]}>
                            Avaliação Agendada na Semana!
                          </Text>
                          {item.weeklyExams.map(ex => (
                            <Text
                              key={ex.id}
                              style={[styles.examAlertText, { color: theme === 'light' ? colors.dangerDark : colors.danger }]}
                            >
                              • {ex.title} em {formatDisplayDate(ex.date)}
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </>
      )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: ReturnType<typeof getThemeColors>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 2,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    closeBtnText: {
      fontSize: 16,
      fontWeight: '700',
    },
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      gap: 10,
    },
    tabBtn: {
      flex: 1,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tabBtnActive: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    tabBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 12,
      letterSpacing: -0.3,
    },
    quickChipsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    quickChip: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickChipText: {
      fontSize: 13,
      fontWeight: '700',
    },
    quickChipSub: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    daysScroll: {
      gap: 8,
      paddingVertical: 4,
    },
    dayCard: {
      width: 60,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    dayCardName: {
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 4,
    },
    dayCardDate: {
      fontSize: 13,
      fontWeight: '800',
    },
    subjectScroll: {
      gap: 8,
      paddingVertical: 4,
      marginBottom: 14,
    },
    subjectPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      marginRight: 8,
    },
    colorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    },
    subjectPillText: {
      fontSize: 13,
      fontWeight: '700',
      maxWidth: 160,
    },
    counterCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
    },
    counterTitle: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 12,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 14,
    },
    stepBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepBtnText: {
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 28,
    },
    counterDisplay: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      minWidth: 100,
    },
    counterNumber: {
      fontSize: 22,
      fontWeight: '800',
    },
    counterUnit: {
      fontSize: 11,
      fontWeight: '600',
    },
    quickAddRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
    },
    quickAddBtn: {
      flex: 1,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickAddBtnText: {
      fontSize: 12,
      fontWeight: '700',
    },
    verdictCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1.5,
      marginBottom: 20,
    },
    verdictBadge: {
      marginBottom: 6,
    },
    verdictBadgeText: {
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    verdictDescription: {
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
      opacity: 0.9,
    },
    emptyCard: {
      padding: 24,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCardTitle: {
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 4,
    },
    emptyCardSubtitle: {
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 16,
    },
    subjectCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 14,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    subjectIndicator: {
      width: 4,
      height: 32,
      borderRadius: 2,
      marginRight: 10,
    },
    cardSubjectName: {
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    cardSubjectMeta: {
      fontSize: 11,
      fontWeight: '500',
      marginTop: 2,
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    statsGrid: {
      flexDirection: 'row',
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      marginBottom: 12,
    },
    statCol: {
      flex: 1,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 9.5,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    statValue: {
      fontSize: 12.5,
      fontWeight: '800',
    },
    statDivider: {
      width: 1,
      height: '80%',
      alignSelf: 'center',
    },
    progressSection: {
      marginBottom: 6,
    },
    progressBarTrack: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      flexDirection: 'row',
      marginBottom: 4,
    },
    progressBarSegment: {
      height: '100%',
    },
    progressBarLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    barLabel: {
      fontSize: 10,
      fontWeight: '600',
    },
    examAlertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 8,
    },
    examAlertTitle: {
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 2,
    },
    examAlertText: {
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
    },
  });
