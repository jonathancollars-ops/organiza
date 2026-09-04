import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Subject, AttendanceRecord, AppEvent, ThemeType, Semester } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { GradeSimulatorModal } from '../components/GradeSimulatorModal';
import { calculateFinalGrade } from '../components/GradeEngine';
import * as Haptics from 'expo-haptics';

interface Props {
  subjects: Subject[];
  events: AppEvent[];
  attendances: AttendanceRecord[];
  theme: ThemeType;
  semesters?: Semester[];
  activeSemesterId?: string;
  onSubjectPress: (subjectId: string) => void;
  onArchiveSubject: (subjectId: string) => void;
}

export const GradesScreen: React.FC<Props> = ({
  subjects,
  events,
  attendances,
  theme,
  semesters = [],
  activeSemesterId,
  onSubjectPress,
  onArchiveSubject
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [simulatorVisible, setSimulatorVisible] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string | undefined>(activeSemesterId);
  const [searchQuery, setSearchQuery] = useState('');

  const calculateGrade = (subject: Subject) => {
    const gradeGroups = subject.gradeGroups || [];
    const hasGrades = gradeGroups.some(g => g.items.some(i => i.grade !== undefined));
    if (!hasGrades || gradeGroups.length === 0) {
      return { current: 0, hasGrades: false, missingCount: 0 };
    }
    const result = calculateFinalGrade(gradeGroups, subject.passGrade || 7.0);
    return { current: result.score, hasGrades: true, missingCount: result.missingItemsCount };
  };

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      if (s.isArchived) return false;
      if (selectedSemester && s.semesterId && s.semesterId !== selectedSemester) return false;
      if (searchQuery.trim() && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [subjects, selectedSemester, searchQuery]);

  // Overall GPA / CR
  const overallMetrics = useMemo(() => {
    let totalWeightedScore = 0;
    let totalCredits = 0;
    let subjectsWithGrades = 0;

    filteredSubjects.forEach(s => {
      if (s.isArchived) return;
      const g = calculateGrade(s);
      if (g.hasGrades) {
        const credits = s.workloadHours || 4;
        totalWeightedScore += g.current * credits;
        totalCredits += credits;
        subjectsWithGrades++;
      }
    });

    const gpa = totalCredits > 0 ? totalWeightedScore / totalCredits : 0;
    return { gpa, subjectsWithGrades };
  }, [filteredSubjects]);

  const handleOpenSimulator = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSimulatorVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Minhas Notas</Text>
        <TouchableOpacity
          style={[styles.simulatorBtn, { backgroundColor: colors.primary }]}
          onPress={handleOpenSimulator}
          activeOpacity={0.8}
        >
          <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '700', fontSize: 13 }}>
            💡 Simulador
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

      {/* GPA Summary Card */}
      {overallMetrics.subjectsWithGrades > 0 && (
        <View style={[styles.gpaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.gpaLabel, { color: colors.textSecondary }]}>Média Geral (CR)</Text>
            <Text style={[styles.gpaSubtitle, { color: colors.textSecondary }]}>
              {overallMetrics.subjectsWithGrades} matéria(s) com notas
            </Text>
          </View>
          <View style={[
            styles.gpaScoreBadge,
            { backgroundColor: overallMetrics.gpa >= 7.0 ? colors.successLight : colors.warningLight }
          ]}>
            <Text style={[
              styles.gpaScoreText,
              { color: overallMetrics.gpa >= 7.0 ? (theme === 'light' ? colors.successDark : colors.success) : (theme === 'light' ? colors.warningDark : colors.warning) }
            ]}>
              {overallMetrics.gpa.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Search Bar */}
      {subjects.length > 3 && (
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar matéria..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {filteredSubjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Text style={styles.emptyIcon}>📚</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {searchQuery ? 'Nenhuma matéria encontrada' : 'Nenhuma matéria cadastrada'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {searchQuery ? 'Tente buscar por outro termo.' : 'Adicione matérias para acompanhar suas notas.'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {filteredSubjects.map(subject => {
            const gradeInfo = calculateGrade(subject);
            const passGrade = subject.passGrade || 7.0;

            const isPassed = gradeInfo.hasGrades && gradeInfo.current >= passGrade;
            const isCritical = gradeInfo.hasGrades && gradeInfo.current < passGrade;
            const subjectSemester = semesters.find(sem => sem.id === subject.semesterId);

            return (
              <TouchableOpacity
                key={subject.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => onSubjectPress(subject.id)}
                activeOpacity={0.7}
              >
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                    <View style={[styles.subjectDot, { backgroundColor: subject.color || colors.primary }]} />
                    <Text style={[styles.subjectName, { color: colors.text }]} numberOfLines={1}>
                      {subject.name}
                      {subject.isArchived && <Text style={{ fontSize: 11, color: colors.textSecondary }}> (Arquivada)</Text>}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {subjectSemester && (
                      <View style={[styles.semBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                        <Text style={[styles.semBadgeText, { color: colors.primary }]}>{subjectSemester.name}</Text>
                      </View>
                    )}
                    {!subject.isArchived && (
                      <TouchableOpacity
                        style={[styles.archiveBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                        onPress={() => onArchiveSubject(subject.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>Arquivar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Média Atual</Text>
                    <Text style={[
                      styles.statValue,
                      { color: gradeInfo.hasGrades ? (isPassed ? (theme === 'light' ? colors.successDark : colors.success) : (theme === 'light' ? colors.dangerDark : colors.danger)) : colors.textSecondary }
                    ]}>
                      {gradeInfo.hasGrades ? gradeInfo.current.toFixed(1) : '--'}
                    </Text>
                  </View>

                  <View style={[styles.statBox, { alignItems: 'center' }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Status</Text>
                    <View style={[
                      styles.statusBadge,
                      {
                        backgroundColor: !gradeInfo.hasGrades 
                          ? colors.surfaceSubtle 
                          : isPassed 
                            ? colors.successLight 
                            : colors.dangerLight
                      }
                    ]}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: !gradeInfo.hasGrades ? colors.textSecondary : isPassed ? (theme === 'light' ? colors.successDark : colors.success) : (theme === 'light' ? colors.dangerDark : colors.danger)
                      }}>
                        {!gradeInfo.hasGrades ? 'Cursando' : isPassed ? 'Aprovado' : 'Em Risco'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statBox, { alignItems: 'flex-end' }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Média Corte</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {passGrade.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <GradeSimulatorModal
        visible={simulatorVisible}
        onClose={() => setSimulatorVisible(false)}
        subjects={subjects}
        theme={theme}
      />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  simulatorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
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
  gpaCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2
  },
  gpaLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2
  },
  gpaSubtitle: {
    fontSize: 11,
  },
  gpaScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  gpaScoreText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  searchContainer: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0
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
  list: {
    flex: 1,
  },
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
    marginBottom: 10,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1
  },
  semBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  semBadgeText: {
    fontSize: 9.5,
    fontWeight: '700'
  },
  archiveBtn: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  }
});

