import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Switch } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { AppEvent, ThemeType, Subject, AttendanceRecord } from './src/types';
import { StorageService } from './src/services/storage';
import { AttendanceService } from './src/services/AttendanceService';
import { NotificationService } from './src/services/notifications';
import { getThemeColors, CategoryColors } from './src/theme';
import { EventModal } from './src/components/EventModal';
import { EventTypeModal } from './src/components/EventTypeModal';
import { SubjectModal } from './src/components/SubjectModal';
import { ExamModal } from './src/components/ExamModal';
import { PendingAttendanceModal } from './src/components/PendingAttendanceModal';
import { SubjectDetailsModal } from './src/components/SubjectDetailsModal';
import { PerformanceScreen } from './src/screens/PerformanceScreen';
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
  const [currentTab, setCurrentTab] = useState<'agenda' | 'performance'>('agenda');
  const [theme, setTheme] = useState<ThemeType>('dark');
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  
  const [eventTypeVisible, setEventTypeVisible] = useState(false);
  const [subjectVisible, setSubjectVisible] = useState(false);
  const [examVisible, setExamVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const colors = getThemeColors(theme);
  
  useEffect(() => {
    loadData();
    NotificationService.requestPermissions();
    
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    const savedTheme = await StorageService.getTheme();
    const savedEvents = await StorageService.getEvents();
    const savedSubjects = await StorageService.getSubjects();
    const savedAttendances = await StorageService.getAttendances();
    
    // Check for new pending attendances
    const updatedAttendances = await AttendanceService.generatePendingAttendances(savedEvents, savedAttendances);

    setTheme(savedTheme);
    setEvents(savedEvents);
    setSubjects(savedSubjects);
    setAttendances(updatedAttendances);
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    await StorageService.saveTheme(newTheme);
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
    let updatedSubjects = [...subjects];
    if (event.category === 'Provas/Trabalhos' && event.subjectId && !editingEvent) {
      const subjectIndex = subjects.findIndex(s => s.id === event.subjectId);
      if (subjectIndex !== -1) {
        const subject = subjects[subjectIndex];
        let gradeGroups = subject.gradeGroups || [];
        
        // Automaticamente joga na primeira ou cria "Avaliações"
        let actualTargetGroupId = '';
        if (gradeGroups.length === 0) {
          const defaultGroup = {
            id: `group_${Date.now()}`,
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
          id: `item_${Date.now()}`,
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
      console.error("Erro ao salvar evento ou notificação", error);
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
      // schedule notifications for all
      for (const ev of newEvents) {
        await NotificationService.scheduleEventNotifications(ev);
      }
    } catch (error) {
      console.error("Erro ao salvar materia", error);
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
    } catch (error) {
      console.error("Erro ao deletar evento", error);
    }
  };

  const toggleEventCompletion = async (eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newEvents = events.map(e => e.id === eventId ? { ...e, isCompleted: !e.isCompleted } : e);
    setEvents(newEvents);
    await StorageService.saveEvents(newEvents);
  };

  // Generate hours for the timeline (07:00 to 23:00)
  const hours = Array.from({ length: 17 }, (_, i) => i + 7);

  const todaysEvents = useMemo(() => {
    const targetDate = selectedDate || format(new Date(), 'yyyy-MM-dd');
    
    return events.filter(e => {
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
      return e.date === targetDate;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [events, selectedDate]);

  const nextTask = useMemo(() => {
    if (selectedDate) return null; // Only show on "today" view
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    return todaysEvents.find(e => {
      const [h, m] = e.startTime.split(':').map(Number);
      return (h * 60 + m) > currentMins;
    });
  }, [todaysEvents, selectedDate, currentTime]);

  // Transform events into calendar markers
  const markedDates = useMemo(() => {
    const marks: any = {};
    const today = new Date().toISOString().split('T')[0];
    
    events.forEach(e => {
      if (e.recurrence === 'none') {
        if (!marks[e.date]) marks[e.date] = { dots: [] };
        if (marks[e.date].dots.length < 3) marks[e.date].dots.push({ color: CategoryColors[e.category] });
      } else {
        // For daily and weekly, mark the next 365 days from the event start date
        let currentDate = parseISO(e.date);
        for (let i = 0; i < 365; i++) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          if (!marks[dateStr]) marks[dateStr] = { dots: [] };
          if (marks[dateStr].dots.length < 3) marks[dateStr].dots.push({ color: CategoryColors[e.category] });
          
          currentDate = addDays(currentDate, e.recurrence === 'daily' ? 1 : 7);
        }
      }
    });

    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: colors.primary,
      };
    }
    return marks;
  }, [events, selectedDate, colors.primary]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Organiza</Text>
        <TouchableOpacity onPress={toggleTheme}>
          <Text style={{ fontSize: 24 }}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      {currentTab === 'agenda' ? (
        <>
          {attendances.filter(a => a.status === 'pending').length > 0 && (
            <TouchableOpacity 
              style={{ backgroundColor: '#ef4444', padding: 15, borderRadius: 10, marginHorizontal: 20, marginTop: 10, flexDirection: 'row', alignItems: 'center' }}
              onPress={() => setAttendanceModalVisible(true)}
            >
              <Text style={{ fontSize: 24, marginRight: 10 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Faltas Pendentes</Text>
                <Text style={{ color: '#fff', fontSize: 12 }}>Você tem {attendances.filter(a => a.status === 'pending').length} aula(s) aguardando confirmação.</Text>
              </View>
            </TouchableOpacity>
          )}

          {!selectedDate ? (
            <View style={styles.calendarContainer}>
              <Calendar
                current={new Date().toISOString().split('T')[0]}
                onDayPress={(day: any) => setSelectedDate(day.dateString)}
                markingType={'multi-dot'}
                markedDates={{
                  ...markedDates,
                  [new Date().toISOString().split('T')[0]]: {
                    ...(markedDates[new Date().toISOString().split('T')[0]] || {}),
                    selected: true,
                    selectedColor: colors.primary,
                    selectedTextColor: '#000'
                  }
                }}
                enableSwipeMonths={true}
                hideArrows={true}
                theme={{
                  calendarBackground: colors.background,
                  textSectionTitleColor: colors.textSecondary,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: '#000',
                  todayTextColor: '#000',
                  todayBackgroundColor: colors.primary,
                  dayTextColor: colors.text,
                  textDisabledColor: colors.border,
                  monthTextColor: colors.text,
                }}
              />
              <Text style={[styles.hintText, { color: colors.textSecondary, marginBottom: 15 }]}>
                Clique em um dia para ver os horários. Deslize para trocar o mês.
              </Text>

              {nextTask && (
                <View style={{ marginBottom: 15 }}>
                  <Text style={[styles.highlightsTitle, { color: colors.text }]}>⏳ Próxima Tarefa</Text>
                  <TouchableOpacity 
                    style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 2 }]}
                    onPress={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  >
                    <View style={styles.highlightHeader}>
                      <Text style={[styles.highlightDate, { color: colors.primary }]}>{nextTask.startTime} - {nextTask.endTime}</Text>
                      <Text style={[styles.highlightCategory, { color: CategoryColors[nextTask.category] }]}>{nextTask.category}</Text>
                    </View>
                    <Text style={[styles.highlightEventTitle, { color: colors.text }]}>{nextTask.title}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {todaysEvents.length > 0 && (
                <View style={styles.highlightsContainer}>
                  <Text style={[styles.highlightsTitle, { color: colors.text }]}>📌 Atividades de Hoje</Text>
                  <ScrollView style={{ flex: 1 }}>
                    {todaysEvents.map(event => (
                      <TouchableOpacity 
                        key={event.id} 
                        style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: CategoryColors[event.category] }]}
                        onPress={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                      >
                        <View style={styles.highlightHeader}>
                          <Text style={[styles.highlightDate, { color: colors.primary }]}>{event.startTime} - {event.endTime}</Text>
                          <Text style={[styles.highlightCategory, { color: CategoryColors[event.category] }]}>{event.category}</Text>
                        </View>
                        <Text style={[styles.highlightEventTitle, { color: colors.text }]}>{event.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <TouchableOpacity 
                style={[styles.backBtn, { borderColor: colors.border }]} 
                onPress={() => setSelectedDate(null)}
              >
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>← Voltar ao Calendário</Text>
                <Text style={{ color: colors.text }}> Dia {selectedDate.split('-').reverse().join('/')}</Text>
              </TouchableOpacity>

              <ScrollView style={styles.timeline}>
                <View style={{ height: 24 * 80, paddingBottom: 80 }}>
                  {/* Grid / Hour Labels */}
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <View key={hour} style={[styles.hourRow, { position: 'absolute', top: hour * 80, width: '100%', borderBottomColor: colors.border, height: 80 }]}>
                      <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>{`${hour.toString().padStart(2, '0')}:00`}</Text>
                      <View style={styles.eventsContainer} />
                    </View>
                  ))}

                  {/* Current Time Indicator */}
                  {selectedDate === format(currentTime, 'yyyy-MM-dd') && (
                    <View style={{
                      position: 'absolute',
                      left: 65,
                      right: 0,
                      top: (currentTime.getHours() + currentTime.getMinutes() / 60) * 80,
                      height: 2,
                      backgroundColor: '#ef4444',
                      zIndex: 10,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginLeft: -4 }} />
                    </View>
                  )}

                  {/* Events */}
                  {todaysEvents.map((event, index) => {
                    const [startH, startM] = event.startTime.split(':').map(Number);
                    const topOffset = (startH + startM / 60) * 80;
                    
                    let durationHours = 1;
                    if (event.endTime) {
                      const [endH, endM] = event.endTime.split(':').map(Number);
                      durationHours = (endH + endM / 60) - (startH + startM / 60);
                      if (durationHours < 0) durationHours += 24;
                    }
                    
                    const height = Math.max(durationHours * 80, 20); // min height 20px
                    
                    // Simple overlap visual trick: offset slightly if overlapping
                    // We'll just add a border and slight opacity
                    
                    return (
                      <TouchableOpacity 
                        key={event.id} 
                        style={[
                          styles.eventCard, 
                          { 
                            position: 'absolute',
                            top: topOffset,
                            height: height - 2, // 2px margin
                            left: 70, // Align right next to timeLabel
                            right: 15,
                            backgroundColor: CategoryColors[event.category], 
                            opacity: event.isCompleted ? 0.6 : 0.95,
                            borderWidth: 1,
                            borderColor: colors.surface,
                            zIndex: 5
                          }
                        ]}
                        onPress={() => toggleEventCompletion(event.id)}
                        onLongPress={() => {
                          setEditingEvent(event);
                          setModalVisible(true);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.eventTitle, { color: '#000' }]} numberOfLines={1}>
                            {event.isCompleted ? '✓ ' : ''}{event.title}
                          </Text>
                          {height >= 40 && (
                            <Text style={{ fontSize: 12, color: '#000', opacity: 0.8 }}>
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
      ) : (
        <>
          <PerformanceScreen 
            subjects={subjects} 
            events={events} 
            attendances={attendances} 
            theme={theme} 
            onSubjectPress={(id) => {
              setSelectedSubjectId(id);
              setDetailsModalVisible(true);
            }}
            onArchiveSubject={async (id) => {
              const newSubjects = subjects.map(s => s.id === id ? { ...s, isArchived: true } : s);
              setSubjects(newSubjects);
              await StorageService.saveSubjects(newSubjects);
            }}
          />
        </>
      )}

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentTab('agenda')}>
          <Text style={{ fontSize: 24 }}>📅</Text>
          <Text style={{ color: currentTab === 'agenda' ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: currentTab === 'agenda' ? 'bold' : 'normal', marginTop: 4 }}>Agenda</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentTab('performance')}>
          <Text style={{ fontSize: 24 }}>📊</Text>
          <Text style={{ color: currentTab === 'performance' ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: currentTab === 'performance' ? 'bold' : 'normal', marginTop: 4 }}>Desempenho</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]} 
        onPress={() => setEventTypeVisible(true)}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

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
        onUpdateSubject={async (updatedSubject) => {
          const newSubjects = subjects.map(s => s.id === updatedSubject.id ? updatedSubject : s);
          setSubjects(newSubjects);
          await StorageService.saveSubjects(newSubjects);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  title: { fontSize: 28, fontWeight: 'bold' },
  calendarContainer: { flex: 1, padding: 10 },
  hintText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  timeline: { flex: 1 },
  hourRow: { flexDirection: 'row', minHeight: 80, borderBottomWidth: 1 },
  timeLabel: { width: 60, textAlign: 'center', paddingTop: 10, fontSize: 14, fontWeight: '500' },
  eventsContainer: { flex: 1, padding: 10 },
  emptySlot: { flex: 1 },
  eventCard: { borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventTitle: { color: '#000', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  eventTime: { color: 'rgba(0,0,0,0.7)', fontSize: 12 },
  fab: { position: 'absolute', bottom: 90, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabIcon: { fontSize: 32, color: '#000', fontWeight: '300' },
  highlightsContainer: { flex: 1, marginTop: 10, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 15 },
  highlightsTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  highlightCard: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  highlightHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  highlightDate: { fontWeight: 'bold' },
  highlightCategory: { fontSize: 12, fontWeight: '600' },
  highlightEventTitle: { fontSize: 16, fontWeight: '500' },
  bottomNav: { flexDirection: 'row', height: 65, borderTopWidth: 1, paddingBottom: 10, paddingTop: 5 },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
