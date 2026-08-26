import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '../theme';
import { Subject, CourseProgressData, ThemeType } from '../types';
import { CourseCRService, DEFAULT_CURRICULUM_TEMPLATE } from '../services/CourseCRService';
import { SecuritySanitizer } from '../services/SecuritySanitizer';

interface AcademicPerformanceScreenProps {
  subjects: Subject[];
  theme?: ThemeType;
}

type PerformanceTab = 'cr_sim' | 'curriculum';

/**
 * AcademicPerformanceScreen - Lumen Academic Performance & Degree Flowchart
 * 100% Offline CR Tracker, What-If Simulation Engine & Degree Matrix.
 */
export const AcademicPerformanceScreen: React.FC<AcademicPerformanceScreenProps> = ({
  subjects,
  theme = 'dark',
}) => {
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);

  const [activeTab, setActiveTab] = useState<PerformanceTab>('cr_sim');
  const [courseData, setCourseData] = useState<CourseProgressData>(DEFAULT_CURRICULUM_TEMPLATE);
  const [selectedSemesterNumber, setSelectedSemesterNumber] = useState<number>(1);

  // Modals
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importMode, setImportMode] = useState<'transcript' | 'curriculum'>('transcript');
  const [importInputText, setImportInputText] = useState('');
  
  const [isTargetModalVisible, setIsTargetModalVisible] = useState(false);
  const [targetInput, setTargetInput] = useState('8.5');

  const [isAddSubjectModalVisible, setIsAddSubjectModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCredits, setNewSubjectCredits] = useState('4');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await CourseCRService.loadCourseProgress();
      setCourseData(data);
      if (data.targetCR) {
        setTargetInput(data.targetCR.toString());
      }
    } catch (e) {
      console.warn('Erro ao carregar dados de desempenho:', e);
    }
  };

  // Calculations
  const historicalCR = useMemo(() => {
    return CourseCRService.calculateHistoricalCR(courseData);
  }, [courseData]);

  const degreeProgress = useMemo(() => {
    return CourseCRService.calculateDegreeProgress(courseData);
  }, [courseData]);

  const crSimulations = useMemo(() => {
    return CourseCRService.simulateCRScenarios(courseData, subjects);
  }, [courseData, subjects]);

  // Current Semester Data
  const currentSemester = useMemo(() => {
    if (!courseData.semesters || courseData.semesters.length === 0) return null;
    const safeIndex = Math.min(Math.max(selectedSemesterIndex, 0), courseData.semesters.length - 1);
    return courseData.semesters[safeIndex];
  }, [courseData, selectedSemesterIndex]);

  // Handlers
  const handleToggleSubject = async (subjectId: string) => {
    Haptics.selectionAsync();
    const updated = CourseCRService.toggleSubjectCompletion(courseData, subjectId);
    setCourseData(updated);
    await CourseCRService.saveCourseProgress(updated);
  };

  const handleSaveTargetCR = async () => {
    const parsed = parseFloat(targetInput.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0 || parsed > 10) {
      Alert.alert('Valor Inválido', 'Insira uma meta de CR entre 0.0 e 10.0');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = { ...courseData, targetCR: parsed };
    setCourseData(updated);
    await CourseCRService.saveCourseProgress(updated);
    setIsTargetModalVisible(false);
  };

  const handleExecuteImport = async () => {
    const raw = importInputText.trim();
    if (!raw) {
      Alert.alert('Texto Vazio', 'Cole o texto ou conteúdo do arquivo para processar.');
      return;
    }

    const sanitized = SecuritySanitizer.sanitizeText(raw);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let updated: CourseProgressData;
    if (importMode === 'transcript') {
      updated = CourseCRService.parseHistoryText(sanitized, courseData);
      Alert.alert('Histórico Importado!', 'As matérias concluídas e o CR acumulado foram atualizados.');
    } else {
      updated = CourseCRService.parseCurriculumMatrixText(sanitized, courseData);
      Alert.alert('Fluxograma Atualizado!', 'A grade por semestres e o percentual do curso foram reestruturados.');
    }

    setCourseData(updated);
    await CourseCRService.saveCourseProgress(updated);
    setImportInputText('');
    setIsImportModalVisible(false);
  };

  const handleAddSubject = async () => {
    const name = newSubjectName.trim();
    const credits = parseInt(newSubjectCredits, 10);
    if (!name || isNaN(credits) || credits <= 0) {
      Alert.alert('Campos Inválidos', 'Preencha o nome e a quantidade de créditos da matéria.');
      return;
    }

    const semNumber = currentSemester?.semesterNumber || 1;
    const updated = CourseCRService.addSubjectToSemester(courseData, semNumber, {
      name,
      credits,
      isCompleted: false
    });

    setCourseData(updated);
    await CourseCRService.saveCourseProgress(updated);
    setNewSubjectName('');
    setNewSubjectCredits('4');
    setIsAddSubjectModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleResetToTemplate = () => {
    Alert.alert(
      'Restaurar Padrão',
      'Deseja redefinir a grade para o modelo padrão da graduação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            setCourseData(DEFAULT_CURRICULUM_TEMPLATE);
            await CourseCRService.saveCourseProgress(DEFAULT_CURRICULUM_TEMPLATE);
            setIsImportModalVisible(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Actions */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🎯 Desempenho & Curso</Text>
          <Text style={styles.headerSubtitle}>
            CR Acumulado • Integralização • Prova Final
          </Text>
        </View>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setIsTargetModalVisible(true)}
            accessibilityLabel="Definir Meta de CR"
          >
            <Text style={styles.headerBtnText}>🎯 Meta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerBtn, styles.headerBtnPrimary]}
            onPress={() => setIsImportModalVisible(true)}
            accessibilityLabel="Importar Histórico ou Fluxograma"
          >
            <Text style={styles.headerBtnPrimaryText}>📥 Importar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'cr_sim' && styles.tabButtonActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('cr_sim');
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'cr_sim' && styles.tabButtonTextActive]}>
            📈 Meu CR & Simulador
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'curriculum' && styles.tabButtonActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('curriculum');
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'curriculum' && styles.tabButtonTextActive]}>
            🎓 Fluxograma & {degreeProgress.completionPercentage.toFixed(0)}% Curso
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'cr_sim' ? (
          /* =========================================================================
             TAB 1: MEU CR & SIMULADOR DE CENÁRIOS WHAT-IF
             ========================================================================= */
          <View style={styles.tabSection}>
            {/* Hero CR Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroLabel}>CR OFICIAL ACUMULADO</Text>
                  <Text style={styles.heroValue}>{historicalCR.toFixed(2)}</Text>
                  <Text style={styles.heroSubtext}>
                    Baseado em {degreeProgress.completedCredits} créditos concluídos
                  </Text>
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroMetric}>
                  <Text style={styles.heroLabel}>META DESEJADA</Text>
                  <Text style={[styles.heroValue, { color: colors.primary }]}>
                    {(courseData.targetCR || 8.5).toFixed(2)}
                  </Text>
                  <TouchableOpacity
                    style={styles.heroEditBtn}
                    onPress={() => setIsTargetModalVisible(true)}
                  >
                    <Text style={styles.heroEditText}>Alterar Meta</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* What-If Scenarios Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>🔮 Simulação de Cenários (What-If)</Text>
              <Text style={styles.sectionBadge}>
                {subjects.length} Matérias em Andamento
              </Text>
            </View>

            {crSimulations.scenarios.map((scen, idx) => (
              <View key={idx} style={[styles.scenarioCard, { borderLeftColor: scen.badgeColor }]}>
                <View style={styles.scenarioHeader}>
                  <Text style={styles.scenarioTitle}>{scen.title}</Text>
                  <View style={[styles.scenarioCRBadge, { backgroundColor: scen.badgeColor + '20' }]}>
                    <Text style={[styles.scenarioCRValue, { color: scen.badgeColor }]}>
                      CR {scen.projectedCR.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.scenarioDesc}>{scen.description}</Text>

                <View style={styles.scenarioFooter}>
                  <Text style={styles.scenarioDiff}>
                    Impacto: {scen.difference >= 0 ? `+${scen.difference.toFixed(2)}` : scen.difference.toFixed(2)} pts
                  </Text>
                </View>
              </View>
            ))}

            {/* Final Exam Calculator Section */}
            <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>📝 Calculadora de Prova Final</Text>
            </View>

            {subjects.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>
                  Nenhuma disciplina cadastrada no semestre atual. Cadastre matérias na aba Notas ou Agenda para ver o cálculo da prova final.
                </Text>
              </View>
            ) : (
              subjects.map(sub => {
                // Calculate average
                let avg = sub.passGrade || 7.0;
                if (sub.gradeGroups && sub.gradeGroups.length > 0) {
                  let totalWeight = 0;
                  let weightedSum = 0;
                  sub.gradeGroups.forEach(g => {
                    if (g.items && g.items.length > 0) {
                      const itemSum = g.items.reduce((acc, it) => acc + (it.grade || 0), 0);
                      const groupScore = (itemSum / g.items.length) * (g.weight / 100);
                      weightedSum += groupScore;
                      totalWeight += g.weight;
                    }
                  });
                  avg = totalWeight > 0 ? (weightedSum / (totalWeight / 100)) : (sub.passGrade || 7.0);
                }

                const finalCalc = CourseCRService.calculateFinalExamRequirement(avg, sub.passGrade || 7.0);

                return (
                  <View key={sub.id} style={styles.examCard}>
                    <View style={styles.examRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.examSubjectName}>{sub.name}</Text>
                        <Text style={styles.examSubjectAvg}>
                          Média Atual: <Text style={{ fontWeight: '700', color: colors.text }}>{avg.toFixed(1)}</Text> (Corte: {(sub.passGrade || 7.0).toFixed(1)})
                        </Text>
                      </View>
                      
                      <View style={[styles.examBadge, { backgroundColor: finalCalc.badgeColor + '25' }]}>
                        <Text style={[styles.examBadgeText, { color: finalCalc.badgeColor }]}>
                          {finalCalc.status === 'approved' ? 'Aprovado' : `Final: ${finalCalc.neededGrade.toFixed(1)}`}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.examMessage}>{finalCalc.message}</Text>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* =========================================================================
             TAB 2: FLUXOGRAMA & % DE CONCLUSÃO DO CURSO
             ========================================================================= */
          <View style={styles.tabSection}>
            {/* Progress Hero Bar */}
            <View style={styles.progressHeroCard}>
              <View style={styles.progressHeroHeader}>
                <View>
                  <Text style={styles.progressHeroTitle}>Integralização do Curso</Text>
                  <Text style={styles.progressHeroSubtitle}>
                    {degreeProgress.completedCredits} de {degreeProgress.totalRequiredCredits} Créditos Totais
                  </Text>
                </View>
                <Text style={styles.progressHeroPercent}>
                  {degreeProgress.completionPercentage.toFixed(1)}%
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${degreeProgress.completionPercentage}%`, backgroundColor: colors.primary }
                  ]}
                />
              </View>

              <View style={styles.progressFooter}>
                <Text style={styles.progressFooterText}>
                  ✅ {degreeProgress.completedSubjectsCount} de {degreeProgress.totalSubjectsCount} disciplinas concluídas
                </Text>
              </View>
            </View>

            {/* Semester Selector Carousel (Pills) */}
            <View style={styles.semesterNav}>
              <Text style={styles.semesterNavTitle}>Selecione o Semestre:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.semesterPillsScroll}
              >
                {courseData.semesters.map((sem, idx) => {
                  const completedInSem = sem.subjects.filter(s => s.isCompleted).length;
                  const isSelected = idx === selectedSemesterIndex;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.semesterPill, isSelected && styles.semesterPillActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedSemesterIndex(idx);
                      }}
                    >
                      <Text style={[styles.semesterPillText, isSelected && styles.semesterPillTextActive]}>
                        {sem.semesterNumber}º Sem
                      </Text>
                      <View style={[styles.semesterPillBadge, isSelected && styles.semesterPillBadgeActive]}>
                        <Text style={[styles.semesterPillBadgeText, isSelected && styles.semesterPillBadgeTextActive]}>
                          {completedInSem}/{sem.subjects.length}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Subjects List for Current Semester */}
            {currentSemester && (
              <View style={styles.semesterContentCard}>
                <View style={styles.semesterCardHeader}>
                  <Text style={styles.semesterCardTitle}>{currentSemester.title}</Text>
                  <TouchableOpacity
                    style={styles.addSubjectBtn}
                    onPress={() => setIsAddSubjectModalVisible(true)}
                  >
                    <Text style={styles.addSubjectBtnText}>+ Matéria</Text>
                  </TouchableOpacity>
                </View>

                {currentSemester.subjects.length === 0 ? (
                  <Text style={styles.emptySemesterText}>
                    Nenhuma matéria neste semestre. Clique em "+ Matéria" ou importe o fluxograma.
                  </Text>
                ) : (
                  currentSemester.subjects.map(sub => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[styles.subjectItem, sub.isCompleted && styles.subjectItemCompleted]}
                      onPress={() => handleToggleSubject(sub.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, sub.isCompleted && styles.checkboxChecked]}>
                        {sub.isCompleted && <Text style={styles.checkmark}>✓</Text>}
                      </View>

                      <View style={styles.subjectItemInfo}>
                        <Text style={[styles.subjectItemName, sub.isCompleted && styles.subjectItemNameCompleted]}>
                          {sub.name}
                        </Text>
                        <Text style={styles.subjectItemMeta}>
                          {sub.credits} créditos • {sub.hours || sub.credits * 15}h {sub.code ? `• ${sub.code}` : ''}
                        </Text>
                      </View>

                      <View style={[styles.statusBadge, sub.isCompleted ? styles.statusBadgeDone : styles.statusBadgePending]}>
                        <Text style={[styles.statusBadgeText, sub.isCompleted ? styles.statusBadgeTextDone : styles.statusBadgeTextPending]}>
                          {sub.isCompleted ? 'Concluída' : 'Pendente'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* =========================================================================
          MODAL: IMPORTAR HISTÓRICO OU FLUXOGRAMA
          ========================================================================= */}
      <Modal
        visible={isImportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsImportModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📥 Importador Acadêmico</Text>
            <Text style={styles.modalSubtitle}>
              Cole o texto do seu portal (SIGAA, Sophia, TOTVS) ou fluxograma de matérias
            </Text>

            {/* Mode Switcher */}
            <View style={styles.modalTabContainer}>
              <TouchableOpacity
                style={[styles.modalTabBtn, importMode === 'transcript' && styles.modalTabBtnActive]}
                onPress={() => setImportMode('transcript')}
              >
                <Text style={[styles.modalTabBtnText, importMode === 'transcript' && styles.modalTabBtnTextActive]}>
                  📑 Histórico & CR
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTabBtn, importMode === 'curriculum' && styles.modalTabBtnActive]}
                onPress={() => setImportMode('curriculum')}
              >
                <Text style={[styles.modalTabBtnText, importMode === 'curriculum' && styles.modalTabBtnTextActive]}>
                  🎓 Fluxograma Matriz
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.importTextInput}
              multiline
              placeholder={
                importMode === 'transcript'
                  ? `Exemplo:\nCálculo I - 80h - Aprovado - Nota 8.5\nFísica Geral I - 60h - Aprovado\nCR Acumulado: 8.42`
                  : `Exemplo:\n1º Semestre\nCálculo I 5 cr\nFísica I 4 cr\n\n2º Semestre\nCálculo II 5 cr\nEstrutura de Dados 4 cr`
              }
              placeholderTextColor={colors.textMuted}
              value={importInputText}
              onChangeText={setImportInputText}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalActionSecondary}
                onPress={handleResetToTemplate}
              >
                <Text style={styles.modalActionSecondaryText}>Restaurar Padrão</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.modalActionCancel}
                  onPress={() => setIsImportModalVisible(false)}
                >
                  <Text style={styles.modalActionCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionSubmit}
                  onPress={handleExecuteImport}
                >
                  <Text style={styles.modalActionSubmitText}>Processar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================================
          MODAL: META DE CR
          ========================================================================= */}
      <Modal
        visible={isTargetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTargetModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <Text style={styles.modalTitle}>🎯 Definir Meta de CR</Text>
            <Text style={styles.modalSubtitle}>
              Insira o Coeficiente de Rendimento desejado (0.0 a 10.0) para suas simulações de bolsa e formatura
            </Text>

            <TextInput
              style={styles.singleInput}
              keyboardType="numeric"
              placeholder="Ex: 8.5"
              placeholderTextColor={colors.textMuted}
              value={targetInput}
              onChangeText={setTargetInput}
              maxLength={4}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalActionCancel}
                onPress={() => setIsTargetModalVisible(false)}
              >
                <Text style={styles.modalActionCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionSubmit}
                onPress={handleSaveTargetCR}
              >
                <Text style={styles.modalActionSubmitText}>Salvar Meta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL: ADICIONAR MATÉRIA AO SEMESTRE
          ========================================================================= */}
      <Modal
        visible={isAddSubjectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddSubjectModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 380 }]}>
            <Text style={styles.modalTitle}>+ Adicionar Disciplina</Text>
            <Text style={styles.modalSubtitle}>
              Adicione à grade do {currentSemester?.title || 'Semestre'}
            </Text>

            <TextInput
              style={styles.singleInput}
              placeholder="Nome da Matéria (Ex: Cálculo Numérico)"
              placeholderTextColor={colors.textMuted}
              value={newSubjectName}
              onChangeText={setNewSubjectName}
            />

            <TextInput
              style={[styles.singleInput, { marginTop: 10 }]}
              keyboardType="numeric"
              placeholder="Créditos (Ex: 4)"
              placeholderTextColor={colors.textMuted}
              value={newSubjectCredits}
              onChangeText={setNewSubjectCredits}
              maxLength={2}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalActionCancel}
                onPress={() => setIsAddSubjectModalVisible(false)}
              >
                <Text style={styles.modalActionCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionSubmit}
                onPress={handleAddSubject}
              >
                <Text style={styles.modalActionSubmitText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors: any, theme: ThemeType) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    headerBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surfaceHighlight,
    },
    headerBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    headerBtnPrimary: {
      backgroundColor: colors.primary,
    },
    headerBtnPrimaryText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#000',
    },
    tabContainer: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginVertical: 10,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 8,
    },
    tabButtonActive: {
      backgroundColor: colors.surfaceHighlight,
    },
    tabButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabButtonTextActive: {
      color: colors.text,
      fontWeight: '700',
    },
    scrollContent: {
      flex: 1,
    },
    scrollContentContainer: {
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
    tabSection: {
      paddingTop: 6,
    },
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroMetric: {
      flex: 1,
      alignItems: 'center',
    },
    heroDivider: {
      width: 1,
      height: 48,
      backgroundColor: colors.borderSubtle,
    },
    heroLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    heroValue: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.text,
    },
    heroSubtext: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      textAlign: 'center',
    },
    heroEditBtn: {
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: colors.surfaceHighlight,
      borderRadius: 6,
    },
    heroEditText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    sectionBadge: {
      fontSize: 11,
      color: colors.textMuted,
    },
    scenarioCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderLeftWidth: 4,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    scenarioHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    scenarioTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    scenarioCRBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    scenarioCRValue: {
      fontSize: 13,
      fontWeight: '800',
    },
    scenarioDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginBottom: 8,
    },
    scenarioFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    scenarioDiff: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    examCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    examRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    examSubjectName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    examSubjectAvg: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    examBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    examBadgeText: {
      fontSize: 12,
      fontWeight: '800',
    },
    examMessage: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    emptyCardText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
    progressHeroCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    progressHeroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    progressHeroTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    progressHeroSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    progressHeroPercent: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.primary,
    },
    progressBarTrack: {
      height: 10,
      backgroundColor: colors.surfaceHighlight,
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 10,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 5,
    },
    progressFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    progressFooterText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    semesterNav: {
      marginBottom: 12,
    },
    semesterNavTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    semesterPillsScroll: {
      gap: 8,
    },
    semesterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      gap: 6,
    },
    semesterPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    semesterPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    semesterPillTextActive: {
      color: '#000',
    },
    semesterPillBadge: {
      backgroundColor: colors.surfaceHighlight,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    semesterPillBadgeActive: {
      backgroundColor: 'rgba(0,0,0,0.15)',
    },
    semesterPillBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
    },
    semesterPillBadgeTextActive: {
      color: '#000',
    },
    semesterContentCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    semesterCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    semesterCardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    addSubjectBtn: {
      backgroundColor: colors.surfaceHighlight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    addSubjectBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    emptySemesterText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 20,
    },
    subjectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    subjectItemCompleted: {
      opacity: 0.85,
      backgroundColor: colors.surfaceHighlight,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.borderHighlight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      fontSize: 12,
      fontWeight: '900',
      color: '#000',
    },
    subjectItemInfo: {
      flex: 1,
    },
    subjectItemName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    subjectItemNameCompleted: {
      textDecorationLine: 'line-through',
      color: colors.textMuted,
    },
    subjectItemMeta: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusBadgeDone: {
      backgroundColor: '#10B98125',
    },
    statusBadgePending: {
      backgroundColor: colors.surfaceHighlight,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    statusBadgeTextDone: {
      color: '#10B981',
    },
    statusBadgeTextPending: {
      color: colors.textMuted,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 480,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
      marginBottom: 12,
      lineHeight: 16,
    },
    modalTabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 2,
      marginBottom: 12,
    },
    modalTabBtn: {
      flex: 1,
      paddingVertical: 6,
      alignItems: 'center',
      borderRadius: 6,
    },
    modalTabBtnActive: {
      backgroundColor: colors.surfaceHighlight,
    },
    modalTabBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    modalTabBtnTextActive: {
      color: colors.text,
      fontWeight: '700',
    },
    importTextInput: {
      height: 160,
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      color: colors.text,
      fontSize: 12,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginBottom: 16,
    },
    singleInput: {
      height: 44,
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      color: colors.text,
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginBottom: 16,
    },
    modalActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    modalActionCancel: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    modalActionCancelText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    modalActionSubmit: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    modalActionSubmitText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#000',
    },
    modalActionSecondary: {
      paddingVertical: 8,
    },
    modalActionSecondaryText: {
      fontSize: 12,
      color: colors.danger || '#EF4444',
      fontWeight: '600',
    },
  });
