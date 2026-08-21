import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Platform, StatusBar as RNStatusBar, ActivityIndicator, Modal } from 'react-native';
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
import { getThemeColors, CategoryColors, getCategoryColor, getContrastTextColor } from './src/theme';
import { generateId, getLocalDateString } from './src/utils';

import { EventModal } from './src/components/EventModal';
import { EventTypeModal } from './src/components/EventTypeModal';
import { SubjectModal } from './src/components/SubjectModal';
import { ExamModal } from './src/components/ExamModal';
import { PendingAttendanceModal } from './src/components/PendingAttendanceModal';
import { SubjectDetailsModal } from './src/components/SubjectDetailsModal';
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
import { AgendaScreen } from './src/screens/AgendaScreen';
import { LumenAIScreen } from './src/screens/LumenAIScreen';
import { AIConfig } from './src/types';

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
  const [currentTab, setCurrentTab] = useState<'agenda' | 'estudos' | 'ia' | 'faltas' | 'notas'>('agenda');
  const [aiConfig, setAiConfig] = useState<AIConfig>({ provider: 'gemini', mode: 'gemini_cloud', apiKey: '' });
  const [scheduleGridVisible, setScheduleGridVisible] = useState(false);
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
    fullscreen: false,
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
  const isFullscreen = settings.fullscreen === true;
  const statusBarStyle = theme === 'light' ? 'dark' : 'light';
  const statusBarBg = theme === 'light' ? colors.surface : colors.background;

  useEffect(() => {
    RNStatusBar.setHidden(isFullscreen, 'fade');
    RNStatusBar.setBarStyle(theme === 'light' ? 'dark-content' : 'light-content', true);
  }, [isFullscreen, theme]);

  useEffect(() => {
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

  const handleTabChange = (tab: 'agenda' | 'estudos' | 'ia' | 'faltas' | 'notas') => {
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



  if (isInitializing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]} edges={isFullscreen ? ['bottom'] : ['top', 'bottom']}>
        <StatusBar
          style={statusBarStyle}
          hidden={isFullscreen}
          backgroundColor={statusBarBg}
          translucent={true}
        />
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={isFullscreen ? ['bottom'] : ['top', 'bottom']}>
      <StatusBar
        style={statusBarStyle}
        hidden={isFullscreen}
        backgroundColor={statusBarBg}
        translucent={true}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 }}>
          <View style={[styles.logoIconBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={{ fontSize: 16 }}>🎓</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>Lumen</Text>
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
        <AgendaScreen
          events={events}
          subjects={subjects}
          attendances={attendances}
          tasks={tasks}
          theme={theme}
          settings={settings}
          gamification={gamification}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onToggleEventCompletion={toggleEventCompletion}
          onToggleTaskCompletion={async (taskId) => {
            const updated = tasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
            setTasks(updated);
            await StorageService.saveTasks(updated);
          }}
          onEditEvent={(event) => {
            setEditingEvent(event);
            setModalVisible(true);
          }}
          onOpenStudy={(subId) => {
            if (subId) setSelectedSubjectId(subId);
            setCurrentTab('estudos');
          }}
          onOpenAttendanceModal={() => setAttendanceModalVisible(true)}
          onOpenExamDetails={(examEvent) => {
            setEditingEvent(examEvent);
            setModalVisible(true);
          }}
          onAddNewEvent={() => {
            setEditingEvent(null);
            setModalVisible(true);
          }}
          onOpenScheduleGrid={() => setScheduleGridVisible(true)}
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
      ) : currentTab === 'ia' ? (
        <LumenAIScreen
          subjects={subjects}
          theme={theme}
          aiConfig={aiConfig}
          onOpenAISettings={() => setSettingsModalVisible(true)}
        />
      ) : currentTab === 'faltas' ? (
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
      ) : (
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
      )}

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {[
          { id: 'agenda', icon: '📅', label: 'Agenda' },
          { id: 'estudos', icon: '⏱️', label: 'Estudos' },
          { id: 'ia', icon: '✨', label: 'Lumen AI' },
          { id: 'faltas', icon: '📊', label: 'Faltas' },
          { id: 'notas', icon: '🎓', label: 'Notas' }
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
      {currentTab !== 'ia' && currentTab !== 'notas' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          onPress={() => setEventTypeVisible(true)}
          accessibilityLabel="Adicionar novo item"
          activeOpacity={0.85}
        >
          <Text style={[styles.fabIcon, { color: getContrastTextColor(colors.primary) }]}>+</Text>
        </TouchableOpacity>
      )}

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

      {/* Grade Horária Semanal Modal */}
      <Modal
        visible={scheduleGridVisible}
        animationType="slide"
        onRequestClose={() => setScheduleGridVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>🗓️ Grade Horária Semanal</Text>
            <TouchableOpacity onPress={() => setScheduleGridVisible(false)} style={{ padding: 6 }}>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>✕ Fechar</Text>
            </TouchableOpacity>
          </View>
          <ScheduleGridScreen subjects={subjects} events={events} theme={theme} semesters={semesters} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0
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

