import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Subject, AttendanceRecord, AppEvent, ThemeType, AttendanceStatus, Semester } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { format, parseISO, isBefore, getDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { AbsencePlannerModal } from '../components/AbsencePlannerModal';

interface Props {
  subjects: Subject[];
  events: AppEvent[];
  attendances: AttendanceRecord[];
  theme: ThemeType;
  semesters?: Semester[];
  activeSemesterId?: string;
  onSubjectPress: (subjectId: string) => void;
  onUpdateAttendance: (subjectId: string, eventId: string, status: AttendanceStatus, dateStr: string) => void;
}

export const AttendanceScreen: React.FC<Props> = ({
  subjects,
  events,
  attendances,
  theme,
  semesters = [],
  activeSemesterId,
  onSubjectPress,
  onUpdateAttendance
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [selectedSemester, setSelectedSemester] = useState<string | undefined>(activeSemesterId);
  const [plannerModalVisible, setPlannerModalVisible] = useState(false);

  const calculateAbsences = (subjectId: string) => {
    return attendances.filter(a => a.subjectId === subjectId && a.status === 'absent').length;
  };

  const calculatePresences = (subjectId: string) => {
    return attendances.filter(a => a.subjectId === subjectId && a.status === 'present').length;
  };

  const calculatePresenceRate = (subjectId: string, maxAbsences: number) => {
    const abs = calculateAbsences(subjectId);
    const pres = calculatePresences(subjectId);
    const totalRecorded = abs + pres;

    if (totalRecorded === 0) return 100.0;
    return (pres / totalRecorded) * 100;
  };

  const getNextClass = (subject: Subject): { event: AppEvent; dateStr: string } | null => {
    const subjectEvents = events.filter(e => e.subjectId === subject.id && e.category === 'Faculdade/Aulas');
    if (subjectEvents.length === 0) return null;

    let nextClassInfo = null;
    let earliestNextDate = new Date('2099-01-01');

    subjectEvents.forEach(e => {
      if (e.recurrence === 'weekly') {
        const startDay = getDay(parseISO(e.date));
        for (let i = 0; i < 7; i++) {
          let testDate = new Date();
          testDate.setDate(testDate.getDate() + i);
          const testDateStr = format(testDate, 'yyyy-MM-dd');
          
          if (getDay(testDate) === startDay && testDateStr >= e.date) {
            const isCancelled = attendances.some(a => a.eventId === e.id && a.date === testDateStr && a.status === 'cancelled');
            if (!isCancelled) {
              const hasRecord = attendances.some(a => a.eventId === e.id && a.date === testDateStr && a.status !== 'pending');
              if (hasRecord) continue;

              if (i === 0) {
                const currentH = new Date().getHours();
                const currentM = new Date().getMinutes();
                const [endH, endM] = (e.endTime || '23:59').split(':').map(Number);
                if (currentH * 60 + currentM > endH * 60 + endM) {
                  continue;
                }
              }
              if (isBefore(testDate, earliestNextDate)) {
                earliestNextDate = testDate;
                nextClassInfo = { event: e, dateStr: testDateStr };
              }
              break;
            }
          }
        }
      }
    });

    return nextClassInfo;
  };

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      if (s.isArchived) return false;
      if (selectedSemester && s.semesterId && s.semesterId !== selectedSemester) return false;
      return true;
    });
  }, [subjects, selectedSemester]);

  // Overall attendance statistics
  const summaryMetrics = useMemo(() => {
    let totalAbsences = 0;
    let atRiskCount = 0;

    filteredSubjects.forEach(s => {
      if (s.isArchived) return;
      const abs = calculateAbsences(s.id);
      const max = s.maxAbsences || 15;
      totalAbsences += abs;
      if ((abs / max) >= 0.7) {
        atRiskCount++;
      }
    });

    return { totalAbsences, atRiskCount };
  }, [filteredSubjects, attendances]);

  const handleAction = (subjectId: string, eventId: string, status: AttendanceStatus, dateStr: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateAttendance(subjectId, eventId, status, dateStr);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Minhas Faltas</Text>
        <TouchableOpacity
          style={[styles.plannerBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setPlannerModalVisible(true);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Abrir simulador Posso Faltar?"
        >
          <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '700', fontSize: 13 }}>
            🏖️ Posso Faltar?
          </Text>
        </TouchableOpacity>
      </View>

      {/* Semesters pill filter */}
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

      {/* Summary card */}
      {filteredSubjects.length > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Faltas Acumuladas</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {summaryMetrics.totalAbsences}
            </Text>
          </View>
          <View style={[styles.summaryItem, { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 18 }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Em Risco (≥70%)</Text>
            <Text style={[styles.summaryValue, { color: summaryMetrics.atRiskCount > 0 ? colors.danger : colors.success }]}>
              {summaryMetrics.atRiskCount} {summaryMetrics.atRiskCount > 0 ? '⚠️' : '✅'}
            </Text>
          </View>
        </View>
      )}

      {filteredSubjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Text style={styles.emptyIcon}>📅</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma matéria cadastrada</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Adicione matérias pelo botão "+" para gerenciar presenças e faltas.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {filteredSubjects.map(subject => {
            const absences = calculateAbsences(subject.id);
            const maxAbsences = subject.maxAbsences || 15;
            const absencePercentage = (absences / maxAbsences) * 100;
            const remainingAbsences = Math.max(0, maxAbsences - absences);
            const presenceRate = calculatePresenceRate(subject.id, maxAbsences);

            let absenceColor = theme === 'light' ? colors.successDark : colors.success;
            let absenceEmoji = '✅';
            let absenceAlert = '';

            if (absencePercentage >= 100) {
              absenceColor = theme === 'light' ? colors.dangerDark : colors.danger;
              absenceEmoji = '💀';
              absenceAlert = 'Reprovado por falta!';
            } else if (absencePercentage >= 80) {
              absenceColor = theme === 'light' ? colors.dangerDark : colors.danger;
              absenceEmoji = '🚨';
              absenceAlert = `Perigo! Só pode faltar mais ${remainingAbsences}x`;
            } else if (absencePercentage >= 50) {
              absenceColor = theme === 'light' ? colors.warningDark : colors.warning;
              absenceEmoji = '⚠️';
              absenceAlert = `Atenção! Restam ${remainingAbsences} faltas`;
            }

            const nextClass = getNextClass(subject);

            const totalRecorded = absences + calculatePresences(subject.id);
            const isPresenceSafe = presenceRate >= 75 || (totalRecorded < 4 && absences <= 1);

            return (
              <View
                key={subject.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: absencePercentage >= 80 ? absenceColor : colors.border
                  }
                ]}
              >
                {/* Header */}
                <TouchableOpacity
                  onPress={() => onSubjectPress(subject.id)}
                  style={styles.cardHeader}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[styles.subjectDot, { backgroundColor: subject.color || colors.primary }]} />
                    <Text style={[styles.subjectName, { color: colors.text }]} numberOfLines={1}>
                      {subject.name}
                      {subject.isArchived && <Text style={{ fontSize: 13, color: colors.textSecondary }}> (Arquivada)</Text>}
                    </Text>
                  </View>
                  <View style={[styles.detailsBadge, { backgroundColor: colors.surfaceSubtle }]}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Detalhes ›</Text>
                  </View>
                </TouchableOpacity>

                {absenceAlert !== '' && (
                  <View style={[styles.alertBanner, { backgroundColor: absenceColor + '18', borderColor: absenceColor }]}>
                    <Text style={{ fontSize: 15, marginRight: 6 }}>{absenceEmoji}</Text>
                    <Text style={{ color: absenceColor, fontWeight: '700', fontSize: 13 }}>{absenceAlert}</Text>
                  </View>
                )}

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Faltas Registradas</Text>
                    <Text style={[styles.statValue, { color: absenceColor }]}>
                      {absences} <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '500' }}>/ {maxAbsences}</Text>
                    </Text>
                    <View style={[styles.progressBar, { backgroundColor: colors.borderSubtle }]}>
                      <View style={[styles.progressFill, { width: `${Math.min(absencePercentage, 100)}%`, backgroundColor: absenceColor }]} />
                    </View>
                  </View>

                  <View style={[styles.statBox, { alignItems: 'flex-end' }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Taxa de Presença</Text>
                    <Text style={[styles.statValue, { color: isPresenceSafe ? (theme === 'light' ? colors.successDark : colors.success) : (theme === 'light' ? colors.dangerDark : colors.danger) }]}>
                      {presenceRate.toFixed(1)}%
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{totalRecorded < 4 ? 'Amostra inicial' : 'Mínimo: 75%'}</Text>
                  </View>
                </View>

                {/* Próxima Aula & Ações Rápidas */}
                <View style={[styles.nextClassContainer, { borderTopColor: colors.border }]}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Próxima Aula</Text>
                  {nextClass ? (
                    <View>
                      <View style={[styles.nextClassDateBadge, { backgroundColor: colors.surfaceSubtle }]}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                          📅 {nextClass.dateStr.split('-').reverse().join('/')} às {nextClass.event.startTime}
                        </Text>
                      </View>
                      
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.successLight, borderColor: colors.success }]}
                          onPress={() => handleAction(subject.id, nextClass.event.id, 'present', nextClass.dateStr)}
                          activeOpacity={0.7}
                        >
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            style={{ color: theme === 'light' ? colors.successDark : colors.success, fontWeight: '700', fontSize: 13 }}
                          >
                            ✓ Presente
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
                          onPress={() => handleAction(subject.id, nextClass.event.id, 'absent', nextClass.dateStr)}
                          activeOpacity={0.7}
                        >
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            style={{ color: theme === 'light' ? colors.dangerDark : colors.danger, fontWeight: '700', fontSize: 13 }}
                          >
                            ✕ Faltei
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                          onPress={() => handleAction(subject.id, nextClass.event.id, 'cancelled', nextClass.dateStr)}
                          activeOpacity={0.7}
                        >
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}
                          >
                            Cancelada
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Nenhuma aula agendada para os próximos dias.</Text>
                  )}
                </View>
              </View>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Simulador Inteligente de Faltas */}
      <AbsencePlannerModal
        visible={plannerModalVisible}
        onClose={() => setPlannerModalVisible(false)}
        subjects={subjects}
        events={events}
        attendances={attendances}
        theme={theme}
      />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, padding: 14 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  plannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  filterContainer: {
    height: 34,
    marginBottom: 10,
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
  summaryCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  list: { flex: 1 },
  card: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1
  },
  detailsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  statBox: { flex: 1 },
  statLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  progressBar: {
    height: 7,
    borderRadius: 4,
    width: '90%',
    overflow: 'hidden'
  },
  progressFill: { height: '100%', borderRadius: 4 },
  nextClassContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1
  },
  nextClassDateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center'
  }
});

