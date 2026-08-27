import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppEvent, Subject, ThemeType, GamificationData } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { getLocalDateString } from '../utils';
import * as Haptics from 'expo-haptics';

interface Props {
  events: AppEvent[];
  subjects: Subject[];
  selectedDate: string; // YYYY-MM-DD
  theme: ThemeType;
  gamification?: GamificationData;
  onOpenStudy: (subjectId?: string) => void;
  onOpenExamDetails?: (event: AppEvent) => void;
}

export const TodaySummaryWidget: React.FC<Props> = ({
  events,
  subjects,
  selectedDate,
  theme,
  gamification,
  onOpenStudy,
  onOpenExamDetails
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Parse current time in minutes from midnight
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayStr = getLocalDateString(now);
  const isToday = selectedDate === todayStr;

  const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
  const safeSubjects = Array.isArray(subjects) ? subjects.filter(Boolean) : [];
  const safeSelectedDate = typeof selectedDate === 'string' && selectedDate.trim() ? selectedDate : todayStr;

  // Filter today's events sorted by startTime
  const todayEvents = safeEvents
    .filter(e => {
      if (!e) return false;
      if (e.date === safeSelectedDate) return true;
      if (e.recurrence === 'weekly') {
        if (e.date && safeSelectedDate < e.date) return false;
        const dayOfWeek = new Date(safeSelectedDate + 'T12:00:00').getDay();
        if (Array.isArray(e.recurrenceDays) && e.recurrenceDays.length > 0) {
          return e.recurrenceDays.includes(dayOfWeek);
        }
        if (e.date) {
          const baseDayOfWeek = new Date(e.date + 'T12:00:00').getDay();
          return baseDayOfWeek === dayOfWeek;
        }
      }
      return false;
    })
    .sort((a, b) => {
      const [ah, am] = String(a?.startTime || '00:00').split(':').map(Number);
      const [bh, bm] = String(b?.startTime || '00:00').split(':').map(Number);
      return ((ah || 0) * 60 + (am || 0)) - ((bh || 0) * 60 + (bm || 0));
    });

  // Find active or next upcoming class/event
  let activeEvent: AppEvent | null = null;
  let nextEvent: AppEvent | null = null;
  let minutesUntilNext: number | null = null;

  for (const evt of todayEvents) {
    const [sh, sm] = String(evt.startTime || '00:00').split(':').map(Number);
    const [eh, em] = String(evt.endTime || '23:59').split(':').map(Number);
    const startMins = (sh || 0) * 60 + (sm || 0);
    const endMins = (eh || 0) * 60 + (em || 0);

    if (isToday) {
      if (currentMinutes >= startMins && currentMinutes <= endMins) {
        activeEvent = evt;
        break;
      } else if (currentMinutes < startMins && !nextEvent) {
        nextEvent = evt;
        minutesUntilNext = startMins - currentMinutes;
      }
    } else {
      // For future/past selected days, just take the first event
      if (!nextEvent) {
        nextEvent = evt;
      }
    }
  }

  const featuredEvent = activeEvent || nextEvent;
  const featuredSubject = featuredEvent ? safeSubjects.find(s => s.id === featuredEvent.subjectId) : null;

  // Find exams or homework in the next 7 days
  const upcomingExams = safeEvents.filter(e => {
    if (!e || e.category !== 'Provas/Trabalhos' || !e.date) return false;
    const evtDate = new Date(e.date + 'T12:00:00');
    const todayDate = new Date(todayStr + 'T12:00:00');
    const diffDays = (evtDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }).sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));

  const nextUrgentExam = upcomingExams[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header Row */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => {
          Haptics.selectionAsync();
          setIsCollapsed(!isCollapsed);
        }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[styles.pulseIcon, { backgroundColor: colors.primaryLight }]}>
            <Text style={{ fontSize: 15 }}>⚡</Text>
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Resumo Inteligente</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {isToday ? 'Hoje' : (safeSelectedDate ? safeSelectedDate.split('-').reverse().join('/') : '')} • {todayEvents.length} compromisso{todayEvents.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {gamification && (
            <View style={[styles.levelBadge, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>
                Nv. {gamification.level} 🎓
              </Text>
            </View>
          )}
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '700' }}>
            {isCollapsed ? '▼' : '▲'}
          </Text>
        </View>
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.body}>
          {/* Active or Next Class Card */}
          {featuredEvent ? (
            <View style={[styles.eventHighlightCard, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={[styles.statusDot, { backgroundColor: activeEvent ? colors.success : colors.primary }]} />
                    <Text style={[styles.statusLabel, { color: activeEvent ? (theme === 'light' ? colors.successDark : colors.success) : (theme === 'light' ? colors.primaryDark : colors.primary) }]}>
                      {activeEvent ? 'AULA EM ANDAMENTO' : minutesUntilNext !== null ? `PRÓXIMA AULA (em ${minutesUntilNext} min)` : 'PRÓXIMA AULA'}
                    </Text>
                  </View>
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                    {featuredEvent.title}
                  </Text>
                  <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                    ⏰ {featuredEvent.startTime} - {featuredEvent.endTime}
                    {featuredSubject?.notes ? ` • ${featuredSubject.notes}` : ''}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.quickStudyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onOpenStudy(featuredEvent.subjectId);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800', fontSize: 12 }}>
                    ⏱️ Estudar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.emptyHighlightCard, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>✨</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 }}>
                Nenhuma aula pendente para este dia. Aproveite para revisar seus estudos!
              </Text>
            </View>
          )}

          {/* Urgent Exam Alert Banner */}
          {nextUrgentExam && (
            <TouchableOpacity
              style={[styles.examAlertBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}
              onPress={() => {
                Haptics.selectionAsync();
                if (onOpenExamDetails) onOpenExamDetails(nextUrgentExam);
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>📝</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme === 'light' ? colors.warningDark : colors.warning, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
                    {nextUrgentExam.title}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                    📅 Dia {nextUrgentExam?.date ? nextUrgentExam.date.split('-').reverse().join('/') : ''} às {nextUrgentExam?.startTime || ''}
                  </Text>
                </View>
              </View>
              <Text style={{ color: theme === 'light' ? colors.warningDark : colors.warning, fontWeight: '800', fontSize: 12, marginLeft: 8 }}>
                Ver ›
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pulseIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  body: {
    marginTop: 12,
    gap: 8,
  },
  eventHighlightCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyHighlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  eventTime: {
    fontSize: 12,
    marginTop: 3,
  },
  quickStudyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  examAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  }
});
