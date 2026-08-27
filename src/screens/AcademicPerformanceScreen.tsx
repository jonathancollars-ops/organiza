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
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { getThemeColors } from '../theme';
import { Subject, CourseProgressData, ThemeType } from '../types';
import { CourseCRService, DEFAULT_CURRICULUM_TEMPLATE } from '../services/CourseCRService';
import { SecuritySanitizer } from '../services/SecuritySanitizer';
import { AIParsingService } from '../services/AIParsingService';
import { StorageService } from '../services/storage';

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
  subjects = [],
  theme = 'dark',
}) => {
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);

  const [activeTab, setActiveTab] = useState<PerformanceTab>('cr_sim');
  const [courseData, setCourseData] = useState<CourseProgressData>(DEFAULT_CURRICULUM_TEMPLATE);
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState<number>(0);

  // Modals
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importMode, setImportMode] = useState<'transcript' | 'curriculum'>('transcript');
  const [importInputText, setImportInputText] = useState('');
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  
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
      if (data && Array.isArray(data.semesters) && data.semesters.length > 0) {
        setCourseData(data);
        if (data.targetCR) {
          setTargetInput(data.targetCR.toString());
        }
      } else {
        setCourseData(DEFAULT_CURRICULUM_TEMPLATE);
      }
    } catch (e) {
      console.warn('Erro ao carregar dados de desempenho:', e);
      setCourseData(DEFAULT_CURRICULUM_TEMPLATE);
    }
  };

  // Calculations with complete defensive fallbacks
  const historicalCR = useMemo(() => {
    try {
      return CourseCRService.calculateHistoricalCR(courseData);
    } catch {
      return courseData?.baselineCR || 8.0;
    }
  }, [courseData]);

  const degreeProgress = useMemo(() => {
    try {
      return CourseCRService.calculateDegreeProgress(courseData);
    } catch {
      return {
        completedCredits: 0,
        totalRequiredCredits: 200,
        completionPercentage: 0,
        completedSubjectsCount: 0,
        totalSubjectsCount: 0
      };
    }
  }, [courseData]);

  const crSimulations = useMemo(() => {
    try {
      return CourseCRService.simulateCRScenarios(courseData, subjects || []);
    } catch {
      return {
        currentCR: historicalCR,
        scenarios: []
      };
    }
  }, [courseData, subjects, historicalCR]);

  // Current Semester Data
  const currentSemester = useMemo(() => {
    const sems = courseData?.semesters;
    if (!sems || !Array.isArray(sems) || sems.length === 0) return null;
    const safeIndex = Math.min(Math.max(selectedSemesterIndex, 0), sems.length - 1);
    return sems[safeIndex] || null;
  }, [courseData, selectedSemesterIndex]);

  // Handlers
  const handleToggleSubject = async (subjectId: string) => {
    try {
      Haptics.selectionAsync();
      const updated = CourseCRService.toggleSubjectCompletion(courseData, subjectId);
      setCourseData(updated);
      await CourseCRService.saveCourseProgress(updated);
    } catch (e) {
      console.warn('Erro ao alternar status da matéria:', e);
    }
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

  const handleDocumentUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const aiConfig = await StorageService.getAIConfig();
      if (!aiConfig || !aiConfig.apiKey || aiConfig.apiKey.trim() === '') {
        Alert.alert(
          'Lumen AI Requerido', 
          'A extração inteligente de PDFs e imagens exige que a API do Gemini esteja configurada na aba Lumen AI.'
        );
        return;
      }

      setIsProcessingDocument(true);
      const fileUri = result.assets[0].uri;
      const mimeType = result.assets[0].mimeType || 'application/pdf';

      const base64Data = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64' as any
      });

      const parsedJSON = await AIParsingService.parseAcademicDocument(base64Data, mimeType, importMode, aiConfig);

      let updated: CourseProgressData;
      if (importMode === 'transcript') {
        updated = CourseCRService.applyAIParsedTranscript(parsedJSON, courseData);
        Alert.alert('Histórico Processado pela IA!', 'Seu CR e matérias aprovadas foram extraídos e atualizados com sucesso.');
      } else {
        updated = CourseCRService.applyAIParsedCurriculum(parsedJSON, courseData);
        Alert.alert('Fluxograma Estruturado!', 'A Inteligência Artificial mapeou todos os semestres e matérias da matriz.');
      }

      setCourseData(updated);
      await CourseCRService.saveCourseProgress(updated);
      setIsImportModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error: any) {
      console.warn('Erro ao processar documento com IA:', error);
      Alert.alert('Falha na Leitura', error.message || 'Não foi possível extrair os dados do arquivo via IA. Verifique se o arquivo está legível.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessingDocument(false);
    }
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

  const safeSemesters = Array.isArray(courseData?.semesters) ? courseData.semesters : [];
  const safeSubjects = Array.isArray(subjects) ? subjects : [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header Actions - Asymmetric Dual-Zone layout clear of notch/camera */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
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
            🎓 Fluxograma & {(degreeProgress?.completionPercentage ?? 0).toFixed(0)}% Curso
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
                    {(courseData?.targetCR || 8.5).toFixed(2)}
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
                {safeSubjects.length} Matérias em Andamento
              </Text>
            </View>

            {(crSimulations.scenarios || []).map((scen, idx) => (
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

            {safeSubjects.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>
                  Nenhuma disciplina cadastrada no semestre atual. Cadastre matérias na aba Notas ou Agenda para ver o cálculo da prova final.
                </Text>
              </View>
            ) : (
              safeSubjects.map(sub => {
                let avg = sub.passGrade || 7.0;
                if (sub.gradeGroups && sub.gradeGroups.length > 0) {
                  let totalWeight = 0;
                  let weightedSum = 0;
                  sub.gradeGroups.forEach(g => {
                    if (g && g.items && g.items.length > 0) {
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
                  {(degreeProgress?.completionPercentage ?? 0).toFixed(1)}%
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, Math.max(0, degreeProgress.completionPercentage))}%`, backgroundColor: colors.primary }
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
                {safeSemesters.map((sem, idx) => {
                  const completedInSem = (sem.subjects || []).filter(s => s.isCompleted).length;
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
                          {completedInSem}/{(sem.subjects || []).length}
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

                {(!currentSemester.subjects || currentSemester.subjects.length === 0) ? (
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
            <View style={styles.modalTabSwitch}>
              <TouchableOpacity
                style={[styles.modalTabBtn, importMode === 'transcript' && styles.modalTabBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setImportMode('transcript');
                }}
              >
                <Text style={[styles.modalTabBtnText, importMode === 'transcript' && styles.modalTabBtnTextActive]}>
                  📄 Histórico / CR
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTabBtn, importMode === 'curriculum' && styles.modalTabBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setImportMode('curriculum');
                }}
              >
                <Text style={[styles.modalTabBtnText, importMode === 'curriculum' && styles.modalTabBtnTextActive]}>
                  🗺️ Grade / Fluxograma
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.importTextInput}
              placeholder={
                importMode === 'transcript'
                  ? 'Ex: Cole o texto do histórico escolar contendo o CR e as disciplinas concluídas...'
                  : 'Ex: Cole a lista de disciplinas por semestre (1º Semestre, 2º Semestre)...'
              }
              placeholderTextColor={colors.textSecondary}
              multiline
              value={importInputText}
              onChangeText={setImportInputText}
              editable={!isProcessingDocument}
            />

            <View style={{ marginVertical: 12 }}>
              <TouchableOpacity
                style={[styles.modalActionSubmit, { backgroundColor: '#8B5CF6', paddingVertical: 14 }]}
                onPress={handleDocumentUpload}
                disabled={isProcessingDocument}
              >
                {isProcessingDocument ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalActionSubmitText}>📄 Analisar PDF / Imagem com Lumen AI</Text>
                )}
              </TouchableOpacity>
              <Text style={{ textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
                A IA do Gemini vai ler seu documento e organizar a grade automaticamente.
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalActionSecondary}
                onPress={handleResetToTemplate}
                disabled={isProcessingDocument}
              >
                <Text style={styles.modalActionSecondaryText}>Restaurar Grade Padrão</Text>
              </TouchableOpacity>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalActionCancel}
                  onPress={() => setIsImportModalVisible(false)}
                  disabled={isProcessingDocument}
                >
                  <Text style={styles.modalActionCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionSubmit}
                  onPress={handleExecuteImport}
                  disabled={isProcessingDocument}
                >
                  <Text style={styles.modalActionSubmitText}>Processar Texto</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================================
          MODAL: DEFINIR META DE CR
          ========================================================================= */}
      <Modal
        visible={isTargetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTargetModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCardSmall}>
            <Text style={styles.modalTitle}>🎯 Definir Meta de CR</Text>
            <Text style={styles.modalSubtitle}>
              Insira o Coeficiente de Rendimento desejado para sua graduação:
            </Text>

            <TextInput
              style={styles.singleInput}
              placeholder="Ex: 8.5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={targetInput}
              onChangeText={setTargetInput}
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
        </KeyboardAvoidingView>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCardSmall}>
            <Text style={styles.modalTitle}>+ Adicionar Disciplina</Text>
            <Text style={styles.modalSubtitle}>
              Adicionar ao {currentSemester?.title || 'Semestre Atual'}:
            </Text>

            <TextInput
              style={[styles.singleInput, { marginBottom: 10 }]}
              placeholder="Nome da matéria (ex: Cálculo Numérico)"
              placeholderTextColor={colors.textSecondary}
              value={newSubjectName}
              onChangeText={setNewSubjectName}
            />

            <TextInput
              style={styles.singleInput}
              placeholder="Créditos (ex: 4)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={newSubjectCredits}
              onChangeText={setNewSubjectCredits}
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
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof getThemeColors>, theme: ThemeType) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 6,
    },
    headerBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surfaceHighlight,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    headerBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    headerBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    headerBtnPrimaryText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#000',
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      gap: 8,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: colors.surfaceHighlight,
    },
    tabButtonActive: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    tabButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabButtonTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    scrollContent: {
      flex: 1,
    },
    scrollContentContainer: {
      padding: 16,
      paddingBottom: 90,
    },
    tabSection: {
      gap: 16,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroMetric: {
      flex: 1,
      alignItems: 'center',
    },
    heroDivider: {
      width: 1,
      height: 48,
      backgroundColor: colors.borderSubtle,
      marginHorizontal: 12,
    },
    heroLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    heroValue: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.text,
    },
    heroSubtext: {
      fontSize: 10,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    heroEditBtn: {
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.primaryLight,
    },
    heroEditText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    sectionBadge: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    scenarioCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderLeftWidth: 4,
    },
    scenarioHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    scenarioTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
      flex: 1,
    },
    scenarioCRBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginLeft: 8,
    },
    scenarioCRValue: {
      fontSize: 13,
      fontWeight: '900',
    },
    scenarioDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
      marginBottom: 6,
    },
    scenarioFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    scenarioDiff: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      alignItems: 'center',
    },
    emptyCardText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    examCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginBottom: 10,
    },
    examRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    examSubjectName: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    examSubjectAvg: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    examBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginLeft: 8,
    },
    examBadgeText: {
      fontSize: 11,
      fontWeight: '800',
    },
    examMessage: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15,
    },
    progressHeroCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
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
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    progressHeroPercent: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.primary,
    },
    progressBarTrack: {
      height: 8,
      backgroundColor: colors.surfaceHighlight,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 10,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    progressFooterText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    semesterNav: {
      marginTop: 8,
    },
    semesterNavTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    semesterPillsScroll: {
      gap: 8,
      paddingBottom: 4,
    },
    semesterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      gap: 6,
    },
    semesterPillActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    semesterPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
    },
    semesterPillTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    semesterPillBadge: {
      backgroundColor: colors.surfaceHighlight,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
    },
    semesterPillBadgeActive: {
      backgroundColor: colors.primary + '30',
    },
    semesterPillBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
    },
    semesterPillBadgeTextActive: {
      color: colors.primary,
    },
    semesterContentCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginTop: 8,
    },
    semesterCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    semesterCardTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    addSubjectBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: colors.primaryLight,
    },
    addSubjectBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    emptySemesterText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    subjectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    subjectItemCompleted: {
      opacity: 0.8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      fontSize: 11,
      fontWeight: '900',
      color: '#000',
    },
    subjectItemInfo: {
      flex: 1,
      marginRight: 8,
    },
    subjectItemName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    subjectItemNameCompleted: {
      color: colors.textMuted,
      textDecorationLine: 'line-through',
    },
    subjectItemMeta: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusBadgeDone: {
      backgroundColor: colors.primaryLight,
    },
    statusBadgePending: {
      backgroundColor: colors.surfaceHighlight,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    statusBadgeTextDone: {
      color: colors.primary,
    },
    statusBadgeTextPending: {
      color: colors.textMuted,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    modalCardSmall: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 15,
    },
    modalTabSwitch: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 3,
      marginBottom: 12,
      gap: 4,
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
