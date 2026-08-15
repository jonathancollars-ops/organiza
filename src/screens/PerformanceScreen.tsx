import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Subject, AttendanceRecord, AppEvent, ThemeType } from '../types';
import { getThemeColors } from '../theme';

interface Props {
  subjects: Subject[];
  events: AppEvent[];
  attendances: AttendanceRecord[];
  theme: ThemeType;
  onSubjectPress: (subjectId: string) => void;
  onArchiveSubject: (subjectId: string) => void;
}

export const PerformanceScreen: React.FC<Props> = ({ subjects, events, attendances, theme, onSubjectPress, onArchiveSubject }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const calculateAbsences = (subjectId: string) => {
    return attendances.filter(a => a.subjectId === subjectId && a.status === 'absent').length;
  };

  const calculateGrade = (subjectId: string, subject: Subject) => {
    const gradeGroups = subject.gradeGroups || [];
    if (gradeGroups.length === 0) return { current: 0, hasGrades: false };

    let totalWeight = 0;
    let totalScore = 0;

    gradeGroups.forEach(group => {
      if (group.items.length === 0) return;
      let groupTotalWeight = 0;
      let groupTotalScore = 0;

      group.items.forEach(item => {
        groupTotalWeight += item.weight;
        if (item.grade !== undefined) {
          groupTotalScore += (item.grade / item.maxGrade) * 10 * item.weight;
        }
      });

      const groupAvg = groupTotalWeight > 0 ? groupTotalScore / groupTotalWeight : 0;
      totalWeight += group.weight;
      totalScore += groupAvg * group.weight;
    });

    const finalAvg = totalWeight > 0 ? totalScore / totalWeight : 0;
    const hasGrades = gradeGroups.some(g => g.items.some(i => i.grade !== undefined));
    return { current: finalAvg, hasGrades };
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meu Desempenho</Text>

      {subjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhuma matéria cadastrada.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {subjects.map(subject => {
            const absences = calculateAbsences(subject.id);
            const maxAbsences = subject.maxAbsences || 15;
            const absencePercentage = (absences / maxAbsences) * 100;
            const remainingAbsences = maxAbsences - absences;

            // ── Absence alert levels (Ponto 3 — Alertas Inteligentes) ──
            let absenceColor = '#22c55e';
            let absenceEmoji = '';
            let absenceAlert = '';

            if (absencePercentage >= 100) {
              absenceColor = '#7f1d1d';
              absenceEmoji = '💀';
              absenceAlert = 'Reprovado por falta!';
            } else if (absencePercentage >= 80) {
              absenceColor = '#ef4444';
              absenceEmoji = '🚨';
              absenceAlert = `Perigo! Só pode faltar mais ${remainingAbsences}x`;
            } else if (absencePercentage >= 50) {
              absenceColor = '#f59e0b';
              absenceEmoji = '⚠️';
              absenceAlert = `Atenção! Restam ${remainingAbsences} faltas`;
            }

            const gradeInfo = calculateGrade(subject.id, subject);
            const passGrade = subject.passGrade || 7.0;

            return (
              <TouchableOpacity
                key={subject.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: absencePercentage >= 80 ? absenceColor : colors.border }]}
                onPress={() => onSubjectPress(subject.id)}
                activeOpacity={0.7}
              >
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: subject.color || colors.primary, marginRight: 8 }} />
                    <Text style={[styles.subjectName, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {subject.name}
                      {subject.isArchived && <Text style={{ fontSize: 13, color: colors.textSecondary }}> (Arquivada)</Text>}
                    </Text>
                  </View>
                  {!subject.isArchived && (
                    <TouchableOpacity
                      style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.background, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                      onPress={() => onArchiveSubject(subject.id)}
                    >
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Arquivar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Absence alert banner (Ponto 3) */}
                {absenceAlert !== '' && (
                  <View style={[styles.alertBanner, { backgroundColor: absenceColor + '18', borderColor: absenceColor }]}>
                    <Text style={{ fontSize: 16 }}>{absenceEmoji}</Text>
                    <Text style={{ color: absenceColor, fontWeight: 'bold', marginLeft: 8, fontSize: 13 }}>{absenceAlert}</Text>
                  </View>
                )}

                {/* Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Faltas</Text>
                    <Text style={[styles.statValue, { color: absenceColor }]}>
                      {absences} <Text style={{ fontSize: 14, color: colors.textSecondary }}>/ {maxAbsences}</Text>
                    </Text>
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                      <View style={[styles.progressFill, { width: `${Math.min(absencePercentage, 100)}%`, backgroundColor: absenceColor }]} />
                    </View>
                  </View>

                  <View style={[styles.statBox, { alignItems: 'flex-end' }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Média Atual</Text>
                    <Text style={[styles.statValue, { color: gradeInfo.hasGrades ? (gradeInfo.current >= passGrade ? '#22c55e' : '#ef4444') : colors.textSecondary }]}>
                      {gradeInfo.hasGrades ? gradeInfo.current.toFixed(1) : '-'}
                    </Text>
                    <Text style={[styles.statSubtitle, { color: colors.textSecondary }]}>Meta: {passGrade.toFixed(1)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 15,
  },
  subjectName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statSubtitle: {
    fontSize: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    width: '90%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  }
});
