import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Switch
} from 'react-native';
import {
  AppEvent,
  AttendanceRecord,
  Subject,
  ThemeType,
  AIConfig,
  AIProviderMode,
  LocalAIModelInfo,
  AIParsedItem,
  AIParsingResult,
  TeamsConfig
} from '../types';
import { StorageService } from '../services/storage';
import { LocalAIModelService, DEFAULT_OFFLINE_MODEL } from '../services/LocalAIModelService';
import { LocalAIInferenceService } from '../services/LocalAIInferenceService';
import { ParsingContext } from '../services/AIParsingService';
import { GoogleSheetsService, GoogleSheetsConfig } from '../services/GoogleSheetsService';
import { TeamsService } from '../services/TeamsService';
import { SyncService } from '../services/SyncService';
import { getThemeColors, getContrastTextColor } from '../theme';
import { getLocalDateString } from '../utils';
import * as Haptics from 'expo-haptics';

export interface AIImportModalProps {
  visible: boolean;
  onClose: () => void;
  theme: ThemeType;
  events: AppEvent[];
  attendances: AttendanceRecord[];
  subjects: Subject[];
  onSyncSuccess?: (
    updatedEvents: AppEvent[],
    updatedAttendances: AttendanceRecord[],
    updatedSubjects: Subject[]
  ) => void;
}

export const AIImportModal: React.FC<AIImportModalProps> = ({
  visible,
  onClose,
  theme,
  events,
  attendances,
  subjects,
  onSyncSuccess
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  // Active Tab: 'paste' (Universal Text) | 'integrations' (Sheets/Teams) | 'manager' (Model & Keys)
  const [activeTab, setActiveTab] = useState<'paste' | 'integrations' | 'manager'>('paste');

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    mode: 'local_edge',
    apiKey: '',
    model: 'gemini-1.5-flash',
    enableFallbackToCloud: true
  });

  // Local Model Info State
  const [modelInfo, setModelInfo] = useState<LocalAIModelInfo>(DEFAULT_OFFLINE_MODEL);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytesText, setDownloadedBytesText] = useState('');

  // Paste / Universal Input State
  const [rawText, setRawText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedResult, setParsedResult] = useState<AIParsingResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Sheets & Teams State
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>({
    spreadsheetUrl: '',
    isConnected: false,
    autoSyncEnabled: true
  });
  const [isSheetsSyncing, setIsSheetsSyncing] = useState(false);

  const [teamsConfig, setTeamsConfig] = useState<TeamsConfig>({
    clientId: '',
    tenantId: 'common',
    isConnected: false
  });
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadInitialData();
    }
  }, [visible]);

  const loadInitialData = async () => {
    const savedAIConfig = await StorageService.getAIConfig();
    setAiConfig(savedAIConfig);

    const mInfo = await LocalAIModelService.checkModelStatus();
    setModelInfo(mInfo);

    const sCfg = await GoogleSheetsService.getSheetsConfig();
    if (sCfg) setSheetsConfig(sCfg);

    const tCfg = await StorageService.getTeamsConfig();
    if (tCfg) setTeamsConfig(tCfg);
  };

  // ─────────────────────────────────────────────────────────────
  // Local Model Download & Storage Lifecycle
  // ─────────────────────────────────────────────────────────────

  const handleStartDownloadModel = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // In production mobile with network or simulation, handle download
      const updated = await LocalAIModelService.startDownload((progress, downloaded, total) => {
        setDownloadProgress(progress);
        const downloadedFormatted = (downloaded / (1024 * 1024)).toFixed(0);
        const totalFormatted = (total / (1024 * 1024)).toFixed(0);
        setDownloadedBytesText(`${downloadedFormatted} MB / ${totalFormatted} MB`);
      });

      setModelInfo(updated);
      setIsDownloading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Download Concluído!', 'O modelo Google Gemma 2B (AI Edge) está pronto para uso 100% offline no seu dispositivo.');
    } catch (err: any) {
      setIsDownloading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Fallback for simulation or offline environments
      Alert.alert(
        'Modo Offline Habilitado',
        'O motor offline inteligente continuará funcionando de forma determinística no seu celular sem necessitar do download completo de 1.28 GB.'
      );
      const info = await LocalAIModelService.checkModelStatus();
      setModelInfo(info);
    }
  };

  const handleDeleteModel = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Liberar Espaço?',
      'Deseja apagar o arquivo do modelo Google Gemma do armazenamento do celular? O app continuará funcionando com o parser local ou com a nuvem.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            await LocalAIModelService.deleteModel();
            const updated = await LocalAIModelService.checkModelStatus();
            setModelInfo(updated);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Espaço Liberado', 'O arquivo do modelo foi excluído do sandbox do aplicativo.');
          }
        }
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Universal Text Analysis & Parsing
  // ─────────────────────────────────────────────────────────────

  const handleAnalyzeText = async () => {
    if (!rawText.trim()) {
      Alert.alert('Texto Vazio', 'Cole ou digite a mensagem do professor ou aviso para a IA analisar.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsAnalyzing(true);
    setParsedResult(null);

    const context: ParsingContext = {
      currentDate: getLocalDateString(),
      currentDayOfWeek: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][new Date().getDay()],
      registeredSubjects: subjects.map(s => s.name)
    };

    try {
      const result = await LocalAIInferenceService.parseUniversalInput(
        {
          rawText,
          sourceType: 'text'
        },
        aiConfig,
        context
      );

      setParsedResult(result);
      setIsAnalyzing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result.items.length === 0) {
        Alert.alert('Nenhum Evento Detectado', 'A IA não identificou nenhuma aula cancelada, prova ou trabalho nesta mensagem.');
      }
    } catch (err: any) {
      setIsAnalyzing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erro ao Analisar', err?.message || 'Falha ao processar o texto com a IA.');
    }
  };

  const handleApplyParsedItems = async () => {
    if (!parsedResult || parsedResult.items.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsApplying(true);

    try {
      const syncRes = await SyncService.processParsedItems(
        parsedResult.items,
        events,
        attendances,
        subjects
      );

      // Save updated data
      await StorageService.saveEvents(syncRes.updatedEvents);
      await StorageService.saveAttendances(syncRes.updatedAttendances);
      await StorageService.saveSubjects(syncRes.updatedSubjects);

      if (onSyncSuccess) {
        onSyncSuccess(syncRes.updatedEvents, syncRes.updatedAttendances, syncRes.updatedSubjects);
      }

      setIsApplying(false);
      setParsedResult(null);
      setRawText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const count = syncRes.syncResult.createdEvents.length + syncRes.syncResult.cancelledAttendances.length;
      Alert.alert(
        'Sucesso! 🎉',
        `${count} atualização(ões) agendada(s) com sucesso no seu calendário e frequência!`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (err: any) {
      setIsApplying(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erro ao Salvar', err?.message || 'Falha ao sincronizar com o calendário.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Sample Quick Test Templates
  // ─────────────────────────────────────────────────────────────

  const setSampleText = (type: 'cancel' | 'exam' | 'hw') => {
    Haptics.selectionAsync();
    const firstSubj = subjects.length > 0 ? subjects[0].name : 'Cálculo 1';
    const secondSubj = subjects.length > 1 ? subjects[1].name : 'Física I';

    if (type === 'cancel') {
      setRawText(`Pessoal, aviso importante: Hoje não teremos a aula de ${firstSubj} pois o professor está doente. Bom descanso a todos!`);
    } else if (type === 'exam') {
      setRawText(`Atenção turma de ${firstSubj}: A nossa Prova P2 foi remarcada para a próxima sexta-feira às 08:00. Conteúdo inclui capítulos 3 a 5.`);
    } else {
      setRawText(`Boa tarde! Segue a Lista de Exercícios 3 de ${secondSubj}. A entrega do trabalho é obrigatória até dia 28/08 às 23:59 valendo nota.`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Fechar</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>✨ Central de IA</Text>
            <Text style={styles.subtitle}>Importação & Sincronização Inteligente</Text>
          </View>
          <View style={{ width: 50 }} />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'paste' && styles.tabItemActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('paste');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'paste' && { color: colors.primary, fontWeight: '800' }]}>
              📋 Colar Aviso
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'integrations' && styles.tabItemActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('integrations');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'integrations' && { color: colors.primary, fontWeight: '800' }]}>
              🔗 Planilha & Teams
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'manager' && styles.tabItemActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('manager');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'manager' && { color: colors.primary, fontWeight: '800' }]}>
              ⚙️ Modelo & IA
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* ======================================================= */}
          {/* TAB 1: PASTE / UNIVERSAL ACADEMIC TEXT                  */}
          {/* ======================================================= */}
          {activeTab === 'paste' && (
            <View style={{ paddingBottom: 40 }}>
              <Text style={styles.sectionTitle}>Importar Mensagem ou Aviso</Text>
              <Text style={styles.sectionSubtitle}>
                Cole mensagens de grupos de WhatsApp, avisos do Classroom, e-mails ou anotações. A IA detecta matérias, cancelamentos e provas automaticamente.
              </Text>

              {/* Mode Pill Badges */}
              <View style={styles.modePillContainer}>
                <TouchableOpacity
                  style={[
                    styles.modePill,
                    aiConfig.mode === 'local_edge' && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={async () => {
                    Haptics.selectionAsync();
                    const newCfg: AIConfig = { ...aiConfig, mode: 'local_edge' };
                    setAiConfig(newCfg);
                    await StorageService.saveAIConfig(newCfg);
                  }}
                >
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: aiConfig.mode === 'local_edge' ? getContrastTextColor(colors.primary) : colors.text
                  }}>
                    🤖 IA Local (Google Edge)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modePill,
                    aiConfig.mode === 'gemini_cloud' && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={async () => {
                    Haptics.selectionAsync();
                    const newCfg: AIConfig = { ...aiConfig, mode: 'gemini_cloud' };
                    setAiConfig(newCfg);
                    await StorageService.saveAIConfig(newCfg);
                  }}
                >
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: aiConfig.mode === 'gemini_cloud' ? getContrastTextColor(colors.primary) : colors.text
                  }}>
                    ☁️ Gemini Flash (Nuvem)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modePill,
                    aiConfig.mode === 'heuristic_offline' && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={async () => {
                    Haptics.selectionAsync();
                    const newCfg: AIConfig = { ...aiConfig, mode: 'heuristic_offline' };
                    setAiConfig(newCfg);
                    await StorageService.saveAIConfig(newCfg);
                  }}
                >
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: aiConfig.mode === 'heuristic_offline' ? getContrastTextColor(colors.primary) : colors.text
                  }}>
                    ⚡ Parser Rápido
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Text Input Area */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={5}
                  value={rawText}
                  onChangeText={setRawText}
                  placeholder="Ex: Pessoal, aula de Cálculo 1 de sexta (22/08) foi cancelada. A prova P2 foi remarcada para 29/08 às 08h e a entrega do Trabalho 1 fica para 02/09."
                  placeholderTextColor={colors.textSecondary}
                  textAlignVertical="top"
                />

                {/* Quick Test Samples */}
                <View style={styles.sampleRow}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '700', marginRight: 4 }}>
                    Exemplos:
                  </Text>
                  <TouchableOpacity style={styles.sampleChip} onPress={() => setSampleText('cancel')}>
                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>🚫 Cancelamento</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sampleChip} onPress={() => setSampleText('exam')}>
                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>📝 Prova</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sampleChip} onPress={() => setSampleText('hw')}>
                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>📁 Trabalho</Text>
                  </TouchableOpacity>
                  {rawText.length > 0 && (
                    <TouchableOpacity style={[styles.sampleChip, { backgroundColor: colors.surfaceSubtle }]} onPress={() => setRawText('')}>
                      <Text style={{ fontSize: 10, color: colors.danger, fontWeight: '700' }}>Limpar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Analyze Button */}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.primary },
                  (!rawText.trim() || isAnalyzing) && { opacity: 0.6 }
                ]}
                onPress={handleAnalyzeText}
                disabled={!rawText.trim() || isAnalyzing}
                activeOpacity={0.8}
              >
                {isAnalyzing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator color={getContrastTextColor(colors.primary)} size="small" />
                    <Text style={[styles.primaryBtnText, { color: getContrastTextColor(colors.primary), marginLeft: 8 }]}>
                      Analisando com IA...
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.primaryBtnText, { color: getContrastTextColor(colors.primary) }]}>
                    ✨ Analisar Aviso com IA
                  </Text>
                )}
              </TouchableOpacity>

              {/* Parsed Result Preview */}
              {parsedResult && parsedResult.items.length > 0 && (
                <View style={[styles.previewContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>🎯 Eventos Detectados ({parsedResult.items.length})</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      Modo: {parsedResult.sourceMode === 'local_edge' ? 'IA Local' : parsedResult.sourceMode === 'gemini_cloud' ? 'Gemini Nuvem' : 'Parser Rápido'}
                    </Text>
                  </View>

                  {parsedResult.items.map((item, idx) => {
                    const isCancel = item.intent === 'cancelled_class';
                    const isExam = item.intent === 'exam';
                    const isHw = item.intent === 'homework';
                    const badgeBg = isCancel ? 'rgba(239, 68, 68, 0.12)' : isExam ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)';
                    const badgeColor = isCancel ? colors.danger : isExam ? colors.primary : colors.success;
                    const icon = isCancel ? '🚫' : isExam ? '📝' : isHw ? '📁' : '📌';

                    return (
                      <View key={idx} style={[styles.eventCard, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <View style={[styles.intentBadge, { backgroundColor: badgeBg }]}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: badgeColor }}>
                              {icon} {isCancel ? 'Aula Cancelada' : isExam ? 'Prova / Exame' : isHw ? 'Trabalho / Tarefa' : 'Aviso'}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>
                            {item.targetDate ? item.targetDate.split('-').reverse().join('/') : 'Data a definir'}
                          </Text>
                        </View>

                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 2 }}>
                          {item.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                          Matéria: <Text style={{ fontWeight: '700', color: colors.text }}>{item.subjectName}</Text> • Horário: {item.startTime} às {item.endTime}
                        </Text>
                        {item.description ? (
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' }}>
                            "{item.description}"
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={[styles.applyBtn, { backgroundColor: colors.success }]}
                    onPress={handleApplyParsedItems}
                    disabled={isApplying}
                    activeOpacity={0.8}
                  >
                    {isApplying ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                        ✅ Confirmar e Agendar no Calendário
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ======================================================= */}
          {/* TAB 2: SHEETS & TEAMS INTEGRATIONS                      */}
          {/* ======================================================= */}
          {activeTab === 'integrations' && (
            <View style={{ paddingBottom: 40 }}>
              <Text style={styles.sectionTitle}>Integrações Acadêmicas</Text>
              <Text style={styles.sectionSubtitle}>
                Conecte planilhas de turma alimentadas por Power Automate ou sincronize canais do Microsoft Teams.
              </Text>

              {/* Google Sheets Card */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, marginRight: 8 }}>📊</Text>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Google Sheets (Automático)</Text>
                      <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>
                        {sheetsConfig.autoSyncEnabled ? '✅ Sincronização Automática Ativada' : '⏸️ Sincronização Pausada'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.success }}>100% Grátis</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8, lineHeight: 16 }}>
                  O app sincroniza automaticamente os avisos da planilha publicada na inicialização e em segundo plano.
                </Text>

                <TextInput
                  style={styles.input}
                  value={sheetsConfig.spreadsheetUrl}
                  onChangeText={(val) => setSheetsConfig({ ...sheetsConfig, spreadsheetUrl: val })}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  placeholderTextColor={colors.textSecondary}
                />

                {/* Auto Sync Toggle */}
                <View style={[styles.toggleRow, { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, marginBottom: 10 }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Sincronizar ao Abrir o App</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>Detecta novas aulas canceladas e provas sem precisar clicar</Text>
                  </View>
                  <Switch
                    value={sheetsConfig.autoSyncEnabled}
                    onValueChange={async (val) => {
                      const updated = { ...sheetsConfig, autoSyncEnabled: val };
                      setSheetsConfig(updated);
                      await GoogleSheetsService.saveSheetsConfig(updated);
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    setIsSheetsSyncing(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    try {
                      const res = await GoogleSheetsService.performAutoSync(
                        events,
                        attendances,
                        subjects,
                        aiConfig
                      );

                      if (res.hasUpdates) {
                        if (onSyncSuccess) {
                          onSyncSuccess(res.updatedEvents, res.updatedAttendances, res.updatedSubjects);
                        }
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Sincronizado!', `${res.newMessagesCount} novas mensagens da planilha foram processadas e agendadas!`);
                      } else {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Tudo Atualizado!', 'A planilha foi verificada e seu calendário já está com todos os avisos mais recentes.');
                      }
                    } catch (e: any) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      Alert.alert('Erro', e?.message || 'Falha ao acessar a planilha.');
                    } finally {
                      setIsSheetsSyncing(false);
                    }
                  }}
                  disabled={isSheetsSyncing}
                >
                  {isSheetsSyncing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                      🔄 Sincronizar Agora
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Microsoft Teams Card */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 20, marginRight: 8 }}>💼</Text>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Microsoft Teams</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>Integração via Microsoft Graph API</Text>
                  </View>
                </View>

                <TextInput
                  style={styles.input}
                  value={teamsConfig.clientId}
                  onChangeText={(val) => setTeamsConfig({ ...teamsConfig, clientId: val })}
                  placeholder="Application (client) ID do Azure AD"
                  placeholderTextColor={colors.textSecondary}
                />

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border }]}
                  onPress={async () => {
                    await StorageService.saveTeamsConfig(teamsConfig);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Salvo', 'Configurações do Microsoft Teams salvas com sucesso.');
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>💾 Salvar Configurações do Teams</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ======================================================= */}
          {/* TAB 3: AI MODEL & STORAGE MANAGER                       */}
          {/* ======================================================= */}
          {activeTab === 'manager' && (
            <View style={{ paddingBottom: 40 }}>
              <Text style={styles.sectionTitle}>Gerenciador de IA & Armazenamento</Text>
              <Text style={styles.sectionSubtitle}>
                Escolha o provedor de IA e gerencie os modelos locais para funcionamento offline.
              </Text>

              {/* Local On-Device AI Model Card */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, marginRight: 8 }}>🤖</Text>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{modelInfo.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        Status: {modelInfo.downloadState === 'downloaded' ? '✅ Instalado no Sandbox' : '📦 Não baixado (0 MB)'}
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: modelInfo.downloadState === 'downloaded' ? 'rgba(16,185,129,0.15)' : colors.surfaceSubtle }
                  ]}>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: modelInfo.downloadState === 'downloaded' ? colors.success : colors.textSecondary
                    }}>
                      {modelInfo.formattedSize}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: 12 }}>
                  {modelInfo.description}
                </Text>

                {/* Storage Sandbox Notice */}
                <View style={[styles.sandboxNotice, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                    🔒 <Text style={{ fontWeight: '700', color: colors.text }}>Sandbox Seguro:</Text> Este arquivo fica armazenado na pasta privada do app. Ao desinstalar o Organiza, o sistema operacional apagará o modelo automaticamente sem deixar resíduos.
                  </Text>
                </View>

                {/* Download Progress Bar */}
                {isDownloading && (
                  <View style={{ marginBottom: 14, marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Baixando modelo...</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>
                        {downloadedBytesText || `${(downloadProgress * 100).toFixed(0)}%`}
                      </Text>
                    </View>
                    <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${Math.max(downloadProgress * 100, 5)}%` }]} />
                    </View>
                  </View>
                )}

                {/* Actions */}
                {modelInfo.downloadState !== 'downloaded' ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={handleStartDownloadModel}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                        📥 Baixar Modelo Offline ({modelInfo.formattedSize})
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', flex: 1, borderWidth: 1, borderColor: colors.danger }]}
                      onPress={handleDeleteModel}
                    >
                      <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 13 }}>
                        🗑️ Apagar Modelo e Liberar {modelInfo.formattedSize}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Google Gemini Cloud Settings Card */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 22, marginRight: 8 }}>☁️</Text>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Google Gemini 2.0 Flash (Nuvem)</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>API gratuita pessoal (1.500 req/dia grátis)</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                  Obtenha uma chave gratuita no Google AI Studio para usar o Gemini Flash sem limites:
                </Text>

                <TextInput
                  style={styles.input}
                  value={aiConfig.apiKey}
                  onChangeText={(val) => setAiConfig({ ...aiConfig, apiKey: val })}
                  placeholder="AIzaSy..."
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                      🔑 Obter chave grátis no Google AI Studio ↗
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Cloud Fallback Toggle */}
                <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Fallback Automático</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>Usar nuvem caso a IA local não esteja baixada</Text>
                  </View>
                  <Switch
                    value={aiConfig.enableFallbackToCloud}
                    onValueChange={(val) => setAiConfig({ ...aiConfig, enableFallbackToCloud: val })}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                  onPress={async () => {
                    await StorageService.saveAIConfig(aiConfig);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Salvo!', 'Configurações de IA salvas com sucesso.');
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>💾 Salvar Chave & Configurações</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 6 : 0
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1
  },
  cancelText: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface
  },
  tabItem: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabItemActive: {
    borderBottomColor: colors.primary
  },
  tabText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 14
  },
  modePillContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap'
  },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 6,
    marginBottom: 6,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14
  },
  textArea: {
    fontSize: 14,
    color: colors.text,
    minHeight: 110,
    padding: 8
  },
  sampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8
  },
  sampleChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginRight: 6,
    marginVertical: 2
  },
  primaryBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  previewContainer: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  eventCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8
  },
  intentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  applyBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    marginBottom: 10,
    backgroundColor: colors.surfaceSubtle
  },
  actionBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  sandboxNotice: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
});
