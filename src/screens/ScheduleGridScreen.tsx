import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Subject, AppEvent, ThemeType, Semester } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';

interface Props {
  subjects: Subject[];
  events: AppEvent[];
  theme: ThemeType;
  semesters?: Semester[];
  activeSemesterId?: string;
}

const DAYS_OF_WEEK = [
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 }
];

export const ScheduleGridScreen: React.FC<Props> = ({
  subjects,
  events,
  theme,
  semesters = [],
  activeSemesterId
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [selectedSemester, setSelectedSemester] = useState<string | undefined>(activeSemesterId);

  const currentDayOfWeek = new Date().getDay(); // 0 = Sun, 1 = Mon ...

  const COLUMN_WIDTH = 76;
  const HOUR_HEIGHT = 54;
  const START_HOUR = 7; // 07:00
  const END_HOUR = 22; // 22:00
  const TOTAL_HOURS = END_HOUR - START_HOUR + 1;

  // Filter only weekly classes
  const classes = useMemo(() => {
    return events.filter(e => {
      if (e.category !== 'Faculdade/Aulas' || e.recurrence !== 'weekly') return false;
      if (e.subjectId) {
        const sub = subjects.find(s => s.id === e.subjectId);
        if (sub?.isArchived) return false;
        if (selectedSemester && sub?.semesterId && sub.semesterId !== selectedSemester) return false;
      }
      return true;
    });
  }, [events, subjects, selectedSemester]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Grade Horária</Text>
      </View>

      {/* Semester pill selector */}
      {semesters.length > 0 && (
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                {
                  backgroundColor: !selectedSemester ? colors.primary : colors.surface,
                  borderColor: !selectedSemester ? colors.primary : colors.border
                }
              ]}
              onPress={() => setSelectedSemester(undefined)}
              activeOpacity={0.7}
            >
              <Text style={{
                color: !selectedSemester ? getContrastTextColor(colors.primary) : colors.text,
                fontWeight: '700',
                fontSize: 11
              }}>
                Todos
              </Text>
            </TouchableOpacity>
            {semesters.map(sem => (
              <TouchableOpacity
                key={sem.id}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: selectedSemester === sem.id ? colors.primary : colors.surface,
                    borderColor: selectedSemester === sem.id ? colors.primary : colors.border
                  }
                ]}
                onPress={() => setSelectedSemester(sem.id)}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: selectedSemester === sem.id ? getContrastTextColor(colors.primary) : colors.text,
                  fontWeight: '700',
                  fontSize: 11
                }}>
                  {sem.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {classes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Text style={{ fontSize: 36 }}>🗓️</Text>
          </View>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Nenhuma aula semanal cadastrada
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Cadastre matérias com dias e horários para visualizá-las na grade.
          </Text>
        </View>
      ) : (
        <View style={styles.gridContainer}>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.verticalScroll}>
            <View style={{ flexDirection: 'row' }}>
              {/* Time axis */}
              <View style={styles.timeAxis}>
                <View style={styles.cornerCell}>
                  <Text style={{ fontSize: 9, color: colors.textSecondary, fontWeight: '800' }}>HORA</Text>
                </View>
                {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                  <View key={i} style={[styles.timeLabelContainer, { height: HOUR_HEIGHT }]}>
                    <Text style={styles.timeLabel}>
                      {(START_HOUR + i).toString().padStart(2, '0')}:00
                    </Text>
                  </View>
                ))}
              </View>

              {/* Days Scroll */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
                <View style={styles.scheduleContent}>
                  {/* Headers */}
                  <View style={styles.daysHeaderRow}>
                    {DAYS_OF_WEEK.map((day) => {
                      const isToday = currentDayOfWeek === day.value;
                      return (
                        <View key={day.value} style={[styles.dayHeader, isToday && { backgroundColor: colors.primaryLight }]}>
                          <Text style={[
                            styles.dayHeaderText,
                            { color: isToday ? colors.primary : colors.text }
                          ]}>
                            {day.label}
                          </Text>
                          {isToday && (
                            <View style={[styles.todayIndicator, { backgroundColor: colors.primary }]} />
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* Grid Body */}
                  <View style={styles.gridBody}>
                    {/* Background lines */}
                    {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                      <View 
                        key={`line-${i}`} 
                        style={[
                          styles.gridLine, 
                          { top: i * HOUR_HEIGHT, width: DAYS_OF_WEEK.length * COLUMN_WIDTH }
                        ]} 
                      />
                    ))}

                    {/* Day Columns for positioning */}
                    {DAYS_OF_WEEK.map((day, index) => (
                      <View key={`col-${day.value}`} style={[styles.dayColumn, { left: index * COLUMN_WIDTH, width: COLUMN_WIDTH }]}>
                        {classes.map(evt => {
                          const dayFromDate = new Date(evt.date + 'T12:00:00').getDay();
                          if (evt.recurrenceDays?.includes(day.value) || dayFromDate === day.value) {
                            const [startH, startM] = (evt.startTime || '08:00').split(':').map(Number);
                            const [endH, endM] = (evt.endTime || '10:00').split(':').map(Number);
                            const startMinutes = (startH - START_HOUR) * 60 + startM;
                            const duration = (endH - START_HOUR) * 60 + endM - startMinutes;
                            if (startMinutes < 0) return null;
                            
                            const subject = subjects.find(s => s.id === evt.subjectId);
                            const blockBg = subject?.color || colors.primary;
                            const contrastText = getContrastTextColor(blockBg);

                            return (
                              <View
                                key={`${evt.id}-${day.value}`}
                                style={[
                                  styles.eventBlock,
                                  {
                                    backgroundColor: blockBg,
                                    top: (startMinutes / 60) * HOUR_HEIGHT,
                                    height: Math.max((duration / 60) * HOUR_HEIGHT - 2, 22),
                                  }
                                ]}
                              >
                                <Text style={[styles.eventText, { color: contrastText }]} numberOfLines={2}>
                                  {subject?.name || evt.title}
                                </Text>
                                {duration >= 40 && (
                                  <Text style={[styles.eventTimeText, { color: contrastText, opacity: 0.9 }]} numberOfLines={1}>
                                    {evt.startTime} - {evt.endTime}
                                  </Text>
                                )}
                              </View>
                            );
                          }
                          return null;
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  filterContainer: {
    height: 34,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  filterScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  gridContainer: {
    flex: 1,
  },
  verticalScroll: {
    flex: 1,
  },
  timeAxis: {
    width: 44,
    borderRightWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cornerCell: {
    height: 38,
    borderBottomWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeLabelContainer: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  timeLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  daysScroll: {
    flex: 1,
  },
  scheduleContent: {
    flexDirection: 'column',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    height: 38,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayHeader: {
    width: 76,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  dayHeaderText: {
    fontWeight: '700',
    fontSize: 12,
  },
  todayIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  gridBody: {
    position: 'relative',
    height: 16 * 54,
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  dayColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 76,
    borderRightWidth: 1,
    borderColor: colors.borderSubtle,
  },
  eventBlock: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 8,
    padding: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  eventText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  eventTimeText: {
    fontSize: 8.5,
    marginTop: 1,
    fontWeight: '600',
  }
});

