import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import {
  AppEvent,
  Subject,
  AttendanceRecord,
  StudyTask,
  ThemeType,
  AppSettings,
  GamificationData
} from '../types';
import { getThemeColors, getCategoryColor, getContrastTextColor } from '../theme';
import { getLocalDateString, formatDisplayDate } from '../utils';
import * as Haptics from 'expo-haptics';
import { format, parseISO, addDays, getDay } from 'date-fns';

// Configuração do Locale em Português para react-native-calendars
if (!LocaleConfig.locales['pt-br']) {
  LocaleConfig.locales['pt-br'] = {
    monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
    dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    today: 'Hoje'
  };
}
LocaleConfig.defaultLocale = 'pt-br';

export interface AgendaScreenProps {
  events: AppEvent[];
  subjects: Subject[];
  attendances: AttendanceRecord[];
  tasks: StudyTask[];
  theme: ThemeType;
  settings: AppSettings;
  gamification?: GamificationData | null;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onToggleEventCompletion: (eventId: string) => void;
  onToggleTaskCompletion: (taskId: string) => void;
  onEditEvent: (event: AppEvent) => void;
  onOpenStudy: (subjectId?: string) => void;
  onOpenAttendanceModal: () => void;
  onOpenExamDetails?: (event: AppEvent) => void;
  onAddNewEvent?: () => void;
  onOpenScheduleGrid?: () => void;
}

export const AgendaScreen: React.FC<AgendaScreenProps> = ({
  events,
  subjects,
  attendances,
  tasks,
  theme,
  settings,
  gamification,
  selectedDate,
  onSelectDate,
  onToggleEventCompletion,
  onToggleTaskCompletion,
  onEditEvent,
  onOpenStudy,
  onOpenAttendanceModal,
  onOpenExamDetails,
  onAddNewEvent,
  onOpenScheduleGrid
}) => {
  const colors = getThemeColors(theme);
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);

  // View mode toggle: 'checklist' vs 'timeline'
  const [viewMode, setViewMode] = useState<'checklist' | 'timeline'>('checklist');

  const todayStr = getLocalDateString();
  const targetDate = selectedDate || todayStr;
  const isToday = targetDate === todayStr;

  // Current time representation
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Pending absences count
  const pendingAttendancesCount = useMemo(() => {
    return attendances.filter(a => a.status === 'pending').length;
  }, [attendances]);

  // Filter events for targetDate
  const todaysEvents = useMemo(() => {
    return events.filter(e => {
      // Filter if exam week mode is active
      if (settings.examWeekMode && e.category !== 'Provas/Trabalhos' && e.category !== 'Faculdade/Aulas') {
        return false;
      }

      // Filter archived subjects
      if (e.subjectId) {
        const subject = subjects.find(s => s.id === e.subjectId);
        if (subject?.isArchived) return false;
      }

      // Filter cancelled classes
      if (e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly') {
        const isCancelled = attendances.some(a => a.eventId === e.id && a.date === targetDate && a.status === 'cancelled');
        if (isCancelled) return false;
      }

      if (targetDate < e.date) return false;
      if (e.recurrence === 'daily') return true;
      if (e.recurrence === 'weekly') {
        if (e.recurrenceDays && e.recurrenceDays.length > 0) {
          const currentDay = getDay(parseISO(targetDate));
          return e.recurrenceDays.includes(currentDay);
        }
        const startDay = getDay(parseISO(e.date));
        const currentDay = getDay(parseISO(targetDate));
        return startDay === currentDay;
      }
      if (e.recurrence === 'monthly') {
        const startDayOfMonth = parseISO(e.date).getDate();
        const currentDayOfMonth = parseISO(targetDate).getDate();
        return startDayOfMonth === currentDayOfMonth;
      }
      return e.date === targetDate;
    }).sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
  }, [events, targetDate, subjects, attendances, settings.examWeekMode]);

  // Filter tasks for targetDate
  const todaysTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.dueDate) {
        return t.dueDate === targetDate;
      }
      // If no due date, show on today's view
      return isToday;
    });
  }, [tasks, targetDate, isToday]);

  // Highlight Card: Find active or imminent upcoming activity
  const highlightInfo = useMemo(() => {
    let activeEvent: AppEvent | null = null;
    let nextEvent: AppEvent | null = null;
    let minutesUntilNext: number | null = null;

    for (const evt of todaysEvents) {
      const [sh, sm] = (evt.startTime || '00:00').split(':').map(Number);
      const [eh, em] = (evt.endTime || '23:59').split(':').map(Number);
      const startMins = (sh || 0) * 60 + (sm || 0);
      let endMins = (eh || 0) * 60 + (em || 0);
      if (endMins < startMins) endMins += 24 * 60;

      if (isToday) {
        if (currentMinutes >= startMins && currentMinutes <= endMins) {
          activeEvent = evt;
          break;
        } else if (currentMinutes < startMins && !nextEvent) {
          nextEvent = evt;
          minutesUntilNext = startMins - currentMinutes;
        }
      } else {
        if (!nextEvent) {
          nextEvent = evt;
        }
      }
    }

    const featured = activeEvent || nextEvent;
    const featuredSubject = featured?.subjectId ? subjects.find(s => s.id === featured.subjectId) : null;

    return {
      activeEvent,
      nextEvent,
      minutesUntilNext,
      featured,
      featuredSubject
    };
  }, [todaysEvents, isToday, currentMinutes, subjects]);

  // Find urgent exams in the next 7 days
  const upcomingExams = useMemo(() => {
    const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
    return safeEvents.filter(e => {
      if (!e || e.category !== 'Provas/Trabalhos' || !e.date) return false;
      const evtDate = new Date(e.date + 'T12:00:00');
      const todayDate = new Date(todayStr + 'T12:00:00');
      const diffDays = (evtDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }).sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  }, [events, todayStr]);

  const nextUrgentExam = upcomingExams[0];

  // Calendar Marked Dates
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    events.forEach(e => {
      if (e.subjectId) {
        const subject = subjects.find(s => s.id === e.subjectId);
        if (subject?.isArchived) return;
      }

      const subject = e.subjectId ? subjects.find(s => s.id === e.subjectId) : null;
      const dotColor = subject?.color || getCategoryColor(e.category, theme) || colors.primary;

      if (e.recurrence === 'none') {
        if (!marks[e.date]) marks[e.date] = { dots: [] };
        if (marks[e.date].dots && marks[e.date].dots.length < 3) {
          marks[e.date].dots.push({ color: dotColor, key: `${e.id}_${marks[e.date].dots.length}` });
        }
      } else {
        let currentDate = parseISO(e.date);
        if (isNaN(currentDate.getTime())) return;

        const maxSteps = e.recurrence === 'daily' ? 180 : e.recurrence === 'weekly' ? 30 : 6;
        for (let i = 0; i < maxSteps; i++) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          if (!marks[dateStr]) marks[dateStr] = { dots: [] };
          if (marks[dateStr].dots && marks[dateStr].dots.length < 3) {
            marks[dateStr].dots.push({ color: dotColor, key: `${e.id}_${dateStr}_${marks[dateStr].dots.length}` });
          }
          currentDate = addDays(currentDate, e.recurrence === 'daily' ? 1 : e.recurrence === 'weekly' ? 7 : 30);
        }
      }
    });

    // Mark selected date
    if (targetDate) {
      marks[targetDate] = {
        ...(marks[targetDate] || {}),
        selected: true,
        selectedColor: colors.primary,
        selectedTextColor: getContrastTextColor(colors.primary)
      };
    }

    return marks;
  }, [events, targetDate, colors.primary, subjects, theme]);

  const totalItemsCount = todaysEvents.length + todaysTasks.length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 0. Pending Absences Alert Banner */}
      {pendingAttendancesCount > 0 && (
        <TouchableOpacity
          style={[styles.pendingBanner, { backgroundColor: colors.danger }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOpenAttendanceModal();
          }}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 20, marginRight: 10 }}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pendingBannerTitle, { color: getContrastTextColor(colors.danger) }]}>
              Faltas Pendentes de Confirmação
            </Text>
            <Text style={[styles.pendingBannerSubtitle, { color: getContrastTextColor(colors.danger) }]}>
              Você tem {pendingAttendancesCount} aula(s) aguardando confirmação.
            </Text>
          </View>
          <Text style={[styles.pendingBannerChevron, { color: getContrastTextColor(colors.danger) }]}>›</Text>
        </TouchableOpacity>
      )}

      {/* ========================================================= */}
      {/* 1. TOP SECTION: Highlight Card (Próxima Atividade / Tarefa Iminente) */}
      {/* ========================================================= */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.sectionIconBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={{ fontSize: 14 }}>⚡</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Próxima Atividade</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {onOpenScheduleGrid && (
              <TouchableOpacity
                style={[styles.gamificationPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, marginRight: 6 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onOpenScheduleGrid();
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                  🗓️ Grade Semanal
                </Text>
              </TouchableOpacity>
            )}

            {gamification && (
              <View style={[styles.gamificationPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <Text style={[styles.gamificationText, { color: colors.primary }]}>
                  Nv. {gamification.level} 🎓
                </Text>
              </View>
            )}
          </View>
        </View>

        {highlightInfo.featured ? (
          <View style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1.5 }]}>
            {/* Status Header Badge */}
            <View style={styles.highlightHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: highlightInfo.activeEvent ? colors.success : colors.primary }
                  ]}
                />
                <Text
                  style={[
                    styles.statusLabel,
                    {
                      color: highlightInfo.activeEvent
                        ? (theme === 'light' ? colors.successDark : colors.success)
                        : (theme === 'light' ? colors.primaryDark : colors.primary)
                    }
                  ]}
                >
                  {highlightInfo.activeEvent
                    ? '● EM ANDAMENTO'
                    : highlightInfo.minutesUntilNext !== null
                    ? `⏱️ Começa em ${highlightInfo.minutesUntilNext} min`
                    : '📅 Próxima Atividade'}
                </Text>
              </View>

              {/* Category Pill with Contrast Text */}
              {highlightInfo.featured.category && (
                <View
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: getCategoryColor(highlightInfo.featured.category, theme)
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: getContrastTextColor(getCategoryColor(highlightInfo.featured.category, theme)) }
                    ]}
                  >
                    {highlightInfo.featured.category}
                  </Text>
                </View>
              )}
            </View>

            {/* Event Title */}
            <Text style={[styles.highlightTitle, { color: colors.text }]} numberOfLines={2}>
              {highlightInfo.featured.title}
            </Text>

            {/* Time and Subject details */}
            <View style={styles.highlightDetailsRow}>
              <View style={[styles.timeBadge, { backgroundColor: colors.surfaceSubtle }]}>
                <Text style={[styles.timeBadgeText, { color: colors.text }]}>
                  ⏰ {highlightInfo.featured.startTime} - {highlightInfo.featured.endTime}
                </Text>
              </View>

              {highlightInfo.featuredSubject && (
                <View style={[styles.subjectBadge, { backgroundColor: (highlightInfo.featuredSubject.color || colors.primary) + '22' }]}>
                  <Text style={[styles.subjectBadgeText, { color: highlightInfo.featuredSubject.color || colors.primary }]} numberOfLines={1}>
                    📚 {highlightInfo.featuredSubject.name}
                  </Text>
                </View>
              )}
            </View>

            {highlightInfo.featuredSubject?.notes ? (
              <Text style={[styles.highlightNotes, { color: colors.textSecondary }]} numberOfLines={1}>
                📍 {highlightInfo.featuredSubject.notes}
              </Text>
            ) : null}

            {/* Quick Action Buttons */}
            <View style={styles.highlightActionsRow}>
              <TouchableOpacity
                style={[styles.quickStudyBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onOpenStudy(highlightInfo.featured?.subjectId);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.quickStudyBtnText, { color: getContrastTextColor(colors.primary) }]}>
                  ⏱️ Estudar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickCheckBtn,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: highlightInfo.featured.isCompleted ? colors.success : colors.border
                  }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (highlightInfo.featured) {
                    onToggleEventCompletion(highlightInfo.featured.id);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, color: highlightInfo.featured.isCompleted ? colors.success : colors.textSecondary }}>
                  {highlightInfo.featured.isCompleted ? '✓ Concluído' : 'Marcar Concluído'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Fallback Card when all tasks are complete */
          <View style={[styles.fallbackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.fallbackIconWrap}>
              <Text style={{ fontSize: 24 }}>✨</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.fallbackTitle, { color: colors.text }]}>
                Tudo em dia por hoje!
              </Text>
              <Text style={[styles.fallbackSubtitle, { color: colors.textSecondary }]}>
                Nenhuma aula ou tarefa pendente para este momento. Aproveite para descansar ou revisar.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.fallbackStudyBtn, { backgroundColor: colors.primaryLight }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenStudy();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.fallbackStudyBtnText, { color: colors.primary }]}>
                Estudos ›
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Urgent Exam Alert Banner */}
        {nextUrgentExam && (
          <TouchableOpacity
            style={[
              styles.examAlertBanner,
              {
                backgroundColor: colors.warningLight,
                borderColor: colors.warning
              }
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              if (onOpenExamDetails) {
                onOpenExamDetails(nextUrgentExam);
              } else {
                onEditEvent(nextUrgentExam);
              }
            }}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>📝</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.examAlertTitle,
                    { color: theme === 'light' ? colors.warningDark : colors.warning }
                  ]}
                  numberOfLines={1}
                >
                  {nextUrgentExam.title}
                </Text>
                <Text style={[styles.examAlertSubtitle, { color: colors.textSecondary }]}>
                  📅 Dia {formatDisplayDate(nextUrgentExam.date)} às {nextUrgentExam.startTime}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.examAlertAction,
                { color: theme === 'light' ? colors.warningDark : colors.warning }
              ]}
            >
              Ver ›
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ========================================================= */}
      {/* 2. MIDDLE SECTION: Interactive Calendar */}
      {/* ========================================================= */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.sectionIconBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={{ fontSize: 14 }}>📅</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Calendário Interativo</Text>
          </View>

          {/* Reset to today button when date other than today is active */}
          {!isToday && (
            <TouchableOpacity
              style={[styles.todayResetBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
              onPress={() => {
                Haptics.selectionAsync();
                onSelectDate(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.todayResetText, { color: colors.primary }]}>
                🔄 Voltar para Hoje
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Calendar
            current={targetDate}
            onDayPress={(day: any) => {
              Haptics.selectionAsync();
              onSelectDate(day.dateString);
            }}
            markingType={'multi-dot'}
            markedDates={markedDates}
            enableSwipeMonths={true}
            hideArrows={false}
            theme={{
              calendarBackground: 'transparent',
              textSectionTitleColor: colors.textSecondary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: getContrastTextColor(colors.primary),
              todayTextColor: colors.primary,
              todayBackgroundColor: 'transparent',
              dayTextColor: colors.text,
              textDisabledColor: colors.textMuted,
              monthTextColor: colors.text,
              arrowColor: colors.primary,
              textMonthFontWeight: 'bold',
              textDayFontSize: 14,
              textMonthFontSize: 16,
            }}
          />
        </View>
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          Toque em qualquer dia para filtrar compromissos e tarefas.
        </Text>
      </View>

      {/* ========================================================= */}
      {/* 3. BOTTOM SECTION: Tasks & Activities Checklist */}
      {/* ========================================================= */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.sectionIconBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={{ fontSize: 14 }}>📋</Text>
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {isToday ? 'Atividades de Hoje' : `Dia ${formatDisplayDate(targetDate)}`}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'} agendado{totalItemsCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* View mode toggle: Checklist vs Timeline */}
          <View style={[styles.viewModeToggleWrap, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.viewModeBtn,
                viewMode === 'checklist' && { backgroundColor: colors.primary }
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode('checklist');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.viewModeBtnText,
                  { color: viewMode === 'checklist' ? getContrastTextColor(colors.primary) : colors.textSecondary }
                ]}
              >
                📋 Lista
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.viewModeBtn,
                viewMode === 'timeline' && { backgroundColor: colors.primary }
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode('timeline');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.viewModeBtnText,
                  { color: viewMode === 'timeline' ? getContrastTextColor(colors.primary) : colors.textSecondary }
                ]}
              >
                ⏱️ 24h
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View Mode Content */}
        {viewMode === 'checklist' ? (
          <View style={styles.checklistContainer}>
            {/* 1. AppEvents Checklist Items */}
            {todaysEvents.map(event => {
              const categoryColor = getCategoryColor(event.category, theme) || colors.primary;
              const subject = event.subjectId ? subjects.find(s => s.id === event.subjectId) : null;

              return (
                <TouchableOpacity
                  key={event.id}
                  style={[
                    styles.checklistItemCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: event.isImportant ? colors.warning : colors.border,
                      borderWidth: event.isImportant ? 1.5 : 1,
                      opacity: event.isCompleted ? 0.65 : 1
                    }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onToggleEventCompletion(event.id);
                  }}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onEditEvent(event);
                  }}
                  activeOpacity={0.8}
                >
                  {/* Interactive Circular Checkbox */}
                  <TouchableOpacity
                    style={[
                      styles.circularCheckbox,
                      {
                        backgroundColor: event.isCompleted ? colors.primary : 'transparent',
                        borderColor: event.isCompleted ? colors.primary : colors.textSecondary
                      }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onToggleEventCompletion(event.id);
                    }}
                    activeOpacity={0.7}
                  >
                    {event.isCompleted && (
                      <Text style={[styles.checkboxCheckmark, { color: getContrastTextColor(colors.primary) }]}>
                        ✓
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Item Content */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.checklistItemHeader}>
                      <Text
                        style={[
                          styles.checklistTitle,
                          {
                            color: colors.text,
                            textDecorationLine: event.isCompleted ? 'line-through' : 'none'
                          }
                        ]}
                        numberOfLines={1}
                      >
                        {event.title}
                      </Text>

                      {event.isImportant && (
                        <View style={[styles.importantBadge, { backgroundColor: colors.warningLight }]}>
                          <Text style={[styles.importantBadgeText, { color: theme === 'light' ? colors.warningDark : colors.warning }]}>
                            ⭐ Destaque
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.checklistMetaRow}>
                      <Text style={[styles.checklistTime, { color: colors.textSecondary }]}>
                        ⏰ {event.startTime} - {event.endTime}
                      </Text>

                      <View style={[styles.miniCategoryBadge, { backgroundColor: categoryColor + '20' }]}>
                        <Text style={[styles.miniCategoryText, { color: categoryColor }]}>
                          {event.category}
                        </Text>
                      </View>

                      {subject && (
                        <View style={[styles.miniSubjectBadge, { backgroundColor: (subject.color || colors.primary) + '20' }]}>
                          <Text style={[styles.miniSubjectText, { color: subject.color || colors.primary }]} numberOfLines={1}>
                            {subject.name}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* 2. StudyTasks Checklist Items */}
            {todaysTasks.map(task => {
              const subject = task.subjectId ? subjects.find(s => s.id === task.subjectId) : null;
              const priorityColor = task.priority === 'high' ? colors.danger : task.priority === 'medium' ? colors.warning : colors.success;

              return (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.checklistItemCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                      opacity: task.isCompleted ? 0.65 : 1
                    }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onToggleTaskCompletion(task.id);
                  }}
                  activeOpacity={0.8}
                >
                  {/* Interactive Circular Checkbox */}
                  <TouchableOpacity
                    style={[
                      styles.circularCheckbox,
                      {
                        backgroundColor: task.isCompleted ? colors.primary : 'transparent',
                        borderColor: task.isCompleted ? colors.primary : colors.textSecondary
                      }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onToggleTaskCompletion(task.id);
                    }}
                    activeOpacity={0.7}
                  >
                    {task.isCompleted && (
                      <Text style={[styles.checkboxCheckmark, { color: getContrastTextColor(colors.primary) }]}>
                        ✓
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Task Content */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.checklistItemHeader}>
                      <Text
                        style={[
                          styles.checklistTitle,
                          {
                            color: colors.text,
                            textDecorationLine: task.isCompleted ? 'line-through' : 'none'
                          }
                        ]}
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>

                      {task.priority && (
                        <View style={[styles.miniCategoryBadge, { backgroundColor: priorityColor + '20' }]}>
                          <Text style={[styles.miniCategoryText, { color: priorityColor }]}>
                            {task.priority === 'high' ? '🔴 Alta' : task.priority === 'medium' ? '🟡 Média' : '🟢 Baixa'}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.checklistMetaRow}>
                      <Text style={[styles.checklistTime, { color: colors.textSecondary }]}>
                        📝 Tarefa de Estudo
                      </Text>

                      {subject && (
                        <View style={[styles.miniSubjectBadge, { backgroundColor: (subject.color || colors.primary) + '20' }]}>
                          <Text style={[styles.miniSubjectText, { color: subject.color || colors.primary }]} numberOfLines={1}>
                            {subject.name}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Empty Checklist Fallback */}
            {totalItemsCount === 0 && (
              <View style={[styles.emptyChecklistCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 26, marginBottom: 8 }}>🎯</Text>
                <Text style={[styles.emptyChecklistTitle, { color: colors.text }]}>
                  Nenhuma atividade agendada
                </Text>
                <Text style={[styles.emptyChecklistSubtitle, { color: colors.textSecondary }]}>
                  Você não possui compromissos ou tarefas registradas para esta data.
                </Text>
                {onAddNewEvent && (
                  <TouchableOpacity
                    style={[styles.addEventBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onAddNewEvent();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.addEventBtnText, { color: getContrastTextColor(colors.primary) }]}>
                      + Adicionar Atividade
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ) : (
          /* Mode B: 24h Hourly Timeline */
          <View style={[styles.timelineWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ height: 24 * 72, position: 'relative' }}>
              {/* Hour Lines */}
              {Array.from({ length: 24 }).map((_, hour) => (
                <View
                  key={hour}
                  style={[
                    styles.timelineHourRow,
                    {
                      top: hour * 72,
                      borderBottomColor: colors.borderSubtle
                    }
                  ]}
                >
                  <Text style={[styles.timelineTimeLabel, { color: colors.textSecondary }]}>
                    {`${hour.toString().padStart(2, '0')}:00`}
                  </Text>
                  <View style={styles.timelineHourDivider} />
                </View>
              ))}

              {/* Current Time Indicator on today */}
              {isToday && (
                <View
                  style={{
                    position: 'absolute',
                    left: 55,
                    right: 0,
                    top: (now.getHours() + now.getMinutes() / 60) * 72,
                    height: 2,
                    backgroundColor: colors.danger,
                    zIndex: 10,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginLeft: -4 }} />
                </View>
              )}

              {/* Event Blocks on Timeline */}
              {todaysEvents.map(event => {
                const [startH, startM] = (event.startTime || '08:00').split(':').map(Number);
                const topOffset = ((startH || 0) + (startM || 0) / 60) * 72;

                let durationHours = 1;
                if (event.endTime) {
                  const [endH, endM] = event.endTime.split(':').map(Number);
                  durationHours = ((endH || 0) + (endM || 0) / 60) - ((startH || 0) + (startM || 0) / 60);
                  if (durationHours <= 0) durationHours = 1;
                }

                const height = Math.max(durationHours * 72 - 4, 32);
                const subject = event.subjectId ? subjects.find(s => s.id === event.subjectId) : null;
                const bg = subject?.color || getCategoryColor(event.category, theme) || colors.primary;
                const contrastColor = getContrastTextColor(bg);

                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[
                      styles.timelineEventCard,
                      {
                        top: topOffset,
                        height,
                        backgroundColor: bg,
                        opacity: event.isCompleted ? 0.65 : 0.95
                      }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onToggleEventCompletion(event.id);
                    }}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onEditEvent(event);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.timelineEventTitle,
                          {
                            color: contrastColor,
                            textDecorationLine: event.isCompleted ? 'line-through' : 'none'
                          }
                        ]}
                        numberOfLines={1}
                      >
                        {event.isCompleted ? '✓ ' : ''}{event.title}
                      </Text>
                      {height >= 44 && (
                        <Text style={[styles.timelineEventTime, { color: contrastColor }]} numberOfLines={1}>
                          {event.startTime} - {event.endTime} • {event.category}
                        </Text>
                      )}
                    </View>
                    {event.isImportant && <Text style={{ fontSize: 14 }}>⭐</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Spacing to prevent Bottom Navigation & FAB from overlapping content */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const getStyles = (colors: any, theme: ThemeType) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 100,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  pendingBannerTitle: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  pendingBannerSubtitle: {
    fontSize: 11,
    opacity: 0.9,
    marginTop: 1,
  },
  pendingBannerChevron: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  sectionContainer: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  gamificationPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  gamificationText: {
    fontSize: 11,
    fontWeight: '800',
  },
  highlightCard: {
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  highlightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  highlightTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  highlightDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subjectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  highlightNotes: {
    fontSize: 12,
    marginBottom: 10,
  },
  highlightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  quickStudyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStudyBtnText: {
    fontWeight: '800',
    fontSize: 13,
  },
  quickCheckBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  fallbackIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  fallbackSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  fallbackStudyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  fallbackStudyBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  examAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  examAlertTitle: {
    fontWeight: '800',
    fontSize: 13,
  },
  examAlertSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  examAlertAction: {
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 8,
  },
  todayResetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  todayResetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  calendarCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 8,
    overflow: 'hidden',
  },
  hintText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },
  viewModeToggleWrap: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
  },
  viewModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewModeBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  checklistContainer: {
    gap: 8,
  },
  checklistItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
  },
  circularCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCheckmark: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  checklistItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checklistTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  importantBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  importantBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  checklistMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  checklistTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  miniCategoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniCategoryText: {
    fontSize: 10,
    fontWeight: '700',
  },
  miniSubjectBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 120,
  },
  miniSubjectText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyChecklistCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyChecklistTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyChecklistSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  addEventBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addEventBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  timelineWrapper: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    overflow: 'hidden',
  },
  timelineHourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 72,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineTimeLabel: {
    width: 48,
    fontSize: 10,
    fontWeight: '600',
  },
  timelineHourDivider: {
    flex: 1,
  },
  timelineEventCard: {
    position: 'absolute',
    left: 55,
    right: 10,
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  timelineEventTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  timelineEventTime: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.9,
    marginTop: 2,
  }
});
