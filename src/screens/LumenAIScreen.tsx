import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import {
  Subject,
  ThemeType,
  CourseProgressData,
  CourseSemester,
  CourseHistorySubject,
  TutorMode,
  TutorMessage,
  LocalModelTier,
  AIConfig,
  CRSimulationScenario
} from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { CourseCRService } from '../services/CourseCRService';
import { LocalAIModelService, AVAILABLE_MODEL_TIERS } from '../services/LocalAIModelService';
import { AIParsingService } from '../services/AIParsingService';
import { generateId, getLocalDateString } from '../utils';
import * as Haptics from 'expo-haptics';

interface Props {
  subjects: Subject[];
  theme: ThemeType;
  aiConfig: AIConfig;
  onOpenAISettings?: () => void;
}

export const LumenAIScreen: React.FC<Props> = ({
  subjects,
  theme,
  aiConfig,
  onOpenAISettings
}) => {
  const colors = getThemeColors(theme);
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);

  // Main Sub Tabs: 'tutor' | 'cr' | 'matriz'
  const [activeTab, setActiveTab] = useState<'tutor' | 'cr' | 'matriz'>('tutor');

  // ─────────────────────────────────────────────────────────
  // Sub-aba 1: Tutor IA State
  // ─────────────────────────────────────────────────────────
  const [tutorMode, setTutorMode] = useState<TutorMode>('socratic');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(subjects.length > 0 ? subjects[0].id : null);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<TutorMessage[]>([
    {
      id: 'welcome_msg',
      role: 'assistant',
      content: 'Olá! Sou seu professor tutor do Lumen. Qual dúvida ou exercício de aula gostaria de analisar hoje?',
      timestamp: getLocalDateString(),
      suggestedSteps: [
        'Como resolver limites indeterminados do tipo 0/0?',
        'Explique a Lei de Faraday e indução eletromagnética',
        'Qual a diferença entre complexidade O(n) e O(n log n)?'
      ]
    }
  ]);

  // ─────────────────────────────────────────────────────────
  // Sub-aba 2 & 3: Course Progress & CR State
  // ─────────────────────────────────────────────────────────
  const [courseData, setCourseData] = useState<CourseProgressData | null>(null);
  const [selectedSemesterNum, setSelectedSemesterNum] = useState<number>(1);
  const [targetCRInput, setTargetCRInput] = useState('8.5');
  const [historyTextInput, setHistoryTextInput] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeTier, setActiveTier] = useState<LocalModelTier>('medium');

  const chatScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadCourseData();
    loadModelTier();
  }, []);

  const loadCourseData = async () => {
    const data = await CourseCRService.loadCourseProgress();
    setCourseData(data);
    if (data.targetCR) {
      setTargetCRInput(data.targetCR.toString());
    }
  };

  const loadModelTier = async () => {
    const tier = await LocalAIModelService.getActiveTier();
    setActiveTier(tier);
  };

  const currentSubject = useMemo(() => {
    return subjects.find(s => s.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  // Dynamic CR Calculations
  const crSimulation = useMemo(() => {
    if (!courseData) return null;
    return CourseCRService.simulateCRScenarios(courseData, subjects);
  }, [courseData, subjects]);

  const degreeProgress = useMemo(() => {
    if (!courseData) return null;
    return CourseCRService.calculateDegreeProgress(courseData);
  }, [courseData]);

  // ─────────────────────────────────────────────────────────
  // Tutor Message Send Handler
  // ─────────────────────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isGenerating) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');

    const userMsg: TutorMessage = {
      id: generateId(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString().slice(0, 5)
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsGenerating(true);

    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const systemPrompt = LocalAIModelService.getTutorSystemPrompt(tutorMode, currentSubject?.name);
      
      let answerContent = '';

      if (aiConfig.apiKey && aiConfig.apiKey.trim().length > 5) {
        // Use Gemini API
        const fullPrompt = `${systemPrompt}\n\nDúvida do estudante: ${query}\n\nResponda em Português do Brasil de forma didática:`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${aiConfig.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }]
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          answerContent = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }

      if (!answerContent) {
        // Fallback to embedded heuristic academic tutor
        if (tutorMode === 'socratic') {
          answerContent = `Excelente pergunta sobre "${query}"! 🧠\n\nPara construirmos o raciocínio juntos:\n1. Qual é a fórmula ou definição fundamental que relaciona os termos dessa questão em ${currentSubject?.name || 'sua matéria'}?\n2. O que nós já temos informado no enunciado e qual é a incógnita principal?\n\nTente me responder o primeiro passo e te guiarei até a solução! ✨`;
        } else {
          answerContent = `📚 Resolução Passo a Passo:\n\n1. Identificação do Problema: ${query}\n2. Teorema Aplicado: Princípios fundamentais de ${currentSubject?.name || 'Estudos'}.\n3. Conclusão: Aplique a dedução direta substituindo os coeficientes e simplifique os termos algébricos.\n\n💡 Dica para Provas: Sempre verifique as unidades e as condições de contorno antes de entregar a folha!`;
        }
      }

      const botMsg: TutorMessage = {
        id: generateId(),
        role: 'assistant',
        content: answerContent,
        timestamp: new Date().toLocaleTimeString().slice(0, 5)
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: TutorMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Não consegui conectar à nuvem no momento (${err?.message || 'Offline'}). O motor nativo de estudos do Lumen está disponível offline!`,
        timestamp: new Date().toLocaleTimeString().slice(0, 5)
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // ─────────────────────────────────────────────────────────
  // CR & Matrix Handlers
  // ─────────────────────────────────────────────────────────
  const handleToggleSubject = async (subId: string) => {
    if (!courseData) return;
    Haptics.selectionAsync();
    const updated = CourseCRService.toggleSubjectCompletion(courseData, subId);
    setCourseData(updated);
    await CourseCRService.saveCourseProgress(updated);
  };

  const handleSaveTargetCR = async () => {
    if (!courseData) return;
    const parsed = parseFloat(targetCRInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updated = { ...courseData, targetCR: parsed };
      setCourseData(updated);
      await CourseCRService.saveCourseProgress(updated);
      Alert.alert('Meta de CR Atualizada!', `Sua meta agora é CR ${parsed.toFixed(2)}.`);
    }
  };

  const handleParseHistoryText = async () => {
    if (!historyTextInput.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = CourseCRService.parseHistoryText(historyTextInput, courseData || undefined);
    setCourseData(updated);
    await CourseCRService.saveCourseProgress(updated);
    setHistoryTextInput('');
    setShowHistoryModal(false);
    Alert.alert('Histórico Escolar Processado!', 'As disciplinas cursadas e o CR foram atualizados com sucesso.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Lumen Sub-Tabs */}
      <View style={styles.subTabBar}>
        {[
          { id: 'tutor', label: '🎓 Professor IA', icon: '🧠' },
          { id: 'cr', label: '📈 Histórico & CR', icon: '🎯' },
          { id: 'matriz', label: '🎓 % do Curso', icon: '📊' }
        ].map(tab => {
          const isSelected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.subTabItem,
                isSelected && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab.id as any);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subTabLabel,
                  {
                    color: isSelected ? colors.primary : colors.textSecondary,
                    fontWeight: isSelected ? '800' : '600'
                  }
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ───────────────────────────────────────────────────── */}
      {/* 1. ABA DO PROFESSOR IA (TUTOR SOCRÁTICO) */}
      {/* ───────────────────────────────────────────────────── */}
      {activeTab === 'tutor' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Mode & Subject Controls Header */}
          <View style={[styles.tutorHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Pedagogical Mode Toggle */}
              <View style={styles.modeToggleGroup}>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    tutorMode === 'socratic' && { backgroundColor: colors.primary }
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTutorMode('socratic');
                  }}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: tutorMode === 'socratic' ? getContrastTextColor(colors.primary) : colors.text }
                    ]}
                  >
                    🎓 Socrático
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    tutorMode === 'direct' && { backgroundColor: colors.primary }
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTutorMode('direct');
                  }}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: tutorMode === 'direct' ? getContrastTextColor(colors.primary) : colors.text }
                    ]}
                  >
                    ⚡ Resolução Direta
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Model Tier Badge */}
              <TouchableOpacity
                style={[styles.tierBadge, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                onPress={onOpenAISettings}
              >
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '700' }}>
                  {AVAILABLE_MODEL_TIERS[activeTier].formattedSize} ⚙️
                </Text>
              </TouchableOpacity>
            </View>

            {/* Subject Selector Chips */}
            {subjects.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                {subjects.map(sub => {
                  const isSelected = selectedSubjectId === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.subjectChip,
                        {
                          backgroundColor: isSelected ? (sub.color || colors.primary) : colors.surfaceSubtle,
                          borderColor: isSelected ? (sub.color || colors.primary) : colors.border
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedSubjectId(sub.id);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? '800' : '600',
                          color: isSelected ? getContrastTextColor(sub.color || colors.primary) : colors.text
                        }}
                      >
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Chat Message ScrollView */}
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubbleWrapper,
                    isUser ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isUser
                        ? { backgroundColor: colors.primary, borderBottomRightRadius: 2 }
                        : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 2 }
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        { color: isUser ? getContrastTextColor(colors.primary) : colors.text }
                      ]}
                    >
                      {msg.content}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        { color: isUser ? getContrastTextColor(colors.primary) : colors.textSecondary }
                      ]}
                    >
                      {msg.timestamp}
                    </Text>
                  </View>

                  {/* Suggested Question Chips (Only for assistant messages) */}
                  {msg.suggestedSteps && msg.suggestedSteps.length > 0 && (
                    <View style={{ marginTop: 8, width: '100%' }}>
                      {msg.suggestedSteps.map((sug, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.suggestionChip, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                          onPress={() => handleSendMessage(sug)}
                        >
                          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                            💡 {sug}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {isGenerating && (
              <View style={[styles.loadingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginLeft: 8, fontSize: 13 }}>
                  Lumen Professor está estruturando a explicação...
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Chat Input Bar */}
          <View style={[styles.inputBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder={`Perguntar ao Professor de ${currentSubject?.name || 'Lumen'}...`}
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: inputText.trim() ? colors.primary : colors.surfaceSubtle }
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || isGenerating}
            >
              <Text style={{ fontSize: 16, color: inputText.trim() ? getContrastTextColor(colors.primary) : colors.textSecondary }}>
                ➔
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ───────────────────────────────────────────────────── */}
      {/* 2. ABA DE HISTÓRICO & SIMULADOR DE CR */}
      {/* ───────────────────────────────────────────────────── */}
      {activeTab === 'cr' && (
        <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
          {/* Main CR Score Hero Card */}
          <View style={[styles.crHeroCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <Text style={[styles.crHeroLabel, { color: colors.textSecondary }]}>COEFICIENTE DE RENDIMENTO (CR ACUMULADO)</Text>
            <Text style={[styles.crHeroScore, { color: colors.primary }]}>
              {crSimulation?.currentCR.toFixed(2) || '8.00'}
            </Text>
            <Text style={[styles.crHeroSub, { color: colors.text }]}>
              Média ponderada por créditos de todas as disciplinas concluídas
            </Text>

            <TouchableOpacity
              style={[styles.importHistoryBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
              onPress={() => setShowHistoryModal(true)}
            >
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>
                📄 Importar Histórico Escolar (Texto / PDF)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Target CR Setting */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>🎯 Meta de CR Universitário</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Defina sua meta para bolsas (PIBIC/CNPq), monitoria ou intercâmbio.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <TextInput
                style={[styles.crTargetInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={targetCRInput}
                onChangeText={setTargetCRInput}
                keyboardType="numeric"
                placeholder="8.5"
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity
                style={[styles.saveTargetBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveTargetCR}
              >
                <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800', fontSize: 14 }}>
                  Salvar Meta
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* What-If Scenarios List */}
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Simulador de Cenários do Semestre</Text>
          {crSimulation?.scenarios.map((scen, idx) => (
            <View
              key={idx}
              style={[
                styles.scenarioCard,
                { backgroundColor: colors.surface, borderColor: scen.badgeColor || colors.border }
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.scenarioTitle, { color: colors.text }]}>{scen.title}</Text>
                <View style={[styles.scenarioPill, { backgroundColor: scen.badgeColor || colors.primary }]}>
                  <Text style={[styles.scenarioPillText, { color: getContrastTextColor(scen.badgeColor || colors.primary) }]}>
                    CR {scen.projectedCR.toFixed(2)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.scenarioDesc, { color: colors.textSecondary }]}>
                {scen.description}
              </Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ───────────────────────────────────────────────────── */}
      {/* 3. ABA DA MATRIZ CURRICULAR (% DO CURSO) */}
      {/* ───────────────────────────────────────────────────── */}
      {activeTab === 'matriz' && (
        <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
          {/* Degree Progress Header Card */}
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.progressPercentage, { color: colors.primary }]}>
                  {degreeProgress?.completionPercentage.toFixed(1)}%
                </Text>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  Conclusão do Curso
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.progressCredits, { color: colors.text }]}>
                  {degreeProgress?.completedCredits} / {degreeProgress?.totalRequiredCredits} Cr.
                </Text>
                <Text style={[styles.progressCount, { color: colors.textSecondary }]}>
                  {degreeProgress?.completedSubjectsCount} de {degreeProgress?.totalSubjectsCount} disciplinas
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceSubtle }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${degreeProgress?.completionPercentage || 0}%`
                  }
                ]}
              />
            </View>
          </View>

          {/* Horizontal Semester Selector Submenu */}
          <Text style={[styles.sectionHeading, { color: colors.text, marginTop: 16 }]}>Semestres da Grade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {courseData?.semesters.map(sem => {
              const isSelected = selectedSemesterNum === sem.semesterNumber;
              const completedInSem = sem.subjects.filter(s => s.isCompleted).length;
              return (
                <TouchableOpacity
                  key={sem.semesterNumber}
                  style={[
                    styles.semesterPill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedSemesterNum(sem.semesterNumber);
                  }}
                >
                  <Text
                    style={[
                      styles.semesterPillText,
                      { color: isSelected ? getContrastTextColor(colors.primary) : colors.text }
                    ]}
                  >
                    {sem.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: isSelected ? getContrastTextColor(colors.primary) : colors.textSecondary,
                      marginTop: 2
                    }}
                  >
                    {completedInSem}/{sem.subjects.length}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Subjects in Selected Semester */}
          {courseData?.semesters
            .find(s => s.semesterNumber === selectedSemesterNum)
            ?.subjects.map(sub => {
              return (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.matrixSubjectCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: sub.isCompleted ? colors.success : colors.border
                    }
                  ]}
                  onPress={() => handleToggleSubject(sub.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.matrixSubName, { color: colors.text }]}>
                      {sub.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      {sub.code && (
                        <Text style={[styles.matrixSubCode, { color: colors.textSecondary }]}>
                          {sub.code} •{' '}
                        </Text>
                      )}
                      <Text style={[styles.matrixSubCredits, { color: colors.textSecondary }]}>
                        {sub.credits} créditos ({sub.hours || sub.credits * 15}h)
                      </Text>
                    </View>
                  </View>

                  {/* Clean Confirmation Badge */}
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: sub.isCompleted ? colors.success : colors.surfaceSubtle,
                        borderColor: sub.isCompleted ? colors.success : colors.border
                      }
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: sub.isCompleted ? getContrastTextColor(colors.success) : colors.textSecondary
                      }}
                    >
                      {sub.isCompleted ? '✅ Concluída' : '⏳ Pendente'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Manual Transcript Import Modal */}
      {showHistoryModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Importar Histórico Escolar</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Cole o texto do seu histórico do portal da faculdade (SIGAA / Sophia / Portal do Aluno):
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              multiline
              numberOfLines={6}
              placeholder="Ex: MAT101 Cálculo I 80h Aprovado..."
              placeholderTextColor={colors.textSecondary}
              value={historyTextInput}
              onChangeText={setHistoryTextInput}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.modalBtnSecondary, { borderColor: colors.border }]}
                onPress={() => setShowHistoryModal(false)}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={handleParseHistoryText}
              >
                <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800' }}>Processar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: any, theme: ThemeType) =>
  StyleSheet.create({
    container: {
      flex: 1
    },
    subTabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface
    },
    subTabItem: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center'
    },
    subTabLabel: {
      fontSize: 13
    },
    // Tutor Styles
    tutorHeaderCard: {
      padding: 12,
      borderBottomWidth: 1
    },
    modeToggleGroup: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 10,
      padding: 3
    },
    modeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8
    },
    modeBtnText: {
      fontSize: 12,
      fontWeight: '700'
    },
    tierBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1
    },
    subjectChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 8,
      borderWidth: 1
    },
    chatScroll: {
      flex: 1
    },
    chatContent: {
      padding: 16,
      paddingBottom: 24
    },
    messageBubbleWrapper: {
      marginBottom: 14,
      width: '100%'
    },
    messageBubble: {
      maxWidth: '85%',
      padding: 14,
      borderRadius: 16
    },
    messageText: {
      fontSize: 14,
      lineHeight: 20
    },
    messageTime: {
      fontSize: 10,
      marginTop: 4,
      alignSelf: 'flex-end'
    },
    suggestionChip: {
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 6
    },
    loadingBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      alignSelf: 'flex-start'
    },
    inputBar: {
      flexDirection: 'row',
      padding: 10,
      borderTopWidth: 1,
      alignItems: 'center'
    },
    textInput: {
      flex: 1,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      maxHeight: 90,
      borderWidth: 1,
      fontSize: 14
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8
    },
    // CR Styles
    tabScroll: {
      flex: 1,
      padding: 16
    },
    crHeroCard: {
      padding: 20,
      borderRadius: 16,
      borderWidth: 1.5,
      alignItems: 'center',
      marginBottom: 16
    },
    crHeroLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8
    },
    crHeroScore: {
      fontSize: 48,
      fontWeight: '900',
      marginVertical: 4
    },
    crHeroSub: {
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 16
    },
    importHistoryBtn: {
      marginTop: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1
    },
    card: {
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 16
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800'
    },
    cardSubtitle: {
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16
    },
    crTargetInput: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      fontSize: 16,
      fontWeight: '700'
    },
    saveTargetBtn: {
      marginLeft: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10
    },
    sectionHeading: {
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 10
    },
    scenarioCard: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      marginBottom: 10
    },
    scenarioTitle: {
      fontSize: 14,
      fontWeight: '800'
    },
    scenarioPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12
    },
    scenarioPillText: {
      fontSize: 12,
      fontWeight: '800'
    },
    scenarioDesc: {
      fontSize: 12,
      marginTop: 6,
      lineHeight: 16
    },
    // Matrix Styles
    progressCard: {
      padding: 16,
      borderRadius: 14,
      borderWidth: 1
    },
    progressPercentage: {
      fontSize: 32,
      fontWeight: '900'
    },
    progressLabel: {
      fontSize: 12,
      fontWeight: '600'
    },
    progressCredits: {
      fontSize: 15,
      fontWeight: '800'
    },
    progressCount: {
      fontSize: 12,
      marginTop: 2
    },
    progressBarBg: {
      height: 8,
      borderRadius: 4,
      marginTop: 14,
      overflow: 'hidden'
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4
    },
    semesterPill: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginRight: 8,
      alignItems: 'center'
    },
    semesterPillText: {
      fontSize: 13,
      fontWeight: '700'
    },
    matrixSubjectCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8
    },
    matrixSubName: {
      fontSize: 14,
      fontWeight: '700'
    },
    matrixSubCode: {
      fontSize: 12,
      fontWeight: '600'
    },
    matrixSubCredits: {
      fontSize: 12
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20
    },
    modalContent: {
      width: '100%',
      borderRadius: 16,
      padding: 20,
      borderWidth: 1
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800'
    },
    modalSub: {
      fontSize: 12,
      marginTop: 4,
      lineHeight: 16
    },
    modalInput: {
      marginTop: 12,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      height: 120,
      textAlignVertical: 'top'
    },
    modalBtnSecondary: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      marginRight: 10
    },
    modalBtnPrimary: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8
    }
  });
