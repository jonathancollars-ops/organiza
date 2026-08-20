import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Platform, StatusBar as RNStatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import {
  AppEvent,
  ThemeType,
  Subject,
  AttendanceRecord,
  StudyTask,
  StudySession,
  StudyStreak,
  Semester,
  AppSettings,
  GamificationData
} from './src/types';
import { StorageService } from './src/services/storage';
import { AttendanceService } from './src/services/AttendanceService';
import { NotificationService } from './src/services/notifications';
import { GoogleSheetsService } from './src/services/GoogleSheetsService';
import { getThemeColors, CategoryColors, getCategoryColor, getContrastTextColor } from './src/theme';
import { generateId, getLocalDateString } from './src/utils';

import { EventModal } from './src/components/EventModal';
import { EventTypeModal } from './src/components/EventTypeModal';
import { SubjectModal } from './src/components/SubjectModal';
import { ExamModal } from './src/components/ExamModal';
import { PendingAttendanceModal } from './src/components/PendingAttendanceModal';
import { SubjectDetailsModal } from './src/components/SubjectDetailsModal';
import { AIImportModal } from './src/components/AIImportModal';
import { SettingsModal } from './src/components/SettingsModal';
import { OnboardingModal } from './src/components/OnboardingModal';

import { TodaySummaryWidget } from './src/components/TodaySummaryWidget';
import { AnalyticsAndAACCModal } from './src/components/AnalyticsAndAACCModal';
import { AchievementsModal } from './src/components/AchievementsModal';
import { GroupProjectsModal } from './src/components/GroupProjectsModal';

import { GradesScreen } from './src/screens/GradesScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { ScheduleGridScreen } from './src/screens/ScheduleGridScreen';
import { StudyScreen } from './src/screens/StudyScreen';

import { format, parseISO, addDays, getDay } from 'date-fns';
import * as Haptics from 'expo-haptics';

// Configurar idioma do calendário para Português
LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'agenda' | 'grade' | 'estudos' | 'faltas' | 'notas'>('agenda');
  const [theme, setTheme] = useState<ThemeType>('dark');
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [streak, setStreak] = useState<StudyStreak>({ currentStreak: 0, longestStreak: 0, lastStudyDate: '' });
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    pomodoroFocusMin: 25,
    pomodoroBreakMin: 5,
    pomodoroLongBreakMin: 15,
    defaultPassGrade: 7.0,
    examWeekMode: false,
    soundEnabled: true,
    hapticsEnabled: true,
  });

  // Modal Visibility States
  const [eventTypeVisible, setEventTypeVisible] = useState(false);
  const [subjectVisible, setSubjectVisible] = useState(false);
  const [examVisible, setExamVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false);
  const [achievementsModalVisible, setAchievementsModalVisible] = useState(false);
  const [groupProjectsModalVisible, setGroupProjectsModalVisible] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Selection states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const colors = getThemeColors(theme);

  useEffect(() => {
    RNStatusBar.setHidden(true, 'none');
    loadData();
    NotificationService.requestPermissions();

    const timer = setInterval(async () => {
      setCurrentTime(new Date());

      // Re-check for new pending attendances every minute using optimized AttendanceService
      const savedEvents = await StorageService.getEvents();
      const savedAttendances = await StorageService.getAttendances();
      const updatedAttendances = await AttendanceService.generatePendingAttendances(savedEvents, savedAttendances);

      if (updatedAttendances.length > savedAttendances.length) {
        setAttendances(updatedAttendances);
        setAttendanceModalVisible(true);
      }
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      const [
        savedTheme,
        savedEvents,
        savedSubjects,
        savedAttendances,
        savedTasks,
        savedSessions,
        savedSemesters,
        savedSettings,
        savedGamification,
        savedStreak
      ] = await Promise.all([
        StorageService.getTheme(),
        StorageService.getEvents(),
        StorageService.getSubjects(),
        StorageService.getAttendances(),
        StorageService.getTasks(),
        StorageService.getStudySessions(),
        StorageService.getSemesters(),
        StorageService.getSettings(),
        StorageService.getGamificationData(),
        StorageService.getStreak(),
      ]);

      // Check for pending attendances
      const updatedAttendances = await AttendanceService.generatePendingAttendances(savedEvents, savedAttendances);

      setTheme(savedTheme);
      setEvents(savedEvents);
      setSubjects(savedSubjects);
      setAttendances(updatedAttendances);
      setTasks(savedTasks);
      setStudySessions(savedSessions);
      setSemesters(savedSemesters);
      setSettings(savedSettings);
      setGamification(savedGamification);
      setStreak(savedStreak);
      // Automated Google Sheets sync out-of-the-box on boot
      StorageService.getAIConfig().then(aiCfg => {
        GoogleSheetsService.performAutoSync(savedEvents, updatedAttendances, savedSubjects, aiCfg).then(res => {
          if (res.hasUpdates) {
            setEvents(res.updatedEvents);
            setAttendances(res.updatedAttendances);
            setSubjects(res.updatedSubjects);
          }
        }).catch(() => {});
      }).catch(() => {});
    } catch (err) {
      console.error('Error loading app data:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleThemeToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Cycle dark -> amoled -> light -> dark
    const nextTheme: ThemeType = theme === 'dark' ? 'amoled' : theme === 'amoled' ? 'light' : 'dark';
    setTheme(nextTheme);
    await StorageService.saveTheme(nextTheme);
    const updatedSettings = { ...settings, theme: nextTheme };
    setSettings(updatedSettings);
    await StorageService.saveSettings(updatedSettings);
  };

  const handleTabChange = (tab: 'agenda' | 'grade' | 'estudos' | 'faltas' | 'notas') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentTab(tab);
  };

  const handleSaveEvent = async (event: AppEvent) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    let newEvents = [...events];
    if (editingEvent) {
      newEvents = newEvents.map(e => e.id === event.id ? event : e);
    } else {
      newEvents.push(event);
    }
    setEvents(newEvents);

    // Auto-link to Grade Engine if it's an exam
    const updatedSubjects = [...subjects];
    if (event.category === 'Provas/Trabalhos' && event.subjectId && !editingEvent) {
      const subjectIndex = subjects.findIndex(s => s.id === event.subjectId);
      if (subjectIndex !== -1) {
        const subject = subjects[subjectIndex];
        let gradeGroups = subject.gradeGroups || [];

        let actualTargetGroupId = '';
        if (gradeGroups.length === 0) {
          const defaultGroup = {
            id: generateId('group'),
            name: 'Avaliações',
            weight: 1,
            items: []
          };
          gradeGroups = [defaultGroup];
          actualTargetGroupId = defaultGroup.id;
        } else {
          actualTargetGroupId = gradeGroups[0].id;
        }

        const newGradeItem = {
          id: generateId('item'),
          name: event.title,
          weight: event.weight || 1,
          maxGrade: event.maxGrade || 10,
          eventId: event.id
        };

        const newGradeGroups = gradeGroups.map(g =>
          g.id === actualTargetGroupId ? { ...g, items: [...g.items, newGradeItem] } : g
        );

        updatedSubjects[subjectIndex] = { ...subject, gradeGroups: newGradeGroups };
        setSubjects(updatedSubjects);
        await StorageService.saveSubjects(updatedSubjects);
      }
    }

    setModalVisible(false);
    setExamVisible(false);
    setEditingEvent(null);

    try {
      await StorageService.saveEvents(newEvents);
      await NotificationService.scheduleEventNotifications(event);
    } catch (error) {
      console.error('Erro ao salvar evento ou notificação', error);
    }
  };

  const handleSaveSubject = async (subject: Subject, newEvents: AppEvent[]) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updatedSubjects = [...subjects, subject];
    const updatedEvents = [...events, ...newEvents];

    setSubjects(updatedSubjects);
    setEvents(updatedEvents);
    setSubjectVisible(false);

    try {
      await StorageService.saveSubjects(updatedSubjects);
      await StorageService.saveEvents(updatedEvents);
      for (const ev of newEvents) {
        await NotificationService.scheduleEventNotifications(ev);
      }
    } catch (error) {
      console.error('Erro ao salvar materia', error);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const updatedSubjects = subjects.filter(s => s.id !== subjectId);
    const updatedEvents = events.filter(e => e.subjectId !== subjectId);
    const updatedAttendances = attendances.filter(a => a.subjectId !== subjectId);

    setSubjects(updatedSubjects);
    setEvents(updatedEvents);
    setAttendances(updatedAttendances);
    setDetailsModalVisible(false);

    try {
      await StorageService.saveSubjects(updatedSubjects);
      await StorageService.saveEvents(updatedEvents);
      await StorageService.saveAttendances(updatedAttendances);
    } catch (error) {
      console.error('Erro ao excluir materia', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newEvents = events.filter(e => e.id !== eventId);
    setEvents(newEvents);
    setModalVisible(false);
    setEditingEvent(null);
    try {
      await StorageService.saveEvents(newEvents);
      await NotificationService.cancelEventNotifications(eventId);
    } catch (error) {
      console.error('Erro ao deletar evento', error);
    }
  };

  const toggleEventCompletion = async (eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newEvents = events.map(e => e.id === eventId ? { ...e, isCompleted: !e.isCompleted } : e);
    setEvents(newEvents);
    await StorageService.saveEvents(newEvents);
  };

  const todaysEvents = useMemo(() => {
    const targetDate = selectedDate || getLocalDateString();

    return events.filter(e => {
      // Filtrar se modo semana de provas estiver ativo
      if (settings.examWeekMode && e.category !== 'Provas/Trabalhos' && e.category !== 'Faculdade/Aulas') {
        return false;
      }

      // Filtrar aulas canceladas e matérias arquivadas
      if (e.subjectId) {
        const subject = subjects.find(s => s.id === e.subjectId);
        if (subject?.isArchived) return false;
      }

      if (e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly') {
        const isCancelled = attendances.some(a => a.eventId === e.id && a.date === targetDate && a.status === 'cancelled');
        if (isCancelled) return false;
      }

      if (targetDate < e.date) return false;
      if (e.recurrence === 'daily') return true;
      if (e.recurrence === 'weekly') {
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
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [events, selectedDate, subjects, attendances, settings.examWeekMode]);

  const nextTask = useMemo(() => {
    if (selectedDate) return null; // Only show on "today" view
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

    return todaysEvents.find(e => {
      const [h, m] = (e.startTime || '08:00').split(':').map(Number);
      return ((h || 0) * 60 + (m || 0)) > currentMins;
    });
  }, [todaysEvents, selectedDate, currentTime]);

  const markedDates = useMemo(() => {
    const marks: any = {};

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
          marks[e.date].dots.push({ color: dotColor });
        }
      } else {
        let currentDate = parseISO(e.date);
        if (isNaN(currentDate.getTime())) return;

        const maxSteps = e.recurrence === 'daily' ? 180 : e.recurrence === 'weekly' ? 30 : 6;
        for (let i = 0; i < maxSteps; i++) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          if (!marks[dateStr]) marks[dateStr] = { dots: [] };
          if (marks[dateStr].dots && marks[dateStr].dots.length < 3) {
            marks[dateStr].dots.push({ color: dotColor });
          }
          currentDate = addDays(currentDate, e.recurrence === 'daily' ? 1 : e.recurrence === 'weekly' ? 7 : 30);
        }
      }
    });

    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: colors.primary,
        selectedTextColor: getContrastTextColor(colors.primary)
      };
    }
    return marks;
  }, [events, selectedDate, colors.primary, subjects, theme]);

  if (isInitializing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]} edges={['top', 'bottom']}>
        <StatusBar hidden={true} />
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.logoIconBadge, { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primaryLight, marginBottom: 12, marginRight: 0 }]}>
            <Text style={{ fontSize: 28 }}>🎓</Text>
          </View>
          <Text style={[styles.title, { color: colors.text, fontSize: 24, marginBottom: 8 }]}>Organiza</Text>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar hidden={true} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 }}>
          <View style={[styles.logoIconBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={{ fontSize: 16 }}>🎓</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>Organiza</Text>
          {settings.examWeekMode && (
            <View style={[styles.examModeBadge, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
              <Text style={{ color: colors.danger, fontSize: 10, fontWeight: 'bold' }}>🎯 MODO PROVAS</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          {/* Level / Conquistas button */}
          <TouchableOpacity
            style={[styles.levelHeaderBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
            onPress={async () => {
              Haptics.selectionAsync();
              const latestStreak = await StorageService.getStreak();
              setStreak(latestStreak);
              setAchievementsModalVisible(true);
            }}
            accessibilityLabel="Conquistas e Nível"
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
              Nv. {gamification?.level || 1} 🎓
            </Text>
          </TouchableOpacity>

          {/* Group Projects button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
            onPress={() => {
              Haptics.selectionAsync();
              setGroupProjectsModalVisible(true);
            }}
            accessibilityLabel="Trabalhos em Grupo"
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15 }}>👥</Text>
          </TouchableOpacity>

          {/* Analytics / AACC button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
            onPress={() => {
              Haptics.selectionAsync();
              setAnalyticsModalVisible(true);
            }}
            accessibilityLabel="Estatísticas e AACC"
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15 }}>📈</Text>
          </TouchableOpacity>

          {/* Universal AI Assistant button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setAiModalVisible(true);
            }}
            accessibilityLabel="Central de IA e Importação"
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16 }}>✨</Text>
          </TouchableOpacity>

          {/* Settings button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
            onPress={() => setSettingsModalVisible(true)}
            accessibilityLabel="Configurações do App"
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </TouchableOpacity>

          {/* Theme Toggle button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
            onPress={handleThemeToggle}
            accessibilityLabel="Alterar Tema"
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16 }}>
              {theme === 'dark' ? '🌙' : theme === 'amoled' ? '🖤' : '☀️'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Content */}
      {currentTab === 'agenda' ? (
        <>
          {attendances.filter(a => a.status === 'pending').length > 0 && (
            <TouchableOpacity
              style={[styles.pendingBanner, { backgroundColor: colors.danger }]}
              onPress={() => setAttendanceModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 20, marginRight: 10 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: getContrastTextColor(colors.danger), fontWeight: 'bold', fontSize: 14 }}>Faltas Pendentes de Confirmação</Text>
                <Text style={{ color: getContrastTextColor(colors.danger), opacity: 0.9, fontSize: 12 }}>
                  Você tem {attendances.filter(a => a.status === 'pending').length} aula(s) aguardando confirmação.
                </Text>
              </View>
              <Text style={{ color: getContrastTextColor(colors.danger), fontWeight: 'bold', fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          )}

          {/* Widget Inteligente "Resumo do Dia" */}
          <TodaySummaryWidget
            events={events}
            subjects={subjects}
            selectedDate={selectedDate || getLocalDateString()}
            theme={theme}
            gamification={gamification || undefined}
            onOpenStudy={(subId) => {
              if (subId) setSelectedSubjectId(subId);
              setCurrentTab('estudos');
            }}
            onOpenExamDetails={(examEvent) => {
              setEditingEvent(examEvent);
              setModalVisible(true);
            }}
          />

          {!selectedDate ? (
            <View style={styles.calendarContainer}>
              <View style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Calendar
                  current={getLocalDateString()}
                  onDayPress={(day: any) => setSelectedDate(day.dateString)}
                  markingType={'multi-dot'}
                  markedDates={{
                    ...markedDates,
                    [getLocalDateString()]: {
                      ...(markedDates[getLocalDateString()] || {}),
                      selected: true,
                      selectedColor: colors.primary,
                      selectedTextColor: getContrastTextColor(colors.primary)
                    }
                  }}
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
                    textDisabledColor: colors.borderHighlight,
                    monthTextColor: colors.text,
                    arrowColor: colors.primary,
                    textMonthFontWeight: 'bold',
                    textDayFontSize: 14,
                    textMonthFontSize: 16,
                  }}
                />
              </View>
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                Toque em um dia para ver a linha do tempo detalhada.
              </Text>

              {nextTask && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.highlightsTitle, { color: colors.text }]}>⏳ Próxima Atividade</Text>
                  <TouchableOpacity
                    style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1.5 }]}
                    onPress={() => setSelectedDate(getLocalDateString())}
                    activeOpacity={0.8}
                  >
                    <View style={styles.highlightHeader}>
                      <View style={[styles.timeBadge, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.highlightDate, { color: colors.primary }]}>{nextTask.startTime} - {nextTask.endTime}</Text>
                      </View>
                      <View style={[styles.categoryBadge, { backgroundColor: (getCategoryColor(nextTask.category, theme) || colors.primary) + '20' }]}>
                        <Text style={[styles.highlightCategory, { color: getCategoryColor(nextTask.category, theme) || colors.primary }]}>{nextTask.category}</Text>
                      </View>
                    </View>
                    <Text style={[styles.highlightEventTitle, { color: colors.text }]}>{nextTask.title}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {todaysEvents.length > 0 && (
                <View style={styles.highlightsContainer}>
                  <Text style={[styles.highlightsTitle, { color: colors.text }]}>📌 Atividades de Hoje</Text>
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    {todaysEvents.map(event => {
                      const categoryColor = getCategoryColor(event.category, theme) || colors.primary;
                      return (
                        <TouchableOpacity
                          key={event.id}
                          style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          onPress={() => setSelectedDate(getLocalDateString())}
                          activeOpacity={0.8}
                        >
                          <View style={styles.highlightHeader}>
                            <Text style={[styles.highlightDate, { color: colors.text }]}>{event.startTime} - {event.endTime}</Text>
                            <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '18' }]}>
                              <Text style={[styles.highlightCategory, { color: categoryColor }]}>{event.category}</Text>
                            </View>
                          </View>
                          <Text style={[styles.highlightEventTitle, { color: colors.text }]}>{event.title}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <View style={{ height: 40 }} />
                  </ScrollView>
                </View>
              )}
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setSelectedDate(null)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 14 }}>← Voltar ao Calendário</Text>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}> Dia {selectedDate.split('-').reverse().join('/')}</Text>
              </TouchableOpacity>

              <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
                <View style={{ height: 24 * 80, paddingBottom: 80 }}>
                  {/* Grid / Hour Labels */}
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <View key={hour} style={[styles.hourRow, { position: 'absolute', top: hour * 80, width: '100%', borderBottomColor: colors.border, height: 80 }]}>
                      <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>{`${hour.toString().padStart(2, '0')}:00`}</Text>
                      <View style={styles.eventsContainer} />
                    </View>
                  ))}

                  {/* Current Time Indicator */}
                  {selectedDate === getLocalDateString(currentTime) && (
                    <View style={{
                      position: 'absolute',
                      left: 65,
                      right: 0,
                      top: (currentTime.getHours() + currentTime.getMinutes() / 60) * 80,
                      height: 2,
                      backgroundColor: colors.danger,
                      zIndex: 10,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginLeft: -5 }} />
                    </View>
                  )}

                  {/* Events */}
                  {todaysEvents.map(event => {
                    const [startH, startM] = (event.startTime || '08:00').split(':').map(Number);
                    const topOffset = ((startH || 0) + (startM || 0) / 60) * 80;

                    let durationHours = 1;
                    if (event.endTime) {
                      const [endH, endM] = event.endTime.split(':').map(Number);
                      durationHours = ((endH || 0) + (endM || 0) / 60) - ((startH || 0) + (startM || 0) / 60);
                      if (durationHours < 0) durationHours += 24;
                    }

                    const height = Math.max(durationHours * 80, 28);
                    const eventBgColor = event.subjectId
                      ? subjects.find(s => s.id === event.subjectId)?.color || getCategoryColor(event.category, theme) || colors.primary
                      : getCategoryColor(event.category, theme) || colors.primary;

                    const contrastTextColor = getContrastTextColor(eventBgColor);

                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={[
                          styles.eventCard,
                          {
                            position: 'absolute',
                            top: topOffset,
                            height: height - 4,
                            left: 70,
                            right: 15,
                            backgroundColor: eventBgColor,
                            opacity: event.isCompleted ? 0.65 : 0.96,
                            zIndex: 5
                          }
                        ]}
                        onPress={() => toggleEventCompletion(event.id)}
                        onLongPress={() => {
                          setEditingEvent(event);
                          setModalVisible(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.eventTitle, { color: contrastTextColor, textDecorationLine: event.isCompleted ? 'line-through' : 'none' }]} numberOfLines={1}>
                            {event.isCompleted ? '✓ ' : ''}{event.title}
                          </Text>
                          {height >= 42 && (
                            <Text style={{ fontSize: 11, color: contrastTextColor, opacity: 0.88, fontWeight: '500' }}>
                              {event.startTime} - {event.endTime} • {event.category}
                            </Text>
                          )}
                        </View>
                        {event.isImportant && <Text style={{ fontSize: 16 }}>⭐️</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
        </>
      ) : currentTab === 'notas' ? (
        <GradesScreen
          subjects={subjects}
          events={events}
          attendances={attendances}
          theme={theme}
          semesters={semesters}
          onSubjectPress={(id) => {
            setSelectedSubjectId(id);
            setDetailsModalVisible(true);
          }}
          onArchiveSubject={async (id) => {
            const updated = subjects.map(s => s.id === id ? { ...s, isArchived: !s.isArchived } : s);
            setSubjects(updated);
            await StorageService.saveSubjects(updated);
          }}
        />
      ) : currentTab === 'grade' ? (
        <ScheduleGridScreen
          subjects={subjects}
          events={events}
          theme={theme}
          semesters={semesters}
        />
      ) : currentTab === 'estudos' ? (
        <StudyScreen
          subjects={subjects}
          tasks={tasks}
          onUpdateTasks={async (updatedTasks) => {
            setTasks(updatedTasks);
            await StorageService.saveTasks(updatedTasks);
          }}
          sessions={studySessions}
          onAddSession={async (session) => {
            const updated = [...studySessions, session];
            setStudySessions(updated);
            await StorageService.saveStudySessions(updated);
          }}
          theme={theme}
          focusMinutesDefault={settings.pomodoroFocusMin}
          breakMinutesDefault={settings.pomodoroBreakMin}
          onOpenAchievements={() => setAchievementsModalVisible(true)}
          onOpenAnalytics={() => setAnalyticsModalVisible(true)}
        />
      ) : (
        <AttendanceScreen
          subjects={subjects}
          events={events}
          attendances={attendances}
          theme={theme}
          semesters={semesters}
          onSubjectPress={(id) => {
            setSelectedSubjectId(id);
            setDetailsModalVisible(true);
          }}
          onUpdateAttendance={async (subjectId, eventId, status, dateStr) => {
            const existingIndex = attendances.findIndex(a => a.eventId === eventId && a.date === dateStr);
            let newAttendances = [...attendances];
            if (existingIndex >= 0) {
              newAttendances[existingIndex].status = status;
            } else {
              newAttendances.push({
                id: generateId('att'),
                subjectId,
                eventId,
                date: dateStr,
                status
              });
            }
            setAttendances(newAttendances);
            await StorageService.saveAttendances(newAttendances);
          }}
        />
      )}

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {[
          { id: 'agenda', icon: '📅', label: 'Agenda' },
          { id: 'grade', icon: '🗓️', label: 'Grade' },
          { id: 'estudos', icon: '📚', label: 'Estudos' },
          { id: 'faltas', icon: '✅', label: 'Faltas' },
          { id: 'notas', icon: '📊', label: 'Notas' }
        ].map(tab => {
          const isActive = currentTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.navItem,
                isActive && [styles.navItemActive, { backgroundColor: colors.primaryLight }]
              ]}
              onPress={() => handleTabChange(tab.id as any)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>{tab.icon}</Text>
              <Text style={{
                color: isActive ? colors.primary : colors.textSecondary,
                fontSize: 11,
                fontWeight: isActive ? '700' : '500',
                marginTop: 2
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={() => setEventTypeVisible(true)}
        accessibilityLabel="Adicionar novo item"
        activeOpacity={0.85}
      >
        <Text style={[styles.fabIcon, { color: getContrastTextColor(colors.primary) }]}>+</Text>
      </TouchableOpacity>

      {/* Modals */}
      <EventTypeModal
        visible={eventTypeVisible}
        onClose={() => setEventTypeVisible(false)}
        theme={theme}
        onSelect={(type) => {
          setEventTypeVisible(false);
          if (type === 'aula') setSubjectVisible(true);
          else if (type === 'prova') setExamVisible(true);
          else setModalVisible(true);
        }}
      />

      <SubjectModal
        visible={subjectVisible}
        onClose={() => setSubjectVisible(false)}
        onSave={handleSaveSubject}
        theme={theme}
        semesters={semesters}
      />

      <ExamModal
        visible={examVisible}
        onClose={() => setExamVisible(false)}
        onSave={handleSaveEvent}
        subjects={subjects}
        events={events}
        theme={theme}
        initialDate={selectedDate || undefined}
        isDateLocked={!!selectedDate}
      />

      <EventModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        theme={theme}
        initialEvent={editingEvent}
        initialDate={selectedDate || undefined}
        isDateLocked={!!selectedDate}
      />

      <PendingAttendanceModal
        visible={attendanceModalVisible}
        onClose={() => setAttendanceModalVisible(false)}
        pendingAttendances={attendances.filter(a => a.status === 'pending')}
        subjects={subjects}
        events={events}
        theme={theme}
        onUpdateStatus={async (id, status) => {
          const updated = attendances.map(a => a.id === id ? { ...a, status } : a);
          setAttendances(updated);
          await StorageService.saveAttendances(updated);
          if (updated.filter(a => a.status === 'pending').length === 0) {
            setAttendanceModalVisible(false);
          }
        }}
      />

      <SubjectDetailsModal
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        subject={subjects.find(s => s.id === selectedSubjectId) || null}
        events={events}
        attendances={attendances}
        theme={theme}
        semesters={semesters}
        onUpdateSubject={async (updatedSubject) => {
          const newSubjects = subjects.map(s => s.id === updatedSubject.id ? updatedSubject : s);
          setSubjects(newSubjects);
          await StorageService.saveSubjects(newSubjects);
        }}
        onDeleteSubject={handleDeleteSubject}
        onAddManualAttendance={async (subjectId, dateStr, status) => {
          const subjectEvents = events.filter(e => e.subjectId === subjectId);
          const fallbackEventId = subjectEvents.length > 0 ? subjectEvents[0].id : generateId('evt_manual');

          const existingIndex = attendances.findIndex(a => a.subjectId === subjectId && a.date === dateStr);
          let newAttendances = [...attendances];

          if (existingIndex >= 0) {
            newAttendances[existingIndex].status = status;
          } else {
            newAttendances.push({
              id: generateId('att'),
              subjectId,
              eventId: fallbackEventId,
              date: dateStr,
              status
            });
          }

          setAttendances(newAttendances);
          await StorageService.saveAttendances(newAttendances);
        }}
      />

      <AIImportModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        theme={theme}
        events={events}
        attendances={attendances}
        subjects={subjects}
        onSyncSuccess={(updatedEvents, updatedAttendances, updatedSubjects) => {
          setEvents(updatedEvents);
          setAttendances(updatedAttendances);
          setSubjects(updatedSubjects);
        }}
      />

      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        theme={theme}
        onThemeChange={(newTheme) => {
          setTheme(newTheme);
          StorageService.saveTheme(newTheme);
        }}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings(newSettings)}
        semesters={semesters}
        onUpdateSemesters={(newSemesters) => setSemesters(newSemesters)}
        onOpenGuide={() => setOnboardingVisible(true)}
        onRestoreSuccess={() => loadData()}
      />

      <OnboardingModal
        visible={onboardingVisible}
        onClose={() => setOnboardingVisible(false)}
        theme={theme}
      />

      {/* Novas Funcionalidades: Estatísticas e AACC */}
      <AnalyticsAndAACCModal
        visible={analyticsModalVisible}
        onClose={() => setAnalyticsModalVisible(false)}
        theme={theme}
        subjects={subjects}
        studySessions={studySessions}
        attendances={attendances}
      />

      {/* Gamificação & Conquistas */}
      <AchievementsModal
        visible={achievementsModalVisible}
        onClose={() => setAchievementsModalVisible(false)}
        theme={theme}
        studySessions={studySessions}
        streak={streak}
        attendances={attendances}
      />

      {/* Trabalhos em Grupo & Kanban */}
      <GroupProjectsModal
        visible={groupProjectsModalVisible}
        onClose={() => setGroupProjectsModalVisible(false)}
        theme={theme}
        subjects={subjects}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 6 : 0
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1
  },
  logoIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  levelHeaderBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  teamsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1
  },
  teamsBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    flexShrink: 1
  },
  examModeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8
  },
  pendingBanner: {
    padding: 14,
    borderRadius: 14,
    marginHorizontal: 15,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },
  calendarContainer: {
    flex: 1,
    padding: 12
  },
  calendarCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 6,
    overflow: 'hidden'
  },
  hintText: {
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
    fontSize: 12
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  timeline: {
    flex: 1
  },
  hourRow: {
    flexDirection: 'row',
    minHeight: 80,
    borderBottomWidth: 1
  },
  timeLabel: {
    width: 60,
    textAlign: 'center',
    paddingTop: 10,
    fontSize: 12,
    fontWeight: '600'
  },
  eventsContainer: {
    flex: 1,
    padding: 10
  },
  eventCard: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2
  },
  eventTitle: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2
  },
  fab: {
    position: 'absolute',
    bottom: 84,
    right: 22,
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8
  },
  fabIcon: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 34
  },
  highlightsContainer: {
    flex: 1,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
    paddingTop: 10
  },
  highlightsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8
  },
  highlightCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8
  },
  highlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  highlightDate: {
    fontWeight: '700',
    fontSize: 12
  },
  highlightCategory: {
    fontSize: 11,
    fontWeight: '700'
  },
  highlightEventTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  bottomNav: {
    flexDirection: 'row',
    height: 64,
    borderTopWidth: 1,
    paddingBottom: 6,
    paddingTop: 4,
    paddingHorizontal: 6,
    alignItems: 'center'
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 12
  },
  navItemActive: {
    borderRadius: 12
  }
});

